"use client";

import { Ban, Check, RotateCcw, Wand2 } from "lucide-react";
import { cn } from "@/lib/cn";
import {
  STYLE_PRESET_META,
  excludedPresets,
  includedPresets,
  isIncludeLimitReached,
} from "@/lib/style-presets";
import {
  MAX_INCLUDED_PRESETS,
  STYLE_PRESET_IDS,
  type StyleFilterMode,
  type StyleFilters as StyleFiltersValue,
  type StylePreset,
} from "@/lib/types";

type StyleFiltersProps = {
  filters: StyleFiltersValue;
  suggested?: StylePreset[];
  disabled?: boolean;
  onToggle: (preset: StylePreset, mode: StyleFilterMode) => void;
  onReset: () => void;
  onApplySuggested?: () => void;
};

export function StyleFilters({
  filters,
  suggested = [],
  disabled,
  onToggle,
  onReset,
  onApplySuggested,
}: StyleFiltersProps) {
  const included = includedPresets(filters);
  const excluded = excludedPresets(filters);
  const limitReached = isIncludeLimitReached(filters);
  const hasAny = included.length + excluded.length > 0;
  const canSuggest = Boolean(onApplySuggested) && suggested.length > 0;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
          Стиль
          <span className="ml-1.5 font-sans text-[11px] normal-case tracking-normal text-copper">
            {included.length}/{MAX_INCLUDED_PRESETS}
          </span>
        </p>
        <div className="flex items-center gap-1">
          {canSuggest ? (
            <button
              type="button"
              disabled={disabled}
              onClick={onApplySuggested}
              title="Взять стили, которые предложил анализ фото"
              className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] text-copper transition hover:bg-copper/10 disabled:opacity-50"
            >
              <Wand2 className="h-3 w-3" />
              Совет
            </button>
          ) : null}
          {hasAny ? (
            <button
              type="button"
              disabled={disabled}
              onClick={onReset}
              className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] text-muted transition hover:bg-ink/5 hover:text-ink disabled:opacity-50"
            >
              <RotateCcw className="h-3 w-3" />
              Сбросить
            </button>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-1.5">
        {STYLE_PRESET_IDS.map((preset) => {
          const state = filters[preset];
          const meta = STYLE_PRESET_META[preset];
          const isIncluded = state === "include";
          const isExcluded = state === "exclude";
          const hint = suggested.includes(preset);
          const includeBlocked = !isIncluded && limitReached;

          return (
            <div
              key={preset}
              className={cn(
                "flex items-center gap-0.5 rounded-xl border p-0.5 transition",
                isIncluded
                  ? "border-copper bg-copper text-white shadow-[0_8px_16px_-12px_rgba(196,92,42,0.9)]"
                  : isExcluded
                    ? "border-dashed border-line-strong bg-parchment text-muted"
                    : hint
                      ? "border-copper/40 bg-blush/60 text-ink"
                      : "border-line bg-cream text-ink-soft",
              )}
            >
              <button
                type="button"
                disabled={disabled || includeBlocked}
                aria-pressed={isIncluded}
                onClick={() => onToggle(preset, "include")}
                title={
                  includeBlocked
                    ? `Максимум ${MAX_INCLUDED_PRESETS} стиля — снимите один, чтобы добавить этот`
                    : `${meta.label}: ${meta.hint}`
                }
                className={cn(
                  "flex min-w-0 flex-1 items-center gap-1 rounded-[10px] px-1.5 py-1.5 text-left transition",
                  isIncluded ? "hover:bg-white/10" : "hover:bg-ink/5",
                  disabled || includeBlocked ? "cursor-not-allowed opacity-60" : "cursor-pointer",
                )}
              >
                <span
                  className={cn(
                    "flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border",
                    isIncluded
                      ? "border-white bg-white text-copper"
                      : isExcluded
                        ? "border-line-strong"
                        : hint
                          ? "border-copper/60"
                          : "border-line-strong",
                  )}
                >
                  {isIncluded ? <Check className="h-2.5 w-2.5" strokeWidth={3.5} /> : null}
                </span>
                <span
                  className={cn(
                    "truncate text-[11px] leading-4",
                    isExcluded && "line-through decoration-muted/70",
                  )}
                >
                  {meta.label}
                </span>
              </button>

              <button
                type="button"
                disabled={disabled}
                aria-pressed={isExcluded}
                onClick={() => onToggle(preset, "exclude")}
                title={isExcluded ? `${meta.label}: вернуть в выбор` : `${meta.label}: исключить из концепта`}
                className={cn(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-[10px] transition disabled:opacity-50",
                  isExcluded
                    ? "bg-ink/10 text-ink-soft"
                    : isIncluded
                      ? "text-white/60 hover:bg-white/15 hover:text-white"
                      : "text-muted/60 hover:bg-ink/5 hover:text-ink",
                )}
              >
                <Ban className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        })}
      </div>

      <p className="text-[11px] leading-4 text-muted">
        Клик по названию — стиль идёт в концепт. <Ban className="mb-0.5 inline h-3 w-3" /> — стиль запрещён в рендере.
        Повторный клик снимает фильтр.
      </p>
    </div>
  );
}
