import { randomUUID } from "node:crypto";
import { generateText, Output, NoObjectGeneratedError, APICallError, RetryError } from "ai";
import {
  resumeDocSchema,
  resumeDraftSchema,
  type ResumeDoc,
  type ResumeDraft,
} from "@/lib/schema/resume";
import { resolveModel, AIConfigurationError, type ResolveModelOptions } from "./provider";
import { RESUME_EXTRACTION_SYSTEM_PROMPT, buildUserPrompt } from "./prompt";

export class AIGenerationError extends Error {
  constructor(message: string, cause?: unknown) {
    super(message, { cause });
    this.name = "AIGenerationError";
  }
}

function withId<T extends object>(entry: T): T & { id: string } {
  return { ...entry, id: randomUUID() };
}

/**
 * Assigns a fresh, stable id to every array entry in the model's draft
 * output. IDs are never requested from the model (see resumeDraftSchema) —
 * an LLM has no way to produce IDs that are actually stable across edits,
 * so the server is the single source of truth for them.
 */
function attachIds(draft: ResumeDraft): ResumeDoc {
  return {
    header: draft.header,
    summary: draft.summary,
    workExperience: draft.workExperience?.map(withId),
    education: draft.education?.map(withId),
    skills: draft.skills?.map(withId),
    projects: draft.projects?.map(withId),
    certifications: draft.certifications?.map(withId),
    awards: draft.awards?.map(withId),
    leadership: draft.leadership?.map(withId),
    publications: draft.publications?.map(withId),
    languages: draft.languages?.map(withId),
    volunteer: draft.volunteer?.map(withId),
    clarifications: draft.clarifications,
  };
}

export type GenerateResumeDraftOptions = ResolveModelOptions;

/**
 * Provider-agnostic entry point: turns combined source text into a
 * validated ResumeDoc. This is the only function the rest of the app calls
 * to talk to an LLM — which provider/model is used is resolved from env
 * vars (or `opts`) inside resolveModel, never here.
 */
export async function generateResumeDraft(
  input: string,
  opts: GenerateResumeDraftOptions = {}
): Promise<ResumeDoc> {
  let draft: ResumeDraft;
  try {
    const model = resolveModel(opts);
    const result = await generateText({
      model,
      system: RESUME_EXTRACTION_SYSTEM_PROMPT,
      prompt: buildUserPrompt(input),
      output: Output.object({ schema: resumeDraftSchema }),
    });
    draft = result.output;
  } catch (error) {
    if (error instanceof AIConfigurationError) {
      throw new AIGenerationError(error.message, error);
    }
    if (NoObjectGeneratedError.isInstance(error)) {
      throw new AIGenerationError(
        "The AI model did not return a valid resume structure. Please try again.",
        error
      );
    }
    // Provider API errors (auth, billing, invalid model, rate limits) carry
    // messages meant for the caller — surface them instead of a generic 502.
    const apiError = APICallError.isInstance(error)
      ? error
      : RetryError.isInstance(error) && APICallError.isInstance(error.lastError)
        ? error.lastError
        : null;
    if (apiError) {
      throw new AIGenerationError(`The AI provider rejected the request: ${apiError.message}`, error);
    }
    throw new AIGenerationError("Resume generation failed.", error);
  }

  return resumeDocSchema.parse(attachIds(draft));
}
