"use client";

import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Vertical sortable list. Reordering is expressed as "move `fromId` to where
 * `toId` currently sits", matching the store's reorder actions — ids all the
 * way through, never array indices.
 *
 * Lists nest (sections contain entries contain bullets). Dragging is bound to
 * an explicit handle so a nested list never steals its parent's drag.
 */
export function SortableList({
  ids,
  onReorder,
  children,
}: {
  ids: string[];
  onReorder: (fromId: string, toId: string) => void;
  children: React.ReactNode;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (over && active.id !== over.id) onReorder(String(active.id), String(over.id));
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        {children}
      </SortableContext>
    </DndContext>
  );
}

/**
 * Renders a sortable row. The handle is keyboard-operable: focus it and use
 * arrow keys to move the item (dnd-kit's KeyboardSensor).
 */
export function SortableRow({
  id,
  label,
  className,
  handleClassName,
  children,
}: {
  id: string;
  label: string;
  className?: string;
  handleClassName?: string;
  children: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn("flex items-start gap-1", isDragging && "z-10 opacity-80", className)}
    >
      <button
        type="button"
        aria-label={`Reorder ${label}`}
        className={cn(
          "mt-1 shrink-0 cursor-grab touch-none rounded-md p-1 text-muted-foreground/60",
          "hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none",
          handleClassName
        )}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-4" />
      </button>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
