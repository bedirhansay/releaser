import { NextRequest } from "next/server";
import { z } from "zod";
import { requireRole, requireSession } from "@/shared/api/require-session";
import { apiError, apiOk, handleApiError } from "@/shared/api/response";
import { deleteGroup } from "@/features/org/org.service";

const paramsSchema = z.object({ id: z.string().min(1) });

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireSession();
    requireRole(session, "OWNER", "ADMIN");
    const { id } = paramsSchema.parse(await ctx.params);
    const ok = await deleteGroup(session.orgId, id);
    if (!ok) return apiError("Group not found", 404);
    return apiOk({ deleted: true });
  } catch (err) {
    return handleApiError(err);
  }
}
