# ТЗ — Агент 2 (Frontend)

**Стек:** Next.js 15 App Router, React 19, TypeScript, Tailwind CSS 4.  
**Не трогать:** `app/api/**`, `lib/ai/**` (это Агент 3).  
**Контракт:** `docs/CONTRACTS.md` → реализовать `lib/types.ts` если файла ещё нет (не менять поля).

## Цель

Студия: загрузка фото комнаты, чат, галерея концепт-рендеров. Без аккаунта.

## Файлы (создать)

```
app/layout.tsx
app/globals.css
app/page.tsx
app/studio/page.tsx
app/studio/loading.tsx
components/studio/StudioShell.tsx          # 3 колонки: source | chat | gallery
components/studio/RoomUploader.tsx
components/studio/AnalysisChips.tsx
components/studio/ChatPanel.tsx
components/studio/PromptComposer.tsx
components/studio/StylePresets.tsx
components/studio/ResultGallery.tsx
components/studio/ResultCard.tsx
components/studio/DisclaimerBanner.tsx     # CONCEPT_DISCLAIMER, всегда в studio
components/studio/RateLimitToast.tsx
hooks/useStudioSession.ts
hooks/useChatStream.ts
hooks/useImageCompress.ts
lib/pollinations.ts                        # buildPollinationsUrl(spec, seed)
lib/idb.ts
lib/types.ts                               # если нет
```

## UI

**`/`**  
Заголовок, 1 абзац, CTA → `/studio`. Мелкий текст: бесплатный концепт, не чертёж.

**`/studio` — desktop ≥1024px: CSS grid 1.1fr 1.2fr 1.1fr. Mobile: вертикальный стек (фото → чат → галерея).**

Левая колонка:

- dropzone + file input, accept jpeg/png/webp
- превью исходника
- `AnalysisChips` после analyze
- `StylePresets` (8 пресетов из контракта)

Центр:

- история чата
- composer: textarea, кнопки «Отправить» и «Сгенерировать концепт»
- стриминг токенов; disabled пока идет analyze/stream

Правая:

- сетка результатов 1–4
- skeleton пока `img` грузится
- ошибка картинки → «Повторить» (новый seed)
- кнопка скачать (клиентский blob)

Глобально в studio: `DisclaimerBanner` (не dismiss навсегда — только collapse).

## Поведение

1. `useImageCompress`: max side 1280, JPEG 0.85, abort если >1.5 MB после сжатия.
2. Upload → `POST /api/analyze` → записать `analysis` в session.
3. Chat → `POST /api/chat` (`generate: false`). Читать SSE, аппендить `token`.
4. «Сгенерировать концепт» → тот же `/api/chat` с `generate: true`. На `prompt_spec` сразу открыть 2 варианта Pollinations (seed, seed+1). Не вызывать `/api/generate` в v1 hot path.
5. `onerror` у `<img>`: один retry через 2s, затем CTA «Попробовать ещё seed».
6. IndexedDB store `sessions`: `{ id, createdAt, thumbnail, analysis, messages, results[] }`. Лимит 30 изображений; FIFO eviction.
7. Пресет кликается → подставить в следующий `ChatRequest.stylePreset` и отправить короткое user message «Apply style: {preset}».

## `lib/pollinations.ts`

Экспорт `buildPollinationsUrl(spec, seed): string` строго по `docs/CONTRACTS.md`.  
Не класть API keys. Не проксировать через Next.js.

## Состояния / a11y

- loading, empty, error, rate_limit (429 → `RateLimitToast`)
- `alt` у исходника и у каждого рендера: «Концепт интерьера, не чертёж»
- фокус в textarea после ответа
- не блокировать UI на 30s без progress: показывать «рендер концепта…»

## Запрещено

- вызывать Gemini из браузера
- Three.js / canvas-чертежи / линейки масштаба
- подпись результата как «проект» / «план» / «3D-модель»
- отправка несжатого 10 MB фото
- хранить ключи в `NEXT_PUBLIC_*`

## Definition of Done

- [ ] `npm run build` без ошибок
- [ ] `/` и `/studio` рендерятся без API keys
- [ ] dropzone + compress + analyze wiring
- [ ] SSE чат
- [ ] 2 Pollinations URL на `prompt_spec`
- [ ] disclaimer виден до и после генерации
- [ ] история переживает reload (IndexedDB)
- [ ] mobile stack usable
- [ ] 429 показывает понятный RU текст, не stack trace
