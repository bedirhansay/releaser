import { requireSessionUserId } from "@/shared/api/require-session";
import { apiOk, handleApiError } from "@/shared/api/response";
import { isGitHubAppConfigured } from "@/infrastructure/github/app-auth";
import { listInstallationsForUser } from "@/features/github-app/github-app.service";

export async function GET() {
  try {
    const userId = await requireSessionUserId();
    const installations = await listInstallationsForUser(userId);
    return apiOk({
      configured: isGitHubAppConfigured(),
      installations,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
