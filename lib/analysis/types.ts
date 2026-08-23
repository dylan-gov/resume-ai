/**
 * Analysis result types.
 *
 * Every score carries the checks that produced it, and every finding
 * carries the location it refers to — a score the user cannot act on is
 * useless, so "explainable" is enforced by the type, not by convention.
 */

/** Points at one bullet, enough to locate it and to edit it via the store. */
export interface BulletRef {
  sectionId: string;
  sectionLabel: string;
  entryId: string;
  entryTitle: string;
  /** Index within the entry's bullet array. */
  index: number;
  /** Which array the bullet lives in ("bullets", or "details" for education). */
  bulletsKey: string;
  text: string;
}

/** Stable DOM id so the editor can scroll to and highlight a finding. */
export function bulletDomId(ref: Pick<BulletRef, "entryId" | "index">): string {
  return `bullet-${ref.entryId}-${ref.index}`;
}

export type FindingKind =
  | "weak-opener"
  | "no-action-verb"
  | "passive-voice"
  | "buzzword"
  | "not-quantified"
  | "too-long"
  | "too-short";

export type Severity = "high" | "medium" | "low";

export interface Finding {
  id: string;
  kind: FindingKind;
  severity: Severity;
  /** One-line statement of the problem. */
  message: string;
  /** What to do about it. */
  suggestion: string;
  /** The exact offending substring, for highlighting. */
  highlight?: string;
  ref: BulletRef;
  /** True when an AI rewrite is worth offering for this finding. */
  rewritable: boolean;
}

export interface ScoreCheck {
  id: string;
  label: string;
  passed: boolean;
  weight: number;
  /** What was actually observed. */
  detail: string;
  /** How to make it pass; omitted when it already passes. */
  howToImprove?: string;
}

export interface Score {
  /** 0–100, rounded. */
  value: number;
  checks: ScoreCheck[];
}

export interface ReadabilityScore {
  /** Flesch–Kincaid grade level, one decimal. */
  gradeLevel: number;
  /** Plain-English reading of the grade. */
  interpretation: string;
  wordCount: number;
  sentenceCount: number;
  syllableCount: number;
  averageWordsPerSentence: number;
}

export interface AnalysisStats {
  bulletCount: number;
  quantifiedBulletCount: number;
  sectionCount: number;
  totalWords: number;
}

export interface ResumeAnalysis {
  ats: Score;
  formatting: Score;
  readability: ReadabilityScore;
  findings: Finding[];
  stats: AnalysisStats;
}

/* ------------------------------ JD matching ----------------------------- */

export interface JobKeyword {
  /** Normalized display term. */
  term: string;
  /** How often it appears in the JD. */
  frequency: number;
  /** Appears in a requirements-style line. */
  required: boolean;
  /** Relative importance, used to weight coverage. */
  weight: number;
}

export type KeywordMatchStatus = "matched" | "synonym" | "missing";

export interface KeywordMatch {
  keyword: JobKeyword;
  status: KeywordMatchStatus;
  /** For "synonym": the wording the resume actually uses. */
  matchedAs?: string;
}

export interface JobMatch {
  /** 0–100 weighted coverage of the JD's keywords. */
  score: number;
  /** Sum of weights of matched keywords, for showing the math. */
  matchedWeight: number;
  totalWeight: number;
  matches: KeywordMatch[];
  missing: KeywordMatch[];
  /** Present in the resume only under different wording. */
  synonyms: KeywordMatch[];
}
