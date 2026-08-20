"use client";

import type { RefObject } from "react";
import { Loader2, Send, Sparkles } from "lucide-react";
import { DisclaimerBanner } from "@/components/studio/DisclaimerBanner";

type PromptComposerProps = {
  value: string;
  disabled?: boolean;
  canGenerate?: boolean;
  generating?: boolean;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  onChange: (value: string) => void;
  onSend: () => void;
  onGenerate: () => void;
};

export function PromptComposer({
  value,
  disabled,
  canGenerate,
  generating,
  textareaRef,
  onChange,
  onSend,
  onGenerate,
}: PromptComposerProps) {
  return (
    <div className="space-y-3">
      <form
        className="rounded-[22px] border border-line bg-cream p-2"
        onSubmit={(event) => {
          event.preventDefault();
          onSend();
        }}
      >
        <textarea
          ref={textareaRef}
          rows={2}
          disabled={disabled}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              onSend();
            }
          }}
          placeholder="Обсудите детали с дизайнером: кафель, стиль хай-тек, теплее свет…"
          className="max-h-32 min-h-16 w-full resize-none bg-transparent px-3 py-2 text-sm leading-6 text-ink outline-none placeholder:text-muted disabled:opacity-60"
        />
        <div className="flex flex-wrap gap-2 p-1">
          <button
            type="submit"
            disabled={disabled || !value.trim()}
            className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-full bg-ink text-sm font-medium text-cream disabled:opacity-40"
          >
            <Send className="h-4 w-4" />
            Отправить
          </button>
          <button
            type="button"
            disabled={disabled || !canGenerate}
            onClick={onGenerate}
            className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-full bg-copper text-sm font-medium text-white disabled:opacity-40"
          >
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {generating ? "Рендер концепта…" : "Сгенерировать концепт"}
          </button>
        </div>
      </form>
      <DisclaimerBanner compact />
    </div>
  );
}
