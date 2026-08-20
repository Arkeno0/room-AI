"use client";

import { useCallback, useRef, useState } from "react";
import { ImagePlus, Upload, X } from "lucide-react";
import { cn } from "@/lib/cn";

type PhotoUploadProps = {
  previewUrl: string | null;
  disabled?: boolean;
  onFile: (file: File | null) => void;
};

export function PhotoUpload({ previewUrl, disabled, onFile }: PhotoUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFiles = useCallback(
    (files: FileList | null) => {
      const file = files?.[0];
      if (file) onFile(file);
    },
    [onFile],
  );

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between">
        <label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
          Фото комнаты
        </label>
        <span className="text-[11px] text-muted">JPG · PNG · WEBP</span>
      </div>

      <div
        onDragOver={(event) => {
          event.preventDefault();
          if (!disabled) setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setIsDragging(false);
          if (!disabled) handleFiles(event.dataTransfer.files);
        }}
        className={cn(
          "relative overflow-hidden rounded-2xl border border-dashed transition-all",
          previewUrl ? "border-line bg-cream" : "border-line-strong bg-parchment/60",
          isDragging && "border-copper bg-blush/40",
          disabled && "pointer-events-none opacity-60",
        )}
      >
        {previewUrl ? (
          <div className="relative aspect-[4/3]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={previewUrl} alt="Превью комнаты" className="h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-ink/35 to-transparent" />
            <button
              type="button"
              onClick={() => onFile(null)}
              className="absolute top-3 right-3 inline-flex h-8 w-8 items-center justify-center rounded-full bg-cream/90 text-ink shadow-sm transition hover:bg-cream"
              aria-label="Удалить фото"
            >
              <X className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="absolute bottom-3 left-3 rounded-full bg-cream/90 px-3 py-1.5 text-xs font-medium text-ink shadow-sm"
            >
              Заменить
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-3 px-6 text-center"
          >
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-cream shadow-sm ring-1 ring-line">
              {isDragging ? <Upload className="h-5 w-5 text-copper" /> : <ImagePlus className="h-5 w-5 text-copper" />}
            </span>
            <span className="max-w-[16rem] text-sm leading-6 text-ink-soft">
              Перетащите фото сюда или{" "}
              <span className="font-semibold text-copper">выберите файл</span>
            </span>
          </button>
        )}

        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          onChange={(event) => {
            handleFiles(event.target.files);
            event.target.value = "";
          }}
        />
      </div>
    </div>
  );
}
