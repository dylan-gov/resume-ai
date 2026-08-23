"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ResumeDoc, SectionMeta } from "@/lib/schema/resume";
import { getSectionEntries } from "@/lib/resume/sections";
import { useResumeActions } from "@/lib/store/use-resume-store";
import { InlineField } from "./inline-field";
import { EntryEditor } from "./entry-editor";
import { SortableList, SortableRow } from "./sortable";

export function SectionEditor({ doc, section }: { doc: ResumeDoc; section: SectionMeta }) {
  const { renameSection, deleteSection, addEntry, reorderEntries, updateField, endEditSession } =
    useResumeActions();

  const entries = getSectionEntries(doc, section);
  const isSummary = section.kind === "summary";

  return (
    <div className="rounded-xl border border-border bg-muted/30 p-2">
      <div className="mb-2 flex items-center gap-1">
        <InlineField
          label={`Section name: ${section.label}`}
          value={section.label}
          sessionKey={`section-label:${section.id}`}
          emphasis="strong"
          className="text-xs tracking-widest uppercase"
          onChange={(v) => renameSection(section.id, v)}
        />
        <div className="flex shrink-0 items-center gap-0.5">
          {!isSummary && (
            <Button
              variant="ghost"
              size="xs"
              onClick={() => {
                endEditSession();
                addEntry(section.id);
              }}
            >
              <Plus className="size-3" />
              Add
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Delete section ${section.label}`}
            onClick={() => {
              endEditSession();
              deleteSection(section.id);
            }}
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      </div>

      {isSummary ? (
        <InlineField
          multiline
          label="Summary"
          placeholder="A short professional summary…"
          value={doc.summary ?? ""}
          sessionKey="field:summary"
          className="border-border bg-background"
          onChange={(v) => updateField(["summary"], v, "field:summary")}
        />
      ) : entries.length === 0 ? (
        <p className="px-1.5 py-2 text-xs text-muted-foreground">
          Nothing here yet. Use <span className="font-medium">Add</span> to create the first entry.
        </p>
      ) : (
        <SortableList
          ids={entries.map((e) => e.id)}
          onReorder={(fromId, toId) => reorderEntries(section.id, fromId, toId)}
        >
          <div className="flex flex-col gap-2">
            {entries.map((entry, index) => (
              <SortableRow key={entry.id} id={entry.id} label="entry">
                <EntryEditor
                  sectionId={section.id}
                  kind={section.kind}
                  entry={entry}
                  path={
                    section.kind === "custom"
                      ? [
                          "sections",
                          (doc.sections ?? []).findIndex((s) => s.id === section.id),
                          "entries",
                          index,
                        ]
                      : [section.kind, index]
                  }
                />
              </SortableRow>
            ))}
          </div>
        </SortableList>
      )}
    </div>
  );
}
