# Architecture — Room Creator (Zero Budget)

## Product

Web app: user uploads a room photo → Gemini analyzes it → user chats about style → app returns **concept renders** of the redesigned interior.

**Not in product:** measured drawings, BIM, 3D mesh, furniture SKUs with real dimensions, construction docs.

## Stack lock

| Layer | Choice | Env |
|---|---|---|
| App | Next.js 15 App Router, React 19, TypeScript, Tailwind CSS 4 | — |
| Host | Vercel Hobby (Netlify = documented fallback only) | — |
| Chat / vision | Google Gemini Flash (`gemini-2.0-flash` primary, `gemini-2.5-flash-lite` fallback) | `GEMINI_API_KEY` |
| Images primary | Replicate ControlNet Depth (`xlabs-ai/flux-dev-controlnet`) | `REPLICATE_API_TOKEN` |
| Images fallback | `lucataco/sdxl-controlnet-depth` on Replicate | same token |
| Persistence | IndexedDB (`idb` or native) | — |
| Auth | none v1 | — |

Do not add: OpenAI, Clerk, Stripe, Supabase, Redis, S3, WebGL CAD.

## System diagram

```
Browser Studio
  ├─ POST /api/analyze   ──► Next.js ──► Gemini Vision ──► RoomAnalysis JSON
  ├─ POST /api/chat SSE  ──► Next.js ──► Gemini Flash  ──► text + ImagePromptSpec
  ├─ POST /api/generate  ──► Replicate ControlNet Depth (source photo + style prompt)
  └─ IndexedDB           ──► local sessions / gallery
```

## Why images are client-side

Vercel Hobby serverless duration is too short and too unreliable for Flux/ControlNet. Pollinations GET is an image URL — the browser waits, not the function. Gemini calls stay on the server (fast enough, key stays private).

## Runtime quotas (treat as budget)

| Service | Practical free cap | App behavior |
|---|---|---|
| Gemini Flash | ~10–15 RPM, ~1 500 RPD | In-memory IP limit; 429 UI; model fallback |
| Pollinations | public, no SLA | retry 1×; skeleton; never block chat |
| HF Inference | cold start, 429 | timeout 12s then fallback |
| Vercel Hobby | bandwidth + 10s-class functions | no heavy image POST on hot path |
| IndexedDB | device quota | cap 30 images / session; blob eviction |

Gemini free-tier prompts may be used to improve Google products. Disclose in footer.

## v1 screens

1. `/` — landing, one CTA, constraint line.
2. `/studio` — three panes: source photo + analysis, chat, gallery.

## v1 user flow

1. Compress photo client-side (max edge 1280px, JPEG ~0.85, ≤1.5 MB).
2. `POST /api/analyze` → show `RoomAnalysis` chips.
3. User picks a style preset and/or chats.
4. Gemini returns assistant text + optional `ImagePromptSpec`.
5. Frontend builds Pollinations URL, renders 1–4 variants (different seeds).
6. Persist session in IndexedDB.

## Prompt compiler (critical)

Gemini is the **layout-preserving prompt compiler**, not a CAD engine.

`ImagePromptSpec.positive` must include:

- camera/viewpoint lock (“same angle as source photo”)
- architectural keep-list (windows, doors, ceiling, alcoves)
- style, materials, lighting
- “photoreal interior concept visualization, not a blueprint”

Never ask the model for mm measurements or scale bars.

## Security

- API keys: server env only.
- Validate `mimeType` ∈ `image/jpeg|image/png|image/webp`.
- Reject payloads > 4 MB after base64.
- Rate limit `/api/*` by IP (in-memory `Map`, 10 req / 10 min / IP).
- Sanitize prompt text before embedding in Pollinations URL (strip URLs, cap 1500 chars).

## Out of scope v1

Auth, accounts, billing, admin, 3D, AR, PDF export of drawings, furniture commerce, multi-room projects, i18n beyond RU UI + EN image prompts.
