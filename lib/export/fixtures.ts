import type { ResumeDoc } from "@/lib/schema/resume";

/**
 * Shared export fixtures. Every exporter is tested against all three, so a
 * format that breaks on empty sections or long documents fails loudly.
 */

/** Barely anything: no sections at all beyond a name. */
export const MINIMAL_DOC: ResumeDoc = {
  header: { name: "Ada Lovelace" },
  sections: [],
};

/**
 * Every section kind populated, plus the awkward cases: an entry with no
 * end date, one with no location, an empty section that must not print, a
 * blank bullet, a custom section, and non-ASCII characters.
 */
export const FULL_DOC: ResumeDoc = {
  header: {
    name: "José Ólafur Müller",
    title: "Senior Backend Engineer",
    email: "jose@example.com",
    phone: "(555) 012-3456",
    location: "Austin, TX",
    links: [
      { label: "GitHub", url: "https://github.com/example" },
      { label: "Portfolio", url: "https://example.com" },
    ],
  },
  summary: "Backend engineer with 8 years’ experience — payments and data infrastructure.",
  workExperience: [
    {
      id: "job-1",
      company: "Northwind Systems",
      role: "Senior Backend Engineer",
      location: "Austin, TX",
      startDate: "Mar 2022",
      endDate: "Present",
      bullets: [
        "Rebuilt the billing service on Postgres logical replication, cutting reconciliation errors by 90%.",
        "Led a team of 3 engineers migrating a monolith to 6 Go services.",
        "   ", // blank-ish bullet: must not appear in any export
      ],
    },
    {
      // No end date and no location — both optional.
      id: "job-2",
      company: "Fenwick Data Co.",
      role: "Backend Engineer",
      startDate: "Jun 2019",
      bullets: ["Built an ingestion pipeline processing 40M events/day."],
    },
  ],
  education: [
    {
      id: "edu-1",
      institution: "University of Texas at Austin",
      degree: "B.S.",
      field: "Computer Science",
      startDate: "2015",
      endDate: "2019",
      details: ["GPA 3.7", "Coursework: distributed systems, compilers"],
    },
  ],
  skills: [
    { id: "sk-1", category: "Languages", items: ["Go", "Python", "TypeScript", "SQL"] },
    { id: "sk-2", category: "Infrastructure", items: ["Postgres", "Kafka", "Kubernetes"] },
  ],
  projects: [
    {
      id: "pr-1",
      name: "Routeplan",
      description: "Route optimization for small delivery fleets.",
      url: "https://routeplan.example.com",
      tech: ["TypeScript", "Postgres"],
      bullets: ["Solver handles 5k stops in under 2 seconds."],
    },
  ],
  certifications: [
    { id: "ce-1", name: "AWS Solutions Architect", issuer: "Amazon Web Services", date: "2023" },
  ],
  awards: [
    { id: "aw-1", title: "Hack Day — 2nd place", issuer: "Austin Hack Day", date: "2024", description: "Shelfie, a bookshelf scanner." },
  ],
  leadership: [
    { id: "ld-1", organization: "Austin Backend Meetup", role: "Organizer", startDate: "2021", bullets: ["Ran a monthly talk series."] },
  ],
  publications: [
    { id: "pb-1", title: "Reconciling money without losing your mind", publisher: "Self-published", date: "2023", url: "https://example.com/talk", authors: ["J. Müller"] },
  ],
  languages: [
    { id: "lg-1", name: "English", proficiency: "Native" },
    { id: "lg-2", name: "Icelandic", proficiency: "Conversational" },
  ],
  volunteer: [
    { id: "vo-1", organization: "Code for Austin", role: "Mentor", startDate: "2020", endDate: "2022", bullets: [] },
  ],
  sections: [
    { id: "summary", kind: "summary", label: "Summary" },
    { id: "workExperience", kind: "workExperience", label: "Experience" },
    { id: "projects", kind: "projects", label: "Projects" },
    { id: "education", kind: "education", label: "Education" },
    { id: "skills", kind: "skills", label: "Skills" },
    { id: "certifications", kind: "certifications", label: "Certifications" },
    { id: "awards", kind: "awards", label: "Awards" },
    { id: "leadership", kind: "leadership", label: "Leadership" },
    { id: "publications", kind: "publications", label: "Publications" },
    { id: "languages", kind: "languages", label: "Languages" },
    { id: "volunteer", kind: "volunteer", label: "Volunteer" },
    {
      id: "custom-1",
      kind: "custom",
      label: "Speaking",
      entries: [
        {
          id: "cu-1",
          title: "Scaling Postgres",
          subtitle: "StrangeLoop",
          startDate: "2024",
          bullets: ["Presented to ~400 attendees."],
        },
      ],
    },
    // Present in the ordering layer but with no entries: must not print.
    { id: "custom-empty", kind: "custom", label: "Empty Section", entries: [] },
  ],
};

/** Long enough to force pagination in PDF and flow across pages in DOCX. */
export function makeMultiPageDoc(jobCount = 12, bulletsPerJob = 8): ResumeDoc {
  return {
    header: { name: "Pat Multipage", title: "Staff Engineer", email: "pat@example.com" },
    summary: "A deliberately long resume used to verify pagination.",
    workExperience: Array.from({ length: jobCount }, (_, i) => ({
      id: `job-${i + 1}`,
      company: `Company Number ${i + 1}`,
      role: `Senior Engineer ${i + 1}`,
      location: "Remote",
      startDate: `${2000 + i}`,
      endDate: `${2001 + i}`,
      bullets: Array.from(
        { length: bulletsPerJob },
        (_, b) =>
          `Job ${i + 1} bullet ${b + 1}: delivered a substantial piece of infrastructure work ` +
          `that measurably improved reliability, throughput, and developer experience across teams.`
      ),
    })),
    sections: [
      { id: "summary", kind: "summary", label: "Summary" },
      { id: "workExperience", kind: "workExperience", label: "Experience" },
    ],
  };
}

export const MULTIPAGE_DOC = makeMultiPageDoc();

export const EXPORT_FIXTURES = {
  minimal: MINIMAL_DOC,
  full: FULL_DOC,
  multipage: MULTIPAGE_DOC,
} as const;
