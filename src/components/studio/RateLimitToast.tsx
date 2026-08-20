"use client";

import { X } from "lucide-react";

type RateLimitToastProps = {
  message: string | null;
  onClose: () => void;
};

export function RateLimitToast({ message, onClose }: RateLimitToastProps) {
  if (!message) return null;

  return (
    <div
      role="status"
      className="fixed top-4 right-4 z-50 max-w-sm rounded-2xl border border-warn-border bg-cream px-4 py-3 shadow-lg"
    >
      <div className="flex items-start gap-3">
        <p className="text-sm leading-6 text-ink-soft">{message}</p>
        <button
          type="button"
          onClick={onClose}
          className="mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full text-muted hover:bg-parchment"
          aria-label="Закрыть"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
