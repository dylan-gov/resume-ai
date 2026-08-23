import type { AnyEntry, SectionKind } from "@/lib/schema/resume";

/**
 * Declarative description of the editable fields for each section kind, so
 * the entry editor is one component rather than eleven near-duplicates.
 * Keys here must match the Zod entry schemas in lib/schema/resume.ts.
 */
export interface EntryTextField {
  key: string;
  label: string;
  placeholder?: string;
  multiline?: boolean;
  /** Lays the field out across the full row rather than in the two-column grid. */
  wide?: boolean;
}

export interface EntryListField {
  key: string;
  label: string;
  placeholder?: string;
}

export interface EntryFieldSpec {
  /** Field whose value labels the entry in collapsed/aria contexts. */
  titleKey: string;
  fields: EntryTextField[];
  listFields?: EntryListField[];
  /** Key of the `string[]` rendered as a bullet list, if the kind has one. */
  bulletsKey?: string;
  bulletsLabel?: string;
}

const DATE_FIELDS: EntryTextField[] = [
  { key: "startDate", label: "Start", placeholder: "Jan 2022" },
  { key: "endDate", label: "End", placeholder: "Present" },
];

export const ENTRY_FIELD_SPECS: Record<Exclude<SectionKind, "summary">, EntryFieldSpec> = {
  workExperience: {
    titleKey: "role",
    fields: [
      { key: "role", label: "Role", placeholder: "Senior Engineer" },
      { key: "company", label: "Company", placeholder: "Acme Inc." },
      { key: "location", label: "Location", placeholder: "Austin, TX" },
      ...DATE_FIELDS,
    ],
    bulletsKey: "bullets",
    bulletsLabel: "Bullets",
  },
  education: {
    titleKey: "institution",
    fields: [
      { key: "institution", label: "Institution", placeholder: "University of Texas" },
      { key: "degree", label: "Degree", placeholder: "B.S." },
      { key: "field", label: "Field", placeholder: "Computer Science" },
      { key: "location", label: "Location", placeholder: "Austin, TX" },
      ...DATE_FIELDS,
    ],
    bulletsKey: "details",
    bulletsLabel: "Details",
  },
  skills: {
    titleKey: "category",
    fields: [{ key: "category", label: "Category", placeholder: "Languages" }],
    listFields: [{ key: "items", label: "Skills", placeholder: "Go, Python, SQL" }],
  },
  projects: {
    titleKey: "name",
    fields: [
      { key: "name", label: "Name", placeholder: "Routeplan" },
      { key: "url", label: "URL", placeholder: "https://…" },
      { key: "description", label: "Description", multiline: true, wide: true },
    ],
    listFields: [{ key: "tech", label: "Tech", placeholder: "TypeScript, Postgres" }],
    bulletsKey: "bullets",
    bulletsLabel: "Bullets",
  },
  certifications: {
    titleKey: "name",
    fields: [
      { key: "name", label: "Name", placeholder: "AWS Solutions Architect" },
      { key: "issuer", label: "Issuer", placeholder: "Amazon Web Services" },
      { key: "date", label: "Date", placeholder: "2023" },
      { key: "url", label: "URL", placeholder: "https://…" },
    ],
  },
  awards: {
    titleKey: "title",
    fields: [
      { key: "title", label: "Title", placeholder: "Employee of the Year" },
      { key: "issuer", label: "Issuer" },
      { key: "date", label: "Date", placeholder: "2024" },
      { key: "description", label: "Description", multiline: true, wide: true },
    ],
  },
  leadership: {
    titleKey: "organization",
    fields: [
      { key: "organization", label: "Organization" },
      { key: "role", label: "Role" },
      ...DATE_FIELDS,
    ],
    bulletsKey: "bullets",
    bulletsLabel: "Bullets",
  },
  publications: {
    titleKey: "title",
    fields: [
      { key: "title", label: "Title" },
      { key: "publisher", label: "Publisher" },
      { key: "date", label: "Date" },
      { key: "url", label: "URL", placeholder: "https://…" },
    ],
    listFields: [{ key: "authors", label: "Authors", placeholder: "Ellis J., Chen L." }],
  },
  languages: {
    titleKey: "name",
    fields: [
      { key: "name", label: "Language", placeholder: "Spanish" },
      { key: "proficiency", label: "Proficiency", placeholder: "Conversational" },
    ],
  },
  volunteer: {
    titleKey: "organization",
    fields: [
      { key: "organization", label: "Organization" },
      { key: "role", label: "Role" },
      ...DATE_FIELDS,
    ],
    bulletsKey: "bullets",
    bulletsLabel: "Bullets",
  },
  custom: {
    titleKey: "title",
    fields: [
      { key: "title", label: "Title" },
      { key: "subtitle", label: "Subtitle" },
      ...DATE_FIELDS,
      { key: "description", label: "Description", multiline: true, wide: true },
    ],
    bulletsKey: "bullets",
    bulletsLabel: "Bullets",
  },
};

export function getEntryFieldSpec(kind: SectionKind): EntryFieldSpec | null {
  if (kind === "summary") return null;
  return ENTRY_FIELD_SPECS[kind];
}

export function entryDisplayTitle(entry: AnyEntry, kind: SectionKind): string {
  const spec = getEntryFieldSpec(kind);
  if (!spec) return "";
  const value = (entry as Record<string, unknown>)[spec.titleKey];
  return typeof value === "string" && value.trim().length > 0 ? value : "Untitled";
}

export function readEntryString(entry: AnyEntry, key: string): string {
  const value = (entry as Record<string, unknown>)[key];
  return typeof value === "string" ? value : "";
}

export function readEntryList(entry: AnyEntry, key: string): string[] {
  const value = (entry as Record<string, unknown>)[key];
  return Array.isArray(value) ? (value as string[]) : [];
}
