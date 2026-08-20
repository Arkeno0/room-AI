import "server-only";

import { buildPollinationsUrl } from "@/lib/ai/pollinations";
import { CONCEPT_DISCLAIMER, type GenerateRequest, type GenerateResponse } from "@/lib/types";

/** Instant Pollinations Flux URL. No API keys, no Hugging Face, no Gemini. */
export function generateConceptImage(request: GenerateRequest): GenerateResponse {
  const imageUrl = buildPollinationsUrl(request.spec, request.spec.seed);

  return {
    imageUrl,
    provider: "pollinations",
    disclaimer: CONCEPT_DISCLAIMER,
  };
}
