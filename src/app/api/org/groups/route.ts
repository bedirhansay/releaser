import { NextRequest } from "next/server";
import { requireRole, requireSession } from "@/shared/api/require-session";
import { apiOk, handleApiError } from "@/shared/api/response";
import { createGroup, listGroups } from "@/features/org/org.service";
import { createGroupSchema } from "@/features/org/org-schemas";

export async function GET() {
  try {
    const ctx = await requireSession();
    requireRole(ctx, "OWNER", "ADMIN");
    const groups = await listGroups(ctx.orgId);
    return apiOk({ groups });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const ctx = await requireSession();
    requireRole(ctx, "OWNER", "ADMIN");
    const { name } = createGroupSchema.parse(await req.json());
    const group = await createGroup(ctx.orgId, name);
    return apiOk({ group }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
