"use client";

import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { ResultCard } from "@/components/studio/ResultCard";
import type { StudioResult } from "@/lib/idb";

type ResultGalleryProps = {
  results: StudioResult[];
  onRetrySeed: (id: string) => void;
  onDelete: (id: string) => void;
  onClearHistory: () => void;
};

export function ResultGallery({ results, onRetrySeed, onDelete, onClearHistory }: ResultGalleryProps) {
  const [confirmClear, setConfirmClear] = useState(false);
  const items = [...results].reverse();
  const hasHistory = results.length > 0;

  useEffect(() => {
    if (!confirmClear) return;
    const timer = window.setTimeout(() => setConfirmClear(false), 4000);
    return () => window.clearTimeout(timer);
  }, [confirmClear]);

  return (
    <section className="flex flex-col rounded-[28px] border border-line bg-cream/80 p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-copper">Галерея</p>
          <h2 className="font-display mt-1 text-3xl leading-none text-ink">Концепты</h2>
        </div>
        {hasHistory ? (
          <button
            type="button"
            onClick={() => {
              if (!confirmClear) {
                setConfirmClear(true);
                return;
              }
              onClearHistory();
              setConfirmClear(false);
            }}
            className="inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-xs text-ink-soft hover:border-copper/40"
          >
            <Trash2 className="h-3.5 w-3.5" />
            {confirmClear ? "Точно очистить?" : "Очистить"}
          </button>
        ) : null}
      </div>

      {items.length === 0 ? (
        <div className="flex min-h-40 items-center justify-center rounded-2xl border border-dashed border-line text-sm text-muted">
          Здесь появятся концепт-рендеры — по два на экран
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {items.map((result) => (
            <ResultCard key={result.id} result={result} onRetrySeed={onRetrySeed} onDelete={onDelete} />
          ))}
        </div>
      )}
    </section>
  );
}
