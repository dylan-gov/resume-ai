"use client";

import { useSyncExternalStore } from "react";

/**
 * Honors `prefers-reduced-motion`. Every animation in the app reads this —
 * motion is decoration, and decoration must never be mandatory.
 *
 * `useSyncExternalStore` rather than state+effect: `matchMedia` *is* an
 * external store, so this is exactly what it is for, and it avoids the
 * cascading render an effect-based version causes.
 */
const QUERY = "(prefers-reduced-motion: reduce)";

function subscribe(onChange: () => void): () => void {
  const query = window.matchMedia(QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

function getSnapshot(): boolean {
  return window.matchMedia(QUERY).matches;
}

/** On the server, assume reduced so no animation runs before hydration. */
function getServerSnapshot(): boolean {
  return true;
}

export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
