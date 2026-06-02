import { NextRequest } from "next/server";
import { z } from "zod";
import { requireSession } from "@/shared/api/require-session";
import { apiOk, handleApiError } from "@/shared/api/response";
import { providerSchema } from "@/shared/api/provider-schema";
import { saveProjectReleaseForOrg } from "@/features/projects/project-release.service";
import { MAX_MARKDOWN_LEN } from "@/shared/api/limits";

const paramsSchema = z.object({ id: z.string().min(1) });

const bodySchema = z.object({
  templateId: z.string().min(1).optional(),
  title: z.string().trim().min(1).max(200),
  markdown: z.string().min(1).max(MAX_MARKDOWN_LEN),
  tags: z.array(z.string().trim().min(1).max(32)).max(20).optional(),
  windowLabel: z.string().min(1).max(120),
  modelUsed: z.string().min(1).max(120),
  primaryRepo: z.object({
    provider: providerSchema,
    owner: z.string().min(1),
    name: z.string().min(1),
  }),
});

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireSession();
    const { id } = paramsSchema.parse(await ctx.params);
    const body = bodySchema.parse(await req.json());
    const saved = await saveProjectReleaseForOrg(session, {
      projectId: id,
      ...body,
    });
    return apiOk({ release: { id: saved.id } }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
