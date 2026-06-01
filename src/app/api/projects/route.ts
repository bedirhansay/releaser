import { NextRequest } from "next/server";
import { requireRole, requireSession } from "@/shared/api/require-session";
import { apiOk, handleApiError } from "@/shared/api/response";
import { createProjectSchema } from "@/features/projects/project-schemas";
import {
  createProjectForOrg,
  listProjectsForOrg,
} from "@/features/projects/projects.service";

export async function GET() {
  try {
    const ctx = await requireSession();
    const projects = await listProjectsForOrg(ctx);
    return apiOk({ projects });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const ctx = await requireSession();
    requireRole(ctx, "OWNER", "ADMIN");
    const body = createProjectSchema.parse(await req.json());
    const project = await createProjectForOrg(ctx, body);
    return apiOk({ project: { id: project.id } }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
