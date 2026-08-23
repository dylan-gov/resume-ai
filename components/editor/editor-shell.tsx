"use client";

import { useState } from "react";
import { Redo2, RotateCcw, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TemplateRenderer } from "@/components/resume/template-renderer";
import { RawJsonView } from "@/components/resume/raw-json-view";
import { useResumeActions, useResumeStore } from "@/lib/store/use-resume-store";
import { cn } from "@/lib/utils";
import { HeaderEditor } from "./header-editor";
import { SectionEditor } from "./section-editor";
import { AddSectionControl } from "./add-section-control";
import { ClarificationsPanel } from "./clarifications-panel";
import { SortableList, SortableRow } from "./sortable";
import { useUndoShortcuts } from "./use-undo-shortcuts";
import { AnalysisPanel } from "@/components/analysis/analysis-panel";
import { StylePanel } from "./style-panel";
import { useStyle } from "@/lib/store/style-store";

type Pane = "edit" | "preview" | "design" | "analysis";

type RightView = "preview" | "design" | "analysis";

function Segmented<T extends string>({
  options,
  value,
  onChange,
  className,
}: {
  options: readonly T[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}) {
  return (
    <div className={cn("flex rounded-lg border border-border p-0.5", className)}>
      {options.map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => onChange(option)}
          className={cn(
            "rounded-md px-2 py-1 text-xs font-medium capitalize transition-colors",
            value === option ? "bg-primary text-primary-foreground" : "text-muted-foreground"
          )}
        >
          {option}
        </button>
      ))}
    </div>
  );
}

function TopBar({
  pane,
  setPane,
  rightView,
  setRightView,
  onReset,
  saveSlot,
}: {
  pane: Pane;
  setPane: (p: Pane) => void;
  rightView: RightView;
  setRightView: (v: RightView) => void;
  onReset?: () => void;
  saveSlot?: React.ReactNode;
}) {
  const { undo, redo, endEditSession } = useResumeActions();
  const canUndo = useResumeStore((s) => s.past.length > 0);
  const canRedo = useResumeStore((s) => s.future.length > 0);

  return (
    <div className="sticky top-0 z-20 flex items-center justify-between gap-2 border-b border-border bg-background/95 px-4 py-2 backdrop-blur">
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="sm"
          disabled={!canUndo}
          title="Undo (Ctrl/Cmd+Z)"
          onClick={() => {
            endEditSession();
            undo();
          }}
        >
          <Undo2 className="size-4" />
          Undo
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={!canRedo}
          title="Redo (Ctrl/Cmd+Shift+Z)"
          onClick={() => {
            endEditSession();
            redo();
          }}
        >
          <Redo2 className="size-4" />
          Redo
        </Button>
      </div>

      <div className="flex items-center gap-1">
        {saveSlot}

        {/* Chooses what the right column shows on desktop. */}
        <Segmented
          className="hidden lg:flex"
          options={["preview", "design", "analysis"] as const}
          value={rightView}
          onChange={setRightView}
        />

        {/* Single-column fallback: all three views become one toggle. */}
        <Segmented
          className="lg:hidden"
          options={["edit", "preview", "design", "analysis"] as const}
          value={pane}
          onChange={(value) => {
            setPane(value);
            if (value !== "edit") setRightView(value);
          }}
        />
        {onReset && (
          <Button variant="ghost" size="sm" onClick={onReset}>
            <RotateCcw className="size-4" />
            Start over
          </Button>
        )}
      </div>
    </div>
  );
}

export function EditorShell({
  onReset,
  saveSlot,
}: {
  onReset?: () => void;
  saveSlot?: React.ReactNode;
}) {
  useUndoShortcuts();
  const [pane, setPane] = useState<Pane>("edit");
  const [rightView, setRightView] = useState<RightView>("preview");

  const doc = useResumeStore((s) => s.present);
  const style = useStyle((s) => s.style);
  const { reorderSections } = useResumeActions();
  const sections = doc.sections ?? [];

  return (
    <div className="flex min-h-screen flex-col">
      <TopBar
        pane={pane}
        setPane={setPane}
        rightView={rightView}
        setRightView={setRightView}
        onReset={onReset}
        saveSlot={saveSlot}
      />

      <div className="grid flex-1 grid-cols-1 lg:grid-cols-2">
        {/* Editor pane */}
        <div
          className={cn(
            "flex flex-col gap-3 border-border p-4 lg:border-r",
            pane === "edit" ? "block" : "hidden lg:block"
          )}
        >
          <ClarificationsPanel />
          <HeaderEditor doc={doc} />

          {sections.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              This resume has no sections. Add one below to get started.
            </p>
          ) : (
            <SortableList
              ids={sections.map((s) => s.id)}
              onReorder={(fromId, toId) => reorderSections(fromId, toId)}
            >
              <div className="flex flex-col gap-3">
                {sections.map((section) => (
                  <SortableRow key={section.id} id={section.id} label={`section ${section.label}`}>
                    <SectionEditor doc={doc} section={section} />
                  </SortableRow>
                ))}
              </div>
            </SortableList>
          )}

          <AddSectionControl doc={doc} />
          <RawJsonView data={doc} />
        </div>

        {/*
          Right column: the live preview (same document, Phase 1 template)
          or the analysis view. Both read the same store, so neither can
          drift from what the editor shows.
        */}
        <div
          className={cn(
            "bg-zinc-50 dark:bg-zinc-950",
            pane === "edit" ? "hidden lg:block" : "block"
          )}
        >
          <div className="lg:sticky lg:top-14 lg:max-h-[calc(100vh-3.5rem)] lg:overflow-y-auto">
            <div className={cn(rightView === "preview" ? "block" : "hidden", "p-4")}>
              <div className="shadow-lg ring-1 ring-black/5">
                <TemplateRenderer doc={doc} style={style} />
              </div>
            </div>
            <div className={rightView === "design" ? "block" : "hidden"}>
              <StylePanel />
            </div>
            <div className={rightView === "analysis" ? "block" : "hidden"}>
              <AnalysisPanel />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
