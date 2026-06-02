import { NextRequest } from "next/server";
import { z } from "zod";
import { requireRole, requireSession } from "@/shared/api/require-session";
import { apiError, apiOk, handleApiError } from "@/shared/api/response";
import { deleteInstallationForOrg } from "@/features/github-app/github-app.service";

const paramsSchema = z.object({ id: z.string().min(1) });

// Forgets an installation record locally. The user fully revokes access from
// GitHub (Settings → Applications) — we surface that in the UI copy.
export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireSession();
    requireRole(session, "OWNER", "ADMIN");
    const { id } = paramsSchema.parse(await ctx.params);
    const ok = await deleteInstallationForOrg(session.orgId, id);
    if (!ok) return apiError("Installation not found", 404);
    return apiOk({ deleted: true });
  } catch (err) {
    return handleApiError(err);
  }
}
