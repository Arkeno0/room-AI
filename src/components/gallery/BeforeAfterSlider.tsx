"use client";

import { useCallback, useRef, useState } from "react";
import { GripVertical } from "lucide-react";
import { cn } from "@/lib/cn";

type BeforeAfterSliderProps = {
  beforeUrl: string;
  afterUrl: string;
  beforeLabel?: string;
  afterLabel?: string;
};

export function BeforeAfterSlider({
  beforeUrl,
  afterUrl,
  beforeLabel = "До",
  afterLabel = "После",
}: BeforeAfterSliderProps) {
  const frameRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState(52);
  const [dragging, setDragging] = useState(false);

  const updateFromClientX = useCallback((clientX: number) => {
    const frame = frameRef.current;
    if (!frame) return;
    const rect = frame.getBoundingClientRect();
    const next = ((clientX - rect.left) / rect.width) * 100;
    setPosition(Math.min(96, Math.max(4, next)));
  }, []);

  return (
    <div
      ref={frameRef}
      className="relative aspect-[16/11] touch-none overflow-hidden rounded-[24px] bg-ink select-none"
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        setDragging(true);
        updateFromClientX(event.clientX);
      }}
      onPointerMove={(event) => {
        if (dragging) updateFromClientX(event.clientX);
      }}
      onPointerUp={() => setDragging(false)}
      onPointerCancel={() => setDragging(false)}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={afterUrl} alt="После" className="absolute inset-0 h-full w-full object-cover" />
      <div className="absolute inset-0" style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={beforeUrl} alt="До" className="h-full w-full object-cover" />
      </div>

      <div
        className="absolute inset-y-0 z-10 w-px bg-cream/90"
        style={{ left: `${position}%` }}
      >
        <div className="absolute top-1/2 left-1/2 flex h-10 w-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-cream/40 bg-cream text-ink shadow-lg">
          <GripVertical className="h-4 w-4" />
        </div>
      </div>

      <span className="absolute top-3 left-3 rounded-full bg-ink/70 px-2.5 py-1 text-[11px] font-medium tracking-wide text-cream uppercase">
        {beforeLabel}
      </span>
      <span className="absolute top-3 right-3 rounded-full bg-cream/90 px-2.5 py-1 text-[11px] font-medium tracking-wide text-ink uppercase">
        {afterLabel}
      </span>

      <input
        type="range"
        min={4}
        max={96}
        value={position}
        aria-label="Сравнение до и после"
        onChange={(event) => setPosition(Number(event.target.value))}
        className={cn("absolute inset-0 z-20 cursor-ew-resize opacity-0", dragging && "cursor-grabbing")}
      />
    </div>
  );
}
