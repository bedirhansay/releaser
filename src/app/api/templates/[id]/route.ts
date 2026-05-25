import { NextRequest } from "next/server";
import { z } from "zod";
import { requireSessionUserId } from "@/shared/api/require-session";
import { apiError, apiOk, handleApiError } from "@/shared/api/response";
import {
  deleteTemplateForUser,
  getTemplateForUser,
  updateTemplateForUser,
} from "@/features/templates/templates.service";
import { templateSectionsSchema } from "@/types/template-schemas";

const paramsSchema = z.object({ id: z.string().min(1) });

const patchSchema = z
  .object({
    name: z.string().trim().min(1).max(100).optional(),
    description: z.string().trim().max(500).nullable().optional(),
    projectId: z.string().min(1).nullable().optional(),
    sections: templateSectionsSchema.optional(),
  })
  .refine(
    (v) =>
      v.name !== undefined ||
      v.description !== undefined ||
      v.projectId !== undefined ||
      v.sections !== undefined,
    {
      message: "Provide at least one of: name, description, projectId, sections",
    },
  );

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const userId = await requireSessionUserId();
    const { id } = paramsSchema.parse(await ctx.params);
    const template = await getTemplateForUser(userId, id);
    if (!template) return apiError("Template not found", 404);
    return apiOk({ template });
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
    const ok = await updateTemplateForUser(userId, id, body);
    if (!ok) return apiError("Template not found", 404);
    return apiOk({ template: { id } });
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
    const ok = await deleteTemplateForUser(userId, id);
    if (!ok) return apiError("Template not found", 404);
    return apiOk({ deleted: true });
  } catch (err) {
    return handleApiError(err);
  }
}
