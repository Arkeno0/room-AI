"use client";

import type { RoomDimensions } from "@/lib/types";

type DimensionFieldsProps = {
  value: RoomDimensions;
  disabled?: boolean;
  onChange: (value: RoomDimensions) => void;
};

const FIELDS: { key: keyof RoomDimensions; label: string }[] = [
  { key: "length", label: "Длина" },
  { key: "width", label: "Ширина" },
  { key: "height", label: "Высота" },
];

export function DimensionFields({ value, disabled, onChange }: DimensionFieldsProps) {
  return (
    <div className="space-y-2">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
        Размеры, м
      </p>
      <div className="grid grid-cols-3 gap-2">
        {FIELDS.map((field) => (
          <label key={field.key} className="group relative">
            <span className="mb-1.5 block text-[11px] text-muted">{field.label}</span>
            <input
              inputMode="decimal"
              min="0.5"
              step="0.1"
              disabled={disabled}
              value={value[field.key]}
              onChange={(event) => onChange({ ...value, [field.key]: event.target.value })}
              className="h-11 w-full rounded-xl border border-line bg-cream px-3 pr-8 text-sm text-ink outline-none transition focus:border-copper disabled:opacity-60"
              placeholder="0.0"
            />
            <span className="pointer-events-none absolute right-3 bottom-3 text-[11px] text-muted">м</span>
          </label>
        ))}
      </div>
    </div>
  );
}
