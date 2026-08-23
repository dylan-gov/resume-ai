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
  SectionMeta,
  SkillGroup,
  VolunteerEntry,
  WorkExperienceEntry,
} from "@/lib/schema/resume";
import { getSectionEntries, normalizeDoc } from "@/lib/resume/sections";

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-2 border-b border-border pb-1 text-xs font-semibold tracking-widest text-muted-foreground uppercase">
      {children}
    </h2>
  );
}

function DateRange({ start, end }: { start?: string; end?: string }) {
  if (!start && !end) return null;
  return (
    <span className="shrink-0 text-xs text-muted-foreground">
      {[start, end].filter(Boolean).join(" – ")}
    </span>
  );
}

function Bullets({ items }: { items?: string[] }) {
  const visible = items?.filter((b) => b.trim().length > 0);
  if (!visible || visible.length === 0) return null;
  return (
    <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm">
      {visible.map((bullet, i) => (
        <li key={i}>{bullet}</li>
      ))}
    </ul>
  );
}

/**
 * Per-kind body renderers. These are the Phase 1 section layouts, unchanged —
 * only the surrounding iteration moved, so that section order and headings
 * come from `doc.sections` (user-controlled) instead of being hardcoded.
 */
function WorkExperienceBody({ entries }: { entries: WorkExperienceEntry[] }) {
  return (
    <div className="flex flex-col gap-4">
      {entries.map((job) => (
        <div key={job.id}>
          <div className="flex items-baseline justify-between gap-4">
            <p className="text-sm font-medium">
              {job.role}
              {job.company ? <span className="text-muted-foreground"> · {job.company}</span> : null}
            </p>
            <DateRange start={job.startDate} end={job.endDate} />
          </div>
          {job.location && <p className="text-xs text-muted-foreground">{job.location}</p>}
          <Bullets items={job.bullets} />
        </div>
      ))}
    </div>
  );
}

function ProjectsBody({ entries }: { entries: ProjectEntry[] }) {
  return (
    <div className="flex flex-col gap-4">
      {entries.map((project) => (
        <div key={project.id}>
          <div className="flex items-baseline justify-between gap-4">
            <p className="text-sm font-medium">
              {project.url ? (
                <a
                  href={project.url}
                  target="_blank"
                  rel="noreferrer"
                  className="underline underline-offset-2"
                >
                  {project.name}
                </a>
              ) : (
                project.name
              )}
            </p>
            {!!project.tech?.length && (
              <span className="shrink-0 text-xs text-muted-foreground">
                {project.tech.join(", ")}
              </span>
            )}
          </div>
          {project.description && (
            <p className="text-sm text-muted-foreground">{project.description}</p>
          )}
          <Bullets items={project.bullets} />
        </div>
      ))}
    </div>
  );
}

function EducationBody({ entries }: { entries: EducationEntry[] }) {
  return (
    <div className="flex flex-col gap-3">
      {entries.map((edu) => (
        <div key={edu.id}>
          <div className="flex items-baseline justify-between gap-4">
            <p className="text-sm font-medium">
              {edu.institution}
              {edu.degree ? (
                <span className="text-muted-foreground">
                  {" "}
                  · {edu.degree}
                  {edu.field ? `, ${edu.field}` : ""}
                </span>
              ) : null}
            </p>
            <DateRange start={edu.startDate} end={edu.endDate} />
          </div>
          {edu.location && <p className="text-xs text-muted-foreground">{edu.location}</p>}
          <Bullets items={edu.details} />
        </div>
      ))}
    </div>
  );
}

function SkillsBody({ entries }: { entries: SkillGroup[] }) {
  return (
    <div className="flex flex-col gap-1">
      {entries.map((group) => (
        <p key={group.id} className="text-sm">
          <span className="font-medium">{group.category}:</span>{" "}
          <span className="text-muted-foreground">{group.items.join(", ")}</span>
        </p>
      ))}
    </div>
  );
}

function CertificationsBody({ entries }: { entries: CertificationEntry[] }) {
  return (
    <div className="flex flex-col gap-1">
      {entries.map((cert) => (
        <div key={cert.id} className="flex items-baseline justify-between gap-4 text-sm">
          <span>
            {cert.name}
            {cert.issuer ? <span className="text-muted-foreground"> · {cert.issuer}</span> : null}
          </span>
          {cert.date && <span className="shrink-0 text-xs text-muted-foreground">{cert.date}</span>}
        </div>
      ))}
    </div>
  );
}

function AwardsBody({ entries }: { entries: AwardEntry[] }) {
  return (
    <div className="flex flex-col gap-1">
      {entries.map((award) => (
        <div key={award.id}>
          <div className="flex items-baseline justify-between gap-4 text-sm">
            <span>
              {award.title}
              {award.issuer ? (
                <span className="text-muted-foreground"> · {award.issuer}</span>
              ) : null}
            </span>
            {award.date && (
              <span className="shrink-0 text-xs text-muted-foreground">{award.date}</span>
            )}
          </div>
          {award.description && (
            <p className="text-sm text-muted-foreground">{award.description}</p>
          )}
        </div>
      ))}
    </div>
  );
}

function RoleListBody({ entries }: { entries: (LeadershipEntry | VolunteerEntry)[] }) {
  return (
    <div className="flex flex-col gap-3">
      {entries.map((role) => (
        <div key={role.id}>
          <div className="flex items-baseline justify-between gap-4">
            <p className="text-sm font-medium">
              {role.organization}
              {role.role ? <span className="text-muted-foreground"> · {role.role}</span> : null}
            </p>
            <DateRange start={role.startDate} end={role.endDate} />
          </div>
          <Bullets items={role.bullets} />
        </div>
      ))}
    </div>
  );
}

function PublicationsBody({ entries }: { entries: PublicationEntry[] }) {
  return (
    <div className="flex flex-col gap-1">
      {entries.map((pub) => {
        const meta = [pub.publisher, pub.date, pub.authors?.join(", ")].filter(Boolean);
        return (
          <div key={pub.id} className="text-sm">
            <span className="font-medium">
              {pub.url ? (
                <a
                  href={pub.url}
                  target="_blank"
                  rel="noreferrer"
                  className="underline underline-offset-2"
                >
                  {pub.title}
                </a>
              ) : (
                pub.title
              )}
            </span>
            <span className="text-muted-foreground">
              {meta.length > 0 ? ` · ${meta.join(" · ")}` : ""}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function LanguagesBody({ entries }: { entries: LanguageEntry[] }) {
  return (
    <p className="text-sm text-muted-foreground">
      {entries
        .map((lang) => `${lang.name}${lang.proficiency ? ` (${lang.proficiency})` : ""}`)
        .join(", ")}
    </p>
  );
}

function CustomBody({ entries }: { entries: CustomEntry[] }) {
  return (
    <div className="flex flex-col gap-3">
      {entries.map((entry) => (
        <div key={entry.id}>
          <div className="flex items-baseline justify-between gap-4">
            <p className="text-sm font-medium">
              {entry.title}
              {entry.subtitle ? (
                <span className="text-muted-foreground"> · {entry.subtitle}</span>
              ) : null}
            </p>
            <DateRange start={entry.startDate} end={entry.endDate} />
          </div>
          {entry.description && (
            <p className="text-sm text-muted-foreground">{entry.description}</p>
          )}
          <Bullets items={entry.bullets} />
        </div>
      ))}
    </div>
  );
}

function SectionBody({ doc, section }: { doc: ResumeDoc; section: SectionMeta }) {
  if (section.kind === "summary") {
    return <p className="text-sm leading-relaxed">{doc.summary}</p>;
  }

  const entries = getSectionEntries(doc, section);

  switch (section.kind) {
    case "workExperience":
      return <WorkExperienceBody entries={entries as WorkExperienceEntry[]} />;
    case "projects":
      return <ProjectsBody entries={entries as ProjectEntry[]} />;
    case "education":
      return <EducationBody entries={entries as EducationEntry[]} />;
    case "skills":
      return <SkillsBody entries={entries as SkillGroup[]} />;
    case "certifications":
      return <CertificationsBody entries={entries as CertificationEntry[]} />;
    case "awards":
      return <AwardsBody entries={entries as AwardEntry[]} />;
    case "leadership":
    case "volunteer":
      return <RoleListBody entries={entries as (LeadershipEntry | VolunteerEntry)[]} />;
    case "publications":
      return <PublicationsBody entries={entries as PublicationEntry[]} />;
    case "languages":
      return <LanguagesBody entries={entries as LanguageEntry[]} />;
    case "custom":
      return <CustomBody entries={entries as CustomEntry[]} />;
  }
}

/**
 * A section is printed only once it has something to show. An empty section
 * still exists in the editor (with its own empty state) — it just does not
 * put a bare heading on the printed page.
 */
function hasVisibleContent(doc: ResumeDoc, section: SectionMeta): boolean {
  if (section.kind === "summary") return (doc.summary ?? "").trim().length > 0;
  return getSectionEntries(doc, section).length > 0;
}

export function ResumeView({ resume }: { resume: ResumeDoc }) {
  const doc = normalizeDoc(resume);
  const header = doc.header;
  const sections = (doc.sections ?? []).filter((section) => hasVisibleContent(doc, section));

  const hasHeader =
    !!header && Object.values(header).some((v) => (Array.isArray(v) ? v.length > 0 : !!v));

  if (!hasHeader && sections.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Nothing to show yet. Add a section, or upload a document to get started.
      </p>
    );
  }

  return (
    <article className="mx-auto flex w-full max-w-[720px] flex-col gap-6 bg-card px-10 py-10 text-card-foreground ring-1 ring-foreground/10 print:ring-0">
      {hasHeader && header && (
        <header className="flex flex-col gap-1 text-center">
          {header.name && <h1 className="text-2xl font-semibold">{header.name}</h1>}
          {header.title && <p className="text-sm text-muted-foreground">{header.title}</p>}
          <p className="flex flex-wrap justify-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
            {[header.email, header.phone, header.location].filter(Boolean).map((item) => (
              <span key={item}>{item}</span>
            ))}
            {header.links?.map((link, i) => (
              <a
                key={`${link.url}-${i}`}
                href={link.url}
                className="underline underline-offset-2 hover:text-foreground"
                target="_blank"
                rel="noreferrer"
              >
                {link.label}
              </a>
            ))}
          </p>
        </header>
      )}

      {sections.map((section) => (
        <section key={section.id}>
          {section.kind !== "summary" && <SectionHeading>{section.label}</SectionHeading>}
          <SectionBody doc={doc} section={section} />
        </section>
      ))}
    </article>
  );
}
