import { NextRequest } from "next/server";
import { z } from "zod";
import { requireSessionUserId } from "@/shared/api/require-session";
import { apiError, apiOk, handleApiError } from "@/shared/api/response";
import { deleteInstallationForUser } from "@/features/github-app/github-app.service";

const paramsSchema = z.object({ id: z.string().min(1) });

// Forgets an installation record locally. The user fully revokes access from
// GitHub (Settings → Applications) — we surface that in the UI copy.
export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const userId = await requireSessionUserId();
    const { id } = paramsSchema.parse(await ctx.params);
    const ok = await deleteInstallationForUser(userId, id);
    if (!ok) return apiError("Installation not found", 404);
    return apiOk({ deleted: true });
  } catch (err) {
    return handleApiError(err);
  }
}
