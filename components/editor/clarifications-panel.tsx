"use client";

import { Check, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getEntryFieldSpec, readEntryString } from "@/lib/resume/entry-fields";
import { findSection, getSectionEntries } from "@/lib/resume/sections";
import { useResumeActions, useResumeStore } from "@/lib/store/use-resume-store";
import type { ResolvedClarification } from "@/lib/resume/clarifications";
import { InlineField } from "./inline-field";
import { useResolvedClarifications } from "./use-clarifications";

/**
 * Closes the loop Phase 1 opened: each question the AI raised is shown with
 * an input bound to the exact field it is about, so the gap can be filled
 * without hunting for it. Dismissing removes the question from the document.
 */
function ClarificationRow({ item }: { item: ResolvedClarification }) {
  const doc = useResumeStore((s) => s.present);
  const { updateField, dismissClarification, endEditSession } = useResumeActions();

  const section = item.sectionId ? findSection(doc, item.sectionId) : undefined;
  const entries = section ? getSectionEntries(doc, section) : [];
  const entryIndex = entries.findIndex((e) => e.id === item.entryId);
  const entry = entryIndex >= 0 ? entries[entryIndex] : undefined;

  const spec = section ? getEntryFieldSpec(section.kind) : null;
  const field = spec?.fields.find((f) => f.key === item.fieldKey);

  const canAnswerInline =
    !!section && !!entry && !!field && section.kind !== "custom" && entryIndex >= 0;

  // Custom sections keep entries on the section itself; built-ins use the
  // top-level array named by the kind.
  const path =
    section && section.kind !== "custom"
      ? [section.kind, entryIndex, item.fieldKey as string]
      : null;

  const context =
    entry && spec ? readEntryString(entry, spec.titleKey) || section?.label : section?.label;

  return (
    <li className="rounded-lg border border-amber-500/25 bg-background/60 p-2">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm">
          {item.text}
          {context && (
            <span className="ml-1 text-xs text-muted-foreground">— {context}</span>
          )}
        </p>
        <Button
          variant="ghost"
          size="xs"
          aria-label={`Dismiss question: ${item.text}`}
          onClick={() => {
            endEditSession();
            dismissClarification(item.index);
          }}
        >
          <Check className="size-3" />
          Done
        </Button>
      </div>

      {canAnswerInline && path && (
        <div className="mt-1 flex items-center gap-2">
          <label className="shrink-0 text-[10px] tracking-wide text-muted-foreground uppercase">
            {field.label}
          </label>
          <InlineField
            label={`${field.label} for ${context ?? "entry"}`}
            placeholder={field.placeholder}
            value={readEntryString(entry, field.key)}
            sessionKey={`clarification:${item.index}:${field.key}`}
            className="border-border bg-background"
            onChange={(v) => updateField(path, v, `clarification:${item.index}:${field.key}`)}
          />
        </div>
      )}
    </li>
  );
}

export function ClarificationsPanel() {
  const clarifications = useResolvedClarifications();
  if (clarifications.length === 0) return null;

  return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3">
      <h2 className="mb-2 flex items-center gap-2 text-sm font-medium text-amber-700 dark:text-amber-400">
        <HelpCircle className="size-4" />
        Questions to improve your resume
        <span className="text-xs font-normal text-muted-foreground">
          ({clarifications.length})
        </span>
      </h2>
      <ul className="flex flex-col gap-2">
        {clarifications.map((item) => (
          <ClarificationRow key={item.index} item={item} />
        ))}
      </ul>
    </div>
  );
}
