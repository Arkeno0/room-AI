"use client";

import { Plus } from "lucide-react";

type HeaderProps = {
  onReset: () => void;
};

export function Header({ onReset }: HeaderProps) {
  return (
    <header className="flex items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-ink text-cream">
          <span className="font-display text-lg leading-none">A</span>
        </div>
        <div>
          <p className="font-display text-2xl leading-none text-ink">Atelier</p>
          <p className="mt-1 text-[11px] tracking-[0.18em] text-muted uppercase">AI-дизайнер интерьеров</p>
        </div>
      </div>

      <button
        type="button"
        onClick={onReset}
        className="inline-flex items-center gap-2 rounded-full border border-line bg-cream px-3 py-2 text-sm text-ink-soft transition hover:border-copper/40"
      >
        <Plus className="h-4 w-4" />
        Новый проект
      </button>
    </header>
  );
}
