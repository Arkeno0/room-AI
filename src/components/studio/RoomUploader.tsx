"use client";

import { useRef, useState } from "react";
import { ImagePlus, Upload, X } from "lucide-react";
import { cn } from "@/lib/cn";

type RoomUploaderProps = {
  previewUrl: string | null;
  disabled?: boolean;
  onFile: (file: File) => void;
  onClear?: () => void;
};

export function RoomUploader({ previewUrl, disabled, onFile, onClear }: RoomUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between">
        <label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">Фото комнаты</label>
        <span className="text-[11px] text-muted">JPG · PNG · WEBP</span>
      </div>

      <div
        onDragOver={(event) => {
          event.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          const file = event.dataTransfer.files[0];
          if (file && !disabled) onFile(file);
        }}
        className={cn(
          "relative overflow-hidden rounded-2xl border border-dashed transition",
          previewUrl ? "border-line bg-cream" : "border-line-strong bg-parchment/70",
          dragging && "border-copper bg-blush/50",
          disabled && "pointer-events-none opacity-60",
        )}
      >
        {previewUrl ? (
          <div className="relative aspect-[4/3]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={previewUrl} alt="Исходное фото комнаты" className="h-full w-full object-cover" />
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="absolute bottom-3 left-3 rounded-full bg-cream/90 px-3 py-1.5 text-xs font-medium"
            >
              Заменить
            </button>
            {onClear ? (
              <button
                type="button"
                onClick={onClear}
                className="absolute top-3 right-3 inline-flex h-8 w-8 items-center justify-center rounded-full bg-cream/90"
                aria-label="Удалить фото"
              >
                <X className="h-4 w-4" />
              </button>
            ) : null}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-3 px-6 text-center"
          >
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-cream ring-1 ring-line">
              {dragging ? <Upload className="h-5 w-5 text-copper" /> : <ImagePlus className="h-5 w-5 text-copper" />}
            </span>
            <span className="text-sm leading-6 text-ink-soft">
              Перетащите фото сюда или <span className="font-semibold text-copper">выберите файл</span>
            </span>
          </button>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) onFile(file);
            event.target.value = "";
          }}
        />
      </div>
    </div>
  );
}
