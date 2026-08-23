import {
  PHRASE_BREAKERS,
  REQUIREMENT_MARKERS,
  STOPWORDS,
  SYNONYM_GROUPS,
} from "./wordlists/keywords";
import type { JobKeyword, JobMatch, KeywordMatch } from "./types";

/**
 * Deterministic job-description keyword extraction and matching.
 *
 * Everything here is pure and reproducible. The AI layer only ever *adds*
 * synonym pairs this list does not know (see lib/analysis/ai/), so the
 * numbers below never depend on a model call.
 */

/** Maps every term in a synonym group to a single canonical form. */
const CANONICAL = new Map<string, string>();
for (const group of SYNONYM_GROUPS) {
  const canonical = group[0];
  for (const term of group) CANONICAL.set(term.toLowerCase(), canonical);
}

export function normalizeTerm(term: string): string {
  const cleaned = term
    .toLowerCase()
    .replace(/[^a-z0-9+#./ -]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return CANONICAL.get(cleaned) ?? cleaned;
}

/**
 * Light singularization, used *only* for comparison — never for the term
 * shown to the user. It happily turns "kubernetes" into "kubernete", which
 * is harmless when both sides of a comparison get the same treatment but
 * would be an embarrassing thing to display.
 */
function singularize(word: string): string {
  if (word.length <= 3) return word;
  if (word.endsWith("ies")) return `${word.slice(0, -3)}y`;
  if (word.endsWith("ses") || word.endsWith("xes")) return word.slice(0, -2);
  if (word.endsWith("s") && !word.endsWith("ss") && !word.endsWith("us")) {
    return word.slice(0, -1);
  }
  return word;
}

/**
 * The key two terms are compared on: singularized (last word only, for
 * phrases) and mapped through the synonym table. Display keeps the original
 * wording; matching uses this.
 */
function canonicalKey(term: string): string {
  const direct = CANONICAL.get(term);
  if (direct) return direct;

  const parts = term.split(" ");
  parts[parts.length - 1] = singularize(parts[parts.length - 1]);
  const singular = parts.join(" ");

  return CANONICAL.get(singular) ?? singular;
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9+#./\s-]/g, " ")
    .split(/\s+/)
    .map((t) => t.replace(/^[-.]+|[-.]+$/g, ""))
    .filter((t) => t.length > 1);
}

function isMeaningful(token: string): boolean {
  if (STOPWORDS.has(token)) return false;
  if (/^\d+$/.test(token)) return false;
  return token.length > 1;
}

/**
 * Extracts weighted keywords from a job description.
 *
 * Unigrams plus 2- and 3-grams, so multi-word skills ("machine learning",
 * "continuous integration") survive as single terms. Weight combines
 * frequency with whether the term appeared in a requirements-style line.
 */
export function extractJobKeywords(jobDescription: string, limit = 40): JobKeyword[] {
  const lines = jobDescription.split(/\r?\n/);
  const counts = new Map<string, { frequency: number; required: boolean }>();

  const bump = (term: string, required: boolean) => {
    const key = normalizeTerm(term);
    if (!key || key.length < 2) return;
    const existing = counts.get(key);
    if (existing) {
      existing.frequency += 1;
      existing.required = existing.required || required;
    } else {
      counts.set(key, { frequency: 1, required });
    }
  };

  // Job descriptions put "Requirements:" on its own line and list the
  // actual requirements beneath it, so the heading's context has to carry
  // forward to following lines until another heading takes over.
  let inRequirementsSection = false;

  for (const line of lines) {
    const lower = line.toLowerCase().trim();
    const lineHasMarker = REQUIREMENT_MARKERS.some((marker) => lower.includes(marker));
    // A short line ending in ":" is a heading.
    const isHeading = /:$/.test(lower) && lower.length < 60;

    if (lineHasMarker) inRequirementsSection = true;
    else if (isHeading) inRequirementsSection = false;

    const required = lineHasMarker || inRequirementsSection;
    const tokens = tokenize(line);

    for (let i = 0; i < tokens.length; i++) {
      // Terms are stored in their original wording; singularization is a
      // comparison detail and must not reach the user-visible term.
      const unigram = tokens[i];
      if (isMeaningful(singularize(unigram)) && isMeaningful(unigram)) {
        bump(unigram, required);
      }

      // Multi-word phrases only count when their outer words are meaningful,
      // which filters "of the team" style noise.
      for (const size of [2, 3]) {
        if (i + size > tokens.length) continue;
        const parts = tokens.slice(i, i + size);
        if (!isMeaningful(parts[0]) || !isMeaningful(parts[parts.length - 1])) continue;
        // "kubernetes and docker" is two skills, not one phrase.
        if (parts.some((part) => PHRASE_BREAKERS.has(part))) continue;
        bump(parts.join(" "), required);
      }
    }
  }

  const keywords: JobKeyword[] = [...counts.entries()].map(([term, { frequency, required }]) => ({
    term,
    frequency,
    required,
    // Requirements matter more; repetition matters, with diminishing returns.
    weight: (required ? 2 : 1) * (1 + Math.log2(frequency)),
  }));

  return keywords
    .sort((a, b) => b.weight - a.weight || a.term.localeCompare(b.term))
    .slice(0, limit);
}

/**
 * Indexes the resume by both raw text (for literal containment) and
 * canonical keys (so different wording of the same skill still matches).
 * `surfaceFor` remembers how the resume actually phrased it, which is what
 * lets the UI say "you wrote React.js" instead of "add React".
 */
function buildResumeIndex(resumeText: string): {
  raw: string;
  canonical: Set<string>;
  surfaceFor: Map<string, string>;
} {
  const raw = ` ${resumeText.toLowerCase().replace(/\s+/g, " ")} `;
  const canonical = new Set<string>();
  const surfaceFor = new Map<string, string>();

  const remember = (surface: string) => {
    const key = canonicalKey(surface);
    canonical.add(key);
    if (!surfaceFor.has(key)) surfaceFor.set(key, surface);
  };

  const tokens = tokenize(resumeText);
  for (let i = 0; i < tokens.length; i++) {
    remember(tokens[i]);
    for (const size of [2, 3]) {
      if (i + size <= tokens.length) remember(tokens.slice(i, i + size).join(" "));
    }
  }

  // Multi-word synonyms that tokenization alone would miss.
  for (const group of SYNONYM_GROUPS) {
    for (const term of group) {
      if (raw.includes(` ${term} `)) {
        canonical.add(group[0]);
        if (!surfaceFor.has(group[0])) surfaceFor.set(group[0], term);
      }
    }
  }

  return { raw, canonical, surfaceFor };
}

export interface MatchOptions {
  /**
   * Extra synonym pairs discovered by the AI layer, as
   * [jobTerm, resumeTerm]. Purely additive — they can turn a "missing"
   * into a "synonym" but never change a deterministic match.
   */
  extraSynonyms?: readonly (readonly [string, string])[];
}

/**
 * Matches a resume against extracted job keywords.
 *
 * Three outcomes, deliberately distinguished so the app never tells someone
 * to "add React" when their resume says "React.js":
 *   - matched: the term appears literally
 *   - synonym: present under different wording (reported, not "missing")
 *   - missing: genuinely absent
 */
export function matchKeywords(
  resumeText: string,
  keywords: JobKeyword[],
  options: MatchOptions = {}
): JobMatch {
  const index = buildResumeIndex(resumeText);
  const extra = new Map<string, string>();
  for (const [jobTerm, resumeTerm] of options.extraSynonyms ?? []) {
    extra.set(normalizeTerm(jobTerm), resumeTerm);
  }

  const results: KeywordMatch[] = keywords.map((keyword) => {
    const term = keyword.term;

    // Literal appearance — the resume uses the JD's own wording.
    if (index.raw.includes(` ${term} `)) {
      return { keyword, status: "matched" };
    }

    // Same skill, different wording. This is what stops the app telling a
    // "React.js" user to add "React".
    const key = canonicalKey(term);
    if (index.canonical.has(key)) {
      const surface = index.surfaceFor.get(key);
      // A pure singular/plural difference is not worth calling a synonym.
      return surface && surface !== term
        ? { keyword, status: "synonym", matchedAs: surface }
        : { keyword, status: "matched" };
    }

    const aiMatch = extra.get(term);
    if (aiMatch && index.raw.includes(` ${aiMatch.toLowerCase()} `)) {
      return { keyword, status: "synonym", matchedAs: aiMatch };
    }

    return { keyword, status: "missing" };
  });

  const totalWeight = keywords.reduce((sum, k) => sum + k.weight, 0);
  // A synonym is a real match — the user has the skill, just worded
  // differently — so it counts fully toward coverage.
  const matchedWeight = results
    .filter((r) => r.status !== "missing")
    .reduce((sum, r) => sum + r.keyword.weight, 0);

  return {
    score: totalWeight === 0 ? 0 : Math.round((matchedWeight / totalWeight) * 100),
    matchedWeight: Math.round(matchedWeight * 100) / 100,
    totalWeight: Math.round(totalWeight * 100) / 100,
    matches: results.filter((r) => r.status === "matched"),
    synonyms: results.filter((r) => r.status === "synonym"),
    missing: results
      .filter((r) => r.status === "missing")
      .sort((a, b) => b.keyword.weight - a.keyword.weight),
  };
}
