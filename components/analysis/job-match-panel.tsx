"use client";

import { useState, useTransition } from "react";
import { Loader2, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { resumeStore } from "@/lib/store/resume-store";
import { matchJobDescriptionAction } from "@/app/actions/analysis";
import type { JobMatch } from "@/lib/analysis/types";

function toneFor(value: number): string {
  if (value >= 75) return "text-emerald-600 dark:text-emerald-400";
  if (value >= 50) return "text-amber-600 dark:text-amber-400";
  return "text-destructive";
}

export function JobMatchPanel({ onKeywords }: { onKeywords?: (terms: string[]) => void }) {
  const [jobDescription, setJobDescription] = useState("");
  const [match, setMatch] = useState<JobMatch | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function analyze() {
    setError(null);
    startTransition(async () => {
      const result = await matchJobDescriptionAction(
        resumeStore.getState().present,
        jobDescription
      );
      if (!result.ok) {
        setError(result.error);
        setMatch(null);
        return;
      }
      setMatch(result.data);
      // Terms the user already demonstrates can be woven into rewrites.
      onKeywords?.([...result.data.matches, ...result.data.synonyms].map((m) => m.keyword.term));
    });
  }

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border bg-card p-3">
      <h3 className="flex items-center gap-2 text-sm font-medium">
        <Target className="size-4" />
        Match against a job description
      </h3>

      <Textarea
        aria-label="Job description"
        placeholder="Paste the job description here…"
        value={jobDescription}
        onChange={(e) => setJobDescription(e.target.value)}
        className="min-h-24 text-xs"
      />

      <Button size="sm" className="self-start" disabled={pending} onClick={analyze}>
        {pending && <Loader2 className="size-4 animate-spin" />}
        Analyze match
      </Button>

      {error && <p className="text-xs text-destructive">{error}</p>}

      {match && (
        <div className="flex flex-col gap-2">
          <div className="rounded-lg border border-border p-2">
            <div className="flex items-baseline justify-between">
              <span className="text-xs font-medium">Keyword coverage</span>
              <span className={cn("text-2xl font-semibold tabular-nums", toneFor(match.score))}>
                {match.score}%
              </span>
            </div>
            {/* The math, not just the number. */}
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {match.matchedWeight} of {match.totalWeight} weighted keyword points covered —{" "}
              {match.matches.length} matched, {match.synonyms.length} under different wording,{" "}
              {match.missing.length} missing.
            </p>
          </div>

          {match.synonyms.length > 0 && (
            <div>
              <p className="mb-1 text-xs font-medium">Already covered, worded differently</p>
              <ul className="flex flex-wrap gap-1">
                {match.synonyms.map((m) => (
                  <li
                    key={m.keyword.term}
                    className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[11px]"
                    title={`Your resume says "${m.matchedAs}"`}
                  >
                    {m.keyword.term} → {m.matchedAs}
                  </li>
                ))}
              </ul>
              <p className="mt-1 text-[11px] text-muted-foreground">
                No change needed — these already count.
              </p>
            </div>
          )}

          {match.missing.length > 0 && (
            <div>
              <p className="mb-1 text-xs font-medium">
                Genuinely missing, most important first
              </p>
              <ul className="flex flex-wrap gap-1">
                {match.missing.slice(0, 20).map((m) => (
                  <li
                    key={m.keyword.term}
                    className={cn(
                      "rounded-full border px-2 py-0.5 text-[11px]",
                      m.keyword.required
                        ? "border-destructive/40 bg-destructive/10"
                        : "border-border bg-muted"
                    )}
                    title={m.keyword.required ? "Listed as a requirement" : "Mentioned in the posting"}
                  >
                    {m.keyword.term}
                    {m.keyword.required ? " *" : ""}
                  </li>
                ))}
              </ul>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Add these only where you genuinely have the experience — starred terms are listed
                as requirements. If you don&apos;t have one, leaving it out is the honest choice;
                claiming it will not survive an interview.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
