"use client";

import { AlertCircle, Check, Cloud, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Persistence } from "./use-persistence";

/**
 * Save state in the top bar. A failed save is shown as an actionable error
 * with a retry, never swallowed — the user's edits are still safe in the
 * store, but they need to know they are not on the server yet.
 */
export function SaveIndicator({ persistence }: { persistence: Persistence }) {
  const { status, error, resumeId, saveNow } = persistence;

  if (status === "error") {
    return (
      <div className="flex items-center gap-1">
        <span
          className="flex items-center gap-1 text-xs text-destructive"
          title={error ?? undefined}
        >
          <AlertCircle className="size-3.5" />
          Not saved
        </span>
        <Button variant="outline" size="xs" onClick={saveNow}>
          Retry
        </Button>
      </div>
    );
  }

  if (status === "saving") {
    return (
      <span className="flex items-center gap-1 text-xs text-muted-foreground">
        <Loader2 className="size-3.5 animate-spin" />
        Saving…
      </span>
    );
  }

  if (status === "saved") {
    return (
      <span className="flex items-center gap-1 text-xs text-muted-foreground">
        <Check className="size-3.5" />
        Saved
      </span>
    );
  }

  // Unsaved: a brand-new draft needs an explicit first save; an existing
  // resume is about to autosave on its own.
  return resumeId ? (
    <span className="flex items-center gap-1 text-xs text-muted-foreground">
      <Cloud className="size-3.5" />
      Unsaved changes
    </span>
  ) : (
    <Button size="sm" onClick={saveNow}>
      <Cloud className="size-4" />
      Save to my account
    </Button>
  );
}
