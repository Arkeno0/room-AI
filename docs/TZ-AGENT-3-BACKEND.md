# ТЗ — Агент 3 (Backend / AI)

**Стек:** Next.js Route Handlers, TypeScript, `@google/generative-ai` (или `@google/genai`).  
**Не трогать:** UI-компоненты studio, кроме правок `lib/types.ts`.  
**Контракт:** `docs/CONTRACTS.md`.

## Цель

Серверные маршруты: анализ фото, чат со стримингом, компиляция `ImagePromptSpec`, опциональный HF fallback. Ключи только в server env.

## Файлы (создать)

```
lib/types.ts
lib/ai/gemini.ts              # getModel(), analyzeRoom(), streamChat()
lib/ai/prompts.ts             # SYSTEM, ANALYZE_SCHEMA, COMPILE_SPEC
lib/ai/huggingface.ts         # optional; throw if !HF_TOKEN
lib/rate-limit.ts             # checkIpLimit(ip): boolean
lib/env.ts                    # GEMINI_API_KEY required; HF_TOKEN optional
app/api/analyze/route.ts
app/api/chat/route.ts
app/api/generate/route.ts
app/api/health/route.ts
.env.example
```

## Env

```
GEMINI_API_KEY=
GEMINI_MODEL=gemini-2.0-flash
GEMINI_MODEL_FALLBACK=gemini-2.5-flash-lite
HF_TOKEN=
HF_IMAGE_MODEL=black-forest-labs/FLUX.1-schnell
```

Нет `NEXT_PUBLIC_` для секретов.

## `lib/ai/prompts.ts` — обязательные правила системы

Системный промпт (RU ответы пользователю, EN для `ImagePromptSpec.positive`):

1. Ты — консультант по **концепту** интерьера, не архитектор-чертёжник.
2. Запрещено выдавать размеры в мм/м как факты, масштаб, площади, «точная 3D-модель».
3. Если пользователь просит чертёж / план БТИ / BIM — отказать и предложить концепт-рендер.
4. Всегда сохранять `architecturalKeep` и ракурс исходного фото в `preserve[]`.
5. `positive`: photoreal interior concept, same camera, same room geometry, no blueprint, no floorplan overlay, no dimension arrows.
6. `negative`: text, watermark, blueprint, floor plan, distorted architecture, extra windows, deformed furniture.
7. При `generate: true` последним событием стрима отдать `prompt_spec`. Без generate — только текст.

Analyze: модель возвращает **только JSON** под `RoomAnalysis`. Валидировать zod/ручной guard; при провале — 502 `upstream`.

## Маршруты

### `POST /api/analyze`

- `checkIpLimit`; 429 если false.
- Guard MIME + размер (decoded ≤ 4 MB).
- `gemini.analyzeRoom(image)`.
- Ответ: `{ analysis, disclaimer: CONCEPT_DISCLAIMER }`.
- Timeout 20s. При 429/unavailable от Gemini — один retry на `GEMINI_MODEL_FALLBACK`.

### `POST /api/chat`

- SSE `Content-Type: text/event-stream`, `Cache-Control: no-store`.
- Тело: `ChatRequest`. Если `generate` и нет `analysis` — 400.
- Стримить `token`. Если `generate: true` — после текста emit `prompt_spec`.
- Не вызывать Pollinations и не ждать картинку.
- Обрезать `messages` до последних 16.

### `POST /api/generate`

- Только HF. Если нет `HF_TOKEN` → `501`.
- `maxDuration = 15` (если платформа позволит). Abort 12s → 502, клиент уйдёт на Pollinations.
- Не использовать как hot path.

### `GET /api/health`

`{ ok: boolean, gemini: boolean, huggingface: boolean }` без утечки ключей.

## Rate limit

`lib/rate-limit.ts`: in-memory `Map<ip, timestamps[]>`.

- 10 запросов / 10 минут / IP на `/api/analyze` + `/api/chat` суммарно.
- 4 запроса / 10 минут на `/api/generate`.
- IP из `x-forwarded-for` (первый hop) иначе `unknown` (тогда общий bucket).

Это не защита от botnet; это защита free-tier квоты Gemini.

## Gemini client

- Один модуль, ключ только runtime server.
- Vision: inlineData base64 + mimeType.
- Temperature analyze `0.2`, chat `0.7`, spec-compile `0.4`.
- Max output tokens: analyze 1024, chat 2048.

## Запрещено

- логировать ключи, полные base64, промпты целиком в prod
- обещать точность геометрии в тексте модели
- биллинг Google Cloud / paid Gemini (только AI Studio free key)
- синхронная генерация картинки внутри `/api/chat`
- запись на диск / S3

## Definition of Done

- [ ] `.env.example` заполнен
- [ ] `/api/health` живой без HF
- [ ] `/api/analyze` на тестовом JPEG → валидный `RoomAnalysis`
- [ ] `/api/chat` стримит токены; при `generate:true` есть `prompt_spec` с `preserve.length >= 1`
- [ ] system prompt содержит отказ от чертежей
- [ ] 400/413/429/502 по контракту
- [ ] ключ не попадает в client bundle (`npm run build` + grep `GEMINI` в `.next/static` = пусто)
- [ ] `/api/generate` корректен при отсутствии токена (501)
