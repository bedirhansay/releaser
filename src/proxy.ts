import { auth } from "@/auth";
import { NextResponse } from "next/server";

// Routes that require auth. Everything else (landing, /login, /api/auth/*,
// /api/health, and the HMAC-verified /api/github/app/webhook) stays public.
// NB: handlers also enforce auth via requireSessionUserId — this edge gate is
// defense-in-depth, not the only check.
const PROTECTED_PREFIXES = [
  "/dashboard",
  "/api/repos",
  "/api/releases",
  "/api/projects",
  "/api/templates",
  "/api/settings",
];

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isProtected = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));
  if (!isProtected) return NextResponse.next();
  if (!req.auth) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("from", pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
});

export const config = {
  // Run middleware on app routes, but skip Next.js internals and static files.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico)$).*)"],
};
