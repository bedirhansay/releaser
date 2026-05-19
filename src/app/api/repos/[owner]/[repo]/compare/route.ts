import { NextRequest } from "next/server";
import { z } from "zod";
import { requireSessionUserId } from "@/shared/api/require-session";
import { apiOk, handleApiError } from "@/shared/api/response";
import { providerSchema } from "@/shared/api/provider-schema";
import { compareBranches } from "@/features/repositories/repositories.service";

const paramsSchema = z.object({
  owner: z.string().min(1),
  repo: z.string().min(1),
});

const querySchema = z.object({
  provider: providerSchema,
  base: z.string().min(1),
  head: z.string().min(1),
});

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ owner: string; repo: string }> },
) {
  try {
    const userId = await requireSessionUserId();
    const { owner, repo } = paramsSchema.parse(await ctx.params);
    const { provider, base, head } = querySchema.parse(
      Object.fromEntries(req.nextUrl.searchParams),
    );
    const compare = await compareBranches(userId, provider, {
      owner,
      repo,
      base,
      head,
    });
    return apiOk({ compare });
  } catch (err) {
    return handleApiError(err);
  }
}
