import type { ResumeDoc, SectionMeta } from "@/lib/schema/resume";
import { getSectionEntries } from "./sections";
import { getEntryFieldSpec, readEntryString } from "./entry-fields";

/**
 * Phase 1 emits clarifications as plain prose ("What was your end date at
 * Fenwick Data Co.?"), with no pointer to what they are about. Phase 2 needs
 * to put each question next to the thing it concerns, so we resolve it here
 * by matching the question text against the identifying values already in the
 * document.
 *
 * This is a best-effort heuristic: an unresolved clarification is still shown,
 * just without an inline field to answer it. It never guesses at content —
 * only at *where* a question points.
 */
export interface ResolvedClarification {
  /** Index in `doc.clarifications`, used to dismiss it. */
  index: number;
  text: string;
  sectionId?: string;
  entryId?: string;
  /** Field on the entry the question appears to ask about. */
  fieldKey?: string;
}

/** Keyword → field, most specific first so "end date" beats bare "date". */
const FIELD_HINTS: { pattern: RegExp; keys: string[] }[] = [
  { pattern: /\bend(s|ed|ing)?\b|\bleft\b|\bleave\b|\bfinish(ed)?\b|\buntil\b/i, keys: ["endDate"] },
  {
    pattern: /\bstart(s|ed|ing)?\b|\bbegan\b|\bbegin\b|\bjoin(ed)?\b|\bsince\b/i,
    keys: ["startDate"],
  },
  { pattern: /\bgraduat|\bcompleted\b/i, keys: ["endDate", "date"] },
  { pattern: /\blocation\b|\bwhere\b|\bcity\b|\bbased\b/i, keys: ["location"] },
  { pattern: /\bmonth\b|\byear\b|\bdate\b|\bwhen\b/i, keys: ["date", "endDate", "startDate"] },
  { pattern: /\btitle\b|\brole\b|\bposition\b/i, keys: ["role", "title"] },
  { pattern: /\bissuer\b|\bawarded by\b|\bwho issued\b/i, keys: ["issuer"] },
  { pattern: /\burl\b|\blink\b/i, keys: ["url"] },
  { pattern: /\bgpa\b|\bhonors\b|\bcoursework\b/i, keys: ["details"] },
  { pattern: /\bdegree\b/i, keys: ["degree"] },
  { pattern: /\bpublisher\b/i, keys: ["publisher"] },
  { pattern: /\bproficien|\bfluen/i, keys: ["proficiency"] },
];

/** Values that identify an entry well enough to match a question against. */
const IDENTIFIER_KEYS = [
  "company",
  "institution",
  "organization",
  "name",
  "title",
  "role",
  "publisher",
  "category",
];

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
}

function resolveField(text: string, availableKeys: string[]): string | undefined {
  for (const hint of FIELD_HINTS) {
    if (!hint.pattern.test(text)) continue;
    const match = hint.keys.find((key) => availableKeys.includes(key));
    if (match) return match;
  }
  return undefined;
}

function resolveOne(doc: ResumeDoc, text: string, index: number): ResolvedClarification {
  const haystack = normalize(text);

  let best: { section: SectionMeta; entryId: string; score: number } | null = null;

  for (const section of doc.sections ?? []) {
    for (const entry of getSectionEntries(doc, section)) {
      for (const key of IDENTIFIER_KEYS) {
        const raw = readEntryString(entry, key);
        const candidate = normalize(raw);
        // Short identifiers ("IBM") produce too many false positives inside
        // ordinary prose, so require a little length before trusting a match.
        if (candidate.length < 4) continue;
        if (!haystack.includes(candidate)) continue;
        if (!best || candidate.length > best.score) {
          best = { section, entryId: entry.id, score: candidate.length };
        }
      }
    }
  }

  if (!best) return { index, text };

  const section = best.section;
  const entry = getSectionEntries(doc, section).find((e) => e.id === best!.entryId);
  const spec = getEntryFieldSpec(section.kind);
  const availableKeys = [
    ...(spec?.fields.map((f) => f.key) ?? []),
    ...(spec?.bulletsKey ? [spec.bulletsKey] : []),
  ];

  return {
    index,
    text,
    sectionId: section.id,
    entryId: entry?.id,
    fieldKey: resolveField(text, availableKeys),
  };
}

export function resolveClarifications(doc: ResumeDoc): ResolvedClarification[] {
  return (doc.clarifications ?? []).map((text, index) => resolveOne(doc, text, index));
}
