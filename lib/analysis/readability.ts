import type { ReadabilityScore } from "./types";

/**
 * Flesch–Kincaid grade level.
 *
 *   0.39 × (words / sentences) + 11.8 × (syllables / words) − 15.59
 *
 * Resume bullets rarely end in a full stop, so each bullet is counted as
 * one sentence unless it contains internal terminal punctuation. That is a
 * deliberate choice: treating the whole resume as one sentence would
 * inflate the grade wildly.
 */

const VOWELS = "aeiouy";

/**
 * Heuristic syllable counter: count vowel groups, drop a silent trailing
 * "e", and never return less than one for a non-empty word. Standard
 * approach for readability metrics — approximate but reproducible.
 */
export function countSyllables(word: string): number {
  const clean = word.toLowerCase().replace(/[^a-z]/g, "");
  if (clean.length === 0) return 0;
  if (clean.length <= 3) return 1;

  let count = 0;
  let previousWasVowel = false;
  for (const char of clean) {
    const isVowel = VOWELS.includes(char);
    if (isVowel && !previousWasVowel) count++;
    previousWasVowel = isVowel;
  }

  // Silent "e": "make" is one syllable, but "the" and "be" were handled above.
  if (clean.endsWith("e") && !clean.endsWith("le") && count > 1) count--;
  // "-ed" is usually not its own syllable except after t/d ("wanted").
  if (clean.endsWith("ed") && count > 1 && !/[td]ed$/.test(clean)) count--;

  return Math.max(1, count);
}

export function countWords(text: string): string[] {
  return text.split(/\s+/).filter((w) => /[a-z0-9]/i.test(w));
}

/** Sentences in one bullet: at least one, more if it has terminal punctuation. */
function countSentences(text: string): number {
  const terminators = text.match(/[.!?]+(\s|$)/g)?.length ?? 0;
  return Math.max(1, terminators);
}

function interpret(grade: number): string {
  if (grade <= 0) return "No readable prose to score yet.";
  if (grade < 8) return "Very easy to read — plain, direct language.";
  if (grade < 11) return "Easy to read. Good for resumes: clear and scannable.";
  if (grade < 14) return "Moderately complex — fine, but some bullets could be tightened.";
  if (grade < 17) return "Dense. Long sentences or heavy vocabulary are slowing recruiters down.";
  return "Very dense. Shorten bullets and prefer plain words over jargon.";
}

/** Scores a set of bullets/prose blocks. Deterministic for a given input. */
export function analyzeReadability(blocks: string[]): ReadabilityScore {
  const usable = blocks.map((b) => b.trim()).filter((b) => b.length > 0);

  let words = 0;
  let syllables = 0;
  let sentences = 0;

  for (const block of usable) {
    const blockWords = countWords(block);
    words += blockWords.length;
    for (const word of blockWords) syllables += countSyllables(word);
    sentences += countSentences(block);
  }

  if (words === 0 || sentences === 0) {
    return {
      gradeLevel: 0,
      interpretation: interpret(0),
      wordCount: 0,
      sentenceCount: 0,
      syllableCount: 0,
      averageWordsPerSentence: 0,
    };
  }

  const wordsPerSentence = words / sentences;
  const syllablesPerWord = syllables / words;
  const raw = 0.39 * wordsPerSentence + 11.8 * syllablesPerWord - 15.59;

  return {
    gradeLevel: Math.round(Math.max(0, raw) * 10) / 10,
    interpretation: interpret(raw),
    wordCount: words,
    sentenceCount: sentences,
    syllableCount: syllables,
    averageWordsPerSentence: Math.round(wordsPerSentence * 10) / 10,
  };
}
