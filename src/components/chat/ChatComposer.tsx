"use client";

import { useState } from "react";
import { Send } from "lucide-react";

type ChatComposerProps = {
  disabled?: boolean;
  onSend: (value: string) => void;
};

export function ChatComposer({ disabled, onSend }: ChatComposerProps) {
  const [value, setValue] = useState("");

  const submit = () => {
    if (!value.trim() || disabled) return;
    onSend(value);
    setValue("");
  };

  return (
    <form
      className="flex items-end gap-2 rounded-[22px] border border-line bg-cream p-2"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <textarea
        rows={1}
        disabled={disabled}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            submit();
          }
        }}
        placeholder="Уточните: теплее свет, меньше декора, другая плитка…"
        className="max-h-28 min-h-11 flex-1 resize-none bg-transparent px-3 py-2.5 text-sm leading-6 text-ink outline-none placeholder:text-muted disabled:opacity-60"
      />
      <button
        type="submit"
        disabled={disabled || !value.trim()}
        className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-ink text-cream transition hover:bg-ink-soft disabled:opacity-40"
        aria-label="Отправить сообщение"
      >
        <Send className="h-4 w-4" />
      </button>
    </form>
  );
}
