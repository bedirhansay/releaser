import { NextRequest } from "next/server";
import { z } from "zod";
import { requireSession } from "@/shared/api/require-session";
import { apiError, apiOk, handleApiError } from "@/shared/api/response";
import {
  deleteReleaseForOrg,
  getReleaseForOrg,
  updateReleaseForOrg,
} from "@/features/releases/releases.service";
import { MAX_MARKDOWN_LEN } from "@/shared/api/limits";

const paramsSchema = z.object({ id: z.string().min(1) });

const patchSchema = z
  .object({
    title: z.string().min(1).max(200).optional(),
    markdown: z.string().min(1).max(MAX_MARKDOWN_LEN).optional(),
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
    const session = await requireSession();
    const { id } = paramsSchema.parse(await ctx.params);
    const release = await getReleaseForOrg(session, id);
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
    const session = await requireSession();
    const { id } = paramsSchema.parse(await ctx.params);
    const body = patchSchema.parse(await req.json());
    const ok = await updateReleaseForOrg(session, id, body);
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
    const session = await requireSession();
    const { id } = paramsSchema.parse(await ctx.params);
    const ok = await deleteReleaseForOrg(session, id);
    if (!ok) return apiError("Release not found", 404);
    return apiOk({ deleted: true });
  } catch (err) {
    return handleApiError(err);
  }
}
