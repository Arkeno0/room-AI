"use client";

import { useRef, useState } from "react";
import { Plus, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { compactObjectName, sanitizePromptTag } from "@/lib/ai/prompts";
import type { RoomAnalysis } from "@/lib/types";

type AnalysisChipsProps = {
  analysis: RoomAnalysis | null;
  loading?: boolean;
  disabled?: boolean;
  onChange?: (analysis: RoomAnalysis) => void;
};

type ChipKind = "keep" | "color" | "meta" | "issue";

const META_FIELDS = [
  { key: "roomType", hint: "тип комнаты" },
  { key: "viewpoint", hint: "ракурс" },
  { key: "lighting", hint: "свет" },
] as const;

function unique(list: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of list) {
    const trimmed = compactObjectName(item) || sanitizePromptTag(item);
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
  }
  return out.slice(0, 16);
}

function EditableChip({
  label,
  kind,
  lockedHint,
  disabled,
  onCommit,
  onRemove,
}: {
  label: string;
  kind: ChipKind;
  lockedHint?: boolean;
  disabled?: boolean;
  onCommit: (next: string) => void;
  onRemove: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(label);
  const inputRef = useRef<HTMLInputElement>(null);

  const startEdit = () => {
    if (disabled) return;
    setDraft(label);
    setEditing(true);
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
  };

  const finish = (save: boolean) => {
    setEditing(false);
    const next = draft.trim();
    if (!save) {
      setDraft(label);
      return;
    }
    if (!next) {
      onRemove();
      return;
    }
    if (next !== label) onCommit(next);
  };

  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-0.5 rounded-full border pl-2.5 pr-1 py-0.5 text-[11px] leading-4",
        kind === "color"
          ? "border-blush bg-blush/50 text-ink"
          : kind === "issue"
            ? "border-warn-border/60 bg-warn/40 text-warn-ink"
            : lockedHint
              ? "border-copper/40 bg-copper/8 text-ink"
              : "border-line bg-cream text-ink-soft",
      )}
    >
      {editing ? (
        <input
          ref={inputRef}
          value={draft}
          disabled={disabled}
          size={Math.max(draft.length, 8)}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={() => finish(true)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              finish(true);
            }
            if (event.key === "Escape") {
              event.preventDefault();
              finish(false);
            }
          }}
          className="min-w-[4.5rem] max-w-[14rem] bg-transparent outline-none"
        />
      ) : (
        <button
          type="button"
          disabled={disabled}
          title="Нажмите, чтобы переименовать"
          onClick={startEdit}
          className="max-w-[14rem] truncate text-left disabled:cursor-default"
        >
          {label}
        </button>
      )}
      <button
        type="button"
        disabled={disabled}
        aria-label={`Убрать «${label}»`}
        title="Убрать из концепта"
        onClick={onRemove}
        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-muted transition hover:bg-ink/8 hover:text-ink disabled:opacity-40"
      >
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}

function AddChip({
  placeholder,
  disabled,
  onAdd,
}: {
  placeholder: string;
  disabled?: boolean;
  onAdd: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const commit = () => {
    const value = draft.trim();
    setDraft("");
    setOpen(false);
    if (value) onAdd(value);
  };

  if (!open) {
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          setOpen(true);
          requestAnimationFrame(() => inputRef.current?.focus());
        }}
        className="inline-flex items-center gap-1 rounded-full border border-dashed border-line px-2 py-0.5 text-[11px] text-muted transition hover:border-copper/40 hover:text-ink disabled:opacity-40"
      >
        <Plus className="h-3 w-3" />
        {placeholder}
      </button>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-copper/40 bg-cream px-2 py-0.5">
      <input
        ref={inputRef}
        value={draft}
        disabled={disabled}
        placeholder={placeholder}
        size={Math.max(draft.length, placeholder.length, 10)}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            commit();
          }
          if (event.key === "Escape") {
            setDraft("");
            setOpen(false);
          }
        }}
        className="min-w-[6rem] max-w-[14rem] bg-transparent text-[11px] outline-none"
      />
    </span>
  );
}

export function AnalysisChips({ analysis, loading, disabled, onChange }: AnalysisChipsProps) {
  if (loading) {
    return (
      <div className="space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">Анализ комнаты</p>
        <div className="flex flex-wrap gap-1.5">
          <span className="skeleton-shimmer h-6 w-24 rounded-full" />
          <span className="skeleton-shimmer h-6 w-32 rounded-full" />
          <span className="skeleton-shimmer h-6 w-20 rounded-full" />
        </div>
      </div>
    );
  }

  if (!analysis) return null;

  const patch = (next: RoomAnalysis) => onChange?.(next);
  const keep = unique(analysis.architecturalKeep);
  const mustKeep = unique(analysis.mustKeepElements ?? []);
  const colors = unique(analysis.colorPalette);
  const issues = unique(analysis.issues);
  const canEdit = Boolean(onChange) && !disabled;

  const renameKeep = (from: string, to: string) => {
    patch({
      ...analysis,
      architecturalKeep: unique(keep.map((item) => (item === from ? to : item))),
      mustKeepElements: unique(mustKeep.map((item) => (item === from ? to : item))),
    });
  };

  const removeKeep = (value: string) => {
    patch({
      ...analysis,
      architecturalKeep: keep.filter((item) => item !== value),
      mustKeepElements: mustKeep.filter((item) => item !== value),
    });
  };

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">Что сохраняем</p>
        <div className="flex flex-wrap gap-1.5">
          {META_FIELDS.map((field) => {
            const value = sanitizePromptTag(analysis[field.key]);
            if (!value) return null;
            return (
              <EditableChip
                key={field.key}
                label={value}
                kind="meta"
                disabled={!canEdit}
                onCommit={(next) => patch({ ...analysis, [field.key]: sanitizePromptTag(next) })}
                onRemove={() => patch({ ...analysis, [field.key]: "" })}
              />
            );
          })}
          {keep.map((item) => (
            <EditableChip
              key={`keep-${item}`}
              label={item}
              kind="keep"
              lockedHint={mustKeep.includes(item)}
              disabled={!canEdit}
              onCommit={(next) => renameKeep(item, next)}
              onRemove={() => removeKeep(item)}
            />
          ))}
          {canEdit ? (
            <AddChip
              placeholder="добавить"
              onAdd={(value) =>
                patch({
                  ...analysis,
                  architecturalKeep: unique([...keep, value]),
                })
              }
            />
          ) : null}
        </div>
      </div>

      {colors.length > 0 || canEdit ? (
        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">Цвета</p>
          <div className="flex flex-wrap gap-1.5">
            {colors.map((item) => (
              <EditableChip
                key={`color-${item}`}
                label={item}
                kind="color"
                disabled={!canEdit}
                onCommit={(next) =>
                  patch({
                    ...analysis,
                    colorPalette: unique(colors.map((color) => (color === item ? next : color))),
                  })
                }
                onRemove={() =>
                  patch({
                    ...analysis,
                    colorPalette: colors.filter((color) => color !== item),
                  })
                }
              />
            ))}
            {canEdit ? (
              <AddChip
                placeholder="цвет"
                onAdd={(value) => patch({ ...analysis, colorPalette: unique([...colors, value]) })}
              />
            ) : null}
          </div>
        </div>
      ) : null}

      {issues.length > 0 ? (
        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">Заметки</p>
          <div className="flex flex-wrap gap-1.5">
            {issues.map((item) => (
              <EditableChip
                key={`issue-${item}`}
                label={item}
                kind="issue"
                disabled={!canEdit}
                onCommit={(next) =>
                  patch({
                    ...analysis,
                    issues: unique(issues.map((issue) => (issue === item ? next : issue))),
                  })
                }
                onRemove={() =>
                  patch({
                    ...analysis,
                    issues: issues.filter((issue) => issue !== item),
                  })
                }
              />
            ))}
          </div>
        </div>
      ) : null}

      <p className="text-[11px] leading-4 text-muted">
        Клик по тегу — переименовать, крестик — убрать. Изменения попадут в следующий концепт.
      </p>
    </div>
  );
}
