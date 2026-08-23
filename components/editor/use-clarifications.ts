"use client";

import { useMemo } from "react";
import { resolveClarifications } from "@/lib/resume/clarifications";
import { useResumeStore } from "@/lib/store/use-resume-store";

/** Clarifications with their resolved target, recomputed as the document changes. */
export function useResolvedClarifications() {
  const doc = useResumeStore((s) => s.present);
  return useMemo(() => resolveClarifications(doc), [doc]);
}
