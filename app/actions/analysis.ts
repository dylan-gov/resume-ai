"use server";

import { resumeDocSchema } from "@/lib/schema/resume";
import { requireUserId } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { collectResumeText, extractJobKeywords, matchKeywords } from "@/lib/analysis";
import type { JobMatch } from "@/lib/analysis/types";
import { rewriteBullet, RewriteError } from "@/lib/analysis/ai/rewrite";
import { findSemanticSynonyms } from "@/lib/analysis/ai/synonyms";

/**
 * Server actions for the AI-assisted half of analysis.
 *
 * The deterministic half runs in the browser against the live store, so
 * scores update as the user edits without a round trip. Only the parts that
 * need a model come here — and each is authenticated and rate-limited,
 * because each costs money.
 */

export type AnalysisActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

/** Suggests a stronger version of one bullet, grounded in its own content. */
export async function suggestRewriteAction(
  bullet: string,
  issues: string[],
  targetKeywords?: string[]
): Promise<AnalysisActionResult<{ rewrite: string; note?: string }>> {
  try {
    const userId = await requireUserId();

    const limit = await checkRateLimit(`rewrite:${userId}`);
    if (!limit.success) {
      return { ok: false, error: "Too many rewrites just now. Wait a moment and try again." };
    }

    if (bullet.trim().length === 0) {
      return { ok: false, error: "There is nothing to rewrite." };
    }

    const suggestion = await rewriteBullet(bullet, { issues, targetKeywords });
    return { ok: true, data: { rewrite: suggestion.rewrite, note: suggestion.note } };
  } catch (error) {
    if (error instanceof RewriteError) return { ok: false, error: error.message };
    if (error instanceof Error && error.message === "Not authenticated") {
      return { ok: false, error: "You are signed out. Sign in again to use rewrites." };
    }
    return { ok: false, error: "Could not generate a rewrite. Please try again." };
  }
}

/**
 * Matches a resume against a job description.
 *
 * The score is computed deterministically first; the model is then asked
 * only about terms that came back missing, and its answers can only
 * upgrade a "missing" to a "synonym". If the model is unavailable the
 * deterministic result stands.
 */
export async function matchJobDescriptionAction(
  doc: unknown,
  jobDescription: string
): Promise<AnalysisActionResult<JobMatch>> {
  try {
    const userId = await requireUserId();

    const parsed = resumeDocSchema.safeParse(doc);
    if (!parsed.success) return { ok: false, error: "Could not read the resume." };

    const text = jobDescription.trim();
    if (text.length < 40) {
      return { ok: false, error: "Paste a longer job description to analyze." };
    }

    const resumeText = collectResumeText(parsed.data);
    const keywords = extractJobKeywords(text);
    const deterministic = matchKeywords(resumeText, keywords);

    // Only spend a model call when there is something left to resolve.
    const limit = await checkRateLimit(`jd-match:${userId}`);
    if (deterministic.missing.length === 0 || !limit.success) {
      return { ok: true, data: deterministic };
    }

    const extraSynonyms = await findSemanticSynonyms(
      deterministic.missing.slice(0, 20).map((m) => m.keyword.term),
      resumeText
    );

    return { ok: true, data: matchKeywords(resumeText, keywords, { extraSynonyms }) };
  } catch (error) {
    if (error instanceof Error && error.message === "Not authenticated") {
      return { ok: false, error: "You are signed out. Sign in again to analyze." };
    }
    return { ok: false, error: "Could not analyze the job description." };
  }
}
