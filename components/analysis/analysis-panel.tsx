"use client";

import { useDeferredValue, useMemo, useState } from "react";
import { BookOpen } from "lucide-react";
import { analyzeResume } from "@/lib/analysis";
import { useResumeStore } from "@/lib/store/use-resume-store";
import { ScoreCard } from "./score-card";
import { FindingItem } from "./finding-item";
import { JobMatchPanel } from "./job-match-panel";

/**
 * The analysis view.
 *
 * The deterministic analysis runs in the browser on the live document, so
 * scores update as the user edits with no round trip and no cost.
 * `useDeferredValue` keeps typing smooth by letting React run the
 * recomputation at lower priority. The AI-assisted parts — rewrites and
 * job matching — are explicitly user-triggered, never automatic, so
 * keystrokes never spend model calls.
 */
export function AnalysisPanel() {
  const doc = useResumeStore((s) => s.present);
  const deferredDoc = useDeferredValue(doc);
  const [targetKeywords, setTargetKeywords] = useState<string[]>([]);

  const analysis = useMemo(() => analyzeResume(deferredDoc), [deferredDoc]);
  const isStale = doc !== deferredDoc;

  return (
    <div className="flex flex-col gap-3 p-4">
      <div>
        <h2 className="text-sm font-medium">Analysis</h2>
        <p className="text-xs text-muted-foreground">
          Scores update live as you edit
          {isStale ? " — recalculating…" : "."} Rewrites and job matching run on request.
        </p>
      </div>

      <ScoreCard title="ATS compatibility" score={analysis.ats} />
      <ScoreCard title="Formatting" score={analysis.formatting} />

      <div className="rounded-xl border border-border bg-card px-3 py-2">
        <div className="flex items-baseline justify-between">
          <p className="flex items-center gap-2 text-sm font-medium">
            <BookOpen className="size-4" />
            Readability
          </p>
          <span className="text-xl font-semibold tabular-nums">
            {analysis.readability.gradeLevel > 0
              ? `Grade ${analysis.readability.gradeLevel}`
              : "—"}
          </span>
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {analysis.readability.interpretation}
        </p>
        {analysis.readability.wordCount > 0 && (
          <p className="mt-0.5 text-[11px] text-muted-foreground/80">
            {analysis.readability.wordCount} words across {analysis.readability.sentenceCount}{" "}
            bullets · {analysis.readability.averageWordsPerSentence} words per bullet on average
          </p>
        )}
      </div>

      <div>
        <p className="mb-1 text-sm font-medium">
          Suggested improvements
          <span className="ml-1 text-xs font-normal text-muted-foreground">
            ({analysis.findings.length})
          </span>
        </p>

        {analysis.findings.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
            {analysis.stats.bulletCount === 0
              ? "Add some bullet points and suggestions will appear here."
              : "No issues found — your bullets look strong."}
          </p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {analysis.findings.map((finding) => (
              <FindingItem
                key={finding.id}
                finding={finding}
                targetKeywords={targetKeywords}
              />
            ))}
          </ul>
        )}
      </div>

      <JobMatchPanel onKeywords={setTargetKeywords} />
    </div>
  );
}
