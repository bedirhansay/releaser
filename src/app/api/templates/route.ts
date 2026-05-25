import { NextRequest } from "next/server";
import { z } from "zod";
import { requireSessionUserId } from "@/shared/api/require-session";
import { apiOk, handleApiError } from "@/shared/api/response";
import {
  createTemplateForUser,
  listTemplatesForUser,
} from "@/features/templates/templates.service";
import { templateSectionsSchema } from "@/types/template-schemas";

const postSchema = z.object({
  name: z.string().trim().min(1).max(100),
  description: z.string().trim().max(500).optional(),
  projectId: z.string().min(1).optional(),
  sections: templateSectionsSchema,
});

export async function GET(req: NextRequest) {
  try {
    const userId = await requireSessionUserId();
    const projectId = req.nextUrl.searchParams.get("projectId") ?? undefined;
    const templates = await listTemplatesForUser(userId, { projectId });
    return apiOk({ templates });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const userId = await requireSessionUserId();
    const body = postSchema.parse(await req.json());
    const created = await createTemplateForUser(userId, body);
    return apiOk({ template: { id: created.id } }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
