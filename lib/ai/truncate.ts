/**
 * Safe input budget for the extraction prompt, in characters. Sized well
 * under typical context windows (roughly 4 chars/token) to leave headroom
 * for the system prompt, schema, and output tokens.
 */
export const MAX_INPUT_CHARS = 60_000;

const RESUME_SIGNAL_WORDS =
  /\b(experience|employment|education|degree|university|college|skills|projects?|certification|award|publication|volunteer|responsibilit(?:y|ies)|achiev(?:ed|ement)|led|managed|built|developed|designed)\b/gi;

const DATE_LIKE = /\b(19|20)\d{2}\b/g;

function score(block: string): number {
  const words = (block.match(RESUME_SIGNAL_WORDS) ?? []).length;
  const dates = (block.match(DATE_LIKE) ?? []).length;
  // Normalize by length so a long, low-signal block doesn't win purely on volume.
  return (words * 3 + dates) / Math.max(block.length / 500, 1);
}

export interface TruncateResult {
  text: string;
  truncated: boolean;
}

/**
 * If combined source text exceeds the safe budget, keep the
 * highest-signal blocks (by resume-like keyword/date density) up to the
 * budget, preserving their original relative order, instead of naively
 * cutting off the end.
 */
export function truncateForBudget(blocks: { label: string; text: string }[]): TruncateResult {
  const totalLength = blocks.reduce((sum, b) => sum + b.text.length, 0);

  if (totalLength <= MAX_INPUT_CHARS) {
    return {
      text: blocks.map((b) => `--- ${b.label} ---\n${b.text}`).join("\n\n"),
      truncated: false,
    };
  }

  const ranked = [...blocks]
    .map((b, index) => ({ ...b, index, score: score(b.text) }))
    .sort((a, b) => b.score - a.score);

  const kept: typeof ranked = [];
  let used = 0;
  for (const block of ranked) {
    const cost = block.text.length + block.label.length + 10;
    if (used + cost > MAX_INPUT_CHARS && kept.length > 0) continue;
    kept.push(block);
    used += cost;
    if (used >= MAX_INPUT_CHARS) break;
  }

  const ordered = kept.sort((a, b) => a.index - b.index);

  return {
    text: ordered.map((b) => `--- ${b.label} ---\n${b.text}`).join("\n\n"),
    truncated: true,
  };
}
