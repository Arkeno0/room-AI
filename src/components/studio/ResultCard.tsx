"use client";

import { useEffect, useState } from "react";
import { Download, RefreshCw, Trash2 } from "lucide-react";
import type { StudioResult } from "@/lib/idb";

export const RESULT_DISCLAIMER =
  "Концепт-рендер (Mood render), не является 3D-моделью или чертежом";

const CONCEPT_ALT = "Концепт интерьера, не чертёж";

type ResultCardProps = {
  result: StudioResult;
  onRetrySeed: (id: string) => void;
  onDelete: (id: string) => void;
};

export function ResultCard({ result, onRetrySeed, onDelete }: ResultCardProps) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [retried, setRetried] = useState(false);
  const [cacheBust, setCacheBust] = useState(0);

  useEffect(() => {
    setLoaded(false);
    setFailed(false);
    setRetried(false);
    setCacheBust(0);
  }, [result.url]);

  const imageSrc = cacheBust
    ? `${result.url}${result.url.includes("?") ? "&" : "?"}retry=${cacheBust}`
    : result.url;

  const download = async () => {
    try {
      const response = await fetch(result.url);
      const blob = await response.blob();
      const href = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = href;
      link.download = `concept-${result.seed}.jpg`;
      link.click();
      URL.revokeObjectURL(href);
    } catch {
      window.open(result.url, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <article className="overflow-hidden rounded-2xl border border-line bg-cream">
      <div className="relative aspect-[16/10] bg-parchment">
        {loaded || failed ? null : <div className="skeleton-shimmer absolute inset-0" aria-hidden />}
        {failed ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-4 text-center">
            <p className="text-sm text-ink-soft">Не удалось загрузить концепт</p>
            <button
              type="button"
              onClick={() => onRetrySeed(result.id)}
              className="inline-flex items-center gap-1.5 rounded-full bg-ink px-3 py-1.5 text-xs text-cream"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Попробовать ещё seed
            </button>
          </div>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageSrc}
            alt={CONCEPT_ALT}
            referrerPolicy="no-referrer"
            className={`h-full w-full object-cover ${loaded ? "opacity-100" : "opacity-0"}`}
            onLoad={() => setLoaded(true)}
            onError={() => {
              if (!retried) {
                setRetried(true);
                window.setTimeout(() => setCacheBust(Date.now()), 2000);
                return;
              }
              setFailed(true);
            }}
          />
        )}
        <p className="absolute inset-x-2 bottom-2 rounded-lg border border-warn-border/80 bg-warn/90 px-2 py-1 text-[10px] leading-4 font-medium text-warn-ink">
          {RESULT_DISCLAIMER}
        </p>
      </div>
      <div className="flex items-center justify-between gap-2 px-3 py-2">
        <p className="truncate text-[11px] tracking-wide text-muted uppercase">seed {result.seed}</p>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => onDelete(result.id)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-line text-copper-dark hover:bg-copper/10"
            aria-label="Удалить концепт"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onRetrySeed(result.id)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-line"
            aria-label="Другой seed"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => void download()}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-line"
            aria-label="Скачать концепт"
          >
            <Download className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </article>
  );
}
