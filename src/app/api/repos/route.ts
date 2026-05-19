import { NextRequest } from "next/server";
import { z } from "zod";
import { requireSessionUserId } from "@/shared/api/require-session";
import { apiOk, handleApiError } from "@/shared/api/response";
import { providerSchema } from "@/shared/api/provider-schema";
import { listUserRepositories } from "@/features/repositories/repositories.service";

const querySchema = z.object({
  provider: providerSchema,
  search: z.string().trim().optional(),
  page: z.coerce.number().int().min(1).optional(),
  perPage: z.coerce.number().int().min(1).max(100).optional(),
});

export async function GET(req: NextRequest) {
  try {
    const userId = await requireSessionUserId();
    const { provider, ...rest } = querySchema.parse(
      Object.fromEntries(req.nextUrl.searchParams),
    );
    const repos = await listUserRepositories(userId, provider, rest);
    return apiOk({ repos });
  } catch (err) {
    return handleApiError(err);
  }
}
