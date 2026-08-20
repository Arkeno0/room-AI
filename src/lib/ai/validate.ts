import "server-only";

import { HttpError } from "@/lib/ai/http";
import {
  INTERIOR_VIEW,
  compactObjectNames,
  finalizePositive,
  sanitizePromptTag,
  sanitizeTagList,
} from "@/lib/ai/prompts";
import {
  MAX_INCLUDED_PRESETS,
  STYLE_PRESET_IDS,
  type AnalyzeRequest,
  type Aspect,
  type ChatRequest,
  type GenerateRequest,
  type ImagePromptSpec,
  type RoomAnalysis,
  type SpatialLayout,
  type StylePreset,
} from "@/lib/types";

export const ALLOWED_MIME = new Set<string>(["image/jpeg", "image/png", "image/webp"]);
export const MAX_DECODED_BYTES = 4 * 1024 * 1024;
const MAX_BRIEF = 2000;
const MAX_MESSAGES = 16;

export function stripDataUrl(value: string): string {
  const trimmed = value.trim();
  const comma = trimmed.indexOf(",");
  if (trimmed.startsWith("data:") && comma !== -1) {
    return trimmed.slice(comma + 1).replace(/\s/g, "");
  }
  return trimmed.replace(/\s/g, "");
}

export function decodedBase64Bytes(base64: string): number {
  const clean = stripDataUrl(base64);
  const padding = clean.endsWith("==") ? 2 : clean.endsWith("=") ? 1 : 0;
  return Math.max(0, Math.floor((clean.length * 3) / 4) - padding);
}

export function assertImagePayload(imageBase64: unknown, mimeType: unknown): {
  imageBase64: string;
  mimeType: AnalyzeRequest["mimeType"];
} {
  if (typeof mimeType !== "string" || !ALLOWED_MIME.has(mimeType)) {
    throw new HttpError(400, "invalid", "Допустимы только image/jpeg, image/png или image/webp.");
  }
  if (typeof imageBase64 !== "string" || imageBase64.trim().length < 32) {
    throw new HttpError(400, "invalid", "Не передано изображение.");
  }

  const cleaned = stripDataUrl(imageBase64);
  if (!/^[A-Za-z0-9+/]+=*$/.test(cleaned)) {
    throw new HttpError(400, "invalid", "Изображение должно быть в base64.");
  }

  if (decodedBase64Bytes(cleaned) > MAX_DECODED_BYTES) {
    throw new HttpError(413, "payload_too_large", "Фото больше 4 МБ после декодирования. Сожмите его на клиенте.");
  }

  return { imageBase64: cleaned, mimeType: mimeType as AnalyzeRequest["mimeType"] };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function asStringArray(value: unknown, fallback: string[] = []): string[] {
  if (!Array.isArray(value)) return fallback;
  return sanitizeTagList(value.map((item) => String(item))).slice(0, 16);
}

export function isStylePreset(value: unknown): value is StylePreset {
  return typeof value === "string" && (STYLE_PRESET_IDS as string[]).includes(value);
}

function parseStylePresets(value: unknown): StylePreset[] {
  if (!Array.isArray(value)) return ["minimal"];
  const presets = value.filter(isStylePreset);
  return presets.length > 0 ? presets.slice(0, 4) : ["minimal"];
}

/** Dedupes and caps a user-supplied list of style filters. */
function parsePresetList(value: unknown, limit: number): StylePreset[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter(isStylePreset))].slice(0, limit);
}

const MAX_ZONE = 240;

function asZone(value: unknown): string {
  return sanitizePromptTag(String(value ?? "")).slice(0, MAX_ZONE);
}

/**
 * Parse the Spatial Grid Anchor. Returns undefined when no zone info is present
 * so the compiler falls back to the furniture-first layout instead of emitting
 * empty anchors.
 */
function parseSpatialLayout(value: unknown): SpatialLayout | undefined {
  if (!isRecord(value)) return undefined;
  const layout: SpatialLayout = {
    camera: INTERIOR_VIEW,
    left: asZone(value.left),
    center: asZone(value.center),
    right: asZone(value.right),
    floorCeiling: asZone(value.floorCeiling),
  };
  const hasAny = Object.values(layout).some(Boolean);
  return hasAny ? layout : undefined;
}

export function isRoomAnalysis(value: unknown): value is RoomAnalysis {
  if (!isRecord(value)) return false;
  return (
    typeof value.roomType === "string" &&
    typeof value.viewpoint === "string" &&
    typeof value.lighting === "string" &&
    Array.isArray(value.existingFurniture) &&
    Array.isArray(value.architecturalKeep) &&
    Array.isArray(value.colorPalette) &&
    Array.isArray(value.issues) &&
    Array.isArray(value.suggestedPresets)
  );
}

export function normalizeRoomAnalysis(value: unknown): RoomAnalysis {
  if (!isRecord(value)) {
    throw new HttpError(502, "upstream", "Gemini вернул пустой анализ комнаты.");
  }

  const mustKeepElements = asStringArray(value.mustKeepElements);
  // Every must-keep element (annotation-detected or user-named) also belongs in
  // architecturalKeep so it flows into preserve[] even if the model forgot to
  // duplicate it.
  const architecturalKeep = Array.from(
    new Set([
      ...asStringArray(value.architecturalKeep, ["windows", "walls", "ceiling"]),
      ...mustKeepElements,
    ]),
  ).slice(0, 16);

  const spatialLayout = parseSpatialLayout(value.spatialLayout);
  const hasWindows = typeof value.hasWindows === "boolean" ? value.hasWindows : undefined;

  const analysis: RoomAnalysis = {
    roomType: sanitizePromptTag(String(value.roomType ?? "").trim()) || "interior",
    viewpoint: sanitizePromptTag(String(value.viewpoint ?? "").trim()) || INTERIOR_VIEW,
    lighting: String(value.lighting ?? "").trim() || "mixed natural light",
    existingFurniture: asStringArray(value.existingFurniture),
    architecturalKeep,
    mustKeepElements,
    ...(spatialLayout ? { spatialLayout } : {}),
    ...(hasWindows === undefined ? {} : { hasWindows }),
    colorPalette: asStringArray(value.colorPalette),
    issues: asStringArray(value.issues),
    suggestedPresets: parseStylePresets(value.suggestedPresets),
  };

  if (!isRoomAnalysis(analysis)) {
    throw new HttpError(502, "upstream", "Не удалось разобрать анализ комнаты.");
  }

  return analysis;
}

export function parseAnalyzeRequest(body: unknown): AnalyzeRequest {
  if (!isRecord(body)) {
    throw new HttpError(400, "invalid", "Ожидался JSON с фото комнаты.");
  }

  const image = assertImagePayload(body.imageBase64, body.mimeType);
  const brief = typeof body.brief === "string" ? body.brief.trim().slice(0, MAX_BRIEF) : undefined;
  const stylePreset = isStylePreset(body.stylePreset) ? body.stylePreset : undefined;

  let dimensions: AnalyzeRequest["dimensions"];
  if (isRecord(body.dimensions)) {
    dimensions = {
      length: String(body.dimensions.length ?? "").trim(),
      width: String(body.dimensions.width ?? "").trim(),
      height: String(body.dimensions.height ?? "").trim(),
    };
  }

  return { ...image, brief, stylePreset, dimensions };
}

export function parseChatRequest(body: unknown): ChatRequest {
  if (!isRecord(body)) {
    throw new HttpError(400, "invalid", "Ожидался JSON чата.");
  }

  const single =
    (typeof body.message === "string" && body.message.trim()) ||
    (typeof body.prompt === "string" && body.prompt.trim()) ||
    (typeof body.text === "string" && body.text.trim()) ||
    "";

  const fromArray = Array.isArray(body.messages)
    ? body.messages
        .map((item) => {
          if (!isRecord(item)) return null;
          if (item.role !== "user" && item.role !== "assistant") return null;
          if (typeof item.content !== "string" || !item.content.trim()) return null;
          return { role: item.role, content: item.content.trim().slice(0, 4000) };
        })
        .filter((item): item is ChatRequest["messages"][number] => Boolean(item))
    : [];

  const messages = (fromArray.length > 0 ? fromArray : single ? [{ role: "user" as const, content: single.slice(0, 4000) }] : []).slice(
    -MAX_MESSAGES,
  );

  if (messages.length === 0) {
    throw new HttpError(400, "invalid", "Нужен текстовый запрос (message) или массив messages.");
  }

  const generate = Boolean(body.generate);
  const analysis = body.analysis == null ? null : normalizeRoomAnalysis(body.analysis);

  let dimensions: ChatRequest["dimensions"];
  if (isRecord(body.dimensions)) {
    dimensions = {
      length: String(body.dimensions.length ?? "").trim(),
      width: String(body.dimensions.width ?? "").trim(),
      height: String(body.dimensions.height ?? "").trim(),
    };
  }

  const stylePresets = parsePresetList(body.stylePresets, MAX_INCLUDED_PRESETS);
  const excludedPresets = parsePresetList(body.excludedPresets, STYLE_PRESET_IDS.length).filter(
    (preset) => !stylePresets.includes(preset),
  );
  const stylePreset = isStylePreset(body.stylePreset) ? body.stylePreset : stylePresets[0];

  const request: ChatRequest = {
    messages,
    analysis,
    generate,
    dimensions,
    stylePreset,
    stylePresets: stylePresets.length > 0 ? stylePresets : stylePreset ? [stylePreset] : [],
    excludedPresets,
  };

  if (typeof body.imageUrl === "string" && body.imageUrl.trim()) {
    request.imageUrl = body.imageUrl.trim();
  }

  if (typeof body.imageBase64 === "string" && body.imageBase64.trim()) {
    const image = assertImagePayload(body.imageBase64, body.mimeType ?? "image/jpeg");
    request.imageBase64 = image.imageBase64;
    request.mimeType = image.mimeType;
  }

  return request;
}

function isAspect(value: unknown): value is Aspect {
  return value === "16:9" || value === "4:3" || value === "1:1";
}

export function normalizePromptSpec(value: unknown, fallback: Partial<ImagePromptSpec> = {}): ImagePromptSpec {
  if (!isRecord(value)) {
    throw new HttpError(502, "upstream", "Не удалось собрать промпт для генератора картинок.");
  }

  const stylePreset =
    value.stylePreset === "custom" || isStylePreset(value.stylePreset)
      ? value.stylePreset
      : fallback.stylePreset ?? "custom";

  const spec: ImagePromptSpec = {
    positive: finalizePositive(String(value.positive ?? fallback.positive ?? "")),
    negative: sanitizePromptTag(String(value.negative ?? fallback.negative ?? "").trim()),
    stylePreset,
    preserve: compactObjectNames(asStringArray(value.preserve, fallback.preserve)),
    aspect: isAspect(value.aspect) ? value.aspect : fallback.aspect ?? "16:9",
    seed: typeof value.seed === "number" && Number.isFinite(value.seed) ? Math.floor(value.seed) : fallback.seed,
    sourceMimeHint:
      typeof value.sourceMimeHint === "string" ? value.sourceMimeHint : fallback.sourceMimeHint,
  };

  if (!spec.positive) {
    throw new HttpError(400, "invalid", "Нужен текстовый промпт для Pollinations.");
  }

  return spec;
}

export function parseGenerateRequest(body: unknown): GenerateRequest {
  if (!isRecord(body)) {
    throw new HttpError(400, "invalid", "Ожидался JSON с ImagePromptSpec или prompt.");
  }

  let spec: ImagePromptSpec;
  if (isRecord(body.spec)) {
    spec = normalizePromptSpec(body.spec);
  } else if (typeof body.prompt === "string" && body.prompt.trim()) {
    spec = normalizePromptSpec({
      positive: body.prompt.trim(),
      negative: "text, watermark, blueprint, floor plan, distorted architecture, extra windows, deformed furniture",
      stylePreset: "custom",
      preserve: [],
      aspect: "16:9",
    });
  } else {
    throw new HttpError(400, "invalid", "Нужен spec или prompt для генерации.");
  }

  const provider =
    body.provider === "huggingface"
      ? "huggingface"
      : body.provider === "pollinations"
        ? "pollinations"
        : body.provider === "auto"
          ? "auto"
          : "replicate";

  const request: GenerateRequest = {
    spec,
    provider,
    prompt: typeof body.prompt === "string" ? body.prompt.trim() : undefined,
  };

  if (typeof body.imageBase64 === "string" && body.imageBase64.trim()) {
    const image = assertImagePayload(body.imageBase64, body.mimeType ?? "image/jpeg");
    request.imageBase64 = image.imageBase64;
    request.mimeType = image.mimeType;
  }

  return request;
}
