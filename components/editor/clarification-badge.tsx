"use client";

import { HelpCircle } from "lucide-react";
import { useResolvedClarifications } from "./use-clarifications";

/**
 * Marks the exact field an outstanding AI question is about, so a
 * clarification listed in the panel above is also visible where it gets
 * answered.
 */
export function ClarificationBadge({
  entryId,
  fieldKey,
}: {
  entryId: string;
  fieldKey: string;
}) {
  const clarifications = useResolvedClarifications();
  const match = clarifications.find((c) => c.entryId === entryId && c.fieldKey === fieldKey);
  if (!match) return null;

  return (
    <span
      title={match.text}
      aria-label={`Open question: ${match.text}`}
      className="shrink-0 text-amber-600 dark:text-amber-400"
    >
      <HelpCircle className="size-3.5" />
    </span>
  );
}
