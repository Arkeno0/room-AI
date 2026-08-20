import { POSITIVE_MAX_CHARS, assembleFluxPrompt } from "@/lib/ai/prompts";
import { ASPECT_SIZE, POLLINATIONS_MODEL, type ImagePromptSpec } from "@/lib/types";

export const POLLINATIONS_PROMPT_BASE = "https://image.pollinations.ai/prompt";

export function sanitizePromptText(text: string): string {
  return text
    .replace(/https?:\/\/\S+/gi, "")
    .replace(/\b(doorways?|door\s*frames?|doors?|eye[-\s]?level|perspectives?|on the left|on the right|in the center background)\b/gi, " ")
    .replace(/[.\n;!?]+/g, ", ")
    .replace(/\s+/g, " ")
    .replace(/\s*,\s*/g, ", ")
    .replace(/^[,\s]+|[,\s]+$/g, "")
    .trim()
    .slice(0, POSITIVE_MAX_CHARS);
}

/**
 * Canonical Flux URL: https://image.pollinations.ai/prompt/{prompt}?model=flux-pro
 * Optional seed/size are appended after the model and do not require a key.
 */
export function buildFluxUrl(
  promptText: string,
  extras?: { seed?: number; width?: number; height?: number },
): string {
  const englishPrompt = sanitizePromptText(promptText);
  // Model is pinned (not user-overridable) so Pollinations can't downgrade it.
  const params = new URLSearchParams({ model: POLLINATIONS_MODEL });

  if (typeof extras?.width === "number") params.set("width", String(extras.width));
  if (typeof extras?.height === "number") params.set("height", String(extras.height));
  if (typeof extras?.seed === "number" && Number.isFinite(extras.seed)) {
    params.set("seed", String(Math.floor(extras.seed)));
  }

  // MANDATORY: percent-encode the prompt path segment or the URL breaks and
  // Pollinations returns a random image.
  return `${POLLINATIONS_PROMPT_BASE}/${encodeURIComponent(englishPrompt)}?${params.toString()}`;
}

export function buildPollinationsUrl(spec: ImagePromptSpec, seed?: number): string {
  const size = ASPECT_SIZE[spec.aspect] ?? ASPECT_SIZE["16:9"];
  const resolvedSeed = seed ?? spec.seed;

  return buildFluxUrl(assembleFluxPrompt(spec), {
    width: size.width,
    height: size.height,
    seed: resolvedSeed,
  });
}

export function buildPollinationsVariants(spec: ImagePromptSpec, count = 2): string[] {
  const base = spec.seed ?? Math.floor(Math.random() * 1_000_000);
  return Array.from({ length: count }, (_, index) => buildPollinationsUrl(spec, base + index));
}
