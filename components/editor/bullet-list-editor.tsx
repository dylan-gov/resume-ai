"use client";

import { useEffect, useRef } from "react";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InlineField } from "./inline-field";
import { SortableList, SortableRow } from "./sortable";
import { useResumeActions } from "@/lib/store/use-resume-store";
import { bulletDomId } from "@/lib/analysis/types";

/**
 * Bullets are `string[]` in the schema (unchanged from Phase 1, so the AI
 * layer and export stay compatible), which means they have no intrinsic ids.
 * Drag identity is therefore derived from position. That is safe here because
 * the list is only reordered through this component: the ids are recomputed
 * from the store's array immediately after every change, and the inputs are
 * controlled, so React never has stale per-row state to mis-associate.
 */
function bulletDragId(entryId: string, index: number): string {
  return `${entryId}::bullet::${index}`;
}

interface BulletListEditorProps {
  sectionId: string;
  entryId: string;
  bullets: string[];
  label: string;
  /** Which string[] on the entry this list edits ("bullets", "details", ...). */
  bulletsKey: string;
}

export function BulletListEditor({
  sectionId,
  entryId,
  bullets,
  label,
  bulletsKey,
}: BulletListEditorProps) {
  const { addBullet, updateBullet, deleteBullet, reorderBullets, endEditSession } =
    useResumeActions();
  const inputs = useRef(new Map<number, HTMLTextAreaElement | HTMLInputElement>());
  // A ref, not state: the focus target is consumed by the next render's
  // effect and must not itself cause a render.
  const pendingFocus = useRef<number | null>(null);

  const setFocusIndex = (index: number) => {
    pendingFocus.current = index;
  };

  // Runs after every render so focus lands once the store update has been
  // applied and the target row actually exists in the DOM.
  useEffect(() => {
    const index = pendingFocus.current;
    if (index === null) return;
    pendingFocus.current = null;

    const el = inputs.current.get(index);
    if (!el) return;
    el.focus();
    const end = el.value.length;
    el.setSelectionRange(end, end);
  });

  function handleKeyDown(e: React.KeyboardEvent, index: number) {
    const value = bullets[index] ?? "";

    if (e.key === "Enter" && !e.shiftKey) {
      // Enter splits to a new bullet. On an already-empty last bullet it
      // exits the list instead of stacking more empties.
      e.preventDefault();
      if (value.trim() === "" && index === bullets.length - 1) {
        (e.target as HTMLElement).blur();
        return;
      }
      endEditSession();
      addBullet(sectionId, entryId, index + 1, bulletsKey);
      setFocusIndex(index + 1);
      return;
    }

    if (e.key === "Backspace" && value === "" && bullets.length > 1) {
      // Backspace on an empty bullet removes it and returns to the previous one.
      e.preventDefault();
      endEditSession();
      deleteBullet(sectionId, entryId, index, bulletsKey);
      setFocusIndex(Math.max(0, index - 1));
    }
  }

  const ids = bullets.map((_, i) => bulletDragId(entryId, i));

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <Button
          variant="ghost"
          size="xs"
          onClick={() => {
            endEditSession();
            addBullet(sectionId, entryId, undefined, bulletsKey);
            setFocusIndex(bullets.length);
          }}
        >
          <Plus className="size-3" />
          Bullet
        </Button>
      </div>

      {bullets.length === 0 ? (
        <p className="px-1.5 py-1 text-xs text-muted-foreground/70">No bullets yet.</p>
      ) : (
        <SortableList
          ids={ids}
          onReorder={(fromId, toId) =>
            reorderBullets(sectionId, entryId, ids.indexOf(fromId), ids.indexOf(toId), bulletsKey)
          }
        >
          <div className="flex flex-col gap-0.5">
            {bullets.map((bullet, index) => (
              <SortableRow
                key={bulletDragId(entryId, index)}
                id={bulletDragId(entryId, index)}
                label={`bullet ${index + 1}`}
              >
                <div className="flex items-start gap-1">
                  <span
                    aria-hidden
                    className="mt-2 size-1 shrink-0 rounded-full bg-muted-foreground/50"
                  />
                  <InlineField
                    multiline
                    // Analysis findings scroll to and highlight this id.
                    id={bulletDomId({ entryId, index })}
                    label={`${label} ${index + 1}`}
                    placeholder="Describe an accomplishment…"
                    value={bullet}
                    sessionKey={`bullet:${sectionId}:${entryId}:${bulletsKey}:${index}`}
                    onChange={(v) => updateBullet(sectionId, entryId, index, v, bulletsKey)}
                    onKeyDown={(e) => handleKeyDown(e, index)}
                    inputRef={(el) => {
                      if (el) inputs.current.set(index, el);
                      else inputs.current.delete(index);
                    }}
                  />
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    aria-label={`Delete bullet ${index + 1}`}
                    className="mt-0.5 shrink-0"
                    onClick={() => {
                      endEditSession();
                      deleteBullet(sectionId, entryId, index, bulletsKey);
                    }}
                  >
                    <X className="size-3" />
                  </Button>
                </div>
              </SortableRow>
            ))}
          </div>
        </SortableList>
      )}
    </div>
  );
}
