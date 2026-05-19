import { NextRequest } from "next/server";
import { z } from "zod";
import { requireSessionUserId } from "@/shared/api/require-session";
import { apiOk, handleApiError } from "@/shared/api/response";
import { providerSchema } from "@/shared/api/provider-schema";
import { prFilterSchema } from "@/shared/api/pr-filter-schema";
import { listPullRequests } from "@/features/repositories/repositories.service";

const paramsSchema = z.object({
  owner: z.string().min(1),
  repo: z.string().min(1),
});

const bodySchema = z.object({
  provider: providerSchema,
  filter: prFilterSchema,
});

// POST (not GET) so the filter discriminated union travels as JSON without
// having to flatten every variant into query-string fields.
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ owner: string; repo: string }> },
) {
  try {
    const userId = await requireSessionUserId();
    const { owner, repo } = paramsSchema.parse(await ctx.params);
    const { provider, filter } = bodySchema.parse(await req.json());
    const pulls = await listPullRequests(userId, provider, {
      owner,
      repo,
      filter,
    });
    return apiOk({ pulls });
  } catch (err) {
    return handleApiError(err);
  }
}
