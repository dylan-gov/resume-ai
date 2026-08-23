import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createMistral } from "@ai-sdk/mistral";
import { createGroq } from "@ai-sdk/groq";
import type { LanguageModel } from "ai";

export type AIProviderName = "anthropic" | "openai" | "google" | "mistral" | "groq";

export interface ResolveModelOptions {
  provider?: string;
  model?: string;
}

/** Thrown for misconfiguration (missing model/API key) — message is always safe to show the user, never contains secrets. */
export class AIConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AIConfigurationError";
  }
}

/**
 * The only place in the codebase that knows about specific AI provider
 * packages. Everything downstream (generateResumeDraft) talks to the
 * provider-agnostic `LanguageModel` interface from the `ai` package.
 *
 * Provider + model are selected via env vars so swapping providers never
 * requires a code change: AI_PROVIDER, AI_MODEL, and the matching
 * ANTHROPIC_API_KEY / OPENAI_API_KEY / GOOGLE_GENERATIVE_AI_API_KEY.
 */
export function resolveModel(opts: ResolveModelOptions = {}): LanguageModel {
  const provider = (opts.provider ?? process.env.AI_PROVIDER ?? "anthropic").toLowerCase();
  const modelId = opts.model ?? process.env.AI_MODEL;

  if (!modelId) {
    throw new AIConfigurationError(
      "No AI model configured. Set AI_MODEL in the environment (e.g. 'claude-sonnet-5', 'gpt-5', or 'gemini-flash-latest')."
    );
  }

  switch (provider) {
    case "anthropic": {
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) throw new AIConfigurationError("ANTHROPIC_API_KEY is not set.");
      return createAnthropic({ apiKey })(modelId);
    }
    case "openai": {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) throw new AIConfigurationError("OPENAI_API_KEY is not set.");
      return createOpenAI({ apiKey })(modelId);
    }
    case "google": {
      const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
      if (!apiKey) throw new AIConfigurationError("GOOGLE_GENERATIVE_AI_API_KEY is not set.");
      return createGoogleGenerativeAI({ apiKey })(modelId);
    }
    case "mistral": {
      const apiKey = process.env.MISTRAL_API_KEY;
      if (!apiKey) throw new AIConfigurationError("MISTRAL_API_KEY is not set.");
      return createMistral({ apiKey })(modelId);
    }
    case "groq": {
      const apiKey = process.env.GROQ_API_KEY;
      if (!apiKey) throw new AIConfigurationError("GROQ_API_KEY is not set.");
      return createGroq({ apiKey })(modelId);
    }
    default:
      throw new AIConfigurationError(
        `Unsupported AI_PROVIDER "${provider}". Supported providers: anthropic, openai, google, mistral, groq.`
      );
  }
}
