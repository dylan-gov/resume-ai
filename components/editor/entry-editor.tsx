"use client";

import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AnyEntry, SectionKind } from "@/lib/schema/resume";
import {
  entryDisplayTitle,
  getEntryFieldSpec,
  readEntryList,
  readEntryString,
} from "@/lib/resume/entry-fields";
import { useResumeActions } from "@/lib/store/use-resume-store";
import { InlineField } from "./inline-field";
import { ListField } from "./list-field";
import { BulletListEditor } from "./bullet-list-editor";
import { ClarificationBadge } from "./clarification-badge";

interface EntryEditorProps {
  sectionId: string;
  kind: SectionKind;
  entry: AnyEntry;
  /** Path prefix into the document for this entry, used by `updateField`. */
  path: (string | number)[];
}

export function EntryEditor({ sectionId, kind, entry, path }: EntryEditorProps) {
  const { updateField, deleteEntry, endEditSession } = useResumeActions();
  const spec = getEntryFieldSpec(kind);
  if (!spec) return null;

  const setField = (key: string, value: unknown) =>
    updateField([...path, key], value, `field:${entry.id}:${key}`);

  return (
    <div className="rounded-lg border border-border bg-background/60 p-2">
      <div className="mb-1 flex items-start justify-between gap-2">
        <div className="grid min-w-0 flex-1 grid-cols-1 gap-x-2 gap-y-0.5 sm:grid-cols-2">
          {spec.fields.map((field) => (
            <div key={field.key} className={field.wide ? "sm:col-span-2" : undefined}>
              <label className="px-1.5 text-[10px] tracking-wide text-muted-foreground/70 uppercase">
                {field.label}
              </label>
              <div className="flex items-center gap-1">
                <InlineField
                  label={`${entryDisplayTitle(entry, kind)} ${field.label}`}
                  placeholder={field.placeholder}
                  multiline={field.multiline}
                  value={readEntryString(entry, field.key)}
                  sessionKey={`field:${entry.id}:${field.key}`}
                  emphasis={field.key === spec.titleKey ? "strong" : "none"}
                  onChange={(v) => setField(field.key, v)}
                />
                <ClarificationBadge entryId={entry.id} fieldKey={field.key} />
              </div>
            </div>
          ))}

          {spec.listFields?.map((field) => (
            <div key={field.key} className="sm:col-span-2">
              <label className="px-1.5 text-[10px] tracking-wide text-muted-foreground/70 uppercase">
                {field.label}
                <span className="ml-1 normal-case opacity-70">(comma separated)</span>
              </label>
              <ListField
                label={field.label}
                placeholder={field.placeholder}
                value={readEntryList(entry, field.key)}
                sessionKey={`field:${entry.id}:${field.key}`}
                onChange={(next) => setField(field.key, next)}
              />
            </div>
          ))}
        </div>

        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`Delete ${entryDisplayTitle(entry, kind)}`}
          onClick={() => {
            endEditSession();
            deleteEntry(sectionId, entry.id);
          }}
        >
          <Trash2 className="size-4" />
        </Button>
      </div>

      {spec.bulletsKey && (
        <BulletListEditor
          sectionId={sectionId}
          entryId={entry.id}
          label={spec.bulletsLabel ?? "Bullets"}
          bulletsKey={spec.bulletsKey}
          bullets={readEntryList(entry, spec.bulletsKey)}
        />
      )}
    </div>
  );
}
