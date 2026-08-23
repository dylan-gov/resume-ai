"use client";

import { useState, useTransition } from "react";
import { Loader2, Sparkles, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { bulletDomId, type Finding } from "@/lib/analysis/types";
import { useResumeActions } from "@/lib/store/use-resume-store";
import { suggestRewriteAction } from "@/app/actions/analysis";

const SEVERITY_STYLES: Record<Finding["severity"], string> = {
  high: "border-destructive/30 bg-destructive/5",
  medium: "border-amber-500/30 bg-amber-500/5",
  low: "border-border bg-muted/30",
};

/** Scrolls the editor to the bullet a finding refers to and focuses it. */
function locate(finding: Finding) {
  const element = document.getElementById(bulletDomId(finding.ref));
  if (!element) return;
  element.scrollIntoView({ behavior: "smooth", block: "center" });
  element.focus({ preventScroll: true });
  element.classList.add("ring-3", "ring-amber-400");
  window.setTimeout(() => element.classList.remove("ring-3", "ring-amber-400"), 1600);
}

export function FindingItem({
  finding,
  targetKeywords,
}: {
  finding: Finding;
  targetKeywords?: string[];
}) {
  const { updateBullet, endEditSession } = useResumeActions();
  const [suggestion, setSuggestion] = useState<{ rewrite: string; note?: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function requestRewrite() {
    setError(null);
    startTransition(async () => {
      const result = await suggestRewriteAction(
        finding.ref.text,
        [finding.message, finding.suggestion],
        targetKeywords
      );
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSuggestion(result.data);
    });
  }

  function accept() {
    if (!suggestion) return;
    const { sectionId, entryId, index, bulletsKey } = finding.ref;
    // Goes through the ordinary Phase 2 store action, so the change is
    // undoable and shows up in the live preview like any manual edit.
    endEditSession();
    updateBullet(sectionId, entryId, index, suggestion.rewrite, bulletsKey);
    endEditSession();
    setSuggestion(null);
  }

  return (
    <li className={cn("rounded-lg border p-2", SEVERITY_STYLES[finding.severity])}>
      <button
        type="button"
        onClick={() => locate(finding)}
        className="block w-full text-left"
        title="Jump to this bullet in the editor"
      >
        <p className="text-xs font-medium">{finding.message}</p>
        <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
          “{finding.ref.text}”
        </p>
        <p className="mt-0.5 text-[11px] text-muted-foreground/80">
          {finding.ref.sectionLabel} · {finding.ref.entryTitle}
        </p>
      </button>

      <p className="mt-1 text-[11px] text-muted-foreground">{finding.suggestion}</p>

      {finding.rewritable && !suggestion && (
        <Button variant="outline" size="xs" className="mt-1.5" disabled={pending} onClick={requestRewrite}>
          {pending ? <Loader2 className="size-3 animate-spin" /> : <Wand2 className="size-3" />}
          Suggest a rewrite
        </Button>
      )}

      {suggestion && (
        <div className="mt-1.5 rounded-md border border-border bg-background p-2">
          <p className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
            <Sparkles className="size-3" />
            Suggested rewrite
          </p>
          <p className="mt-1 text-xs">{suggestion.rewrite}</p>
          {suggestion.note && (
            <p className="mt-1 text-[11px] text-muted-foreground">{suggestion.note}</p>
          )}
          <div className="mt-1.5 flex gap-1">
            <Button size="xs" onClick={accept}>
              Accept
            </Button>
            <Button variant="ghost" size="xs" onClick={() => setSuggestion(null)}>
              Dismiss
            </Button>
          </div>
        </div>
      )}

      {error && <p className="mt-1 text-[11px] text-destructive">{error}</p>}
    </li>
  );
}
