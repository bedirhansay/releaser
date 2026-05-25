import { NextRequest } from "next/server";
import { z } from "zod";
import { requireSessionUserId } from "@/shared/api/require-session";
import { apiError, apiOk, handleApiError } from "@/shared/api/response";
import { providerSchema } from "@/shared/api/provider-schema";
import {
  deleteProjectForUser,
  getProjectForUser,
  updateProjectForUser,
} from "@/features/projects/projects.service";

const paramsSchema = z.object({ id: z.string().min(1) });

const repoSchema = z.object({
  provider: providerSchema,
  owner: z.string().trim().min(1),
  name: z.string().trim().min(1),
  role: z.string().trim().max(40).optional(),
});

const patchSchema = z
  .object({
    name: z.string().trim().min(1).max(100).optional(),
    slug: z.string().trim().max(60).optional(),
    description: z.string().trim().max(500).optional(),
    repos: z.array(repoSchema).min(1).max(20).optional(),
  })
  .refine(
    (v) =>
      v.name !== undefined ||
      v.slug !== undefined ||
      v.description !== undefined ||
      v.repos !== undefined,
    { message: "Provide at least one of: name, slug, description, repos" },
  );

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const userId = await requireSessionUserId();
    const { id } = paramsSchema.parse(await ctx.params);
    const project = await getProjectForUser(userId, id);
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
    const userId = await requireSessionUserId();
    const { id } = paramsSchema.parse(await ctx.params);
    const body = patchSchema.parse(await req.json());
    const ok = await updateProjectForUser(userId, id, body);
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
    const userId = await requireSessionUserId();
    const { id } = paramsSchema.parse(await ctx.params);
    const ok = await deleteProjectForUser(userId, id);
    if (!ok) return apiError("Project not found", 404);
    return apiOk({ deleted: true });
  } catch (err) {
    return handleApiError(err);
  }
}
