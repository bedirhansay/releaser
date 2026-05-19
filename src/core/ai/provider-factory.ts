import type { AIProvider } from "./types";
import { OpenAIProvider } from "@/infrastructure/ai/openai-provider";

// `openai` covers both real OpenAI and any OpenAI-compatible endpoint
// (GLM, DeepSeek, Together, Groq, Ollama, …) — picked via AI_BASE_URL env.
export type AIProviderKind = "openai";

export interface CreateAIProviderInput {
  kind?: AIProviderKind;
  apiKey?: string;
  model?: string;
  baseURL?: string;
}

export function createAIProvider({
  kind = "openai",
  apiKey,
  model,
  baseURL,
}: CreateAIProviderInput = {}): AIProvider {
  switch (kind) {
    case "openai":
      return new OpenAIProvider({ apiKey, model, baseURL });
    default: {
      const exhaustive: never = kind;
      throw new Error(`Unknown AI provider: ${String(exhaustive)}`);
    }
  }
}
