import {
  MAX_INCLUDED_PRESETS,
  STYLE_PRESET_IDS,
  type StyleFilters,
  type StylePreset,
} from "@/lib/types";

export type StylePresetMeta = {
  label: string;
  /** Одна строка «из чего состоит стиль» — показываем под чипом и в тултипе. */
  hint: string;
};

export const STYLE_PRESET_META: Record<StylePreset, StylePresetMeta> = {
  scandinavian: { label: "Сканди", hint: "светлый дуб, белые стены, лён" },
  japandi: { label: "Джапанди", hint: "тёплое дерево, беж, минимум декора" },
  "mid-century": { label: "Мид-сенчури", hint: "тик, латунь, ретро-палитра" },
  industrial: { label: "Индастриал", hint: "кирпич, чёрный металл, бетон" },
  minimal: { label: "Минимализм", hint: "гладкая штукатурка, нейтральные тона" },
  classic: { label: "Классика", hint: "лепнина, массив дерева, люстра" },
  boho: { label: "Бохо", hint: "ротанг, макраме, много растений" },
  "dark-luxury": { label: "Тёмный люкс", hint: "мрамор, латунь, велюр" },
};

export function stylePresetLabel(preset: StylePreset): string {
  return STYLE_PRESET_META[preset].label;
}

export function includedPresets(filters: StyleFilters | undefined): StylePreset[] {
  if (!filters) return [];
  return STYLE_PRESET_IDS.filter((preset) => filters[preset] === "include");
}

export function excludedPresets(filters: StyleFilters | undefined): StylePreset[] {
  if (!filters) return [];
  return STYLE_PRESET_IDS.filter((preset) => filters[preset] === "exclude");
}

export function primaryPreset(filters: StyleFilters | undefined): StylePreset | undefined {
  return includedPresets(filters)[0];
}

export function isIncludeLimitReached(filters: StyleFilters | undefined): boolean {
  return includedPresets(filters).length >= MAX_INCLUDED_PRESETS;
}

/**
 * Один клик = одно понятное изменение. `include` и `exclude` взаимоисключающие,
 * повторный клик по активному состоянию выключает фильтр.
 */
export function toggleStyleFilter(
  filters: StyleFilters,
  preset: StylePreset,
  mode: "include" | "exclude",
): StyleFilters {
  const next = { ...filters };
  if (next[preset] === mode) {
    delete next[preset];
    return next;
  }
  if (mode === "include" && isIncludeLimitReached(next)) return filters;
  next[preset] = mode;
  return next;
}

export function filtersFromPresets(presets: StylePreset[] | undefined): StyleFilters {
  const filters: StyleFilters = {};
  for (const preset of (presets ?? []).slice(0, MAX_INCLUDED_PRESETS)) {
    filters[preset] = "include";
  }
  return filters;
}

/** Строка для чата/кнопки генерации: «Индастриал + Минимализм, без Классики». */
export function describeStyleFilters(filters: StyleFilters | undefined): string {
  const included = includedPresets(filters).map(stylePresetLabel);
  const excluded = excludedPresets(filters).map(stylePresetLabel);
  const parts: string[] = [];
  if (included.length) parts.push(included.join(" + "));
  if (excluded.length) parts.push(`без ${excluded.join(", ")}`);
  return parts.join(", ");
}
