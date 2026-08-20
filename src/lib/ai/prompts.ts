import type { ChatRequest, ImagePromptSpec, RoomAnalysis, RoomDimensions, SpatialLayout, StylePreset } from "@/lib/types";
import { CONCEPT_DISCLAIMER, MAX_INCLUDED_PRESETS } from "@/lib/types";

export { CONCEPT_DISCLAIMER };

const REQUIRED_NEGATIVE =
  "text, watermark, blueprint, floor plan, CAD drawing, distorted architecture, extra windows, deformed furniture, dimension arrows";

/**
 * Core rule for building the image prompt. The generator receives whatever lands
 * in `positive`, so it MUST be detailed English that FILLS the scene. Empty/weak
 * prompts (or Russian text, or negation words) produce bare, off-brief rooms.
 */
export const IMAGE_PROMPT_RULE = [
  "Переводи любой пользовательский запрос в английский промпт для генерации изображений.",
  "Геометрия комнаты (стены, короб под трубы, ступеньки, ниши) берётся с карты глубины ControlNet. НЕ описывай расположение.",
  "КАТЕГОРИЧЕСКИ запрещены фразы: on the left, on the right, in the center background, left wall, right wall, doorway, door frame, eye level, perspective, placement, position.",
  "Gemini пишет ТОЛЬКО стилистику: тип комнаты, отделка, цвета, стиль, светильники, характер мебели.",
  "Формула: [Style + Scale/Room] + [Fixture names] + [Materials] + [Style] + [Lighting] + [Quality].",
  "Пример: Modern compact bathroom, dark grey tiles, dark luxury style, floating vanity, wall-mounted toilet, warm indirect lighting, archviz, photorealistic 8k.",
  "Не копируй keepTags в positive. Не выдумывай короб/ступеньку, если их нет — глубинный контроль уже держит геометрию.",
].join(" ");

/** Quality tail of every compiled positive prompt. */
export const RENDER_QUALITY_TAIL = "archviz, photorealistic 8k render";

/** Cap so the spatial grid fits without the old 1500-char water. */
export const POSITIVE_MAX_CHARS = 400;
export const POSITIVE_MIN_CHARS = 80;

/** Constructive terms — only if the photo actually has the feature. */
export const INSTALL_LEDGE = "tiled installation ledge";
export const CONSOLE_WALL = INSTALL_LEDGE;
export const BOX_LEDGE = "architectural box ledge";
export const WALL_NICHE = "wall niche";
export const FLAT_WALL = "clean flat wall";
export const TOILET_WITH_LEDGE = "toilet with tiled installation ledge";

export const LEDGE_KEYWORDS = [CONSOLE_WALL, BOX_LEDGE, WALL_NICHE] as const;

/** @deprecated alias — kept so older chips still compact to a real term. */
export const TILED_STEP_LEDGE = CONSOLE_WALL;
export const TILED_STEP_CHIP = BOX_LEDGE;

/** Russian trigger words that mean "keep this element, do not change it". */
const KEEP_COMMAND_RE =
  /\b(остав(ь|ить|им|ляем)?|сохран(и|ить|яем|ять)?|не\s+мен(я|яй|ять)|не\s+трога(й|ть)|не\s+убира(й|ть)|не\s+снос(и|ить)|не\s+удал(яй|ять|яем))\b/i;

export function hasKeepCommand(text: string): boolean {
  return KEEP_COMMAND_RE.test(text);
}

/**
 * Must-keep elements become simple object names in the prompt and chips.
 * Never emit the old service prefix — Flux treats it as noise and drops the box.
 */
export function retainedClauses(elements: string[]): string[] {
  return compactObjectNames(elements);
}

/**
 * True only for explicit architectural extras on the photo.
 * Do NOT match generic words like "step" or "box" alone — that hallucinates a pipe chase.
 */
export function isArchitecturalFeature(value: string): boolean {
  return /\b(half-height|installation console|console wall|box ledge|wall niche|pipe(?:s)?\s*(?:box|chase|cover)|boxed-in|architectural (?:box|ledge)|tiled (?:box|ledge|step)|короб(?:а|ом|е)?|короб.{0,24}труб|труб.{0,24}короб|подиум|ступеньк|выступ|ниш[аиеу]?|балка|колонн|alcove|beam|column|pillar|несущ)\b/i.test(
    value,
  );
}

export function isTiledStep(value: string): boolean {
  return /\b(ступеньк|подиум|выступ|tiled (?:box|ledge|step)|box ledge|console wall|half-height|pipe(?:s)?\s*(?:box|chase)|короб.{0,24}труб|труб.{0,24}короб)\b/i.test(
    value,
  );
}

export function isBoxedStructure(value: string): boolean {
  return isTiledStep(value) || /\b(короб|pipe(?:s)?\s*(?:box|chase)|console wall|boxed-in)\b/i.test(value);
}

export function isStructuralColumn(value: string): boolean {
  return /\b(column|колон|pillar|пилон|балка|beam|несущ)/i.test(value);
}

export function isWallNiche(value: string): boolean {
  return /\b(niche|alcove|ниш[аиеу]?)\b/i.test(value);
}

export function isArchitecturalConstraint(value: string): boolean {
  return isArchitecturalFeature(value);
}

/** Map a detected feature to a constructive term. Empty string if none. */
export function constraintKeyword(value: string): string {
  if (!isArchitecturalFeature(value)) return "";
  if (isWallNiche(value)) return WALL_NICHE;
  if (isTiledStep(value) || isBoxedStructure(value)) return CONSOLE_WALL;
  if (isStructuralColumn(value)) return BOX_LEDGE;
  return BOX_LEDGE;
}

/**
 * Bag of Words — Flux ignores left/right anchors and paints doors instead.
 * `positive` is a flat object list, never a spatial grid.
 */
export const BAG_OF_WORDS_FORMULA =
  "[Style + Scale/Room] + [Fixture names] + [Materials] + [Style] + [Lighting] + [Quality]";
/** @deprecated alias — spatial left/right anchors confuse Flux. */
export const SPATIAL_GRID_FORMULA = BAG_OF_WORDS_FORMULA;

/**
 * Negative anchor that is force-appended whenever the source room has no
 * windows, so the model does not paint a window into the middle of a wall.
 * "no windows" is a negation → it belongs in the negative field; the positive
 * side gets the layout-lock phrase instead.
 */
export const NO_WINDOW_NEGATIVE = "windows, window on wall, extra window, glass window";
export const LAYOUT_LOCK_POSITIVE =
  "exact room layout preserved, every fixture stays in its original zone, no zones swapped";

/**
 * Object names from a SpatialLayout — no left/right/center anchors.
 */
export function spatialGridClauses(
  layout?: SpatialLayout,
  _opts: { includeCamera?: boolean } = {},
): string[] {
  if (!layout) return [];
  return compactObjectNames([layout.left, layout.center, layout.right, layout.floorCeiling]);
}

/** True when the source photo is known to have no windows. */
export function roomHasNoWindows(analysis?: RoomAnalysis | null): boolean {
  return analysis?.hasWindows === false;
}

/**
 * Safe camera phrase. Naming a threshold / jamb / opening makes Flux draw a
 * corridor instead of the bathroom, so the view is described without that.
 */
export const INTERIOR_VIEW = "interior view of the source room";

/**
 * Forced fixture opener. The generator must see toilet / shower / washbasin
 * FIRST or it fills the frame with hallways.
 */
/** Fallback opener when analysis has no zones yet. */
export const BATHROOM_FIXTURE_LEAD =
  "Modern compact bathroom, dark grey tiles, dark luxury style, floating vanity, wall-mounted toilet, warm indirect lighting, archviz, photorealistic 8k";

/** Applied to small/compact rooms so Flux doesn't render a cavernous hall. */
export const OVERSIZE_NEGATIVE = "huge room, large open space, spacious hall, corridor, hallway, lobby";

const DOOR_TOKEN_RE = /\b(doorways?|door\s*frames?|doors?)\b/gi;
const PLACEMENT_TOKEN_RE = /\b(positions?|placements?)\b/gi;
/** These tokens make Flux paint a door / corridor in the middle of the room. */
const POSITION_PHRASE_RE =
  /\b(?:on the (?:left|right)(?:[- ]hand)?(?: side)?(?: wall)?|to the (?:left|right)(?: of)?|in the (?:center|centre|middle)(?: background)?|center background|(?:left|right) wall)\b/gi;
const CAMERA_POISON_RE =
  /\b(eye[-\s]?level|perspectives?|first[-\s]?person(?:\s+view)?|camera\s+angle|looking through)\b/gi;
const SERVICE_PHRASE_RE =
  /exact(?: architectural)? element retained:?\s*|retaining the original(?: structure and exact geometry of)?\s*|build the new design around[^,]*|do not demolish[^,]*|keep existing architecture:?\s*|exact room layout preserved[^,]*|every fixture stays in its original zone[^,]*|same (?:room )?geometry(?: and proportions)? as source photo|same (?:camera angle|interior view) as source photo|interior view of (?:the source room|a [^,]+)/gi;

/**
 * Strip tokens that poison Flux: opening/jamb vocabulary, empty
 * "position"/"placement" suffixes, and long keep-service phrases.
 * Chip labels become simple object names ("tiled step ledge").
 */
export function sanitizePromptTag(value: string): string {
  return value
    .replace(POSITION_PHRASE_RE, " ")
    .replace(DOOR_TOKEN_RE, " ")
    .replace(PLACEMENT_TOKEN_RE, " ")
    .replace(CAMERA_POISON_RE, " ")
    .replace(SERVICE_PHRASE_RE, " ")
    .replace(/[.\n;]+/g, ", ")
    .replace(/\s+/g, " ")
    .replace(/\s*,\s*/g, ", ")
    .replace(/^[,\s]+|[,\s]+$/g, "")
    .replace(/,(?:\s*,)+/g, ",")
    .trim();
}

export function sanitizeTagList(values: string[] | undefined): string[] {
  return compactObjectNames(values);
}

/** Collapse a keep-chip / Gemini dump into a short object name. */
export function compactObjectName(value: string): string {
  const text = sanitizePromptTag(value);
  if (!text) return "";
  if (/^(walls?|ceiling|windows?|floor|architecture)$/i.test(text)) return "";
  if (text.toLowerCase() === FLAT_WALL) return "";
  if (/^[a-z0-9\s-]+$/i.test(text) && tagWords(text).length === 0) return "";
  const lower = text.toLowerCase();
  const hasFixture = /\b(toilet|shower|bed|sofa|sink|wardrobe|desk|table|cabin|vanity)\b/i.test(text);
  // A keep-chip that is ONLY a box/niche collapses to the constructive term.
  // A sentence that already names a fixture must keep the fixture.
  if (!hasFixture) {
    const keyword = constraintKeyword(lower);
    if (keyword) return keyword;
  }
  if (/\bshower\b/.test(lower) && !isArchitecturalFeature(lower)) return "glass shower enclosure";
  if (/\b(sink|vanity|washbasin)\b/.test(lower) && text.split(/\s+/).length <= 4) return "floating vanity";
  if (/\btoilet\b/.test(lower) && text.split(/\s+/).length <= 4) return "wall-mounted toilet";
  const words = text.split(/\s+/);
  return words.length > 10 ? words.slice(0, 8).join(" ") : text;
}

export function compactObjectNames(values: string[] | undefined): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of values ?? []) {
    const clean = compactObjectName(item);
    const key = clean.toLowerCase();
    if (!clean || seen.has(key)) continue;
    seen.add(key);
    out.push(clean);
  }
  return out;
}

const TAG_STOPWORDS = new Set([
  "a",
  "an",
  "the",
  "on",
  "in",
  "of",
  "and",
  "with",
  "at",
  "to",
  "from",
  "for",
  "into",
  "onto",
  "over",
  "under",
]);

function splitClauses(text: string): string[] {
  return text
    .split(",")
    .map((part) => part.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function isQualityClause(part: string): boolean {
  return /^(archviz|photorealistic(?:\s+\d+k)?(?:\s+render)?|\d+k(?:\s+render)?|no windows)$/i.test(part);
}

function tagWords(tag: string): string[] {
  return tag
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length >= 3 && !TAG_STOPWORDS.has(word));
}

/** True when this keep-tag's object is already named in the style prompt. */
export function promptContainsTag(promptStyle: string, tag: string): boolean {
  const needle = sanitizePromptTag(tag).toLowerCase();
  if (!needle) return true;
  const hay = promptStyle.toLowerCase();
  if (hay.includes(needle)) return true;
  const words = tagWords(needle);
  if (words.length === 0) return hay.includes(needle);
  return words.every((word) => new RegExp(`\\b${escapeRegExp(word)}\\b`, "i").test(hay));
}

/**
 * Append keep-tags only when the object is NOT already in promptStyle.
 * Inserted before quality tags so the grid stays:
 * room + left + center + right + materials/style + (missing keep) + quality.
 */
export function mergeKeepTagsIfMissing(promptStyle: string, _keepTags?: string[]): string {
  return promptStyle;
}

function dedupePromptClauses(text: string): string {
  const kept: string[] = [];
  const seen = new Set<string>();
  for (const part of splitClauses(text)) {
    const key = part.toLowerCase();
    if (seen.has(key)) continue;
    const words = tagWords(key);
    const blob = kept.join(" ").toLowerCase();
    if (words.length > 0 && blob && words.every((word) => new RegExp(`\\b${escapeRegExp(word)}\\b`, "i").test(blob))) {
      continue;
    }
    seen.add(key);
    kept.push(part);
  }
  return kept.join(", ");
}

/** One comma-separated sentence: no periods, no repeated clauses, no camera poison. */
export function normalizeFluxSentence(text: string): string {
  const cleaned = sanitizePromptTag(text.replace(/[.\n;!?]+/g, ", "));
  return clampPositive(dedupePromptClauses(cleaned));
}

/**
 * Final English prompt sent to Pollinations / HF.
 * Keep-tags are never concatenated — they already live in the object list.
 */
export function assembleFluxPrompt(spec: Pick<ImagePromptSpec, "positive" | "preserve">): string {
  return normalizeFluxSentence(spec.positive);
}

/** Sanitize, weave missing architectural constraints, append quality tail, cap length. */
export function finalizePositive(text: string, analysis?: RoomAnalysis | null): string {
  let s = sanitizePromptTag(text).replace(/\s+/g, " ").trim();
  s = ensureConstraintsInPositive(s, analysis);
  if (!/archviz/i.test(s)) s = [s, RENDER_QUALITY_TAIL].filter(Boolean).join(", ");
  return normalizeFluxSentence(s);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const HALLUCINATED_FEATURE_RE = new RegExp(
  [
    escapeRegExp(CONSOLE_WALL),
    escapeRegExp(INSTALL_LEDGE),
    escapeRegExp(TOILET_WITH_LEDGE),
    escapeRegExp(BOX_LEDGE),
    escapeRegExp(WALL_NICHE),
    "tiled half-height installation console wall",
    "raised tiled step ledge(?: behind (?:the )?toilet)?",
    "built-in step ledge",
    "boxed-in structure",
    "retained architectural ledge",
    "white toilet sitting on a low tiled step(?: ledge)?",
    "toilet mounted on a low tiled step(?: ledge)?",
  ].join("|"),
  "gi",
);

function stripHallucinatedFeatures(text: string): string {
  return text
    .replace(HALLUCINATED_FEATURE_RE, " ")
    .replace(/\s+/g, " ")
    .replace(/\s*,\s*/g, ", ")
    .replace(/^[,\s]+|[,\s]+$/g, "")
    .replace(/,(?:\s*,)+/g, ",")
    .trim();
}

function ensureConstraintsInPositive(text: string, analysis?: RoomAnalysis | null): string {
  // Depth ControlNet locks walls/ledges. Never inject a pipe box into the style prompt.
  if (analysis === undefined) return text;
  return stripHallucinatedFeatures(text);
}

export function hasArchitecturalFeatures(analysis?: RoomAnalysis | null): boolean {
  return collectConstraints(analysis).length > 0;
}

export function filterPreserveForFeatures(preserve: string[], analysis?: RoomAnalysis | null): string[] {
  const allowFeatures = hasArchitecturalFeatures(analysis);
  return preserve.filter((item) => {
    const isFeatureTerm = LEDGE_KEYWORDS.some((keyword) => keyword.toLowerCase() === item.toLowerCase());
    return allowFeatures || !isFeatureTerm;
  });
}

export function clampPositive(text: string): string {
  let s = text.replace(/\s+/g, " ").replace(/,(?:\s*,)+/g, ",").replace(/^,|,$/g, "").trim();
  if (s.length > POSITIVE_MAX_CHARS) {
    const cut = s.slice(0, POSITIVE_MAX_CHARS);
    const comma = cut.lastIndexOf(",");
    s = (comma >= 120 ? cut.slice(0, comma) : cut).trim();
  }
  if (s.length < POSITIVE_MIN_CHARS && !/archviz/i.test(s)) {
    const pad = `, ${RENDER_QUALITY_TAIL}`;
    if (s.length + pad.length <= POSITIVE_MAX_CHARS) s += pad;
  }
  return s.slice(0, POSITIVE_MAX_CHARS);
}

type ScaleTier = "small" | "medium" | "large" | "unknown";

function parseMeters(value?: string): number {
  const n = Number.parseFloat((value ?? "").replace(",", ".").replace(/[^\d.]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/**
 * Bucket the room by footprint. Unknown stays "compact" — not bathroom-specific.
 */
export function roomScaleTier(dimensions?: RoomDimensions): ScaleTier {
  if (!dimensions) return "unknown";
  const length = parseMeters(dimensions.length);
  const width = parseMeters(dimensions.width);
  const sides = [length, width].filter(Boolean);
  const area = length && width ? length * width : 0;
  const minSide = sides.length ? Math.min(...sides) : 0;
  if (!area && !minSide) return "unknown";
  if ((area && area <= 6) || (minSide && minSide <= 2)) return "small";
  if (area && area <= 14) return "medium";
  return "large";
}

/** Compact / Spacious / Small — never metric numbers. */
export function scaleWord(dimensions?: RoomDimensions): "Small" | "Compact" | "Spacious" {
  switch (roomScaleTier(dimensions)) {
    case "large":
      return "Spacious";
    case "medium":
      return "Compact";
    default:
      return "Small";
  }
}

export function scaleKeywords(dimensions?: RoomDimensions): string {
  switch (roomScaleTier(dimensions)) {
    case "large":
      return "spacious";
    case "medium":
      return "compact";
    default:
      return "small compact";
  }
}

function sizeAdjective(dimensions?: RoomDimensions): string {
  return scaleWord(dimensions).toLowerCase();
}

const ROOM_NOUN_MAP: Array<{ test: RegExp; noun: string }> = [
  { test: /\b(bath|toilet|shower|wc|washroom|restroom|wet\s*room|сануз|ванн|унитаз|душ)\b/, noun: "bathroom" },
  { test: /\b(bed|спальн)\b/, noun: "bedroom" },
  { test: /\b(liv|lounge|гости|зал)\b/, noun: "living room" },
  { test: /\b(kitc|кухн)\b/, noun: "kitchen" },
  { test: /\b(din|столов)\b/, noun: "dining room" },
  { test: /\b(offic|study|кабинет)\b/, noun: "home office" },
  { test: /\b(child|kids|nursery|детск)\b/, noun: "nursery" },
  { test: /\b(hall|коридор|прихож|entry)\b/, noun: "hallway" },
];

export function roomNoun(analysis?: RoomAnalysis | null): string {
  const raw = sanitizePromptTag(analysis?.roomType || "").toLowerCase();
  if (raw && !/^(interior|room|space|фото)$/i.test(raw)) {
    for (const entry of ROOM_NOUN_MAP) {
      if (entry.test.test(raw)) return entry.noun;
    }
    return raw;
  }
  const blob = [
    analysis?.existingFurniture?.join(" "),
    analysis?.spatialLayout?.left,
    analysis?.spatialLayout?.center,
    analysis?.spatialLayout?.right,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  for (const entry of ROOM_NOUN_MAP) {
    if (entry.test.test(blob)) return entry.noun;
  }
  return "interior";
}

export function isWetRoom(analysis?: RoomAnalysis | null): boolean {
  return roomNoun(analysis) === "bathroom";
}

/** Camera phrase without any opening/jamb vocabulary. */
export function interiorViewPhrase(
  analysis?: RoomAnalysis | null,
  dimensions?: RoomDimensions,
): string {
  const size = sizeAdjective(dimensions);
  const noun = roomNoun(analysis);
  return `interior view of a ${[size, noun].filter(Boolean).join(" ")}`;
}

export function fixtureLead(
  analysis?: RoomAnalysis | null,
  dimensions?: RoomDimensions,
): string {
  return compileSpatialClauses(analysis, dimensions, []).join(", ");
}

type StyleScene = { style: string; furniture: string; materials: string; lighting: string };

/** Default furniture / materials / lighting per style so the scene is never empty. */
export const STYLE_SCENE: Record<StylePreset, StyleScene> = {
  scandinavian: {
    style: "scandinavian interior design",
    furniture: "a light grey fabric sofa, oak coffee table, soft wool area rug, floor lamp, potted plants",
    materials: "light oak wood, white walls, linen textiles",
    lighting: "soft natural daylight",
  },
  japandi: {
    style: "modern Japandi interior design",
    furniture:
      "a cream boucle sofa in the center, solid wooden coffee table, large textured rug, potted monstera plants near the window",
    materials: "warm oak parquet floor, olive-beige painted walls, natural linen",
    lighting: "warm ambient sunlight",
  },
  "mid-century": {
    style: "mid-century modern interior design",
    furniture: "a tufted sofa, walnut lounge chair, teak sideboard, sculptural floor lamp, framed abstract art",
    materials: "teak wood, brass accents, muted retro color palette",
    lighting: "warm golden-hour light",
  },
  industrial: {
    style: "industrial loft interior design",
    furniture: "a worn leather sofa, reclaimed wood table, black metal shelving, Edison-bulb fixtures, large plants",
    materials: "exposed brick, black steel, polished concrete",
    lighting: "moody warm light",
  },
  minimal: {
    style: "minimalist interior design",
    furniture: "a low white sofa, slim coffee table, simple area rug, one accent chair, restrained decor",
    materials: "smooth plaster walls, pale wood floor, neutral palette",
    lighting: "even soft daylight",
  },
  classic: {
    style: "classic interior design",
    furniture: "a tufted sofa, carved wooden coffee table, ornate rug, pair of armchairs, framed paintings",
    materials: "moulded walls, rich wood, elegant textiles",
    lighting: "warm chandelier light",
  },
  boho: {
    style: "bohemian interior design",
    furniture: "a rattan sofa, layered rugs, macrame wall decor, floor cushions, many potted plants",
    materials: "natural fibers, terracotta accents, warm earthy tones",
    lighting: "warm cozy light",
  },
  "dark-luxury": {
    style: "dark luxury interior design",
    furniture: "a deep velvet sofa, marble coffee table, brass floor lamp, statement armchair, framed art",
    materials: "dark painted walls, marble, brass, velvet",
    lighting: "moody dramatic lighting",
  },
};

const DEFAULT_SCENE: StyleScene = {
  style: "contemporary interior design",
  furniture: "a comfortable sofa, wooden coffee table, area rug, accent chair, floor lamp, potted plants",
  materials: "warm wood, soft neutral tones, natural textiles",
  lighting: "soft natural daylight",
};

export function sceneFor(preset?: StylePreset): StyleScene {
  return preset ? STYLE_SCENE[preset] : DEFAULT_SCENE;
}

/** Included style filters, deduped and capped. Falls back to the legacy single preset. */
export function resolvePresets(
  request: Pick<ChatRequest, "stylePreset" | "stylePresets">,
): StylePreset[] {
  const list = request.stylePresets?.length
    ? request.stylePresets
    : request.stylePreset
      ? [request.stylePreset]
      : [];
  return [...new Set(list)].slice(0, MAX_INCLUDED_PRESETS);
}

function leadingItems(list: string, count: number): string[] {
  return list
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, count);
}

/**
 * Merge several style filters into one scene. The first pick stays dominant
 * (its full furniture set and lighting) and the rest only contribute accents,
 * otherwise Flux gets a contradictory prompt and renders a generic room.
 */
export function blendScenes(presets: StylePreset[]): StyleScene {
  const [primary, ...rest] = presets.map((preset) => STYLE_SCENE[preset]);
  if (!primary) return DEFAULT_SCENE;
  if (rest.length === 0) return primary;

  const accents = rest.flatMap((scene) => leadingItems(scene.furniture, 1));
  const materials = [...new Set([...leadingItems(primary.materials, 3), ...rest.flatMap((scene) => leadingItems(scene.materials, 2))])];

  return {
    style: `${primary.style} blended with ${rest.map((scene) => scene.style).join(" and ")}`,
    furniture: [primary.furniture, ...accents].join(", "),
    materials: materials.join(", "),
    lighting: primary.lighting,
  };
}

/** Rejected style filters, expressed as things the generator must avoid. */
export function excludedStylesNegative(presets: StylePreset[] | undefined): string {
  if (!presets?.length) return "";
  return presets
    .flatMap((preset) => [STYLE_SCENE[preset].style, ...leadingItems(STYLE_SCENE[preset].materials, 2)])
    .join(", ");
}

/**
 * Required negatives + rejected styles + whatever the model produced, deduped:
 * Gemini usually echoes REQUIRED_NEGATIVE back, and a doubled list only eats the
 * Pollinations URL budget.
 */
export function buildNegative(excluded: StylePreset[] | undefined, extra = ""): string {
  const seen = new Set<string>();
  return [REQUIRED_NEGATIVE, excludedStylesNegative(excluded), extra]
    .filter(Boolean)
    .flatMap((chunk) => chunk.split(","))
    .map((item) => item.trim())
    .filter((item) => {
      if (!item || seen.has(item.toLowerCase())) return false;
      seen.add(item.toLowerCase());
      return true;
    })
    .join(", ")
    .slice(0, 600);
}

/**
 * Shared system prompt for analyze / chat / spec-compile.
 * RU answers to the user, EN for ImagePromptSpec.positive.
 */
export const SYSTEM_PROMPT = [
  "Ты — консультант по КОНЦЕПТУ интерьера, а не архитектор-чертёжник.",
  "Отвечай пользователю на русском языке, дружелюбно и по делу.",
  "Запрещено выдавать размеры в мм/м как факты, масштаб, площади или «точную 3D-модель».",
  "Если просят чертёж, план БТИ, BIM или строительную документацию — вежливо откажись и предложи концепт-рендер.",
  "Геометрия комнаты фиксируется ControlNet Depth по исходному фото. Не описывай зоны и не пиши on the left / on the right.",
  "ВАЖНО — пользовательские пометки на фото: ищи рисунки поверх изображения (красные линии, стрелки, кружки).",
  "Если находишь выделение — пометь объект в mustKeepElements простым именем, но НЕ вставляй координаты в positive.",
  "Команды «оставь это», «сохрани», «не меняй»: константа для preserve[], не для пространственных фраз в промпте.",
  `КРИТИЧНО — positive это ТОЛЬКО стилистика: ${BAG_OF_WORDS_FORMULA}.`,
  "Канон: 'Modern compact bathroom, dark grey tiles, dark luxury style, floating vanity, wall-mounted toilet, warm indirect lighting, archviz, photorealistic 8k'.",
  `Quality: '${RENDER_QUALITY_TAIL}'. Не пиши дверной проём. Не подставляй санузел, если на фото другая комната.`,
  IMAGE_PROMPT_RULE,
].join(" ");

export const ANALYZE_INSTRUCTION = [
  "Проанализируй фото интерьера и верни ТОЛЬКО валидный JSON без пояснений и без markdown-ограждений.",
  "Схема RoomAnalysis:",
  '{"roomType": string, "viewpoint": string, "lighting": string, "existingFurniture": string[], "architecturalKeep": string[], "mustKeepElements": string[], "spatialLayout": {"camera": string, "left": string, "center": string, "right": string, "floorCeiling": string}, "hasWindows": boolean, "colorPalette": string[], "issues": string[], "suggestedPresets": string[]}',
  "Значения на английском. suggestedPresets — только из набора:",
  "scandinavian, japandi, mid-century, industrial, minimal, classic, boho, dark-luxury.",
  "architecturalKeep обязателен и не пустой (стены, потолок). Нишу/короб пиши туда ТОЛЬКО если они видны на фото.",
  "ОБЯЗАТЕЛЬНО заполни spatialLayout — список главных объектов комнаты (не выдумывай санузел, если на фото спальня/гостиная/кухня):",
  "spatialLayout.camera — 'interior view of the source room'. Не описывай дверной проём.",
  "spatialLayout.left / center / right — КОРОТКИЕ имена объектов БЕЗ on the left / on the right / in the center background (wardrobe, shower, toilet, bed…).",
  "spatialLayout.floorCeiling — пол и потолок.",
  "IF на фото есть короб под трубы, ступенька, ниша, балка или выступ — запиши в mustKeepElements короткое имя (tiled installation ledge / architectural box ledge / wall niche). В spatialLayout пиши только имя объекта, без позиции.",
  "ELSE стены ровные — mustKeepElements = []. Не пиши короб/ступень/ledge/niche и не пиши clean flat wall.",
  "Все теги — короткие названия объектов, без хвоста про позицию.",
  "В architecturalKeep / existingFurniture / mustKeepElements не пиши про дверной проём, косяк или дверь.",
  // Window presence drives the no-window negative anchor.
  "hasWindows — true ТОЛЬКО если на фото реально видно окно; если окон нет — обязательно false (тогда генератор не пририсует окно посреди стены).",
  // Annotation pass — mandatory before returning JSON.
  "Перед ответом внимательно осмотри фото на пользовательские аннотации: красные или яркие линии, обводки маркером, стрелки, кружки, штриховку поверх изображения.",
  `Выделение на фото → простое имя в mustKeepElements (ниша → '${WALL_NICHE}', короб/трубы → '${CONSOLE_WALL}'). Если выделений нет и стенка ровная — mustKeepElements [].`,
  "Каждый элемент из mustKeepElements ОБЯЗАТЕЛЬНО продублируй и в architecturalKeep. Если аннотаций на фото нет — верни mustKeepElements как пустой массив [].",
].join(" ");

export const COMPILE_SPEC_INSTRUCTION = [
  IMAGE_PROMPT_RULE,
  "Собери JSON ImagePromptSpec для генератора картинок. Верни ТОЛЬКО JSON без пояснений.",
  "Схема:",
  '{"positive": string, "negative": string, "stylePreset": string, "preserve": string[], "aspect": "16:9"|"4:3"|"1:1", "seed"?: number}',
  `positive — АНГЛИЙСКАЯ стилистика: ${BAG_OF_WORDS_FORMULA}. Геометрия с depth-карты, НЕ пиши on the left / on the right / in the center background.`,
  "Канон: 'Modern compact bathroom, dark grey tiles, dark luxury style, floating vanity, wall-mounted toilet, warm indirect lighting, archviz, photorealistic 8k'.",
  "Канон спальни: 'Modern compact bedroom, oak wood, beige plaster, Japandi style, wardrobe, double bed, warm ambient lighting, archviz, photorealistic 8k'.",
  "Тип комнаты бери из анализа. Не описывай короб/ступеньку — ControlNet Depth уже держит геометрию фото.",
  "Если есть existingFurniture / spatialLayout — возьми короткие имена предметов (без координат).",
  "Если пользователь дал мало деталей — добавь стиль и свет. НИКОГДА не оставляй промпт пустым.",
  "Не копируй preserve/keepTags в positive.",
  'В списке только объекты с фото. Отрицание "no windows" — только в хвосте Quality, если окон нет.',
  `Всё нежелательное складывай ТОЛЬКО в поле negative (генератор использует его отдельно): ${REQUIRED_NEGATIVE}.`,
  "preserve — имена объектов из фото. НИКОГДА не копируй keepTags в positive. Короб туда попадает только если он обнаружен.",
  // Retained / must-keep elements are non-negotiable architectural constants.
  "Итоговый positive — одно предложение без повторов и без eye level / doorway / door frame / perspective.",
  "Эти же сохраняемые элементы обязательно перечисли в preserve[]. Их нельзя переносить в negative и нельзя удалять из сцены.",
  // Framing + scale negatives.
  `В negative для маленьких/компактных комнат добавляй '${OVERSIZE_NEGATIVE}'.`,
  // No-window negative anchor.
  `Если окон на фото нет (hasWindows=false) — добавь 'no windows' ТОЛЬКО в negative. Геометрия окон/стен — с depth-карты.`,
  // Style filters chosen in the UI.
  "Если в контексте есть желаемые стили — смешай их в positive, первый в списке ведущий.",
  "Если в контексте есть отклонённые стили — ни их названия, ни их характерные материалы не должны попасть в positive; перечисли их в negative.",
].join(" ");

/** Compact RU context block appended before the chat/spec request. */
export function chatContextBlock(
  request: Pick<ChatRequest, "analysis" | "stylePreset" | "stylePresets" | "excludedPresets" | "dimensions">,
): string {
  const lines: string[] = [];
  if (request.analysis) {
    lines.push(`Анализ комнаты: тип=${request.analysis.roomType}, ракурс=${request.analysis.viewpoint}, свет=${request.analysis.lighting}.`);
    if (request.analysis.architecturalKeep?.length) {
      lines.push(`Сохранить архитектуру: ${request.analysis.architecturalKeep.join(", ")}.`);
    }
    if (request.analysis.mustKeepElements?.length) {
      lines.push(
        `Фиксированные архитектурные константы (отмечены на фото или просьбой пользователя) — НЕ удалять, НЕ перестраивать, строить дизайн вокруг них: ${request.analysis.mustKeepElements.join(", ")}.`,
      );
    }
    const layout = request.analysis.spatialLayout;
    if (layout) {
      lines.push(
        "Объекты комнаты (только имена, без left/right/center):",
        `- ${[layout.left, layout.center, layout.right].filter(Boolean).join(", ") || "—"}`,
        `- пол/потолок: ${layout.floorCeiling || "—"}`,
      );
    }
    if (request.analysis.hasWindows === false) {
      lines.push(
        "На исходном фото ОКОН НЕТ: в negative добавь 'no windows'. Не пиши это в positive.",
      );
    }
    if (request.analysis.colorPalette?.length) {
      lines.push(`Цветовая палитра (пользователь может править теги): ${request.analysis.colorPalette.join(", ")}.`);
    }
    if (request.analysis.issues?.length) {
      lines.push(`Заметки: ${request.analysis.issues.join("; ")}.`);
    }
  }
  const wanted = resolvePresets(request);
  if (wanted.length === 1) lines.push(`Желаемый стиль: ${wanted[0]}.`);
  if (wanted.length > 1) {
    lines.push(`Желаемые стили — смешай их, первый ведущий: ${wanted.join(", ")}.`);
  }
  if (request.excludedPresets?.length) {
    lines.push(
      `Стили, которые пользователь отклонил — не используй ни их мебель, ни материалы, перечисли их в negative: ${request.excludedPresets.join(", ")}.`,
    );
  }
  const size = formatDimensions(request.dimensions);
  if (size) {
    const scale = scaleKeywords(request.dimensions);
    lines.push(
      `Габариты (только ориентир, НЕ пиши цифрами в промпте): ${size}. Переведи их в масштаб-слова${scale ? `: ${scale}` : " (компактное пространство)"}.`,
    );
  }
  lines.push(
    `Positive — только стиль: ${BAG_OF_WORDS_FORMULA}. Геометрия с ControlNet Depth, без on the left / on the right.`,
  );
  return lines.join("\n") || "Контекст комнаты не указан.";
}

export function formatDimensions(dimensions?: RoomDimensions): string {
  if (!dimensions) return "";
  const { length, width, height } = dimensions;
  if (!length && !width && !height) return "";
  return `${length || "?"}x${width || "?"}x${height || "?"}m`;
}

export function lastUserText(request: Pick<ChatRequest, "messages">): string {
  return (
    [...request.messages].reverse().find((message) => message.role === "user")?.content.trim() ||
    "photoreal interior concept"
  );
}

export function applyUserKeepFeatures(
  analysis: RoomAnalysis | null | undefined,
  userText: string,
): RoomAnalysis | null | undefined {
  if (!hasKeepCommand(userText) || !isArchitecturalFeature(userText)) return analysis;
  const keyword = constraintKeyword(userText);
  if (!keyword) return analysis;
  const base = analysis ?? localRoomAnalysis({});
  return {
    ...base,
    mustKeepElements: compactObjectNames([...(base.mustKeepElements ?? []), keyword]),
  };
}

export function compilePromptSpec(request: ChatRequest): ImagePromptSpec {
  const presets = resolvePresets(request);
  const analysis = applyUserKeepFeatures(request.analysis, lastUserText(request));
  const constraints = collectConstraints(analysis);
  const mustKeep = compactObjectNames([
    ...(analysis?.mustKeepElements ?? []),
    ...constraints.map((hit) => hit.keyword),
  ]);

  const preserve = filterPreserveForFeatures(
    compactObjectNames([
      ...mustKeep,
      ...(analysis?.architecturalKeep ?? []),
    ]),
    analysis,
  );

  const positive = compileSpatialClauses(analysis, request.dimensions, presets).join(", ");

  const extraNegative = [
    roomScaleTier(request.dimensions) === "large" ? "" : OVERSIZE_NEGATIVE,
    roomHasNoWindows(analysis) ? NO_WINDOW_NEGATIVE : "",
  ]
    .filter(Boolean)
    .join(", ");

  return {
    positive: assembleFluxPrompt({
      positive: finalizePositive(positive, analysis ?? null),
      preserve,
    }),
    negative: buildNegative(request.excludedPresets, extraNegative),
    stylePreset: presets[0] ?? "custom",
    preserve,
    aspect: "16:9",
    sourceMimeHint: request.mimeType,
  };
}

type ConstraintHit = { keyword: string; zone: "left" | "center" | "right"; source: string };

function collectConstraints(analysis?: RoomAnalysis | null): ConstraintHit[] {
  if (!analysis) return [];
  const layout = analysis.spatialLayout;
  // Only explicit detections: mustKeep + zone text. Do NOT mine generic
  // architecturalKeep ("walls", "ceiling") — that hallucinates a pipe box.
  const pool: Array<{ text: string; zone: ConstraintHit["zone"] }> = [
    ...(analysis.mustKeepElements ?? []).map((text) => ({ text, zone: guessConstraintZone(text, layout) })),
    { text: layout?.left ?? "", zone: "left" as const },
    { text: layout?.center ?? "", zone: "center" as const },
    { text: layout?.right ?? "", zone: "right" as const },
  ];
  const seen = new Set<string>();
  const hits: ConstraintHit[] = [];
  for (const item of pool) {
    if (!item.text || !isArchitecturalFeature(item.text)) continue;
    const keyword = constraintKeyword(item.text);
    if (!keyword) continue;
    const key = `${item.zone}:${keyword}`;
    if (seen.has(key)) continue;
    seen.add(key);
    hits.push({ keyword, zone: item.zone, source: item.text });
  }
  return hits;
}

function guessConstraintZone(
  text: string,
  layout?: SpatialLayout,
): ConstraintHit["zone"] {
  const lower = text.toLowerCase();
  if (/\bleft\b|лев/.test(lower)) return "left";
  if (/\bright\b|прав/.test(lower)) return "right";
  if (layout?.left && isArchitecturalFeature(layout.left)) return "left";
  if (layout?.right && isArchitecturalFeature(layout.right)) return "right";
  return "center";
}

function titleRoom(analysis?: RoomAnalysis | null, dimensions?: RoomDimensions, presets: StylePreset[] = []): string {
  const noun = roomNoun(analysis);
  const size = scaleWord(dimensions);
  const scale = size === "Small" ? "compact" : size.toLowerCase();
  const adj = presets[0] === "classic" ? "Classic" : "Modern";
  return `${adj} ${scale} ${noun}`;
}

function lightingClause(presets: StylePreset[]): string {
  return sceneFor(presets[0]).lighting || "warm indirect lighting";
}

function styleClause(presets: StylePreset[]): string {
  const preset = presets[0];
  if (!preset) return "";
  const pretty = preset === "japandi" ? "Japandi" : preset.replace(/-/g, " ");
  return `${pretty} style`;
}

function materialsClause(analysis: RoomAnalysis | null | undefined, presets: StylePreset[]): string {
  const scene = blendScenes(presets);
  const fromPalette = compactObjectNames(analysis?.colorPalette).slice(0, 2);
  const fromFloor = compactObjectName(analysis?.spatialLayout?.floorCeiling ?? "");
  const fromStyle = leadingItems(scene.materials, 2);
  const bits = [...fromPalette, fromFloor, ...fromStyle].filter(Boolean);
  const seen = new Set<string>();
  return bits
    .filter((item) => {
      const key = item.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 3)
    .join(", ");
}

type ZoneDefaults = { left: string; center: string; right: string };

function defaultZones(noun: string): ZoneDefaults {
  switch (noun) {
    case "bathroom":
      return { left: "glass shower enclosure", center: "wall-mounted toilet", right: "floating vanity" };
    case "bedroom":
      return { left: "wardrobe", center: "double bed", right: "desk with chair" };
    case "living room":
      return { left: "bookshelf", center: "sofa", right: "sideboard" };
    case "kitchen":
      return { left: "tall cabinets", center: "dining table", right: "kitchen counters" };
    case "dining room":
      return { left: "sideboard", center: "dining table", right: "display cabinet" };
    case "home office":
      return { left: "bookcase", center: "desk", right: "storage cabinet" };
    case "nursery":
      return { left: "storage shelves", center: "crib", right: "changing table" };
    default:
      return { left: "storage", center: "main furniture", right: "accent furniture" };
  }
}

function objectPhrase(raw: string | undefined, fallback: string): string {
  const name = raw ? compactObjectName(raw) : "";
  return (name || fallback).replace(/\s+/g, " ").trim();
}

export function compileSpatialClauses(
  analysis: RoomAnalysis | null | undefined,
  dimensions: RoomDimensions | undefined,
  presets: StylePreset[],
): string[] {
  const noun = roomNoun(analysis);
  const defaults = defaultZones(noun);
  const layout = analysis?.spatialLayout;
  const furniture = compactObjectNames(analysis?.existingFurniture);

  const leftRaw = layout?.left || (furniture[0] && noun !== "bathroom" ? furniture[0] : "");
  const centerRaw = layout?.center || (furniture[1] ? furniture[1] : "");
  const rightRaw = layout?.right || (furniture[2] ? furniture[2] : "");

  const objects = uniqueObjectPhrases([
    objectPhrase(leftRaw, defaults.left),
    objectPhrase(centerRaw, defaults.center),
    objectPhrase(rightRaw, defaults.right),
  ]).filter((item) => !LEDGE_KEYWORDS.some((keyword) => item.toLowerCase() === keyword.toLowerCase()));

  return [
    titleRoom(analysis, dimensions, presets),
    materialsClause(analysis, presets),
    styleClause(presets),
    ...objects,
    lightingClause(presets),
    RENDER_QUALITY_TAIL.replace(" render", ""),
  ].filter(Boolean);
}

function uniqueObjectPhrases(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of values) {
    const text = item.replace(/\s+/g, " ").trim();
    const key = text.toLowerCase();
    if (!text || seen.has(key)) continue;
    seen.add(key);
    out.push(text);
  }
  return out;
}

export function localDesignerReply(request: ChatRequest): string {
  const userText = lastUserText(request);
  const size = formatDimensions(request.dimensions);
  const sizeLine = size ? ` Ориентир по габаритам: ${size.replace(/x/g, " × ")}.` : "";

  return [
    `Собрала концепт по запросу «${userText.slice(0, 180)}».${sizeLine}`,
    "Рендер строится через Replicate ControlNet Depth по исходному фото комнаты.",
    CONCEPT_DISCLAIMER,
  ].join(" ");
}

export function localRoomAnalysis(input: {
  brief?: string;
  stylePreset?: StylePreset;
  dimensions?: RoomDimensions;
}): RoomAnalysis {
  const suggested: StylePreset[] = input.stylePreset
    ? [input.stylePreset]
    : ["minimal", "scandinavian", "japandi"];

  return {
    roomType: "interior",
    viewpoint: INTERIOR_VIEW,
    lighting: "as in the source photo",
    existingFurniture: [],
    architecturalKeep: ["walls", "ceiling"],
    mustKeepElements: [],
    colorPalette: [],
    issues: input.brief ? [] : ["стиль ещё не уточнён"],
    suggestedPresets: suggested.slice(0, 4),
  };
}
