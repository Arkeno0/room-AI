# Shared contracts (Agent 2 + Agent 3)

Implement exactly as `lib/types.ts`. Do not diverge field names.

```ts
export type StylePreset =
  | "scandinavian"
  | "japandi"
  | "mid-century"
  | "industrial"
  | "minimal"
  | "classic"
  | "boho"
  | "dark-luxury";

export type Aspect = "16:9" | "4:3" | "1:1";

export type RoomAnalysis = {
  roomType: string;
  viewpoint: string;
  lighting: string;
  existingFurniture: string[];
  architecturalKeep: string[];
  colorPalette: string[];
  issues: string[];
  suggestedPresets: StylePreset[];
};

export type ImagePromptSpec = {
  positive: string;      // English, Flux-optimized, ≤1500 chars
  negative: string;
  stylePreset: StylePreset | "custom";
  preserve: string[];
  aspect: Aspect;
  seed?: number;
  sourceMimeHint?: string;
};

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export type AnalyzeRequest = {
  imageBase64: string;   // raw base64, no data: prefix
  mimeType: "image/jpeg" | "image/png" | "image/webp";
};

export type AnalyzeResponse = {
  analysis: RoomAnalysis;
  disclaimer: string;
};

export type StyleFilterMode = "include" | "exclude";
export type StyleFilters = Partial<Record<StylePreset, StyleFilterMode>>;
export const MAX_INCLUDED_PRESETS = 3;

export type ChatRequest = {
  messages: ChatMessage[];
  analysis: RoomAnalysis | null;
  imageBase64?: string;
  mimeType?: AnalyzeRequest["mimeType"];
  stylePreset?: StylePreset;      // primary style = stylePresets[0]
  stylePresets?: StylePreset[];   // blended into positive, max MAX_INCLUDED_PRESETS
  excludedPresets?: StylePreset[];// pushed into spec.negative
  generate?: boolean;    // user clicked “Generate concept”
};

export type ChatSseEvent =
  | { type: "token"; text: string }
  | { type: "prompt_spec"; spec: ImagePromptSpec }
  | { type: "error"; message: string; code: "rate_limit" | "upstream" | "invalid" };

export type GenerateRequest = {
  spec: ImagePromptSpec;
  provider: "huggingface";
};

export type GenerateResponse = {
  imageUrl: string;
  provider: "huggingface";
  disclaimer: string;
};

export const CONCEPT_DISCLAIMER =
  "Это концепт-визуализация интерьера, а не чертёж в масштабе, не 3D-модель и не строительная документация.";
```

## HTTP

| Method | Path | Body | Response |
|---|---|---|---|
| POST | `/api/analyze` | `AnalyzeRequest` | `200 AnalyzeResponse` |
| POST | `/api/chat` | `ChatRequest` | `text/event-stream` of `ChatSseEvent` |
| POST | `/api/generate` | `GenerateRequest` | `200 GenerateResponse` or `501` if HF unset |
| GET | `/api/health` | — | `{ ok, gemini, huggingface }` |

SSE frame: `data: ${JSON.stringify(event)}\n\n`. Client stops on stream end. On `prompt_spec`, Agent 2 **does not** wait for `/api/generate`; it calls Pollinations immediately.

## Pollinations URL (Agent 2)

```
https://image.pollinations.ai/prompt/{encodeURIComponent(spec.positive)}
  ?width={w}&height={h}&model=flux&nologo=true&enhance=true&seed={seed}
```

Aspect map: `16:9 → 1280×720`, `4:3 → 1024×768`, `1:1 → 1024×1024`.

Negative prompt: append to `positive` as `, avoid: {spec.negative}` (Pollinations has no separate negative field on GET).

## Style filters (Agent 2 → Agent 3)

The studio panel stores one `StyleFilters` map per session. `include` picks (max 3) are blended
into `positive` — the first is dominant. `exclude` picks are appended to `negative` together with
their signature materials, and the server re-applies them after Gemini compiles the spec, so a
rejected style cannot come back through the model's own `negative`.

## Error shape (JSON routes)

```ts
{ error: string; code: "rate_limit" | "upstream" | "invalid" | "payload_too_large" }
```

HTTP: `400` invalid, `413` too large, `429` rate limit, `502` upstream.
