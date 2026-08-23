import type {
  AwardEntry,
  CertificationEntry,
  CustomEntry,
  EducationEntry,
  LanguageEntry,
  LeadershipEntry,
  ProjectEntry,
  PublicationEntry,
  ResumeDoc,
  SectionKind,
  SectionMeta,
  SkillGroup,
  VolunteerEntry,
  WorkExperienceEntry,
} from "@/lib/schema/resume";
import { getSectionEntries, normalizeDoc } from "@/lib/resume/sections";

/**
 * A format-neutral flattening of a `ResumeDoc`.
 *
 * This is the load-bearing idea of Phase 4: PDF, DOCX, Markdown, and TXT all
 * render *this*, never the document directly. Deciding what each section
 * contributes — and in what order — happens exactly once, so the four
 * formats cannot drift apart or disagree with the on-screen preview. A
 * section the user deleted is absent from the outline, so it cannot
 * reappear in any format.
 *
 * Section order comes straight from `doc.sections` (the Phase 2 ordering
 * layer), so the user's reordering is respected everywhere.
 */

export interface OutlineLink {
  label: string;
  url: string;
}

export interface OutlineHeader {
  name?: string;
  title?: string;
  /** Email / phone / location, in that order, with blanks removed. */
  contacts: string[];
  links: OutlineLink[];
}

export interface OutlineEntry {
  id: string;
  /** Main label, e.g. a role, institution, or project name. */
  title: string;
  /** Secondary label rendered after the title, e.g. the employer. */
  subtitle?: string;
  /** Right-hand meta, e.g. "Mar 2022 – Present". */
  dates?: string;
  location?: string;
  url?: string;
  description?: string;
  /** Comma-joined values shown on the title line, e.g. a skill group. */
  inline?: string;
  bullets: string[];
}

export interface OutlineSection {
  id: string;
  kind: SectionKind;
  label: string;
  /** Single block of prose (summary, languages) instead of entries. */
  paragraph?: string;
  entries: OutlineEntry[];
}

export interface ResumeOutline {
  header: OutlineHeader;
  sections: OutlineSection[];
}

function joinDates(start?: string, end?: string): string | undefined {
  const parts = [start, end].filter((p): p is string => !!p && p.trim().length > 0);
  return parts.length ? parts.join(" – ") : undefined;
}

function clean(values: (string | undefined)[]): string[] {
  return values.filter((v): v is string => !!v && v.trim().length > 0).map((v) => v.trim());
}

/** Blank bullets exist while editing; they are not content and never export. */
function cleanBullets(bullets?: string[]): string[] {
  return (bullets ?? []).map((b) => b.trim()).filter((b) => b.length > 0);
}

function entriesFor(doc: ResumeDoc, section: SectionMeta): OutlineEntry[] {
  const raw = getSectionEntries(doc, section);

  switch (section.kind) {
    case "workExperience":
      return (raw as WorkExperienceEntry[]).map((e) => ({
        id: e.id,
        title: e.role,
        subtitle: e.company,
        dates: joinDates(e.startDate, e.endDate),
        location: e.location,
        bullets: cleanBullets(e.bullets),
      }));

    case "projects":
      return (raw as ProjectEntry[]).map((e) => ({
        id: e.id,
        title: e.name,
        dates: e.tech?.length ? e.tech.join(", ") : undefined,
        url: e.url,
        description: e.description,
        bullets: cleanBullets(e.bullets),
      }));

    case "education":
      return (raw as EducationEntry[]).map((e) => ({
        id: e.id,
        title: e.institution,
        subtitle: clean([e.degree, e.field]).join(", ") || undefined,
        dates: joinDates(e.startDate, e.endDate),
        location: e.location,
        bullets: cleanBullets(e.details),
      }));

    case "skills":
      return (raw as SkillGroup[]).map((e) => ({
        id: e.id,
        title: e.category,
        inline: e.items.join(", "),
        bullets: [],
      }));

    case "certifications":
      return (raw as CertificationEntry[]).map((e) => ({
        id: e.id,
        title: e.name,
        subtitle: e.issuer,
        dates: e.date,
        url: e.url,
        bullets: [],
      }));

    case "awards":
      return (raw as AwardEntry[]).map((e) => ({
        id: e.id,
        title: e.title,
        subtitle: e.issuer,
        dates: e.date,
        description: e.description,
        bullets: [],
      }));

    case "leadership":
    case "volunteer":
      return (raw as (LeadershipEntry | VolunteerEntry)[]).map((e) => ({
        id: e.id,
        title: e.organization,
        subtitle: e.role,
        dates: joinDates(e.startDate, e.endDate),
        bullets: cleanBullets(e.bullets),
      }));

    case "publications":
      return (raw as PublicationEntry[]).map((e) => ({
        id: e.id,
        title: e.title,
        subtitle: clean([e.publisher, e.date, e.authors?.join(", ")]).join(" · ") || undefined,
        url: e.url,
        bullets: [],
      }));

    case "custom":
      return (raw as CustomEntry[]).map((e) => ({
        id: e.id,
        title: e.title ?? "",
        subtitle: e.subtitle,
        dates: joinDates(e.startDate, e.endDate),
        description: e.description,
        bullets: cleanBullets(e.bullets),
      }));

    default:
      return [];
  }
}

function paragraphFor(doc: ResumeDoc, section: SectionMeta): string | undefined {
  if (section.kind === "summary") {
    const text = doc.summary?.trim();
    return text?.length ? text : undefined;
  }
  if (section.kind === "languages") {
    const entries = getSectionEntries(doc, section) as LanguageEntry[];
    const text = entries
      .map((l) => `${l.name}${l.proficiency ? ` (${l.proficiency})` : ""}`)
      .join(", ");
    return text.length ? text : undefined;
  }
  return undefined;
}

export function buildOutline(input: ResumeDoc): ResumeOutline {
  const doc = normalizeDoc(input);
  const header = doc.header ?? {};

  const sections: OutlineSection[] = [];
  for (const section of doc.sections ?? []) {
    const paragraph = paragraphFor(doc, section);
    const entries = paragraph === undefined ? entriesFor(doc, section) : [];

    // Mirrors the preview: a section with nothing to show is not printed.
    if (!paragraph && entries.length === 0) continue;

    sections.push({
      id: section.id,
      kind: section.kind,
      label: section.label,
      paragraph,
      entries,
    });
  }

  return {
    header: {
      name: header.name?.trim() || undefined,
      title: header.title?.trim() || undefined,
      contacts: clean([header.email, header.phone, header.location]),
      links: (header.links ?? [])
        .filter((l) => l.url.trim().length > 0)
        .map((l) => ({ label: l.label.trim() || l.url.trim(), url: l.url.trim() })),
    },
    sections,
  };
}
