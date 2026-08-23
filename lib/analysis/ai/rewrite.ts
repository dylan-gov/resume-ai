import { generateText, Output } from "ai";
import { z } from "zod";
import { resolveModel, AIConfigurationError } from "@/lib/ai/provider";
import type { Finding } from "../types";

/**
 * AI-assisted bullet rewriting — the narrow slice where genuine language
 * understanding is needed. Everything else in Phase 5 is deterministic.
 *
 * The prompt's hard constraint is groundedness: a rewrite may only restate
 * what the original bullet already claims. It must never add a metric, a
 * technology, or a scope the user did not write, because a resume that
 * over-claims gets the user caught in an interview.
 */

const REWRITE_SYSTEM_PROMPT = `You rewrite individual resume bullet points to be stronger, without changing what they claim.

Hard rules — never break these:
1. Use ONLY facts present in the original bullet. Never add numbers, percentages, dollar amounts, team sizes, technologies, job titles, or outcomes that are not already there. If the original has no metric, the rewrite has no metric.
2. Do not inflate scope. "helped with X" may become "contributed to X" — it may NOT become "led X".
3. Open with a strong, specific action verb in past tense (present tense only if the role is current).
4. Keep it to one sentence, under 30 words, with no trailing period unless the original had one.
5. Remove filler, clichés, and passive voice. Say who did what and what resulted.
6. Preserve every proper noun exactly as written (product names, technologies, teams).

If the bullet cannot be improved without inventing facts, return it essentially unchanged and say so in "note".`;

const rewriteSchema = z.object({
  rewrite: z.string().describe("The improved bullet, grounded strictly in the original"),
  note: z
    .string()
    .optional()
    .describe("Brief explanation of what changed, or why little could change"),
});

export interface RewriteSuggestion {
  original: string;
  rewrite: string;
  note?: string;
}

export class RewriteError extends Error {
  constructor(message: string, cause?: unknown) {
    super(message, { cause });
    this.name = "RewriteError";
  }
}

export interface RewriteOptions {
  /** Problems the deterministic pass found, so the model knows what to fix. */
  issues?: string[];
  /**
   * Keywords from a job description that this bullet could naturally carry.
   * Only terms the user already has evidence for should be passed here.
   */
  targetKeywords?: string[];
}

export async function rewriteBullet(
  bullet: string,
  options: RewriteOptions = {}
): Promise<RewriteSuggestion> {
  const issues = options.issues?.length
    ? `\n\nProblems detected in this bullet:\n${options.issues.map((i) => `- ${i}`).join("\n")}`
    : "";

  const keywords = options.targetKeywords?.length
    ? `\n\nIf — and only if — the original bullet already demonstrates them, you may use this wording: ${options.targetKeywords.join(", ")}. Do not claim any of these if the bullet does not already show evidence of it.`
    : "";

  try {
    const result = await generateText({
      model: resolveModel(),
      system: REWRITE_SYSTEM_PROMPT,
      prompt: `Rewrite this resume bullet:\n\n"${bullet}"${issues}${keywords}`,
      output: Output.object({ schema: rewriteSchema }),
    });

    const rewrite = result.output.rewrite.trim();
    if (!rewrite) throw new RewriteError("The model returned an empty rewrite.");

    return { original: bullet, rewrite, note: result.output.note };
  } catch (error) {
    if (error instanceof AIConfigurationError) throw new RewriteError(error.message, error);
    if (error instanceof RewriteError) throw error;
    throw new RewriteError("Could not generate a rewrite. Please try again.", error);
  }
}

/** Turns findings for one bullet into plain-language issues for the prompt. */
export function issuesFromFindings(findings: Finding[]): string[] {
  return findings.filter((f) => f.rewritable).map((f) => f.message);
}
