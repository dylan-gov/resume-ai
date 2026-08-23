import { ACTION_VERBS, WEAK_OPENERS } from "./wordlists/weak-openers";
import { BUZZWORDS } from "./wordlists/buzzwords";
import { BE_FORMS, IRREGULAR_PARTICIPLES, PARTICIPLE_EXCEPTIONS } from "./wordlists/passive";
import { countWords } from "./readability";
import type { BulletRef, Finding } from "./types";

/**
 * Per-bullet deterministic detectors. Every function here is pure and
 * exported so it can be unit-tested against known-good and known-bad text
 * without constructing a whole document.
 */

/** Bullets shorter than this read as stubs rather than accomplishments. */
export const MIN_BULLET_WORDS = 4;
/** Bullets longer than this read as paragraphs and lose the reader. */
export const MAX_BULLET_WORDS = 45;

const ACTION_VERB_SET = new Set(ACTION_VERBS);
const BE_FORM_SET = new Set(BE_FORMS);
const IRREGULAR_SET = new Set(IRREGULAR_PARTICIPLES);
const EXCEPTION_SET = new Set(PARTICIPLE_EXCEPTIONS);

function normalize(text: string): string {
  return text.toLowerCase().replace(/[‘’]/g, "'").trim();
}

/** Returns the matched weak opener, or null. */
export function findWeakOpener(bullet: string): string | null {
  const text = normalize(bullet);
  for (const opener of WEAK_OPENERS) {
    if (text.startsWith(opener)) return opener;
  }
  return null;
}

/**
 * True when the bullet does not begin with a recognizable action verb.
 *
 * Only the first word is considered, and a word ending in "ed" or "ing" is
 * accepted as verb-like even if it is not in the curated list — the list is
 * a fast path, not an exhaustive dictionary, so unusual-but-valid verbs are
 * not falsely flagged.
 */
export function lacksActionVerb(bullet: string): boolean {
  const words = countWords(normalize(bullet));
  if (words.length === 0) return false;

  const first = words[0].replace(/[^a-z]/g, "");
  if (first.length === 0) return false;
  if (ACTION_VERB_SET.has(first)) return false;
  // Verb-like morphology: "architected", "spearheading".
  if (/(ed|ing)$/.test(first) && first.length > 4) return false;
  return true;
}

function isParticiple(word: string): boolean {
  const clean = word.replace(/[^a-z]/g, "");
  if (clean.length === 0) return false;
  if (EXCEPTION_SET.has(clean)) return false;
  if (IRREGULAR_SET.has(clean)) return true;
  return clean.endsWith("ed") && clean.length > 3;
}

/**
 * Detects passive voice: a "to be" form followed by a past participle,
 * allowing one adverb in between ("was quickly rebuilt").
 * Returns the offending phrase for highlighting, or null.
 */
export function findPassiveVoice(bullet: string): string | null {
  const raw = bullet.split(/\s+/).filter(Boolean);
  const lower = raw.map((w) => w.toLowerCase().replace(/[^a-z']/g, ""));

  for (let i = 0; i < lower.length; i++) {
    if (!BE_FORM_SET.has(lower[i])) continue;

    for (let offset = 1; offset <= 2 && i + offset < lower.length; offset++) {
      const candidate = lower[i + offset];
      // Only an adverb may sit between the be-form and the participle.
      if (offset === 2 && !candidate.endsWith("ly") && !lower[i + 1].endsWith("ly")) break;
      if (isParticiple(candidate)) {
        return raw.slice(i, i + offset + 1).join(" ");
      }
    }
  }

  return null;
}

/** Returns every buzzword present in the bullet. */
export function findBuzzwords(bullet: string): string[] {
  const text = normalize(bullet);
  return BUZZWORDS.filter((buzz) => {
    const escaped = buzz.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`\\b${escaped}\\b`).test(text);
  });
}

/**
 * True when the bullet contains a number, percentage, currency amount, or
 * a magnitude word — the signal recruiters and ATS scoring look for.
 */
export function isQuantified(bullet: string): boolean {
  if (/\d/.test(bullet)) return true;
  return /\b(percent|percentage|double|doubled|tripled|quadrupled|half|halved|thousand|thousands|million|millions|billion|billions|dozens|hundreds)\b/i.test(
    bullet
  );
}

export function bulletWordCount(bullet: string): number {
  return countWords(bullet).length;
}

/** Runs every detector over one bullet and returns its findings. */
export function analyzeBullet(ref: BulletRef): Finding[] {
  const findings: Finding[] = [];
  const key = `${ref.entryId}-${ref.index}`;

  const weakOpener = findWeakOpener(ref.text);
  if (weakOpener) {
    findings.push({
      id: `weak-opener-${key}`,
      kind: "weak-opener",
      severity: "high",
      message: `Starts with "${weakOpener}", which describes a duty rather than an achievement.`,
      suggestion: "Open with a strong action verb and state what you actually delivered.",
      highlight: ref.text.slice(0, weakOpener.length),
      ref,
      rewritable: true,
    });
  } else if (lacksActionVerb(ref.text)) {
    findings.push({
      id: `no-action-verb-${key}`,
      kind: "no-action-verb",
      severity: "medium",
      message: "Does not begin with an action verb.",
      suggestion: "Lead with a verb like “Built”, “Led”, or “Reduced”.",
      ref,
      rewritable: true,
    });
  }

  const passive = findPassiveVoice(ref.text);
  if (passive) {
    findings.push({
      id: `passive-${key}`,
      kind: "passive-voice",
      severity: "medium",
      message: `Passive voice: “${passive}”.`,
      suggestion: "Rewrite so you are the subject doing the action.",
      highlight: passive,
      ref,
      rewritable: true,
    });
  }

  for (const buzzword of findBuzzwords(ref.text)) {
    findings.push({
      id: `buzzword-${key}-${buzzword.replace(/\s+/g, "-")}`,
      kind: "buzzword",
      severity: "low",
      message: `Contains the cliché “${buzzword}”.`,
      suggestion: "Replace it with concrete evidence of the same quality.",
      highlight: buzzword,
      ref,
      rewritable: true,
    });
  }

  if (!isQuantified(ref.text)) {
    findings.push({
      id: `not-quantified-${key}`,
      kind: "not-quantified",
      severity: "medium",
      message: "No number, percentage, or scale.",
      suggestion:
        "Add a real metric if you have one — team size, volume, time saved, or percent change.",
      ref,
      // Not rewritable: inventing a metric the user does not have would be
      // fabrication, so this finding is surfaced but never auto-rewritten.
      rewritable: false,
    });
  }

  const words = bulletWordCount(ref.text);
  if (words > MAX_BULLET_WORDS) {
    findings.push({
      id: `too-long-${key}`,
      kind: "too-long",
      severity: "medium",
      message: `${words} words — this reads as a paragraph.`,
      suggestion: `Tighten to under ${MAX_BULLET_WORDS} words, or split into two bullets.`,
      ref,
      rewritable: true,
    });
  } else if (words < MIN_BULLET_WORDS) {
    findings.push({
      id: `too-short-${key}`,
      kind: "too-short",
      severity: "low",
      message: `Only ${words} word${words === 1 ? "" : "s"} — too thin to convey impact.`,
      suggestion: "Say what you did, how, and what resulted.",
      ref,
      rewritable: true,
    });
  }

  return findings;
}
