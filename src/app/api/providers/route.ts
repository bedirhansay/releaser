import { requireSession } from "@/shared/api/require-session";
import { apiOk, handleApiError } from "@/shared/api/response";
import { listLinkedProviders } from "@/features/repositories/repositories.service";

export async function GET() {
  try {
    const ctx = await requireSession();
    const providers = await listLinkedProviders(ctx.orgId);
    return apiOk({ providers });
  } catch (err) {
    return handleApiError(err);
  }
}
