import { NextRequest } from "next/server";
import { z } from "zod";
import { requireSessionUserId } from "@/shared/api/require-session";
import { apiOk, handleApiError } from "@/shared/api/response";
import { providerSchema } from "@/shared/api/provider-schema";
import { prFilterSchema } from "@/shared/api/pr-filter-schema";
import { enforce, POLICIES } from "@/shared/api/rate-limit";
import { generateReleaseFromPRsForUser } from "@/features/releases/releases.service";

const bodySchema = z.object({
  provider: providerSchema,
  owner: z.string().min(1),
  repo: z.string().min(1),
  filter: prFilterSchema,
});

export async function POST(req: NextRequest) {
  try {
    const userId = await requireSessionUserId();
    enforce(`ai-generate:${userId}`, POLICIES.AI_GENERATE);

    const input = bodySchema.parse(await req.json());
    const release = await generateReleaseFromPRsForUser(userId, input);
    return apiOk({ release });
  } catch (err) {
    return handleApiError(err);
  }
}

// AI generation can take a while; opt out of caching and allow longer runtime.
export const maxDuration = 60;
export const dynamic = "force-dynamic";
