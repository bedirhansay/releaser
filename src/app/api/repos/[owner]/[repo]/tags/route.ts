import { NextRequest } from "next/server";
import { z } from "zod";
import { requireSessionUserId } from "@/shared/api/require-session";
import { apiOk, handleApiError } from "@/shared/api/response";
import { providerSchema } from "@/shared/api/provider-schema";
import { listTags } from "@/features/repositories/repositories.service";

const paramsSchema = z.object({
  owner: z.string().min(1),
  repo: z.string().min(1),
});
const querySchema = z.object({ provider: providerSchema });

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ owner: string; repo: string }> },
) {
  try {
    const userId = await requireSessionUserId();
    const params = paramsSchema.parse(await ctx.params);
    const { provider } = querySchema.parse(
      Object.fromEntries(req.nextUrl.searchParams),
    );
    const tags = await listTags(userId, provider, params);
    return apiOk({ tags });
  } catch (err) {
    return handleApiError(err);
  }
}
