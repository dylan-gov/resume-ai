import type { ResumeDoc } from "@/lib/schema/resume";
import { normalizeDoc } from "@/lib/resume/sections";
import { collectBullets, collectResumeText } from "./locate";
import { analyzeBullet, isQuantified } from "./bullets";
import { analyzeReadability } from "./readability";
import { scoreAts, scoreFormatting } from "./scores";
import { countWords } from "./readability";
import type { Finding, ResumeAnalysis } from "./types";

const SEVERITY_ORDER = { high: 0, medium: 1, low: 2 } as const;

/**
 * Runs the full deterministic analysis. Pure: the same document always
 * yields the same numbers and the same findings, in the same order.
 */
export function analyzeResume(input: ResumeDoc): ResumeAnalysis {
  const doc = normalizeDoc(input);
  const bullets = collectBullets(doc);

  const findings: Finding[] = bullets.flatMap(analyzeBullet).sort((a, b) => {
    const bySeverity = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
    if (bySeverity !== 0) return bySeverity;
    return a.id.localeCompare(b.id);
  });

  const text = collectResumeText(doc);

  return {
    ats: scoreAts(doc, bullets),
    formatting: scoreFormatting(doc, bullets),
    readability: analyzeReadability(bullets.map((b) => b.text)),
    findings,
    stats: {
      bulletCount: bullets.length,
      quantifiedBulletCount: bullets.filter((b) => isQuantified(b.text)).length,
      sectionCount: (doc.sections ?? []).length,
      totalWords: countWords(text).length,
    },
  };
}

export { collectBullets, collectResumeText } from "./locate";
export { extractJobKeywords, matchKeywords, normalizeTerm } from "./keywords";
export { analyzeReadability, countSyllables } from "./readability";
export {
  analyzeBullet,
  bulletWordCount,
  findBuzzwords,
  findPassiveVoice,
  findWeakOpener,
  isQuantified,
  lacksActionVerb,
} from "./bullets";
export { scoreAts, scoreFormatting } from "./scores";
export { bulletDomId } from "./types";
export type * from "./types";
