"use client";

import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ResumeDoc } from "@/lib/schema/resume";
import { useResumeActions } from "@/lib/store/use-resume-store";
import { InlineField } from "./inline-field";

const HEADER_FIELDS = [
  { key: "name", label: "Name", placeholder: "Jordan Ellis" },
  { key: "title", label: "Headline", placeholder: "Backend Engineer" },
  { key: "email", label: "Email", placeholder: "you@example.com" },
  { key: "phone", label: "Phone", placeholder: "(555) 012-3456" },
  { key: "location", label: "Location", placeholder: "Austin, TX" },
] as const;

/**
 * The header is the resume's identity block: always present and always first,
 * so unlike the sections below it, it is not reorderable or deletable.
 */
export function HeaderEditor({ doc }: { doc: ResumeDoc }) {
  const { updateField, endEditSession } = useResumeActions();
  const header = doc.header ?? {};
  const links = header.links ?? [];

  return (
    <div className="rounded-xl border border-border bg-muted/30 p-2">
      <p className="mb-2 px-1.5 text-xs font-medium tracking-widest text-muted-foreground uppercase">
        Header
      </p>

      <div className="grid grid-cols-1 gap-x-2 gap-y-0.5 sm:grid-cols-2">
        {HEADER_FIELDS.map((field) => (
          <div key={field.key}>
            <label className="px-1.5 text-[10px] tracking-wide text-muted-foreground/70 uppercase">
              {field.label}
            </label>
            <InlineField
              label={field.label}
              placeholder={field.placeholder}
              value={header[field.key] ?? ""}
              sessionKey={`field:header.${field.key}`}
              emphasis={field.key === "name" ? "strong" : "none"}
              onChange={(v) => updateField(["header", field.key], v, `field:header.${field.key}`)}
            />
          </div>
        ))}
      </div>

      <div className="mt-2">
        <div className="flex items-center justify-between">
          <span className="px-1.5 text-[10px] tracking-wide text-muted-foreground/70 uppercase">
            Links
          </span>
          <Button
            variant="ghost"
            size="xs"
            onClick={() => {
              endEditSession();
              updateField(["header", "links"], [...links, { label: "", url: "" }]);
            }}
          >
            <Plus className="size-3" />
            Link
          </Button>
        </div>

        {links.map((link, index) => (
          <div key={index} className="flex items-center gap-1">
            <InlineField
              label={`Link ${index + 1} label`}
              placeholder="LinkedIn"
              value={link.label}
              sessionKey={`field:header.links.${index}.label`}
              onChange={(v) =>
                updateField(
                  ["header", "links", index, "label"],
                  v,
                  `field:header.links.${index}.label`
                )
              }
            />
            <InlineField
              label={`Link ${index + 1} URL`}
              placeholder="https://…"
              value={link.url}
              sessionKey={`field:header.links.${index}.url`}
              onChange={(v) =>
                updateField(["header", "links", index, "url"], v, `field:header.links.${index}.url`)
              }
            />
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label={`Delete link ${index + 1}`}
              onClick={() => {
                endEditSession();
                updateField(
                  ["header", "links"],
                  links.filter((_, i) => i !== index)
                );
              }}
            >
              <X className="size-3" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
