"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Palette } from "lucide-react";
import { resumeStore } from "@/lib/store/resume-store";
import { styleStore } from "@/lib/store/style-store";
import { TEMPLATE_LIST } from "@/lib/templates/registry";
import type { ResumeDoc } from "@/lib/schema/resume";
import { CommandPalette, type CommandAction } from "@/components/ui/command-palette";
import { EditorShell } from "./editor-shell";
import { SaveIndicator } from "./save-indicator";
import { ExportMenu } from "./export-menu";
import { usePersistence } from "./use-persistence";

/**
 * The single editing surface, used both for a freshly generated draft
 * (`resumeId: null`) and for a resume loaded from the database.
 *
 * Hydration is the whole adapter: the Phase 2 store already accepts a
 * `ResumeDoc`, so the editor, preview, and undo/redo work unchanged on
 * loaded data. Undo history intentionally starts fresh — prior history
 * describes a different document.
 */
export function PersistentEditor({
  initialDoc,
  initialStyle,
  resumeId,
  title,
  onReset,
}: {
  initialDoc: ResumeDoc;
  initialStyle?: unknown;
  resumeId: string | null;
  title?: string;
  onReset?: () => void;
}) {
  // Runs exactly once, during the first render, so the editor never paints
  // an empty document before the loaded one arrives.
  useState(() => {
    resumeStore.getState().hydrate(initialDoc);
    // Styling is hydrated in the same pass so the first paint already uses
    // the saved template rather than flashing the default one.
    styleStore.getState().hydrate(initialStyle);
    return true;
  });

  const router = useRouter();
  const persistence = usePersistence(resumeId);

  // Editor-specific palette actions. The palette itself knows nothing
  // about templates; surfaces contribute their own commands.
  const commands = useMemo<CommandAction[]>(
    () => [
      ...TEMPLATE_LIST.map((template) => ({
        id: `template-${template.id}`,
        label: `Template: ${template.name}`,
        group: "Design",
        icon: Palette,
        keywords: `template design ${template.description}`,
        run: () => styleStore.getState().setTemplate(template.id),
      })),
      {
        id: "save-now",
        label: "Save resume",
        group: "Resume",
        keywords: "save persist",
        run: () => persistence.saveNow(),
      },
    ],
    [persistence]
  );

  // Once a draft becomes a real row, move to its canonical URL so a reload
  // (or a later visit from the dashboard) lands on the saved resume.
  useEffect(() => {
    if (!resumeId && persistence.resumeId) {
      router.replace(`/editor/${persistence.resumeId}`);
    }
  }, [resumeId, persistence.resumeId, router]);

  return (
    <>
      <CommandPalette actions={commands} />
      <EditorShell
      onReset={onReset}
      saveSlot={
        <>
          <SaveIndicator persistence={persistence} />
          <ExportMenu title={title} />
        </>
      }
      />
    </>
  );
}
