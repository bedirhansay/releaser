import { NextRequest } from "next/server";
import { z } from "zod";
import { requireSession } from "@/shared/api/require-session";
import { apiOk, handleApiError } from "@/shared/api/response";
import { prFilterSchema } from "@/shared/api/pr-filter-schema";
import { POLICIES } from "@/shared/api/rate-limit";
import { enforceDistributed } from "@/shared/api/rate-limit-distributed";
import { generateProjectReleaseForOrg } from "@/features/projects/project-release.service";

const paramsSchema = z.object({ id: z.string().min(1) });

const bodySchema = z.object({
  templateId: z.string().min(1).optional(),
  filter: prFilterSchema,
  meta: z
    .object({
      version: z.string().trim().max(60).optional(),
      date: z.string().trim().max(60).optional(),
      risk: z.string().trim().max(40).optional(),
      signOff: z.string().trim().max(2000).optional(),
    })
    .optional(),
});

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireSession();
    await enforceDistributed(`ai-generate:${session.userId}`, POLICIES.AI_GENERATE);
    await enforceDistributed(`ai-quota:${session.userId}`, POLICIES.AI_DAILY_QUOTA);

    const { id } = paramsSchema.parse(await ctx.params);
    const { templateId, filter, meta } = bodySchema.parse(await req.json());
    const release = await generateProjectReleaseForOrg(session, {
      projectId: id,
      templateId,
      filter,
      meta,
    });
    return apiOk({ release });
  } catch (err) {
    return handleApiError(err);
  }
}

// AI generation can take a while; opt out of caching and allow longer runtime.
export const maxDuration = 60;
export const dynamic = "force-dynamic";
