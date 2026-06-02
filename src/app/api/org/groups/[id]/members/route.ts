import { NextRequest } from "next/server";
import { z } from "zod";
import { requireRole, requireSession } from "@/shared/api/require-session";
import { apiError, apiOk, handleApiError } from "@/shared/api/response";
import { addGroupMember, removeGroupMember } from "@/features/org/org.service";
import { groupMemberSchema } from "@/features/org/org-schemas";

const paramsSchema = z.object({ id: z.string().min(1) });

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireSession();
    requireRole(session, "OWNER", "ADMIN");
    const { id } = paramsSchema.parse(await ctx.params);
    const { userId } = groupMemberSchema.parse(await req.json());
    await addGroupMember(session.orgId, id, userId);
    return apiOk({ added: true }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireSession();
    requireRole(session, "OWNER", "ADMIN");
    const { id } = paramsSchema.parse(await ctx.params);
    const { userId } = groupMemberSchema.parse(await req.json());
    const ok = await removeGroupMember(session.orgId, id, userId);
    if (!ok) return apiError("Group member not found", 404);
    return apiOk({ deleted: true });
  } catch (err) {
    return handleApiError(err);
  }
}
