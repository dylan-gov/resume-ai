"use client";

import { useStore } from "zustand";
import { useShallow } from "zustand/react/shallow";
import { resumeStore, type ResumeStoreState } from "./resume-store";

/** Subscribe to a slice of the editor store. */
export function useResumeStore<T>(selector: (state: ResumeStoreState) => T): T {
  return useStore(resumeStore, selector);
}

/** Subscribe with shallow comparison, for selectors returning a new object/array. */
export function useResumeStoreShallow<T>(selector: (state: ResumeStoreState) => T): T {
  return useStore(resumeStore, useShallow(selector));
}

/**
 * Actions are stable across renders (zustand never recreates them), so
 * components can pull them once without re-rendering on document changes.
 */
export function useResumeActions() {
  return resumeStore.getState();
}
