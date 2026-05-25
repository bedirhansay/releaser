import { NextRequest } from "next/server";
import { z } from "zod";
import { requireSessionUserId } from "@/shared/api/require-session";
import { apiOk, handleApiError } from "@/shared/api/response";
import { providerSchema } from "@/shared/api/provider-schema";
import { POLICIES } from "@/shared/api/rate-limit";
import { enforceDistributed } from "@/shared/api/rate-limit-distributed";
import { generateReleaseForUser } from "@/features/releases/releases.service";

const bodySchema = z.object({
  provider: providerSchema,
  owner: z.string().min(1),
  repo: z.string().min(1),
  base: z.string().min(1),
  head: z.string().min(1),
});

export async function POST(req: NextRequest) {
  try {
    const userId = await requireSessionUserId();
    // Cap AI cost per user — short-term burst limit + daily quota. Throws
    // RateLimitError, translated by handleApiError to 429.
    await enforceDistributed(`ai-generate:${userId}`, POLICIES.AI_GENERATE);
    await enforceDistributed(`ai-quota:${userId}`, POLICIES.AI_DAILY_QUOTA);

    const input = bodySchema.parse(await req.json());
    const release = await generateReleaseForUser(userId, input);
    return apiOk({ release });
  } catch (err) {
    return handleApiError(err);
  }
}

// AI generation can take a while; opt out of caching and allow longer runtime.
export const maxDuration = 60;
export const dynamic = "force-dynamic";
