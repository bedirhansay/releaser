import { NextRequest } from "next/server";
import { z } from "zod";
import { requireRole, requireSession } from "@/shared/api/require-session";
import { apiError, apiOk, handleApiError } from "@/shared/api/response";
import { updateProjectSchema } from "@/features/projects/project-schemas";
import {
  deleteProjectForOrg,
  getProjectForOrg,
  updateProjectForOrg,
} from "@/features/projects/projects.service";

const paramsSchema = z.object({ id: z.string().min(1) });

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireSession();
    const { id } = paramsSchema.parse(await ctx.params);
    const project = await getProjectForOrg(session, id);
    if (!project) return apiError("Project not found", 404);
    return apiOk({ project });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireSession();
    requireRole(session, "OWNER", "ADMIN");
    const { id } = paramsSchema.parse(await ctx.params);
    const body = updateProjectSchema.parse(await req.json());
    const ok = await updateProjectForOrg(session, id, body);
    if (!ok) return apiError("Project not found", 404);
    return apiOk({ project: { id } });
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
    const ok = await deleteProjectForOrg(session, id);
    if (!ok) return apiError("Project not found", 404);
    return apiOk({ deleted: true });
  } catch (err) {
    return handleApiError(err);
  }
}
