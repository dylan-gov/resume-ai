"use client";

import { useState } from "react";
import { Check, ChevronDown, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Score } from "@/lib/analysis/types";

function toneFor(value: number): string {
  if (value >= 80) return "text-emerald-600 dark:text-emerald-400";
  if (value >= 55) return "text-amber-600 dark:text-amber-400";
  return "text-destructive";
}

/**
 * A score is never shown without the checks that produced it — expanding
 * the card reveals exactly what passed, what failed, and how to fix it.
 */
export function ScoreCard({ title, score }: { title: string; score: Score }) {
  const [open, setOpen] = useState(false);
  const failed = score.checks.filter((c) => !c.passed);

  return (
    <div className="rounded-xl border border-border bg-card">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left"
      >
        <div className="min-w-0">
          <p className="text-sm font-medium">{title}</p>
          <p className="text-xs text-muted-foreground">
            {failed.length === 0
              ? `All ${score.checks.length} checks passed`
              : `${failed.length} of ${score.checks.length} checks need attention`}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className={cn("text-xl font-semibold tabular-nums", toneFor(score.value))}>
            {score.value}
          </span>
          <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} />
        </div>
      </button>

      {open && (
        <ul className="flex flex-col gap-1 border-t border-border px-3 py-2">
          {score.checks.map((check) => (
            <li key={check.id} className="flex items-start gap-2 text-xs">
              {check.passed ? (
                <Check className="mt-0.5 size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <X className="mt-0.5 size-3.5 shrink-0 text-destructive" />
              )}
              <div className="min-w-0">
                <p className={cn(!check.passed && "font-medium")}>{check.label}</p>
                <p className="text-muted-foreground">{check.detail}</p>
                {check.howToImprove && (
                  <p className="mt-0.5 text-amber-700 dark:text-amber-400">
                    {check.howToImprove}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
