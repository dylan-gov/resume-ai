"use client";

import { createStore, type StoreApi } from "zustand/vanilla";
import { useStore } from "zustand";
import {
  DEFAULT_STYLE,
  resolveStyle,
  type StyleConfig,
  type TemplateId,
} from "@/lib/templates/style";
import { applyTemplate } from "@/lib/templates/registry";

/**
 * Presentation state, deliberately kept **out of the `ResumeDoc`**.
 *
 * The phase's rule is that content lives in the document and appearance
 * lives in the template plus `StyleConfig`. Putting styling into the doc
 * would break that, and would also put "changed the accent colour" into the
 * same undo history as "deleted a job", which is not what a user means by
 * undo. Styling is therefore its own small store, persisted alongside the
 * resume rather than inside it.
 */
export interface StyleStoreState {
  style: StyleConfig;
  hydrate(style: unknown): void;
  /** Switching template adopts that template's designed look. */
  setTemplate(templateId: TemplateId): void;
  update(patch: Partial<StyleConfig>): void;
  reset(): void;
}

export function createStyleStore(initial?: unknown): StoreApi<StyleStoreState> {
  return createStore<StyleStoreState>()((set, get) => ({
    style: resolveStyle(initial),

    hydrate(style) {
      set({ style: resolveStyle(style) });
    },

    setTemplate(templateId) {
      set({ style: applyTemplate(templateId) });
    },

    update(patch) {
      // Re-resolve so every change is clamped back into safe bounds.
      set({ style: resolveStyle({ ...get().style, ...patch }) });
    },

    reset() {
      set({ style: { ...DEFAULT_STYLE } });
    },
  }));
}

export const styleStore = createStyleStore();

export function useStyle<T>(selector: (state: StyleStoreState) => T): T {
  return useStore(styleStore, selector);
}

export function useStyleActions() {
  return styleStore.getState();
}
