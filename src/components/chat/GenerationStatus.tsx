"use client";

import { Check } from "lucide-react";
import type { GenerationJob } from "@/lib/types";
import { GENERATION_STEPS } from "@/lib/studio-copy";
import { cn } from "@/lib/cn";

type GenerationStatusProps = {
  job: GenerationJob;
};

export function GenerationStatus({ job }: GenerationStatusProps) {
  return (
    <div className="w-full max-w-[34rem] overflow-hidden rounded-3xl border border-line bg-parchment/70 p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-ink">{job.label}</p>
        <span className="text-[11px] tracking-wide text-muted">{job.progress}%</span>
      </div>

      <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-line">
        <div
          className="h-full rounded-full bg-copper transition-all duration-500"
          style={{ width: `${job.progress}%` }}
        />
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        {GENERATION_STEPS.filter((step) => step.step !== "done").map((step) => {
          const done =
            GENERATION_STEPS.findIndex((item) => item.step === job.step) >
            GENERATION_STEPS.findIndex((item) => item.step === step.step);
          const active = job.step === step.step;

          return (
            <div
              key={step.step}
              className={cn(
                "rounded-2xl px-3 py-2 text-[11px] leading-4",
                active ? "bg-cream text-ink" : "text-muted",
              )}
            >
              <span className="mb-1 flex items-center gap-1.5">
                {done ? (
                  <Check className="h-3.5 w-3.5 text-sage" />
                ) : (
                  <span
                    className={cn(
                      "h-1.5 w-1.5 rounded-full",
                      active ? "animate-[atelier-pulse_1.2s_ease-in-out_infinite] bg-copper" : "bg-line-strong",
                    )}
                  />
                )}
                {step.label}
              </span>
            </div>
          );
        })}
      </div>

      <div className="mt-4 overflow-hidden rounded-2xl">
        <div className="skeleton-shimmer aspect-[16/10] w-full" />
        <div className="mt-2 grid grid-cols-3 gap-2">
          <div className="skeleton-shimmer h-3 rounded-full" />
          <div className="skeleton-shimmer h-3 rounded-full" />
          <div className="skeleton-shimmer h-3 rounded-full opacity-60" />
        </div>
      </div>
    </div>
  );
}
