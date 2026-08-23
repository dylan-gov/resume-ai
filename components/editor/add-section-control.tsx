"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ResumeDoc } from "@/lib/schema/resume";
import { availableSectionKinds, DEFAULT_SECTION_LABELS } from "@/lib/resume/sections";
import { useResumeActions } from "@/lib/store/use-resume-store";

export function AddSectionControl({ doc }: { doc: ResumeDoc }) {
  const { addSection, addCustomSection, endEditSession } = useResumeActions();
  const [open, setOpen] = useState(false);
  const available = availableSectionKinds(doc);

  return (
    <div className="rounded-xl border border-dashed border-border p-2">
      <Button variant="ghost" size="sm" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <Plus className="size-4" />
        Add section
      </Button>

      {open && (
        <div className="mt-2 flex flex-wrap gap-1">
          {available.map((kind) => (
            <Button
              key={kind}
              variant="outline"
              size="xs"
              onClick={() => {
                endEditSession();
                addSection(kind);
                setOpen(false);
              }}
            >
              {DEFAULT_SECTION_LABELS[kind]}
            </Button>
          ))}
          <Button
            variant="secondary"
            size="xs"
            onClick={() => {
              endEditSession();
              addCustomSection();
              setOpen(false);
            }}
          >
            <Plus className="size-3" />
            Custom section
          </Button>
        </div>
      )}
    </div>
  );
}
