import {
  type AnyEntry,
  type ResumeDoc,
  type SectionKind,
  type SectionMeta,
} from "@/lib/schema/resume";

/**
 * The bridge between the Phase 2 ordering layer (`doc.sections`) and the
 * Phase 1 typed section arrays (`doc.workExperience`, ...).
 *
 * Built-in sections keep their data in the top-level array named by their
 * `kind`; only custom sections store entries on the section itself. Every
 * read/write of section entries goes through here so that distinction lives
 * in exactly one place.
 */

/** Built-in kinds whose data is an array on the document, in default resume order. */
export const ARRAY_SECTION_KINDS = [
  "workExperience",
  "education",
  "skills",
  "projects",
  "certifications",
  "awards",
  "leadership",
  "publications",
  "languages",
  "volunteer",
] as const;

export type ArraySectionKind = (typeof ARRAY_SECTION_KINDS)[number];

/** Default order sections appear in for a freshly generated resume. */
const DEFAULT_ORDER: SectionKind[] = ["summary", ...ARRAY_SECTION_KINDS];

export const DEFAULT_SECTION_LABELS: Record<SectionKind, string> = {
  summary: "Summary",
  workExperience: "Experience",
  education: "Education",
  skills: "Skills",
  projects: "Projects",
  certifications: "Certifications",
  awards: "Awards",
  leadership: "Leadership",
  publications: "Publications",
  languages: "Languages",
  volunteer: "Volunteer",
  custom: "New Section",
};

export function isArraySectionKind(kind: SectionKind): kind is ArraySectionKind {
  return (ARRAY_SECTION_KINDS as readonly string[]).includes(kind);
}

/**
 * Built-in sections use their kind as their id. It is stable across
 * serialization, unique by construction (one section per built-in kind),
 * and readable in the raw-JSON debug view. Custom sections get UUIDs.
 */
export function sectionIdForKind(kind: ArraySectionKind | "summary"): string {
  return kind;
}

function hasContent(doc: ResumeDoc, kind: SectionKind): boolean {
  if (kind === "summary") return typeof doc.summary === "string" && doc.summary.length > 0;
  if (isArraySectionKind(kind)) return (doc[kind]?.length ?? 0) > 0;
  return false;
}

/**
 * Derives the section list for a document that predates the ordering layer
 * (i.e. anything straight out of the Phase 1 pipeline): default order,
 * default labels, and only the sections that actually have content.
 */
export function defaultSections(doc: ResumeDoc): SectionMeta[] {
  return DEFAULT_ORDER.filter((kind) => hasContent(doc, kind)).map((kind) => ({
    id: sectionIdForKind(kind as ArraySectionKind | "summary"),
    kind,
    label: DEFAULT_SECTION_LABELS[kind],
  }));
}

/**
 * Makes a document safe for the editor: guarantees `sections` exists.
 *
 * Used when hydrating the store from the Phase 1 API response, and the same
 * entry point Phase 3 will use when hydrating from a persisted record.
 * Idempotent — a document that already has sections is returned unchanged.
 */
export function normalizeDoc(doc: ResumeDoc): ResumeDoc {
  if (doc.sections) return doc;
  return { ...doc, sections: defaultSections(doc) };
}

export function findSection(doc: ResumeDoc, sectionId: string): SectionMeta | undefined {
  return doc.sections?.find((s) => s.id === sectionId);
}

/** Reads a section's entries regardless of whether it is built-in or custom. */
export function getSectionEntries(doc: ResumeDoc, section: SectionMeta): AnyEntry[] {
  if (section.kind === "custom") return section.entries ?? [];
  if (isArraySectionKind(section.kind)) return doc[section.kind] ?? [];
  return [];
}

/**
 * Writes a section's entries back to wherever that section stores them.
 * Returns a new document; never mutates.
 */
export function setSectionEntries(
  doc: ResumeDoc,
  section: SectionMeta,
  entries: AnyEntry[]
): ResumeDoc {
  if (section.kind === "custom") {
    return {
      ...doc,
      sections: doc.sections?.map((s) =>
        s.id === section.id ? { ...s, entries: entries as SectionMeta["entries"] } : s
      ),
    };
  }
  if (isArraySectionKind(section.kind)) {
    // The cast is contained here: the caller-facing API is AnyEntry[], but
    // each kind's array is homogeneous and validated by Zod on commit.
    return { ...doc, [section.kind]: entries } as ResumeDoc;
  }
  return doc;
}

/**
 * A blank entry for a section kind. Fields the schema marks required are
 * seeded with "" (valid, and what an empty form row should look like);
 * optional fields are left absent so the document stays minimal.
 */
export function createBlankEntry(kind: SectionKind, id: string): AnyEntry {
  switch (kind) {
    case "workExperience":
      return { id, company: "", role: "", bullets: [""] };
    case "education":
      return { id, institution: "", degree: "" };
    case "skills":
      return { id, category: "", items: [] };
    case "projects":
      return { id, name: "", bullets: [""] };
    case "certifications":
      return { id, name: "" };
    case "awards":
      return { id, title: "" };
    case "leadership":
      return { id, organization: "", bullets: [""] };
    case "publications":
      return { id, title: "" };
    case "languages":
      return { id, name: "" };
    case "volunteer":
      return { id, organization: "", bullets: [""] };
    case "custom":
      return { id, title: "", bullets: [""] };
    case "summary":
      // The summary section holds a single string on the document, not entries.
      return { id, title: "" };
  }
}

/** Section kinds not yet present in the document, offered in "add section". */
export function availableSectionKinds(doc: ResumeDoc): SectionKind[] {
  const used = new Set((doc.sections ?? []).map((s) => s.kind));
  return DEFAULT_ORDER.filter((kind) => !used.has(kind));
}

/** Moves the item with `fromId` to the position currently held by `toId`. */
export function reorderById<T extends { id: string }>(
  items: T[],
  fromId: string,
  toId: string
): T[] {
  const fromIndex = items.findIndex((i) => i.id === fromId);
  const toIndex = items.findIndex((i) => i.id === toId);
  if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) return items;
  const next = [...items];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
}
