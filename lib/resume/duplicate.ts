import type { ResumeDoc } from "@/lib/schema/resume";

/**
 * Deep-copies a document, giving every entry (and every custom section) a
 * fresh id so the copy is fully independent of its source. Built-in section
 * ids are the section kind and stay as they are — they are unique within a
 * document by construction, not global identifiers.
 */
export function withFreshIds(
  doc: ResumeDoc,
  generateId: () => string = () => globalThis.crypto.randomUUID()
): ResumeDoc {
  const copy: ResumeDoc = structuredClone(doc);

  const reid = <T extends { id: string }>(entries: T[] | undefined) =>
    entries?.map((entry) => ({ ...entry, id: generateId() }));

  copy.workExperience = reid(copy.workExperience);
  copy.education = reid(copy.education);
  copy.skills = reid(copy.skills);
  copy.projects = reid(copy.projects);
  copy.certifications = reid(copy.certifications);
  copy.awards = reid(copy.awards);
  copy.leadership = reid(copy.leadership);
  copy.publications = reid(copy.publications);
  copy.languages = reid(copy.languages);
  copy.volunteer = reid(copy.volunteer);

  copy.sections = copy.sections?.map((section) =>
    section.kind === "custom"
      ? { ...section, id: generateId(), entries: reid(section.entries) }
      : section
  );

  return copy;
}
