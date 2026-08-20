import "server-only";

/**
 * Server-only env access. Secrets never reach the client bundle.
 * All values are optional: the app must degrade gracefully to the
 * Pollinations client path when Gemini / HF are not configured.
 */

function readEnv(name: string): string {
  return (process.env[name] ?? "").trim();
}

export const GEMINI_API_KEY = readEnv("GEMINI_API_KEY");

/** Primary vision/chat model (current stable free-tier flash). */
export const GEMINI_MODEL = readEnv("GEMINI_MODEL") || "gemini-3.5-flash";

/** Fallback used on 429 / 404 / unavailable from the primary model. */
export const GEMINI_MODEL_FALLBACK = readEnv("GEMINI_MODEL_FALLBACK") || "gemini-3.1-flash-lite";

export const HF_TOKEN = readEnv("HF_TOKEN");
// Only the free hf-inference provider serves a text-to-image model today; FLUX and
// ControlNet-depth require paid providers, so SD3-medium is the $0 default.
export const HF_IMAGE_MODEL = readEnv("HF_IMAGE_MODEL") || "stabilityai/stable-diffusion-3-medium-diffusers";

/**
 * Public SDXL ControlNet Depth, pinned to a known-working version.
 * Geometry comes from the source photo (`image`); the prompt is style-only.
 */
export const DEFAULT_REPLICATE_CONTROLNET_MODEL =
  "lucataco/sdxl-controlnet-depth:465fb41789dc2203a9d7158be11d1d2570606a039c65e0e236fd329b5eecb10c";

/** Token is read at call time so a restarted server always sees `.env.local`. */
export function getReplicateApiToken(): string {
  return (process.env.REPLICATE_API_TOKEN ?? "").trim();
}

export function getReplicateControlnetModel(): string {
  return (process.env.REPLICATE_CONTROLNET_MODEL ?? "").trim() || DEFAULT_REPLICATE_CONTROLNET_MODEL;
}

export function getReplicateControlnetFallback(): string {
  return (process.env.REPLICATE_CONTROLNET_FALLBACK ?? "").trim() || DEFAULT_REPLICATE_CONTROLNET_MODEL;
}

/** True when a Gemini key is present; otherwise routes use local fallbacks. */
export function hasGemini(): boolean {
  return GEMINI_API_KEY.length > 0;
}

export function hasHuggingFace(): boolean {
  return HF_TOKEN.length > 0;
}

export function hasReplicate(): boolean {
  return getReplicateApiToken().length > 0;
}
