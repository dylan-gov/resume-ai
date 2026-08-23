import { z } from "zod";

/**
 * Canonical resume document schema — the single source of truth for the
 * entire product (parsing, rendering, future editing, ATS scoring, export).
 *
 * Every section is optional: a resume in progress may be missing whole
 * sections, and the AI extraction step must never fabricate one just to
 * satisfy the schema. Dates are free-form display strings ("Jan 2022",
 * "2019 - Present") rather than parsed timestamps, since resumes rarely
 * use ISO dates and precision isn't needed for rendering.
 *
 * Every array entry carries a stable `id` so future phases (drag-to-reorder,
 * inline editing) can reference an entry without depending on array index.
 * IDs are assigned server-side after generation (see lib/ai/generate-resume-draft.ts),
 * never trusted from the model — see draft() below.
 */

const id = z.string();

const linkSchema = z.object({
  label: z.string().describe("Display label, e.g. 'LinkedIn', 'Portfolio', 'GitHub'"),
  url: z.string(),
});

const headerSchema = z.object({
  name: z.string().optional(),
  title: z.string().optional().describe("Professional headline, e.g. 'Senior Software Engineer'"),
  email: z.string().optional(),
  phone: z.string().optional(),
  location: z.string().optional(),
  links: z.array(linkSchema).optional(),
});

const workExperienceEntrySchema = z.object({
  id,
  company: z.string(),
  role: z.string(),
  location: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional().describe("Use 'Present' for current roles"),
  bullets: z.array(z.string()).optional(),
});

const educationEntrySchema = z.object({
  id,
  institution: z.string(),
  degree: z.string().optional(),
  field: z.string().optional(),
  location: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  details: z.array(z.string()).optional().describe("GPA, honors, relevant coursework, etc."),
});

const skillGroupSchema = z.object({
  id,
  category: z.string().describe("e.g. 'Languages', 'Frameworks', 'Tools'"),
  items: z.array(z.string()),
});

const projectEntrySchema = z.object({
  id,
  name: z.string(),
  description: z.string().optional(),
  bullets: z.array(z.string()).optional(),
  url: z.string().optional(),
  tech: z.array(z.string()).optional(),
});

const certificationEntrySchema = z.object({
  id,
  name: z.string(),
  issuer: z.string().optional(),
  date: z.string().optional(),
  url: z.string().optional(),
});

const awardEntrySchema = z.object({
  id,
  title: z.string(),
  issuer: z.string().optional(),
  date: z.string().optional(),
  description: z.string().optional(),
});

const leadershipEntrySchema = z.object({
  id,
  organization: z.string(),
  role: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  bullets: z.array(z.string()).optional(),
});

const publicationEntrySchema = z.object({
  id,
  title: z.string(),
  publisher: z.string().optional(),
  date: z.string().optional(),
  url: z.string().optional(),
  authors: z.array(z.string()).optional(),
});

const languageEntrySchema = z.object({
  id,
  name: z.string(),
  proficiency: z.string().optional().describe("e.g. 'Native', 'Fluent', 'Conversational'"),
});

const volunteerEntrySchema = z.object({
  id,
  organization: z.string(),
  role: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  bullets: z.array(z.string()).optional(),
});

/**
 * Section identity/ordering layer, added in Phase 2 (editing).
 *
 * Phase 1 modelled sections as fixed object keys, which cannot express
 * user-controlled order, renamed headings, or custom sections. Rather than
 * restructure the typed section arrays — the AI layer and the default
 * template both depend on their shapes — Phase 2 adds an *ordering layer*
 * alongside them.
 *
 * `sections` is the ordered list of what the resume shows and what each
 * heading is called. For built-in kinds the entry data still lives in the
 * matching top-level array (`workExperience`, `education`, ...); only
 * `kind: "custom"` sections carry their own `entries`. This keeps Phase 1
 * documents valid (the field is optional — see normalizeDoc in
 * lib/resume/sections.ts, which backfills it) and keeps every existing
 * consumer working unchanged.
 */
export const sectionKindSchema = z.enum([
  "summary",
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
  "custom",
]);

export type SectionKind = z.infer<typeof sectionKindSchema>;

/** Free-form entry for user-created sections; every field optional but `id`. */
const customEntrySchema = z.object({
  id,
  title: z.string().optional(),
  subtitle: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  description: z.string().optional(),
  bullets: z.array(z.string()).optional(),
});

const sectionMetaSchema = z.object({
  id,
  kind: sectionKindSchema,
  /** Display heading. Renameable for built-in kinds too, not just custom ones. */
  label: z.string(),
  /** Only meaningful when `kind` is "custom"; built-in kinds read their top-level array. */
  entries: z.array(customEntrySchema).optional(),
});

export const resumeDocSchema = z.object({
  header: headerSchema.optional(),
  summary: z.string().optional(),
  sections: z.array(sectionMetaSchema).optional(),
  workExperience: z.array(workExperienceEntrySchema).optional(),
  education: z.array(educationEntrySchema).optional(),
  skills: z.array(skillGroupSchema).optional(),
  projects: z.array(projectEntrySchema).optional(),
  certifications: z.array(certificationEntrySchema).optional(),
  awards: z.array(awardEntrySchema).optional(),
  leadership: z.array(leadershipEntrySchema).optional(),
  publications: z.array(publicationEntrySchema).optional(),
  languages: z.array(languageEntrySchema).optional(),
  volunteer: z.array(volunteerEntrySchema).optional(),
  /**
   * Questions to ask the user about missing or ambiguous source material
   * (e.g. "What were your employment dates at Acme Corp?"). Populated by
   * the AI extraction step instead of guessing. Answering these is Phase 2.
   */
  clarifications: z.array(z.string()).optional(),
});

export type ResumeDoc = z.infer<typeof resumeDocSchema>;
export type WorkExperienceEntry = z.infer<typeof workExperienceEntrySchema>;
export type EducationEntry = z.infer<typeof educationEntrySchema>;
export type SkillGroup = z.infer<typeof skillGroupSchema>;
export type ProjectEntry = z.infer<typeof projectEntrySchema>;
export type CertificationEntry = z.infer<typeof certificationEntrySchema>;
export type AwardEntry = z.infer<typeof awardEntrySchema>;
export type LeadershipEntry = z.infer<typeof leadershipEntrySchema>;
export type PublicationEntry = z.infer<typeof publicationEntrySchema>;
export type LanguageEntry = z.infer<typeof languageEntrySchema>;
export type VolunteerEntry = z.infer<typeof volunteerEntrySchema>;
export type CustomEntry = z.infer<typeof customEntrySchema>;
export type SectionMeta = z.infer<typeof sectionMetaSchema>;
export type ResumeLink = z.infer<typeof linkSchema>;

/** Any entry that can appear inside a section, discriminated by its section's kind. */
export type AnyEntry =
  | WorkExperienceEntry
  | EducationEntry
  | SkillGroup
  | ProjectEntry
  | CertificationEntry
  | AwardEntry
  | LeadershipEntry
  | PublicationEntry
  | LanguageEntry
  | VolunteerEntry
  | CustomEntry;

/**
 * Draft schema handed to the model: identical to resumeDocSchema but with
 * every `id` field stripped. The model has no stable way to produce
 * meaningful IDs, so it isn't asked to — IDs are generated server-side
 * once the draft comes back (see attachIds in generate-resume-draft.ts).
 */
export const resumeDraftSchema = z.object({
  header: headerSchema.optional(),
  summary: z.string().optional(),
  workExperience: z.array(workExperienceEntrySchema.omit({ id: true })).optional(),
  education: z.array(educationEntrySchema.omit({ id: true })).optional(),
  skills: z.array(skillGroupSchema.omit({ id: true })).optional(),
  projects: z.array(projectEntrySchema.omit({ id: true })).optional(),
  certifications: z.array(certificationEntrySchema.omit({ id: true })).optional(),
  awards: z.array(awardEntrySchema.omit({ id: true })).optional(),
  leadership: z.array(leadershipEntrySchema.omit({ id: true })).optional(),
  publications: z.array(publicationEntrySchema.omit({ id: true })).optional(),
  languages: z.array(languageEntrySchema.omit({ id: true })).optional(),
  volunteer: z.array(volunteerEntrySchema.omit({ id: true })).optional(),
  clarifications: z.array(z.string()).optional(),
});

export type ResumeDraft = z.infer<typeof resumeDraftSchema>;
