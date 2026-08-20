import "server-only";

import { fetchWithTimeout } from "@/lib/ai/http";
import {
  ANALYZE_INSTRUCTION,
  COMPILE_SPEC_INSTRUCTION,
  SYSTEM_PROMPT,
  applyUserKeepFeatures,
  buildNegative,
  chatContextBlock,
  compilePromptSpec,
  filterPreserveForFeatures,
  finalizePositive,
  assembleFluxPrompt,
  lastUserText,
} from "@/lib/ai/prompts";
import { normalizePromptSpec, normalizeRoomAnalysis } from "@/lib/ai/validate";
import {
  GEMINI_API_KEY,
  GEMINI_MODEL,
  GEMINI_MODEL_FALLBACK,
  hasGemini,
} from "@/lib/env";
import type { ChatRequest, ImagePromptSpec, RoomAnalysis } from "@/lib/types";

const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const CALL_TIMEOUT_MS = 9000;

type GeminiPart = { text: string } | { inlineData: { mimeType: string; data: string } };
type GeminiContent = { role?: "user" | "model"; parts: GeminiPart[] };

type GenerateOptions = {
  contents: GeminiContent[];
  system?: string;
  temperature?: number;
  maxOutputTokens?: number;
  json?: boolean;
  signal?: AbortSignal;
};

export class GeminiError extends Error {
  readonly retryable: boolean;

  constructor(message: string, retryable: boolean) {
    super(message);
    this.name = "GeminiError";
    this.retryable = retryable;
  }
}

/** Single upstream call to one model. Throws GeminiError (retryable flag set). */
async function callModel(model: string, opts: GenerateOptions): Promise<string> {
  if (!hasGemini()) {
    throw new GeminiError("GEMINI_API_KEY отсутствует.", false);
  }

  const body = {
    contents: opts.contents,
    ...(opts.system ? { systemInstruction: { parts: [{ text: opts.system }] } } : {}),
    generationConfig: {
      temperature: opts.temperature ?? 0.7,
      maxOutputTokens: opts.maxOutputTokens ?? 2048,
      // Gemini 3.x are thinking models: left on, "thoughts" consume the entire
      // output budget and return empty/truncated text (finishReason=MAX_TOKENS).
      // These are short, deterministic interior-concept prompts, so disable it.
      thinkingConfig: { thinkingBudget: 0 },
      ...(opts.json ? { responseMimeType: "application/json" } : {}),
    },
  };

  let response: Response;
  try {
    response = await fetchWithTimeout(`${API_BASE}/${model}:generateContent`, {
      method: "POST",
      // Key travels in a header, never in the URL, so it can't leak via URL logs.
      headers: { "Content-Type": "application/json", "x-goog-api-key": GEMINI_API_KEY },
      body: JSON.stringify(body),
      timeoutMs: CALL_TIMEOUT_MS,
      signal: opts.signal,
    });
  } catch {
    // Network error / timeout — worth trying the fallback model.
    throw new GeminiError("Gemini недоступен (сеть/таймаут).", true);
  }

  if (!response.ok) {
    // 404 => primary model name retired; trying the fallback model can recover.
    const retryable = response.status === 429 || response.status === 404 || response.status >= 500;
    // Never log the response body: it may echo the prompt.
    throw new GeminiError(`Gemini ответил ${response.status}.`, retryable);
  }

  let data: unknown;
  try {
    data = await response.json();
  } catch {
    throw new GeminiError("Gemini вернул нечитаемый ответ.", true);
  }

  const text = extractText(data);
  if (!text) {
    throw new GeminiError("Gemini вернул пустой ответ.", false);
  }
  return text;
}

/** Try primary model, then fall back to the secondary model on retryable errors. */
async function generateText(opts: GenerateOptions): Promise<string> {
  try {
    return await callModel(GEMINI_MODEL, opts);
  } catch (error) {
    if (error instanceof GeminiError && error.retryable && GEMINI_MODEL_FALLBACK !== GEMINI_MODEL) {
      return callModel(GEMINI_MODEL_FALLBACK, opts);
    }
    throw error;
  }
}

function extractText(data: unknown): string {
  if (!data || typeof data !== "object") return "";
  const candidates = (data as { candidates?: unknown }).candidates;
  if (!Array.isArray(candidates) || candidates.length === 0) return "";
  const parts = (candidates[0] as { content?: { parts?: unknown } })?.content?.parts;
  if (!Array.isArray(parts)) return "";
  return parts
    .map((part) => (part && typeof part === "object" ? String((part as { text?: unknown }).text ?? "") : ""))
    .join("")
    .trim();
}

/** Pull a JSON object/array out of a model reply even if it added prose or fences. */
function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = (fenced ? fenced[1] : text).trim();
  const start = raw.search(/[[{]/);
  if (start === -1) throw new GeminiError("Gemini не вернул JSON.", false);
  const end = Math.max(raw.lastIndexOf("}"), raw.lastIndexOf("]"));
  const slice = end > start ? raw.slice(start, end + 1) : raw.slice(start);
  return JSON.parse(slice);
}

/** Vision analysis → validated RoomAnalysis. Throws on failure (caller falls back). */
export async function analyzeRoom(payload: {
  imageBase64: string;
  mimeType: string;
  brief?: string;
}): Promise<RoomAnalysis> {
  const parts: GeminiPart[] = [
    { text: ANALYZE_INSTRUCTION + (payload.brief ? `\n\nUser note: ${payload.brief}` : "") },
    { inlineData: { mimeType: payload.mimeType, data: payload.imageBase64 } },
  ];

  const text = await generateText({
    contents: [{ role: "user", parts }],
    system: SYSTEM_PROMPT,
    temperature: 0.2,
    // Bumped from 1024: the RoomAnalysis JSON now also carries the spatial grid
    // (camera/left/center/right/floor+ceiling) and must not truncate mid-JSON.
    maxOutputTokens: 1536,
    json: true,
  });

  return normalizeRoomAnalysis(extractJson(text));
}

/** Conversational designer reply in RU. Throws on failure (caller falls back). */
export async function chatDesignerReply(payload: ChatRequest): Promise<string> {
  const parts: GeminiPart[] = [{ text: chatContextBlock(payload) }];

  const contents: GeminiContent[] = payload.messages.map((message) => ({
    role: message.role === "assistant" ? "model" : "user",
    parts: [{ text: message.content }],
  }));
  contents.unshift({ role: "user", parts });

  return generateText({
    contents,
    system: SYSTEM_PROMPT,
    temperature: 0.7,
    maxOutputTokens: 2048,
  });
}

/**
 * Compile an English Flux ImagePromptSpec via Gemini.
 * Always resolves to a valid spec: on any failure it returns the local compiler
 * output so the Pollinations client path never breaks.
 */
export async function compileSpec(payload: ChatRequest): Promise<ImagePromptSpec> {
  const local = compilePromptSpec(payload);
  const analysis = applyUserKeepFeatures(payload.analysis, lastUserText(payload));
  try {
    const userBrief = lastUserText(payload);
    const compileUser = [
      COMPILE_SPEC_INSTRUCTION,
      chatContextBlock({ ...payload, analysis: analysis ?? null }),
      "User style request (may be Russian). Translate the design intent into English for Flux.",
      "Do NOT copy the original-language wording into positive. positive must be English only.",
      `Request: ${userBrief}`,
    ].join("\n\n");

    const text = await generateText({
      contents: [{ role: "user", parts: [{ text: compileUser }] }],
      system: SYSTEM_PROMPT,
      temperature: 0.4,
      maxOutputTokens: 1024,
      json: true,
    });
    const spec = normalizePromptSpec(extractJson(text), local);
    // Gemini often drops the rejected styles, so re-apply them server-side.
    // Re-run the IF/ELSE compiler pass so a hallucinated pipe-box cannot stick.
    return {
      ...spec,
      positive: assembleFluxPrompt({
        positive: finalizePositive(spec.positive, analysis ?? null),
        preserve: filterPreserveForFeatures(spec.preserve, analysis ?? null),
      }),
      preserve: filterPreserveForFeatures(spec.preserve, analysis ?? null),
      negative: buildNegative(payload.excludedPresets, spec.negative),
    };
  } catch {
    return local;
  }
}
