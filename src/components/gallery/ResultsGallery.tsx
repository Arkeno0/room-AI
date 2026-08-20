"use client";

import { BeforeAfterSlider } from "@/components/gallery/BeforeAfterSlider";
import type { DesignResult } from "@/lib/types";
import { cn } from "@/lib/cn";

type ResultsGalleryProps = {
  results: DesignResult[];
  activeResult: DesignResult | undefined;
  onSelect: (id: string) => void;
};

export function ResultsGallery({ results, activeResult, onSelect }: ResultsGalleryProps) {
  return (
    <section className="flex h-full min-h-0 flex-col rounded-[28px] border border-line bg-cream/80 p-5 shadow-[0_20px_50px_-32px_rgba(28,23,20,0.45)]">
      <div className="mb-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-copper">Галерея</p>
        <h2 className="font-display mt-1 text-3xl leading-none text-ink">До / После</h2>
      </div>

      {activeResult ? (
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
          <BeforeAfterSlider beforeUrl={activeResult.beforeUrl} afterUrl={activeResult.afterUrl} />

          <div>
            <p className="font-display text-xl text-ink">{activeResult.title}</p>
            <p className="mt-1 text-sm leading-6 text-muted">{activeResult.prompt}</p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {results.map((result) => (
              <button
                key={result.id}
                type="button"
                onClick={() => onSelect(result.id)}
                className={cn(
                  "overflow-hidden rounded-2xl border text-left transition",
                  result.id === activeResult.id ? "border-copper ring-2 ring-copper/20" : "border-line hover:border-copper/40",
                )}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={result.afterUrl} alt={result.title} className="aspect-[16/10] w-full object-cover" />
                <div className="px-2.5 py-2">
                  <p className="truncate text-xs font-medium text-ink">{result.title}</p>
                  <p className="text-[10px] uppercase tracking-wider text-muted">
                    {result.isDemo ? "Пример" : "Рендер"}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex flex-1 items-center justify-center rounded-2xl border border-dashed border-line text-sm text-muted">
          Здесь появятся рендеры
        </div>
      )}
    </section>
  );
}
