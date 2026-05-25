import { NextRequest } from "next/server";
import { z } from "zod";
import { requireSessionUserId } from "@/shared/api/require-session";
import { apiError, apiOk, handleApiError } from "@/shared/api/response";
import {
  deleteReleaseForUser,
  getReleaseForUser,
  updateReleaseForUser,
} from "@/features/releases/releases.service";

const paramsSchema = z.object({ id: z.string().min(1) });

const patchSchema = z
  .object({
    title: z.string().min(1).max(200).optional(),
    markdown: z.string().min(1).optional(),
    tags: z.array(z.string().trim().min(1).max(32)).max(20).optional(),
  })
  .refine(
    (v) =>
      v.title !== undefined ||
      v.markdown !== undefined ||
      v.tags !== undefined,
    { message: "Provide at least one of: title, markdown, tags" },
  );

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const userId = await requireSessionUserId();
    const { id } = paramsSchema.parse(await ctx.params);
    const release = await getReleaseForUser(userId, id);
    if (!release) return apiError("Release not found", 404);
    return apiOk({ release });
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
    const ok = await updateReleaseForUser(userId, id, body);
    if (!ok) return apiError("Release not found", 404);
    return apiOk({ release: { id } });
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
    const ok = await deleteReleaseForUser(userId, id);
    if (!ok) return apiError("Release not found", 404);
    return apiOk({ deleted: true });
  } catch (err) {
    return handleApiError(err);
  }
}
