import { NextRequest, NextResponse } from "next/server";
import { requireSessionUserId } from "@/shared/api/require-session";
import { handleApiError } from "@/shared/api/response";
import { getInstallationMeta } from "@/infrastructure/github/app-auth";
import { saveInstallationForUser } from "@/features/github-app/github-app.service";

// GitHub redirects here after the user installs / reconfigures the App.
// Query params: installation_id, setup_action, state.
export async function GET(req: NextRequest) {
  const settingsUrl = (status: string) =>
    new URL(
      `/dashboard/settings?github=${status}`,
      process.env.AUTH_URL ?? req.nextUrl.origin,
    );

  try {
    const userId = await requireSessionUserId();
    const params = req.nextUrl.searchParams;
    const installationIdRaw = params.get("installation_id");
    const state = params.get("state");

    // CSRF: the state must match the cookie we set when starting the install.
    const cookieState = req.cookies.get("gh_app_state")?.value;
    if (!state || !cookieState || state !== cookieState) {
      return NextResponse.redirect(settingsUrl("state_mismatch"));
    }

    const installationId = Number(installationIdRaw);
    if (!installationIdRaw || Number.isNaN(installationId)) {
      return NextResponse.redirect(settingsUrl("no_installation"));
    }

    // Enrich with account + repo-selection metadata (best effort).
    let meta = {};
    try {
      meta = await getInstallationMeta(installationId);
    } catch {
      /* metadata is non-critical — store the installation regardless */
    }

    await saveInstallationForUser(userId, installationId, meta);

    const res = NextResponse.redirect(settingsUrl("connected"));
    res.cookies.delete("gh_app_state");
    return res;
  } catch (err) {
    return handleApiError(err);
  }
}
