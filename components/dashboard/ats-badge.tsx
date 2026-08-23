import { cn } from "@/lib/utils";

/**
 * Surfaces the Phase 5 ATS score on the dashboard.
 *
 * Computed on the server from the stored document with the same
 * deterministic analyzer the editor uses, so the badge and the analysis
 * panel can never disagree.
 */
export function AtsBadge({ score }: { score: number }) {
  const tone =
    score >= 85
      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
      : score >= 65
        ? "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400"
        : "border-destructive/30 bg-destructive/10 text-destructive";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium tabular-nums",
        tone
      )}
      title={`ATS compatibility score: ${score} out of 100`}
    >
      ATS {score}
    </span>
  );
}
