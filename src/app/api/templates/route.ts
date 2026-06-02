import { NextRequest } from "next/server";
import { requireRole, requireSession } from "@/shared/api/require-session";
import { apiOk, handleApiError } from "@/shared/api/response";
import {
  createTemplateForOrg,
  ensureDefaultTemplateForOrg,
  listTemplatesForOrg,
} from "@/features/templates/templates.service";
import { createTemplateSchema } from "@/types/template-schemas";

export async function GET(req: NextRequest) {
  try {
    const ctx = await requireSession();
    const projectId = req.nextUrl.searchParams.get("projectId") ?? undefined;
    // Guarantee the org always has at least the default (finsel) template so
    // the picker is never empty on a fresh org. Idempotent — only seeds once.
    if (!projectId) {
      await ensureDefaultTemplateForOrg(ctx.orgId, ctx.userId);
    }
    const templates = await listTemplatesForOrg(ctx.orgId, { projectId });
    return apiOk({ templates });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const ctx = await requireSession();
    requireRole(ctx, "OWNER", "ADMIN");
    const body = createTemplateSchema.parse(await req.json());
    const created = await createTemplateForOrg(ctx.orgId, ctx.userId, body);
    return apiOk({ template: { id: created.id } }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
