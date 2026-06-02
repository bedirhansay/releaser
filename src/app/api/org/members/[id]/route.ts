import { NextRequest } from "next/server";
import { z } from "zod";
import { requireRole, requireSession } from "@/shared/api/require-session";
import { apiError, apiOk, handleApiError } from "@/shared/api/response";
import { removeMember, updateMemberRole } from "@/features/org/org.service";
import { updateMemberSchema } from "@/features/org/org-schemas";

const paramsSchema = z.object({ id: z.string().min(1) });

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireSession();
    requireRole(session, "OWNER", "ADMIN");
    const { id } = paramsSchema.parse(await ctx.params);
    const { role } = updateMemberSchema.parse(await req.json());
    const ok = await updateMemberRole(session.orgId, id, role, session.role);
    if (!ok) return apiError("Member not found", 404);
    return apiOk({ member: { id } });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireSession();
    requireRole(session, "OWNER", "ADMIN");
    const { id } = paramsSchema.parse(await ctx.params);
    const ok = await removeMember(session.orgId, id, session.role);
    if (!ok) return apiError("Member not found", 404);
    return apiOk({ deleted: true });
  } catch (err) {
    return handleApiError(err);
  }
}
