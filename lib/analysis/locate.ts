import type { ResumeDoc } from "@/lib/schema/resume";
import { getSectionEntries, normalizeDoc } from "@/lib/resume/sections";
import { entryDisplayTitle, getEntryFieldSpec, readEntryList } from "@/lib/resume/entry-fields";
import type { BulletRef } from "./types";

/**
 * Walks a document and yields every bullet with enough context to (a) point
 * the user at it in the editor and (b) rewrite it through the existing
 * Phase 2 store action — `updateBullet(sectionId, entryId, index, value,
 * bulletsKey)`. Analysis therefore needs no mutation path of its own.
 *
 * `bulletsKey` matters: education stores its list under `details`, not
 * `bullets`, so a hardcoded key would silently target the wrong field.
 */
export function collectBullets(input: ResumeDoc): BulletRef[] {
  const doc = normalizeDoc(input);
  const refs: BulletRef[] = [];

  for (const section of doc.sections ?? []) {
    const spec = getEntryFieldSpec(section.kind);
    if (!spec?.bulletsKey) continue;

    for (const entry of getSectionEntries(doc, section)) {
      const bullets = readEntryList(entry, spec.bulletsKey);
      bullets.forEach((text, index) => {
        if (text.trim().length === 0) return; // blank editing rows aren't content
        refs.push({
          sectionId: section.id,
          sectionLabel: section.label,
          entryId: entry.id,
          entryTitle: entryDisplayTitle(entry, section.kind),
          index,
          bulletsKey: spec.bulletsKey!,
          text,
        });
      });
    }
  }

  return refs;
}

/** All human-readable prose in the document, for readability and matching. */
export function collectResumeText(input: ResumeDoc): string {
  const doc = normalizeDoc(input);
  const parts: string[] = [];

  if (doc.header?.title) parts.push(doc.header.title);
  if (doc.summary) parts.push(doc.summary);

  for (const section of doc.sections ?? []) {
    parts.push(section.label);
    const spec = getEntryFieldSpec(section.kind);

    for (const entry of getSectionEntries(doc, section)) {
      const record = entry as Record<string, unknown>;
      for (const field of spec?.fields ?? []) {
        const value = record[field.key];
        if (typeof value === "string" && value.trim()) parts.push(value);
      }
      for (const field of spec?.listFields ?? []) {
        const value = record[field.key];
        if (Array.isArray(value)) parts.push(value.join(", "));
      }
      if (spec?.bulletsKey) parts.push(...readEntryList(entry, spec.bulletsKey));
    }
  }

  return parts.filter((p) => p.trim().length > 0).join("\n");
}
