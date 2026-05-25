import { prisma } from "@/infrastructure/db/prisma";
import {
  decryptToken,
  encryptToken,
} from "@/infrastructure/crypto/token-cipher";
import { createAIProvider } from "@/core/ai/provider-factory";
import type { AIProvider } from "@/core/ai/types";

/** Safe-to-expose view of a user's AI config — the key itself never leaves. */
export interface AiSettingStatus {
  hasKey: boolean;
  baseUrl: string | null;
  model: string | null;
  /** True when the shared AI_* env fallback is configured. */
  envFallbackAvailable: boolean;
}

export async function getAiSettingStatus(
  userId: string,
): Promise<AiSettingStatus> {
  const row = await prisma.aiSetting.findUnique({ where: { userId } });
  return {
    hasKey: Boolean(row?.apiKeyCipher),
    baseUrl: row?.baseUrl ?? null,
    model: row?.model ?? null,
    envFallbackAvailable: Boolean(process.env.AI_API_KEY),
  };
}

export interface UpsertAiSettingInput {
  /** Omit to leave the stored key unchanged; empty string clears it. */
  apiKey?: string;
  baseUrl?: string | null;
  model?: string | null;
}

export async function upsertAiSettingForUser(
  userId: string,
  input: UpsertAiSettingInput,
): Promise<AiSettingStatus> {
  // Encrypt only when a new key is provided. An explicit empty string clears
  // the stored key (revert to env fallback); `undefined` leaves it as-is.
  const keyPatch =
    input.apiKey === undefined
      ? {}
      : {
          apiKeyCipher: input.apiKey
            ? encryptToken(input.apiKey)
            : null,
        };

  await prisma.aiSetting.upsert({
    where: { userId },
    create: {
      userId,
      apiKeyCipher: input.apiKey ? encryptToken(input.apiKey) : null,
      baseUrl: input.baseUrl ?? null,
      model: input.model ?? null,
    },
    update: {
      ...keyPatch,
      ...(input.baseUrl !== undefined ? { baseUrl: input.baseUrl } : {}),
      ...(input.model !== undefined ? { model: input.model } : {}),
    },
  });

  return getAiSettingStatus(userId);
}

/**
 * Builds the AI provider for a user: their own encrypted key/endpoint when set,
 * otherwise the shared AI_* env fallback. This is the single entry point every
 * generation path should use so BYO-LLM is honoured everywhere.
 */
export async function resolveAiProviderForUser(
  userId: string,
): Promise<AIProvider> {
  const row = await prisma.aiSetting.findUnique({ where: { userId } });
  if (row?.apiKeyCipher) {
    return createAIProvider({
      apiKey: decryptToken(row.apiKeyCipher),
      baseURL: row.baseUrl ?? undefined,
      model: row.model ?? undefined,
    });
  }
  // No per-user key — fall back to the shared env config (createAIProvider
  // reads AI_API_KEY / AI_BASE_URL / AI_MODEL itself).
  return createAIProvider();
}
