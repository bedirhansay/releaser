import { NextRequest } from "next/server";
import { z } from "zod";
import { requireSessionUserId } from "@/shared/api/require-session";
import { apiOk, handleApiError } from "@/shared/api/response";
import { providerSchema } from "@/shared/api/provider-schema";
import {
  createProjectForUser,
  listProjectsForUser,
} from "@/features/projects/projects.service";

const repoSchema = z.object({
  provider: providerSchema,
  owner: z.string().trim().min(1),
  name: z.string().trim().min(1),
  role: z.string().trim().max(40).optional(),
});

const postSchema = z.object({
  name: z.string().trim().min(1).max(100),
  slug: z.string().trim().max(60).optional(),
  description: z.string().trim().max(500).optional(),
  repos: z.array(repoSchema).min(1).max(20),
});

export async function GET() {
  try {
    const userId = await requireSessionUserId();
    const projects = await listProjectsForUser(userId);
    return apiOk({ projects });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const userId = await requireSessionUserId();
    const body = postSchema.parse(await req.json());
    const project = await createProjectForUser(userId, body);
    return apiOk({ project: { id: project.id } }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
