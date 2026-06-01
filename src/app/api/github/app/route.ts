import { requireSession } from "@/shared/api/require-session";
import { apiOk, handleApiError } from "@/shared/api/response";
import { isGitHubAppConfigured } from "@/infrastructure/github/app-auth";
import { listInstallationsForOrg } from "@/features/github-app/github-app.service";

export async function GET() {
  try {
    const ctx = await requireSession();
    const installations = await listInstallationsForOrg(ctx.orgId);
    return apiOk({
      configured: isGitHubAppConfigured(),
      installations,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
