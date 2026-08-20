"use client";

import { STYLE_PRESETS } from "@/lib/types";
import { cn } from "@/lib/cn";

type StylePromptProps = {
  value: string;
  disabled?: boolean;
  onChange: (value: string) => void;
};

export function StylePrompt({ value, disabled, onChange }: StylePromptProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between">
        <label htmlFor="style-prompt" className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
          Стиль и материалы
        </label>
        <span className="text-[11px] text-muted">{value.length}/240</span>
      </div>

      <textarea
        id="style-prompt"
        rows={4}
        maxLength={240}
        disabled={disabled}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Например: хай-тек, крупноформатная плитка, скрытый свет, минимум декора"
        className="w-full resize-none rounded-2xl border border-line bg-cream px-3.5 py-3 text-sm leading-6 text-ink outline-none transition placeholder:text-muted/80 focus:border-copper disabled:opacity-60"
      />

      <div className="flex flex-wrap gap-1.5">
        {STYLE_PRESETS.map((preset) => (
          <button
            key={preset}
            type="button"
            disabled={disabled}
            onClick={() => onChange(preset)}
            className={cn(
              "rounded-full border px-2.5 py-1 text-[11px] transition",
              value === preset
                ? "border-copper bg-copper text-white"
                : "border-line bg-cream text-ink-soft hover:border-copper/40",
            )}
          >
            {preset}
          </button>
        ))}
      </div>
    </div>
  );
}
