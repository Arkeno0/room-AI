"use client";

import { Loader2, Sparkles } from "lucide-react";
import { DimensionFields } from "@/components/dashboard/DimensionFields";
import { PhotoUpload } from "@/components/dashboard/PhotoUpload";
import { StylePrompt } from "@/components/dashboard/StylePrompt";
import type { RoomBrief } from "@/lib/types";

type BriefPanelProps = {
  brief: RoomBrief;
  error: string | null;
  isGenerating: boolean;
  onPhoto: (file: File | null) => void;
  onChange: (patch: Partial<RoomBrief>) => void;
  onSubmit: () => void;
};

export function BriefPanel({
  brief,
  error,
  isGenerating,
  onPhoto,
  onChange,
  onSubmit,
}: BriefPanelProps) {
  return (
    <section className="flex h-full min-h-0 flex-col rounded-[28px] border border-line bg-cream/80 p-5 shadow-[0_20px_50px_-32px_rgba(28,23,20,0.45)]">
      <div className="mb-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-copper">Бриф проекта</p>
        <h2 className="font-display mt-1 text-3xl leading-none text-ink">Комната</h2>
      </div>

      <form
        className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto pr-1"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
      >
        <PhotoUpload previewUrl={brief.photoUrl} disabled={isGenerating} onFile={onPhoto} />
        <DimensionFields
          value={{ length: brief.length, width: brief.width, height: brief.height }}
          disabled={isGenerating}
          onChange={(dimensions) => onChange(dimensions)}
        />
        <StylePrompt
          value={brief.prompt}
          disabled={isGenerating}
          onChange={(prompt) => onChange({ prompt })}
        />

        {error ? (
          <p className="rounded-xl bg-copper/10 px-3 py-2 text-sm text-copper-dark">{error}</p>
        ) : null}

        <button
          type="submit"
          disabled={isGenerating}
          className="mt-auto inline-flex h-12 items-center justify-center gap-2 rounded-full bg-copper text-sm font-semibold text-white shadow-[0_12px_24px_-12px_rgba(196,92,42,0.9)] transition hover:bg-copper-dark disabled:opacity-60"
        >
          {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {isGenerating ? "Собираю концепцию" : "Создать концепцию"}
        </button>
      </form>
    </section>
  );
}
