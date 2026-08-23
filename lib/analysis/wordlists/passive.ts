/**
 * WORD LIST — passive-voice detection inputs.
 *
 * Passive voice is a "to be" verb followed by a past participle:
 *   "the service *was rebuilt*", "metrics *were tracked* by the team".
 *
 * Regular participles end in -ed and are matched by rule; irregular ones
 * have to be listed. Edit these lists to tune detection; the matching logic
 * lives in lib/analysis/bullets.ts.
 */

/** Forms of "to be" that can begin a passive construction. */
export const BE_FORMS: readonly string[] = [
  "am", "is", "are", "was", "were", "be", "been", "being", "get", "gets", "got",
];

/** Irregular past participles (-ed rule does not catch these). */
export const IRREGULAR_PARTICIPLES: readonly string[] = [
  "begun", "born", "broken", "brought", "built", "bought", "caught", "chosen",
  "come", "cut", "dealt", "done", "drawn", "driven", "eaten", "fallen", "felt",
  "found", "given", "gone", "grown", "held", "hit", "kept", "known", "laid",
  "led", "left", "lent", "let", "lost", "made", "meant", "met", "overseen",
  "paid", "put", "read", "rebuilt", "run", "said", "seen", "sent", "set",
  "shown", "shut", "sold", "sought", "spent", "split", "spread", "stood",
  "taken", "taught", "told", "thought", "thrown", "understood", "undertaken",
  "won", "withdrawn", "written",
];

/**
 * Words ending in -ed that are adjectives or plain past-tense verbs, not
 * participles in a passive construction. Without these, "is required" style
 * false positives creep in on ordinary resume phrasing.
 */
export const PARTICIPLE_EXCEPTIONS: readonly string[] = [
  "based", "advanced", "detailed", "dedicated", "experienced", "interested",
  "involved", "limited", "located", "motivated", "oriented", "pleased",
  "prepared", "qualified", "related", "skilled", "specialized", "united",
  "used", "varied", "focused",
];
