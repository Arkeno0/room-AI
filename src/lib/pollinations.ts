import { POSITIVE_MAX_CHARS, assembleFluxPrompt, compilePromptSpec } from "@/lib/ai/prompts";
import { ASPECT_SIZE, POLLINATIONS_MODEL, type ImagePromptSpec, type RoomAnalysis, type StylePreset } from "@/lib/types";

export const POLLINATIONS_PROMPT_BASE = "https://image.pollinations.ai/prompt";

const CYRILLIC = /[\u0400-\u04FF\u0500-\u052F]+/g;
const DOOR_TOKEN_RE = /\b(doorways?|door\s*frames?|doors?)\b/gi;
const PLACEMENT_TOKEN_RE = /\b(positions?|placements?)\b/gi;

const POSITION_PHRASE_RE =
  /\b(?:on the (?:left|right)(?:[- ]hand)?(?: side)?(?: wall)?|to the (?:left|right)(?: of)?|in the (?:center|centre|middle)(?: background)?|center background|(?:left|right) wall)\b/gi;
const CAMERA_POISON_RE =
  /\b(eye[-\s]?level|perspectives?|first[-\s]?person(?:\s+view)?|camera\s+angle)\b/gi;

export function sanitizePromptText(text: string): string {
  return text
    .replace(/https?:\/\/\S+/gi, "")
    .replace(CYRILLIC, " ")
    .replace(POSITION_PHRASE_RE, " ")
    .replace(DOOR_TOKEN_RE, " ")
    .replace(PLACEMENT_TOKEN_RE, " ")
    .replace(CAMERA_POISON_RE, " ")
    .replace(/exact(?: architectural)? element retained:?\s*/gi, " ")
    .replace(/[.\n;!?]+/g, ", ")
    .replace(/\s+/g, " ")
    .replace(/\s*,\s*/g, ", ")
    .replace(/^[,\s]+|[,\s]+$/g, "")
    .trim()
    .slice(0, POSITIVE_MAX_CHARS);
}

export function isEnglishFluxPrompt(text: string): boolean {
  return Boolean(text.trim()) && !/[\u0400-\u04FF\u0500-\u052F]/.test(text);
}

/** https://image.pollinations.ai/prompt/{prompt}?model=flux-pro */
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

  // MANDATORY: the prompt is a path segment, so it MUST be percent-encoded.
  // Without encodeURIComponent, spaces/punctuation (and any non-ASCII) break the
  // URL and Pollinations falls back to a random image.
  return `${POLLINATIONS_PROMPT_BASE}/${encodeURIComponent(englishPrompt)}?${params.toString()}`;
}

export function buildPollinationsUrl(spec: ImagePromptSpec, seed: number): string {
  const size = ASPECT_SIZE[spec.aspect] ?? ASPECT_SIZE["16:9"];
  const positive = sanitizePromptText(assembleFluxPrompt(spec));

  return buildFluxUrl(positive, {
    width: size.width,
    height: size.height,
    seed,
  });
}

export function buildConceptSeeds(spec: ImagePromptSpec): [number, number] {
  const base = spec.seed ?? Math.floor(Math.random() * 1_000_000);
  return [base, base + 1];
}

export function buildConceptSpec(input: {
  stylePreset?: StylePreset;
  stylePresets?: StylePreset[];
  excludedPresets?: StylePreset[];
  analysis?: RoomAnalysis | null;
  dimensions?: { length: string; width: string; height: string };
}): ImagePromptSpec {
  return compilePromptSpec({
    messages: [{ role: "user", content: "photoreal interior concept" }],
    analysis: input.analysis ?? null,
    stylePreset: input.stylePreset,
    stylePresets: input.stylePresets,
    excludedPresets: input.excludedPresets,
    dimensions: input.dimensions,
  });
}

export function buildConceptRenderUrls(spec: ImagePromptSpec) {
  return buildConceptSeeds(spec).map((seed) => ({
    seed,
    url: buildPollinationsUrl(spec, seed),
  }));
}
