import "server-only";

import Replicate from "replicate";
import { HttpError } from "@/lib/ai/http";
import { assembleFluxPrompt } from "@/lib/ai/prompts";
import {
  getReplicateApiToken,
  getReplicateControlnetFallback,
  getReplicateControlnetModel,
  hasReplicate,
} from "@/lib/env";
import type { ImagePromptSpec } from "@/lib/types";

/** Depth ControlNet strength — locks walls, ledges, pipe boxes 1:1 from the photo. */
export const CONTROLNET_CONDITIONING_SCALE = 0.75;
export const CONTROL_TYPE = "depth" as const;

const CALL_TIMEOUT_MS = 55_000;

type ReplicateModelId = `${string}/${string}` | `${string}/${string}:${string}`;

export type ReplicateGenerateInput = {
  spec: ImagePromptSpec;
  imageBase64: string;
  mimeType: string;
  signal?: AbortSignal;
  variants?: number;
};

export type ReplicateGenerateResult = {
  imageUrls: string[];
  model: string;
};

function dataUri(imageBase64: string, mimeType: string): string {
  return `data:${mimeType};base64,${imageBase64}`;
}

function unwrapOutput(output: unknown): string {
  if (typeof output === "string" && /^https?:\/\//i.test(output)) return output;
  if (Array.isArray(output) && output[0] != null) return unwrapOutput(output[0]);
  if (output && typeof output === "object") {
    const rec = output as { url?: unknown; href?: unknown };
    if (typeof rec.url === "function") {
      const href = String(rec.url());
      if (href) return href;
    }
    if (typeof rec.url === "string" && rec.url) return rec.url;
    if (typeof rec.href === "string" && rec.href) return rec.href;
  }
  throw new HttpError(502, "upstream", "Replicate вернул пустое изображение.");
}

function asModelId(value: string): ReplicateModelId {
  if (!/^[^/]+\/[^/:]+(?::[0-9a-f]+)?$/i.test(value)) {
    throw new HttpError(501, "upstream", "Некорректный идентификатор модели Replicate.");
  }
  return value as ReplicateModelId;
}

function isSdxlDepth(model: string): boolean {
  return model.includes("sdxl-controlnet-depth");
}

async function runModel(
  client: Replicate,
  model: ReplicateModelId,
  input: Record<string, unknown>,
  signal: AbortSignal,
): Promise<string> {
  const output = await client.run(model, {
    input,
    signal,
    wait: { mode: "block", timeout: Math.ceil(CALL_TIMEOUT_MS / 1000) },
  });
  return unwrapOutput(output);
}

function fluxDepthInput(
  spec: ImagePromptSpec,
  controlImage: string,
  seed: number,
): Record<string, unknown> {
  return {
    prompt: assembleFluxPrompt(spec),
    negative_prompt: spec.negative,
    control_type: CONTROL_TYPE,
    controlnet_conditioning_scale: CONTROLNET_CONDITIONING_SCALE,
    control_strength: CONTROLNET_CONDITIONING_SCALE,
    control_image: controlImage,
    output_format: "jpg",
    output_quality: 90,
    seed,
    steps: 28,
  };
}

/** lucataco/sdxl-controlnet-depth: `image` is the ControlNet photo, depth is inferred server-side. */
function sdxlDepthInput(
  spec: ImagePromptSpec,
  controlImage: string,
  seed: number,
): Record<string, unknown> {
  return {
    prompt: assembleFluxPrompt(spec),
    image: controlImage,
    condition_scale: CONTROLNET_CONDITIONING_SCALE,
    num_inference_steps: 30,
    seed,
  };
}

function inputForModel(
  model: string,
  spec: ImagePromptSpec,
  controlImage: string,
  seed: number,
): Record<string, unknown> {
  return isSdxlDepth(model)
    ? sdxlDepthInput(spec, controlImage, seed)
    : fluxDepthInput(spec, controlImage, seed);
}

/**
 * ControlNet Depth via Replicate. Geometry (walls, pipe boxes, ledges) comes
 * from the source photo; the prompt is style-only.
 */
export async function generateWithReplicate(input: ReplicateGenerateInput): Promise<ReplicateGenerateResult> {
  if (!hasReplicate()) {
    throw new HttpError(501, "upstream", "Генерация через Replicate выключена: нет REPLICATE_API_TOKEN.");
  }

  const token = getReplicateApiToken();
  const variants = Math.min(Math.max(input.variants ?? 1, 1), 2);
  const controlImage = dataUri(input.imageBase64, input.mimeType);
  const baseSeed = input.spec.seed ?? Math.floor(Math.random() * 1_000_000);
  const client = new Replicate({ auth: token });
  const primary = asModelId(getReplicateControlnetModel());
  const fallback = asModelId(getReplicateControlnetFallback());

  const controller = new AbortController();
  const onAbort = () => controller.abort();
  input.signal?.addEventListener("abort", onAbort);
  const timer = setTimeout(() => controller.abort(), CALL_TIMEOUT_MS);

  try {
    const settled = await Promise.allSettled(
      Array.from({ length: variants }, async (_, index) => {
        const seed = baseSeed + index;
        try {
          return await runModel(
            client,
            primary,
            inputForModel(primary, input.spec, controlImage, seed),
            controller.signal,
          );
        } catch (error) {
          if (controller.signal.aborted) throw error;
          if (fallback === primary) throw error;
          return runModel(
            client,
            fallback,
            inputForModel(fallback, input.spec, controlImage, seed),
            controller.signal,
          );
        }
      }),
    );
    const urls = settled.flatMap((item) => (item.status === "fulfilled" ? [item.value] : []));
    if (urls.length === 0) {
      const reason = settled.find((item) => item.status === "rejected");
      if (reason && reason.status === "rejected") throw reason.reason;
      throw new HttpError(502, "upstream", "Replicate ControlNet недоступен.");
    }
    return { imageUrls: urls, model: primary };
  } catch (error) {
    if (error instanceof HttpError) throw error;
    if (controller.signal.aborted) {
      throw new HttpError(502, "upstream", "Replicate не ответил вовремя.");
    }
    throw new HttpError(502, "upstream", "Replicate ControlNet недоступен.");
  } finally {
    clearTimeout(timer);
    input.signal?.removeEventListener("abort", onAbort);
  }
}
