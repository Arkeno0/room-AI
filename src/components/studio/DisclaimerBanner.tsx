"use client";

import { useState } from "react";
import { AlertTriangle, ChevronDown, ChevronUp } from "lucide-react";
import { CONCEPT_DISCLAIMER } from "@/lib/types";
import { cn } from "@/lib/cn";

export const MOOD_RENDER_BANNER =
  "⚠️ Концепт-рендер (Mood render). Не является 3D-моделью, чертежом в масштабе или стройдокументацией.";

type DisclaimerBannerProps = {
  compact?: boolean;
  className?: string;
};

export function DisclaimerBanner({ compact = false, className }: DisclaimerBannerProps) {
  const [collapsed, setCollapsed] = useState(false);

  if (compact) {
    return (
      <p
        className={cn(
          "rounded-xl border border-warn-border bg-warn px-3 py-2 text-[12px] leading-5 font-medium text-warn-ink",
          className,
        )}
      >
        {MOOD_RENDER_BANNER}
      </p>
    );
  }

  return (
    <aside className={cn("rounded-2xl border border-warn-border bg-warn text-warn-ink", className)}>
      <button
        type="button"
        onClick={() => setCollapsed((value) => !value)}
        className="flex w-full items-start gap-3 px-4 py-3 text-left"
        aria-expanded={!collapsed}
      >
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <span className="flex-1 text-sm leading-6 font-semibold">{MOOD_RENDER_BANNER}</span>
        {collapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
      </button>
      {collapsed ? null : (
        <p className="border-t border-warn-border/70 px-4 py-3 text-xs leading-5">{CONCEPT_DISCLAIMER}</p>
      )}
    </aside>
  );
}
