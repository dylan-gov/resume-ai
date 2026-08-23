import { generateText, Output } from "ai";
import { z } from "zod";
import { resolveModel } from "@/lib/ai/provider";

/**
 * AI-assisted semantic keyword matching.
 *
 * Purely additive to the deterministic matcher: it can only turn a
 * "missing" keyword into a "present under a synonym", never the reverse,
 * and never changes a score the deterministic pass already computed. If
 * this call fails, matching still works — just with the curated synonym
 * list alone.
 */

const SYSTEM_PROMPT = `You decide whether a job-description term is already demonstrated in a resume under different wording.

Rules:
1. Only report a pair when the resume genuinely demonstrates the same skill. "React.js" covers "React". "Postgres" covers "PostgreSQL".
2. Do NOT report loose or aspirational matches. A tool does not cover the broader practice, and knowing a practice does not cover a specific tool: "infrastructure as code" does NOT cover "Terraform", and "Scrum" does NOT cover "Kanban".
3. When in doubt, leave it out. A false match tells the user they are covered when they are not, which is worse than an extra "missing" entry.
4. Quote the resume wording exactly as it appears.`;

const responseSchema = z.object({
  pairs: z
    .array(
      z.object({
        jobTerm: z.string().describe("The job-description term"),
        resumeTerm: z.string().describe("The exact wording used in the resume"),
      })
    )
    .describe("Only genuinely equivalent pairs; empty when none apply"),
});

/**
 * Returns `[jobTerm, resumeTerm]` pairs to feed into `matchKeywords`.
 * Returns an empty array on any failure — matching must never depend on
 * this call succeeding.
 */
export async function findSemanticSynonyms(
  missingTerms: string[],
  resumeText: string
): Promise<[string, string][]> {
  if (missingTerms.length === 0) return [];

  try {
    const result = await generateText({
      model: resolveModel(),
      system: SYSTEM_PROMPT,
      prompt:
        `Job description terms not found literally in the resume:\n${missingTerms.map((t) => `- ${t}`).join("\n")}\n\n` +
        `Resume text:\n"""\n${resumeText.slice(0, 6000)}\n"""\n\n` +
        `Which of those terms are already demonstrated in the resume under different wording?`,
      output: Output.object({ schema: responseSchema }),
    });

    return result.output.pairs
      .filter((p) => p.jobTerm.trim() && p.resumeTerm.trim())
      // Guard against a model "finding" a term that is not in the resume.
      .filter((p) => resumeText.toLowerCase().includes(p.resumeTerm.toLowerCase().trim()))
      .map((p) => [p.jobTerm.trim(), p.resumeTerm.trim()] as [string, string]);
  } catch {
    return [];
  }
}
