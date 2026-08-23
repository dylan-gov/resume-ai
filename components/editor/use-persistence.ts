"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { resumeStore } from "@/lib/store/resume-store";
import { styleStore } from "@/lib/store/style-store";
import { createResumeAction, saveResumeAction } from "@/app/actions/resumes";
import type { ResumeDoc } from "@/lib/schema/resume";
import type { StyleConfig } from "@/lib/templates/style";

export type SaveStatus = "unsaved" | "saving" | "saved" | "error";

const AUTOSAVE_DELAY_MS = 2000;

export interface Persistence {
  status: SaveStatus;
  error: string | null;
  resumeId: string | null;
  saveNow: () => void;
}

/**
 * Bridges the Phase 2 store to the database.
 *
 * Deliberately one-directional: it reads `present` and writes it out. It
 * never writes back into the store, so a failed or slow save can never
 * clobber what the user is typing — a save error surfaces as status and
 * leaves local edit state untouched.
 */
export function usePersistence(initialResumeId: string | null): Persistence {
  const [resumeId, setResumeId] = useState<string | null>(initialResumeId);
  const [status, setStatus] = useState<SaveStatus>(initialResumeId ? "saved" : "unsaved");
  const [error, setError] = useState<string | null>(null);

  // The exact document object last persisted. Store mutations always produce
  // a new object, so reference equality is a sound "nothing changed" check.
  const savedDoc = useRef<ResumeDoc | null>(
    initialResumeId ? resumeStore.getState().present : null
  );
  // Styling persists with the resume, so a design change is a save too.
  const savedStyle = useRef<StyleConfig | null>(
    initialResumeId ? styleStore.getState().style : null
  );
  const inFlight = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const persist = useCallback(async () => {
    if (inFlight.current) return;

    const doc = resumeStore.getState().present;
    const style = styleStore.getState().style;
    if (doc === savedDoc.current && style === savedStyle.current) return;

    inFlight.current = true;
    setStatus("saving");
    setError(null);

    const currentId = resumeId;

    if (currentId) {
      const result = await saveResumeAction(currentId, doc, style);
      inFlight.current = false;
      if (!result.ok) {
        setStatus("error");
        setError(result.error);
        return;
      }
    } else {
      const result = await createResumeAction(doc, undefined, style);
      inFlight.current = false;
      if (!result.ok) {
        setStatus("error");
        setError(result.error);
        return;
      }
      setResumeId(result.data.id);
    }

    savedDoc.current = doc;
    savedStyle.current = style;

    // An edit that landed mid-save is still unsaved; reflect that honestly
    // rather than showing a green "saved" over stale data.
    const settled =
      resumeStore.getState().present === doc && styleStore.getState().style === style;
    setStatus(settled ? "saved" : "unsaved");
  }, [resumeId]);

  const saveNow = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    void persist();
  }, [persist]);

  // Autosave: only for resumes that already exist. A freshly generated draft
  // is created explicitly, so we never silently write to someone's account.
  useEffect(() => {
    if (!resumeId) return;

    const onChange = () => {
      if (
        resumeStore.getState().present === savedDoc.current &&
        styleStore.getState().style === savedStyle.current
      ) {
        return;
      }
      setStatus((s) => (s === "saving" ? s : "unsaved"));
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void persist(), AUTOSAVE_DELAY_MS);
    };

    const unsubscribeDoc = resumeStore.subscribe(onChange);
    const unsubscribeStyle = styleStore.subscribe(onChange);

    return () => {
      unsubscribeDoc();
      unsubscribeStyle();
      if (timer.current) clearTimeout(timer.current);
    };
  }, [resumeId, persist]);

  return { status, error, resumeId, saveNow };
}
