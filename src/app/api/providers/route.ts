import { requireSessionUserId } from "@/shared/api/require-session";
import { apiOk, handleApiError } from "@/shared/api/response";
import { listLinkedProviders } from "@/features/repositories/repositories.service";

export async function GET() {
  try {
    const userId = await requireSessionUserId();
    const providers = await listLinkedProviders(userId);
    return apiOk({ providers });
  } catch (err) {
    return handleApiError(err);
  }
}
