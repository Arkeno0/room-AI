import "server-only";

import { HttpError, fetchWithTimeout, sleep } from "@/lib/ai/http";
import { assembleFluxPrompt } from "@/lib/ai/prompts";
import { HF_IMAGE_MODEL, HF_TOKEN, hasHuggingFace } from "@/lib/env";
import { type Aspect, type ImagePromptSpec } from "@/lib/types";

/**
 * The classic api-inference.huggingface.co endpoint was retired; requests now go
 * through the Inference Providers router. Only the free `hf-inference` provider is
 * used here to honor the project's $0 rule.
 */
const HF_ROUTER_BASE = "https://router.huggingface.co/hf-inference/models";

/**
 * Abort budget for the upstream call. Sized for SD cold starts (~15-20s) since we
 * pass wait_for_model; kept under the route's maxDuration. On abort the route
 * returns 502 and the client falls back to the Pollinations URL path.
 */
export const HF_TIMEOUT_MS = 50_000;

/**
 * The free hf-inference provider currently exposes no image-to-image / ControlNet
 * model, so generation is text-to-image. Geometry is preserved through the prompt
 * (viewpoint + architectural keep-list compiled by Gemini), not by conditioning on
 * the source photo.
 */
const HF_SIZE: Record<Aspect, { width: number; height: number }> = {
  // SD-friendly dimensions (multiples of 64).
  "16:9": { width: 1024, height: 576 },
  "4:3": { width: 1024, height: 768 },
  "1:1": { width: 1024, height: 1024 },
};

export type HfGenerateInput = {
  spec: ImagePromptSpec;
  /** Override HF_IMAGE_MODEL if needed. */
  model?: string;
  signal?: AbortSignal;
};

export type HfGenerateResult = {
  dataUrl: string;
  model: string;
};

function buildPrompt(spec: ImagePromptSpec): string {
  return assembleFluxPrompt(spec);
}

/**
 * Text-to-image via the HF Inference router (free hf-inference provider).
 *
 * Throws HttpError(501) when HF_TOKEN is missing and HttpError(502) on any upstream
 * failure/timeout, so the client can fall back to the Pollinations URL path.
 */
export async function generateWithHuggingFace(input: HfGenerateInput): Promise<HfGenerateResult> {
  if (!hasHuggingFace()) {
    throw new HttpError(501, "upstream", "Hugging Face не настроен: отсутствует HF_TOKEN.");
  }

  const model = (input.model || HF_IMAGE_MODEL).trim();
  const size = HF_SIZE[input.spec.aspect] ?? HF_SIZE["16:9"];
  const body = JSON.stringify({
    inputs: buildPrompt(input.spec),
    parameters: {
      negative_prompt: input.spec.negative.trim() || undefined,
      width: size.width,
      height: size.height,
    },
    options: { wait_for_model: true },
  });

  // One retry if the model is still warming up (503).
  let response = await callHf(model, body, input.signal);
  if (response.status === 503) {
    await sleep(1500);
    response = await callHf(model, body, input.signal);
  }

  const contentType = response.headers.get("content-type") ?? "";

  if (!response.ok || contentType.includes("application/json")) {
    // Errors come back as JSON; never surface the token or the raw prompt upstream.
    let detail = `Hugging Face ответил ${response.status}.`;
    try {
      const data = (await response.json()) as { error?: unknown };
      if (data?.error) detail = `Hugging Face: ${String(data.error).slice(0, 200)}`;
    } catch {
      /* ignore parse errors */
    }
    throw new HttpError(502, "upstream", detail);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.byteLength === 0) {
    throw new HttpError(502, "upstream", "Hugging Face вернул пустое изображение.");
  }

  const outMime = contentType.startsWith("image/") ? contentType.split(";")[0] : "image/png";
  return {
    dataUrl: `data:${outMime};base64,${buffer.toString("base64")}`,
    model,
  };
}

async function callHf(model: string, body: string, signal?: AbortSignal): Promise<Response> {
  try {
    return await fetchWithTimeout(`${HF_ROUTER_BASE}/${model}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${HF_TOKEN}`,
        "Content-Type": "application/json",
        Accept: "image/png",
      },
      body,
      timeoutMs: HF_TIMEOUT_MS,
      signal,
    });
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(502, "upstream", "Hugging Face недоступен (сеть/таймаут).");
  }
}
