import { analyzeRoom } from "@/lib/ai/gemini";
import { localRoomAnalysis } from "@/lib/ai/prompts";
import { HttpError, jsonError } from "@/lib/ai/http";
import { parseAnalyzeRequest } from "@/lib/ai/validate";
import { hasGemini } from "@/lib/env";
import { checkIpLimit, getClientIp, retryAfterSeconds } from "@/lib/rate-limit";
import { CONCEPT_DISCLAIMER, type AnalyzeResponse, type RoomAnalysis } from "@/lib/types";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

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

    const payload = parseAnalyzeRequest(json);

    const fallback = (): RoomAnalysis =>
      localRoomAnalysis({
        brief: payload.brief,
        stylePreset: payload.stylePreset,
        dimensions: payload.dimensions,
      });

    let analysis: RoomAnalysis;
    if (hasGemini()) {
      try {
        analysis = await analyzeRoom(payload);
      } catch (error) {
        // No key leak; never crash — degrade to a local analysis so the
        // Pollinations concept path keeps working.
        console.error("[analyze] gemini fallback:", error instanceof Error ? error.message : "unknown");
        analysis = fallback();
      }
    } else {
      analysis = fallback();
    }

    const body: AnalyzeResponse = { analysis, disclaimer: CONCEPT_DISCLAIMER };
    return NextResponse.json(body);
  } catch (error) {
    return jsonError(error);
  }
}
