import { NextRequest } from "next/server";
import { z } from "zod";
import { requireSession } from "@/shared/api/require-session";
import { apiOk, handleApiError } from "@/shared/api/response";
import { providerSchema } from "@/shared/api/provider-schema";
import { prFilterSchema } from "@/shared/api/pr-filter-schema";
import { POLICIES } from "@/shared/api/rate-limit";
import { enforceDistributed } from "@/shared/api/rate-limit-distributed";
import { generateReleaseFromPRsForOrg } from "@/features/releases/releases.service";

const bodySchema = z.object({
  provider: providerSchema,
  owner: z.string().min(1),
  repo: z.string().min(1),
  filter: prFilterSchema,
});

export async function POST(req: NextRequest) {
  try {
    const ctx = await requireSession();
    await enforceDistributed(`ai-generate:${ctx.userId}`, POLICIES.AI_GENERATE);
    await enforceDistributed(`ai-quota:${ctx.userId}`, POLICIES.AI_DAILY_QUOTA);

    const input = bodySchema.parse(await req.json());
    const release = await generateReleaseFromPRsForOrg(ctx.orgId, input);
    return apiOk({ release });
  } catch (err) {
    return handleApiError(err);
  }
}

// AI generation can take a while; opt out of caching and allow longer runtime.
export const maxDuration = 60;
export const dynamic = "force-dynamic";
