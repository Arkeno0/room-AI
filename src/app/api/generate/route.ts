import { generateWithReplicate } from "@/lib/ai/replicate";
import { assembleFluxPrompt, compactObjectNames, finalizePositive } from "@/lib/ai/prompts";
import { HttpError, jsonError } from "@/lib/ai/http";
import { parseGenerateRequest } from "@/lib/ai/validate";
import { hasReplicate } from "@/lib/env";
import { checkIpLimit, getClientIp, retryAfterSeconds } from "@/lib/rate-limit";
import { CONCEPT_DISCLAIMER, type GenerateResponse } from "@/lib/types";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    if (!hasReplicate()) {
      throw new HttpError(501, "upstream", "Генерация через Replicate выключена: нет REPLICATE_API_TOKEN.");
    }

    const ip = getClientIp(request);
    if (!checkIpLimit(ip, "generate")) {
      throw new HttpError(
        429,
        "rate_limit",
        "Слишком много запросов к генератору. Подождите несколько минут.",
        retryAfterSeconds(),
      );
    }

    let json: unknown;
    try {
      json = await request.json();
    } catch {
      throw new HttpError(400, "invalid", "Некорректный JSON.");
    }

    const payload = parseGenerateRequest(json);
    if (!payload.imageBase64) {
      throw new HttpError(400, "invalid", "Нужно исходное фото комнаты для ControlNet Depth.");
    }

    const preserve = compactObjectNames(payload.spec.preserve);
    const spec = {
      ...payload.spec,
      preserve,
      positive: assembleFluxPrompt({
        positive: finalizePositive(payload.spec.positive),
        preserve,
      }),
    };

    const result = await generateWithReplicate({
      spec,
      imageBase64: payload.imageBase64,
      mimeType: payload.mimeType ?? "image/jpeg",
      signal: request.signal,
      variants: 2,
    });

    const body: GenerateResponse = {
      imageUrl: result.imageUrls[0],
      imageUrls: result.imageUrls,
      provider: "replicate",
      model: result.model,
      disclaimer: CONCEPT_DISCLAIMER,
    };

    return NextResponse.json(body);
  } catch (error) {
    return jsonError(error);
  }
}
