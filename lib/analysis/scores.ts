import type { ResumeDoc } from "@/lib/schema/resume";
import { getSectionEntries, normalizeDoc } from "@/lib/resume/sections";
import type { BulletRef, Score, ScoreCheck } from "./types";
import { MAX_BULLET_WORDS, MIN_BULLET_WORDS, bulletWordCount, isQuantified } from "./bullets";

/**
 * Scores are a weighted pass-rate over explicit checks. Each check carries
 * what was observed and how to fix it, so the number is never a black box.
 */
function toScore(checks: ScoreCheck[]): Score {
  const total = checks.reduce((sum, c) => sum + c.weight, 0);
  if (total === 0) return { value: 0, checks };
  const earned = checks.reduce((sum, c) => sum + (c.passed ? c.weight : 0), 0);
  return { value: Math.round((earned / total) * 100), checks };
}

/** Section labels an ATS is likely to recognize, by kind. */
const RECOGNIZABLE_LABELS: Record<string, RegExp> = {
  workExperience: /experience|employment|work history|professional/i,
  education: /education|academic|schooling/i,
  skills: /skills|technical|competenc/i,
};

export function scoreAts(input: ResumeDoc, bullets: BulletRef[]): Score {
  const doc = normalizeDoc(input);
  const sections = doc.sections ?? [];
  const kinds = new Set(sections.map((s) => s.kind));
  const header = doc.header ?? {};

  const checks: ScoreCheck[] = [];

  checks.push({
    id: "contact-email",
    label: "Contact email present",
    passed: !!header.email?.trim(),
    weight: 3,
    detail: header.email?.trim() ? `Found ${header.email.trim()}` : "No email address",
    howToImprove: header.email?.trim() ? undefined : "Add an email to the header — most ATS require one.",
  });

  const hasSecondContact = !!(header.phone?.trim() || header.location?.trim());
  checks.push({
    id: "contact-secondary",
    label: "Phone or location present",
    passed: hasSecondContact,
    weight: 1,
    detail: hasSecondContact ? "Found a phone number or location" : "Neither phone nor location",
    howToImprove: hasSecondContact ? undefined : "Add a phone number or city to the header.",
  });

  checks.push({
    id: "has-name",
    label: "Name present",
    passed: !!header.name?.trim(),
    weight: 3,
    detail: header.name?.trim() ? `Found ${header.name.trim()}` : "No name in the header",
    howToImprove: header.name?.trim() ? undefined : "Add your name — parsers key on it first.",
  });

  for (const [kind, label] of [
    ["workExperience", "Work experience section"],
    ["education", "Education section"],
    ["skills", "Skills section"],
  ] as const) {
    const present = kinds.has(kind);
    const weight = kind === "workExperience" ? 4 : 2;
    checks.push({
      id: `section-${kind}`,
      label,
      passed: present,
      weight,
      detail: present ? "Present" : "Missing",
      howToImprove: present ? undefined : `Add a ${label.toLowerCase()} — ATS look for it by name.`,
    });

    if (!present) continue;

    // Present, but is the heading one a parser will recognize?
    const section = sections.find((s) => s.kind === kind)!;
    const recognizable = RECOGNIZABLE_LABELS[kind].test(section.label);
    checks.push({
      id: `label-${kind}`,
      label: `"${section.label}" is a standard heading`,
      passed: recognizable,
      weight: 2,
      detail: recognizable
        ? `"${section.label}" is recognizable`
        : `"${section.label}" is non-standard`,
      howToImprove: recognizable
        ? undefined
        : `Rename it to something conventional so parsers map it correctly.`,
    });
  }

  // Dates on every job: ATS build employment timelines from these.
  const jobs = sections.find((s) => s.kind === "workExperience");
  const jobEntries = jobs ? getSectionEntries(doc, jobs) : [];
  const datedJobs = jobEntries.filter(
    (e) => !!(e as { startDate?: string }).startDate?.trim()
  ).length;
  checks.push({
    id: "job-dates",
    label: "Every role has a start date",
    passed: jobEntries.length > 0 && datedJobs === jobEntries.length,
    weight: 3,
    detail:
      jobEntries.length === 0
        ? "No roles to check"
        : `${datedJobs} of ${jobEntries.length} roles have a start date`,
    howToImprove:
      jobEntries.length > 0 && datedJobs === jobEntries.length
        ? undefined
        : "Add start dates so parsers can build your employment timeline.",
  });

  const quantified = bullets.filter((b) => isQuantified(b.text)).length;
  const quantifiedRatio = bullets.length === 0 ? 0 : quantified / bullets.length;
  checks.push({
    id: "quantified",
    label: "Bullets include measurable results",
    passed: quantifiedRatio >= 0.3,
    weight: 3,
    detail:
      bullets.length === 0
        ? "No bullets to check"
        : `${quantified} of ${bullets.length} bullets (${Math.round(quantifiedRatio * 100)}%) include a number`,
    howToImprove:
      quantifiedRatio >= 0.3
        ? undefined
        : "Quantify at least a third of your bullets — it is the strongest recruiter signal.",
  });

  checks.push({
    id: "has-bullets",
    label: "Experience is described in bullets",
    passed: bullets.length >= 3,
    weight: 2,
    detail: `${bullets.length} bullet${bullets.length === 1 ? "" : "s"} found`,
    howToImprove:
      bullets.length >= 3 ? undefined : "Add bullet points describing what you did in each role.",
  });

  // Structural guarantee rather than a heuristic: the document is
  // structured JSON and Phase 4 exports it as real text, never an image.
  checks.push({
    id: "machine-readable",
    label: "Exports as real, parseable text",
    passed: true,
    weight: 2,
    detail:
      "Your resume is structured data, and PDF/DOCX exports contain selectable text — not an image.",
  });

  return toScore(checks);
}

export function scoreFormatting(input: ResumeDoc, bullets: BulletRef[]): Score {
  const doc = normalizeDoc(input);
  const sections = doc.sections ?? [];
  const checks: ScoreCheck[] = [];

  const longBullets = bullets.filter((b) => bulletWordCount(b.text) > MAX_BULLET_WORDS);
  checks.push({
    id: "bullet-length-max",
    label: "No paragraph-length bullets",
    passed: longBullets.length === 0,
    weight: 3,
    detail:
      longBullets.length === 0
        ? "All bullets are a readable length"
        : `${longBullets.length} bullet(s) exceed ${MAX_BULLET_WORDS} words`,
    howToImprove:
      longBullets.length === 0 ? undefined : "Split long bullets or cut them to one clear idea.",
  });

  const shortBullets = bullets.filter((b) => bulletWordCount(b.text) < MIN_BULLET_WORDS);
  checks.push({
    id: "bullet-length-min",
    label: "No stub bullets",
    passed: shortBullets.length === 0,
    weight: 2,
    detail:
      shortBullets.length === 0
        ? "No bullets are too short"
        : `${shortBullets.length} bullet(s) are under ${MIN_BULLET_WORDS} words`,
    howToImprove:
      shortBullets.length === 0 ? undefined : "Expand short bullets to say what happened and why it mattered.",
  });

  const labelled = sections.every((s) => s.label.trim().length > 0);
  checks.push({
    id: "section-labels",
    label: "Every section has a heading",
    passed: labelled,
    weight: 2,
    detail: labelled ? "All sections are labelled" : "A section has an empty heading",
    howToImprove: labelled ? undefined : "Give every section a heading.",
  });

  // Roles need both a title and an employer to read correctly.
  const jobs = sections.find((s) => s.kind === "workExperience");
  const jobEntries = jobs ? getSectionEntries(doc, jobs) : [];
  const complete = jobEntries.filter((e) => {
    const entry = e as { role?: string; company?: string };
    return !!entry.role?.trim() && !!entry.company?.trim();
  }).length;
  checks.push({
    id: "entry-completeness",
    label: "Every role has a title and employer",
    passed: jobEntries.length === 0 || complete === jobEntries.length,
    weight: 3,
    detail:
      jobEntries.length === 0
        ? "No roles to check"
        : `${complete} of ${jobEntries.length} roles are complete`,
    howToImprove:
      jobEntries.length === 0 || complete === jobEntries.length
        ? undefined
        : "Fill in the missing job title or company name.",
  });

  const emptySections = sections.filter(
    (s) => s.kind !== "summary" && getSectionEntries(doc, s).length === 0
  );
  checks.push({
    id: "no-empty-sections",
    label: "No empty sections",
    passed: emptySections.length === 0,
    weight: 1,
    detail:
      emptySections.length === 0
        ? "Every section has content"
        : `Empty: ${emptySections.map((s) => s.label).join(", ")}`,
    howToImprove:
      emptySections.length === 0 ? undefined : "Add entries to empty sections, or delete them.",
  });

  return toScore(checks);
}
