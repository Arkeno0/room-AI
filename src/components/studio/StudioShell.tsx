"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2, Plus, Sparkles } from "lucide-react";
import { AnalysisChips } from "@/components/studio/AnalysisChips";
import { ChatPanel } from "@/components/studio/ChatPanel";
import { DisclaimerBanner } from "@/components/studio/DisclaimerBanner";
import { RateLimitToast } from "@/components/studio/RateLimitToast";
import { ResultGallery } from "@/components/studio/ResultGallery";
import { RoomUploader } from "@/components/studio/RoomUploader";
import { StyleFilters } from "@/components/studio/StyleFilters";
import { useStudioSession } from "@/hooks/useStudioSession";
import { excludedPresets, includedPresets, stylePresetLabel } from "@/lib/style-presets";

const DIMENSIONS: { key: "length" | "width" | "height"; label: string }[] = [
  { key: "length", label: "Длина" },
  { key: "width", label: "Ширина" },
  { key: "height", label: "Высота" },
];

export function StudioShell() {
  const studio = useStudioSession();
  const [draft, setDraft] = useState("");
  const session = studio.session;

  if (!studio.hydrated || !session) {
    return <div className="min-h-screen bg-parchment" />;
  }

  const wantedStyles = includedPresets(session.styleFilters);
  const unwantedStyles = excludedPresets(session.styleFilters);

  return (
    <div className="mx-auto flex min-h-dvh max-w-[1440px] flex-col gap-4 overflow-x-hidden px-4 py-5 md:px-6 lg:px-8">
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-3">
        <Link href="/" className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-ink text-cream">
            <span className="font-display text-lg leading-none">A</span>
          </div>
          <div>
            <p className="font-display text-2xl leading-none text-ink">Atelier</p>
            <p className="mt-1 text-[11px] tracking-[0.18em] text-muted uppercase">Студия концепта</p>
          </div>
        </Link>
        <button
          type="button"
          onClick={studio.resetSession}
          className="inline-flex items-center gap-2 rounded-full border border-line bg-cream px-3 py-2 text-sm text-ink-soft"
        >
          <Plus className="h-4 w-4" />
          Новый проект
        </button>
      </header>

      <DisclaimerBanner className="shrink-0" />
      <RateLimitToast message={studio.rateLimitMessage} onClose={() => studio.setRateLimitMessage(null)} />

      <div className="grid flex-1 gap-4 lg:grid-cols-[1.1fr_1.2fr_1.1fr] lg:items-start">
        <section className="flex min-h-0 flex-col overflow-hidden rounded-[28px] border border-line bg-cream/80 p-5 lg:sticky lg:top-5 lg:h-[calc(100dvh-2.5rem)]">
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto pr-1">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-copper">Исходник</p>
              <h2 className="font-display mt-1 text-3xl leading-none text-ink">Комната</h2>
            </div>

            <RoomUploader
              previewUrl={session.thumbnail}
              disabled={studio.busy}
              onFile={(file) => void studio.analyzePhoto(file)}
            />

            <StyleFilters
              filters={session.styleFilters}
              suggested={session.analysis?.suggestedPresets}
              onToggle={studio.toggleStyle}
              onReset={studio.resetStyleFilters}
              onApplySuggested={studio.applySuggestedStyles}
            />

            <label className="space-y-2">
              <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">Запрос стиля</span>
              <textarea
                rows={3}
                disabled={studio.busy}
                value={session.styleQuery}
                onChange={(event) => studio.updateStyleQuery(event.target.value)}
                placeholder="кафель, стиль хай-тек"
                className="w-full resize-none rounded-2xl border border-line bg-cream px-3.5 py-3 text-sm leading-6 outline-none focus:border-copper disabled:opacity-60"
              />
            </label>

            <div className="space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">Размеры, м · ориентир</p>
              <div className="grid grid-cols-3 gap-2">
                {DIMENSIONS.map((field) => (
                  <label key={field.key}>
                    <span className="mb-1.5 block text-[11px] text-muted">{field.label}</span>
                    <input
                      inputMode="decimal"
                      disabled={studio.busy}
                      value={session.dimensions[field.key]}
                      onChange={(event) =>
                        studio.updateDimensions({ ...session.dimensions, [field.key]: event.target.value })
                      }
                      placeholder="0.0"
                      className="h-11 w-full rounded-xl border border-line bg-cream px-3 text-sm outline-none focus:border-copper disabled:opacity-60"
                    />
                  </label>
                ))}
              </div>
            </div>

            <AnalysisChips
              analysis={session.analysis}
              loading={studio.status === "analyzing"}
              disabled={studio.busy}
              onChange={studio.updateAnalysis}
            />

            {studio.error ? (
              <p className="rounded-xl bg-copper/10 px-3 py-2 text-sm text-copper-dark">{studio.error}</p>
            ) : null}
            {studio.status === "compressing" ? (
              <p className="text-sm text-muted">Сжимаю фото…</p>
            ) : null}
          </div>

          <div className="mt-4 shrink-0 space-y-3 border-t border-line pt-4">
            <div className="flex flex-wrap items-center justify-center gap-1 text-[11px] leading-4">
              {wantedStyles.length === 0 && unwantedStyles.length === 0 ? (
                <span className="text-muted">Стиль не выбран — соберу концепт по фото и текстовому запросу</span>
              ) : null}
              {wantedStyles.map((preset) => (
                <span key={preset} className="rounded-full bg-copper/12 px-2 py-0.5 font-medium text-copper-dark">
                  {stylePresetLabel(preset)}
                </span>
              ))}
              {unwantedStyles.map((preset) => (
                <span
                  key={preset}
                  className="rounded-full border border-dashed border-line-strong px-2 py-0.5 text-muted line-through"
                >
                  {stylePresetLabel(preset)}
                </span>
              ))}
            </div>
            <button
              type="button"
              disabled={studio.busy}
              onClick={() => studio.generateConcept()}
              className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-copper text-sm font-semibold text-white shadow-[0_12px_24px_-12px_rgba(196,92,42,0.9)] transition hover:bg-copper-dark disabled:opacity-50"
            >
              {studio.status === "rendering" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              {studio.status === "rendering" ? "Перевожу запрос для рендера…" : "Сгенерировать концепт"}
            </button>
            <p className="text-center text-xs leading-5 text-muted">
              Gemini переводит запрос на английский, Pollinations рисует концепт по этому промпту.
            </p>
            <DisclaimerBanner compact />
          </div>
        </section>

        <div className="min-h-0 lg:sticky lg:top-5 lg:h-[calc(100dvh-2.5rem)]">
          <ChatPanel
            messages={session.messages}
            streamingText={studio.streamingText}
            draft={draft}
            disabled={studio.busy}
            canGenerate
            generating={studio.status === "rendering"}
            textareaRef={studio.composerRef}
            onDraftChange={setDraft}
            onSend={() => {
              const text = draft;
              setDraft("");
              void studio.sendMessage(text);
            }}
            onGenerate={() => void studio.generateConcept()}
          />
        </div>

        <div className="min-w-0">
          <ResultGallery
            results={session.results}
            onRetrySeed={studio.retrySeed}
            onDelete={studio.deleteResult}
            onClearHistory={() => void studio.clearHistory()}
          />
        </div>
      </div>

      <p className="shrink-0 text-center text-[11px] leading-4 text-muted">
        Бесплатный концепт. Запросы к Gemini на free-tier могут использоваться Google для улучшения продуктов.
      </p>
    </div>
  );
}
