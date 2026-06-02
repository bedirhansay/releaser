import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { requireRole, requireSession } from "@/shared/api/require-session";
import { handleApiError } from "@/shared/api/response";
import { getInstallUrl } from "@/infrastructure/github/app-auth";

// Kicks off the GitHub App install: sets a short-lived CSRF state cookie and
// redirects the user to GitHub's installation screen where they pick repos.
export async function GET() {
  try {
    const session = await requireSession();
    requireRole(session, "OWNER", "ADMIN");
    const state = randomUUID();
    const url = getInstallUrl(state);
    if (!url) {
      return NextResponse.redirect(
        new URL(
          "/dashboard/settings?github=not_configured",
          process.env.AUTH_URL ?? "http://localhost:3000",
        ),
      );
    }
    const res = NextResponse.redirect(url);
    res.cookies.set("gh_app_state", state, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 600, // 10 minutes
    });
    return res;
  } catch (err) {
    return handleApiError(err);
  }
}
