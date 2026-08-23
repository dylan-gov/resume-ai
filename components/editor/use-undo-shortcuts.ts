"use client";

import { useEffect } from "react";
import { resumeStore } from "@/lib/store/resume-store";

/**
 * Cmd/Ctrl+Z to undo, Cmd/Ctrl+Shift+Z (or Ctrl+Y) to redo.
 *
 * The in-progress edit session is closed first so the current field's
 * keystrokes are one complete history entry before the pointer moves —
 * otherwise the first undo would only rewind to mid-word.
 */
export function useUndoShortcuts() {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (!(event.metaKey || event.ctrlKey)) return;

      const key = event.key.toLowerCase();
      const isUndo = key === "z" && !event.shiftKey;
      const isRedo = (key === "z" && event.shiftKey) || key === "y";
      if (!isUndo && !isRedo) return;

      event.preventDefault();
      const state = resumeStore.getState();
      state.endEditSession();
      if (isUndo) state.undo();
      else state.redo();
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}
