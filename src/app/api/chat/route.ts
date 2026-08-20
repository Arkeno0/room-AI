import { chatDesignerReply, compileSpec } from "@/lib/ai/gemini";
import { compilePromptSpec, localDesignerReply } from "@/lib/ai/prompts";
import { HttpError, jsonError } from "@/lib/ai/http";
import { parseChatRequest } from "@/lib/ai/validate";
import { hasGemini } from "@/lib/env";
import { checkIpLimit, getClientIp, retryAfterSeconds } from "@/lib/rate-limit";
import {
  CONCEPT_DISCLAIMER,
  type ChatJsonResponse,
  type ChatRequest,
  type ChatSseEvent,
  type ImagePromptSpec,
} from "@/lib/types";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * Resolve designer text + Flux spec. Uses Gemini when a key is present, but
 * always degrades to the local compiler so the client keeps a valid Pollinations
 * prompt even when the key is missing or Gemini errors out.
 */
async function resolveReply(payload: ChatRequest): Promise<{ text: string; spec: ImagePromptSpec }> {
  if (!hasGemini()) {
    return { text: localDesignerReply(payload), spec: compilePromptSpec(payload) };
  }

  const wantsSpec = Boolean(payload.generate);
  const [textResult, specResult] = await Promise.allSettled([
    chatDesignerReply(payload),
    wantsSpec ? compileSpec(payload) : Promise.resolve(compilePromptSpec(payload)),
  ]);

  const text =
    textResult.status === "fulfilled" && textResult.value.trim()
      ? textResult.value.trim()
      : localDesignerReply(payload);

  const spec =
    specResult.status === "fulfilled" ? specResult.value : compilePromptSpec(payload);

  if (textResult.status === "rejected") {
    console.error(
      "[chat] gemini text fallback:",
      textResult.reason instanceof Error ? textResult.reason.message : "unknown",
    );
  }

  return { text, spec };
}

export async function POST(request: Request) {
  try {
    const ip = getClientIp(request);
    if (!checkIpLimit(ip, "chat")) {
      throw new HttpError(
        429,
        "rate_limit",
        "Слишком много запросов. Подождите несколько минут.",
        retryAfterSeconds(),
      );
    }

    let json: unknown;
    try {
      json = await request.json();
    } catch {
      throw new HttpError(400, "invalid", "Некорректный JSON.");
    }

    const payload = parseChatRequest(json);
    const { text, spec } = await resolveReply(payload);

    const accept = request.headers.get("accept") ?? "";
    if (!accept.includes("text/event-stream")) {
      const body: ChatJsonResponse = {
        text,
        imagePrompt: spec.positive,
        spec,
        disclaimer: CONCEPT_DISCLAIMER,
      };
      return NextResponse.json(body);
    }

    const encoder = new TextEncoder();
    const events: ChatSseEvent[] = [{ type: "token", text }];
    if (payload.generate) {
      events.push({ type: "prompt_spec", spec });
    }
    const stream = new ReadableStream({
      start(controller) {
        for (const event of events) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        }
        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-store, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}
