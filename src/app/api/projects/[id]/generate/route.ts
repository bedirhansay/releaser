import { NextRequest } from "next/server";
import { z } from "zod";
import { requireSessionUserId } from "@/shared/api/require-session";
import { apiOk, handleApiError } from "@/shared/api/response";
import { prFilterSchema } from "@/shared/api/pr-filter-schema";
import { POLICIES } from "@/shared/api/rate-limit";
import { enforceDistributed } from "@/shared/api/rate-limit-distributed";
import { generateProjectReleaseForUser } from "@/features/projects/project-release.service";

const paramsSchema = z.object({ id: z.string().min(1) });

const bodySchema = z.object({
  templateId: z.string().min(1).optional(),
  filter: prFilterSchema,
});

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const userId = await requireSessionUserId();
    await enforceDistributed(`ai-generate:${userId}`, POLICIES.AI_GENERATE);
    await enforceDistributed(`ai-quota:${userId}`, POLICIES.AI_DAILY_QUOTA);

    const { id } = paramsSchema.parse(await ctx.params);
    const { templateId, filter } = bodySchema.parse(await req.json());
    const release = await generateProjectReleaseForUser(userId, {
      projectId: id,
      templateId,
      filter,
    });
    return apiOk({ release });
  } catch (err) {
    return handleApiError(err);
  }
}

// AI generation can take a while; opt out of caching and allow longer runtime.
export const maxDuration = 60;
export const dynamic = "force-dynamic";
