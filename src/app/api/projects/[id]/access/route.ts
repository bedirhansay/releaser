import { NextRequest } from "next/server";
import { z } from "zod";
import { requireRole, requireSession } from "@/shared/api/require-session";
import { apiError, apiOk, handleApiError } from "@/shared/api/response";
import { getProjectAccess, setProjectAccess } from "@/features/org/org.service";
import { projectAccessSchema } from "@/features/org/org-schemas";

const paramsSchema = z.object({ id: z.string().min(1) });

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireSession();
    requireRole(session, "OWNER", "ADMIN");
    const { id } = paramsSchema.parse(await ctx.params);
    const access = await getProjectAccess(session.orgId, id);
    if (!access) return apiError("Project not found", 404);
    return apiOk({ access });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PUT(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireSession();
    requireRole(session, "OWNER", "ADMIN");
    const { id } = paramsSchema.parse(await ctx.params);
    const body = projectAccessSchema.parse(await req.json());
    const ok = await setProjectAccess(session.orgId, id, body);
    if (!ok) return apiError("Project not found", 404);
    return apiOk({ updated: true });
  } catch (err) {
    return handleApiError(err);
  }
}
