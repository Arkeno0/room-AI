export type StudioTab = "brief" | "chat" | "gallery";

export type RoomDimensions = {
  length: string;
  width: string;
  height: string;
};

export type RoomBrief = RoomDimensions & {
  prompt: string;
  photoFile: File | null;
  photoUrl: string | null;
};

export type ChatRole = "user" | "assistant";

export type ChatAttachment = {
  type: "image";
  url: string;
  alt: string;
};

export type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: string;
  attachments?: ChatAttachment[];
};

export type GenerationStep = "analyzing" | "materials" | "rendering" | "done";

export type GenerationJob = {
  id: string;
  step: GenerationStep;
  progress: number;
  label: string;
};

export type DesignResult = {
  id: string;
  title: string;
  prompt: string;
  beforeUrl: string;
  afterUrl: string;
  createdAt: string;
  isDemo?: boolean;
};

export const STYLE_PRESETS = [
  "Хай-тек, крупноформатная плитка",
  "Скандинавский минимализм",
  "Джапанди, тёплое дерево",
  "Современная классика",
  "Лофт с кирпичом",
  "Тихая средиземноморская",
] as const;

/** API contract — docs/CONTRACTS.md */

export type StylePreset =
  | "scandinavian"
  | "japandi"
  | "mid-century"
  | "industrial"
  | "minimal"
  | "classic"
  | "boho"
  | "dark-luxury";

export const STYLE_PRESET_IDS: StylePreset[] = [
  "scandinavian",
  "japandi",
  "mid-century",
  "industrial",
  "minimal",
  "classic",
  "boho",
  "dark-luxury",
];

/** "include" — стиль идёт в positive, "exclude" — в negative. Отсутствие ключа = фильтр выключен. */
export type StyleFilterMode = "include" | "exclude";

export type StyleFilters = Partial<Record<StylePreset, StyleFilterMode>>;

/** Больше — промпт превращается в кашу и Flux теряет стиль. */
export const MAX_INCLUDED_PRESETS = 3;

export type Aspect = "16:9" | "4:3" | "1:1";

/**
 * Spatial Grid Anchor — a zone-by-zone map of the room so the generator anchors
 * each fixture to the correct wall and stops swapping zones (e.g. drawing a
 * window where the shower is). Filled from the source photo during analyze.
 */
export type SpatialLayout = {
  /** e.g. "interior view of the source room". Never mention an opening or jamb. */
  camera: string;
  /** What sits on / against the LEFT wall. */
  left: string;
  /** What sits in the CENTER background. */
  center: string;
  /** What sits on / against the RIGHT wall. */
  right: string;
  /** Floor + ceiling treatment. */
  floorCeiling: string;
};

export type RoomAnalysis = {
  roomType: string;
  viewpoint: string;
  lighting: string;
  existingFurniture: string[];
  architecturalKeep: string[];
  /**
   * Elements the user explicitly marked as untouchable — either drawn over the
   * photo (red/marker outlines, arrows, circles) or named in chat ("оставь",
   * "не меняй"). These become fixed architectural constants the generator must
   * build around, never demolish. Optional for backward compatibility.
   */
  mustKeepElements?: string[];
  /** Zone-by-zone layout (left/center/right/floor+ceiling) with camera anchor. */
  spatialLayout?: SpatialLayout;
  /**
   * Whether the source photo actually contains windows. When false, the
   * compiler force-appends a "no windows" negative anchor so the model does not
   * invent a window in the middle of a wall.
   */
  hasWindows?: boolean;
  colorPalette: string[];
  issues: string[];
  suggestedPresets: StylePreset[];
};

export type ImagePromptSpec = {
  positive: string;
  negative: string;
  stylePreset: StylePreset | "custom";
  preserve: string[];
  aspect: Aspect;
  seed?: number;
  sourceMimeHint?: string;
};

export type AnalyzeRequest = {
  imageBase64: string;
  mimeType: "image/jpeg" | "image/png" | "image/webp";
  dimensions?: RoomDimensions;
  brief?: string;
  stylePreset?: StylePreset;
};

export type AnalyzeResponse = {
  analysis: RoomAnalysis;
  disclaimer: string;
};

export type ChatRequest = {
  messages: Array<Pick<ChatMessage, "role" | "content">>;
  analysis: RoomAnalysis | null;
  imageBase64?: string;
  imageUrl?: string;
  mimeType?: AnalyzeRequest["mimeType"];
  /** Primary style, kept for backward compatibility with single-select clients. */
  stylePreset?: StylePreset;
  /** Styles the user wants blended into the concept. */
  stylePresets?: StylePreset[];
  /** Styles the user explicitly rejected; they land in the negative prompt. */
  excludedPresets?: StylePreset[];
  generate?: boolean;
  dimensions?: RoomDimensions;
};

export type ChatJsonResponse = {
  text: string;
  imagePrompt: string;
  spec: ImagePromptSpec;
  disclaimer: string;
};

export type ChatSseEvent =
  | { type: "token"; text: string }
  | { type: "prompt_spec"; spec: ImagePromptSpec }
  | { type: "error"; message: string; code: "rate_limit" | "upstream" | "invalid" };

export type ImageProvider = "pollinations" | "huggingface" | "replicate";

export type GenerateRequest = {
  spec: ImagePromptSpec;
  provider?: ImageProvider | "auto";
  prompt?: string;
  /** Source room photo (raw base64, no data: prefix) — ControlNet Depth control image. */
  imageBase64?: string;
  mimeType?: AnalyzeRequest["mimeType"];
};

export type GenerateResponse = {
  /** Replicate CDN URL, Pollinations https URL, or a `data:image/...;base64,` string. */
  imageUrl: string;
  /** Extra seeds from the same generate call. */
  imageUrls?: string[];
  provider: ImageProvider;
  disclaimer: string;
  model?: string;
  warning?: string;
};

export type ApiErrorCode = "rate_limit" | "upstream" | "invalid" | "payload_too_large";

export type ApiErrorBody = {
  error: string;
  code: ApiErrorCode;
};

export type HealthResponse = {
  ok: boolean;
  pollinations: boolean;
  gemini: boolean;
  huggingface: boolean;
  replicate: boolean;
};

export const CONCEPT_DISCLAIMER =
  "Это концепт-визуализация интерьера, а не чертёж в масштабе, не 3D-модель и не строительная документация.";

/**
 * Hardcoded Pollinations image model. Pinned to the strongest Flux tier so
 * Pollinations can't silently downgrade to a weaker default. Swap to "flux-dev"
 * here (single source of truth) if flux-pro is unavailable.
 */
export const POLLINATIONS_MODEL = "flux-pro";

export const ASPECT_SIZE: Record<Aspect, { width: number; height: number }> = {
  "16:9": { width: 1280, height: 720 },
  "4:3": { width: 1024, height: 768 },
  "1:1": { width: 1024, height: 1024 },
};
