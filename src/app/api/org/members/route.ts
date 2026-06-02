import { NextRequest } from "next/server";
import { requireRole, requireSession } from "@/shared/api/require-session";
import { apiOk, handleApiError } from "@/shared/api/response";
import { createMember, listMembers } from "@/features/org/org.service";
import { createMemberSchema } from "@/features/org/org-schemas";

export async function GET() {
  try {
    const ctx = await requireSession();
    requireRole(ctx, "OWNER", "ADMIN");
    const members = await listMembers(ctx.orgId);
    return apiOk({ members });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const ctx = await requireSession();
    requireRole(ctx, "OWNER", "ADMIN");
    const body = createMemberSchema.parse(await req.json());
    const member = await createMember(ctx.orgId, body);
    return apiOk({ member }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
