import { auth } from "@/auth";
import type { Role } from "@prisma/client";

export class UnauthorizedError extends Error {
  readonly status = 401 as const;
  constructor(message = "Not authenticated") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends Error {
  readonly status = 403 as const;
  constructor(message = "Forbidden") {
    super(message);
    this.name = "ForbiddenError";
  }
}

export async function requireSessionUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) throw new UnauthorizedError();
  return session.user.id;
}

/** Authenticated user + their active organization and role. */
export interface SessionContext {
  userId: string;
  orgId: string;
  role: Role;
}

/**
 * Requires an authenticated user who belongs to an organization. Returns the
 * org + role so callers can scope queries and gate writes. A logged-in user
 * with no membership (e.g. an OAuth identity that was never provisioned) is
 * treated as forbidden — they have no org to act in.
 */
export async function requireSession(): Promise<SessionContext> {
  const session = await auth();
  if (!session?.user?.id) throw new UnauthorizedError();
  if (!session.user.orgId || !session.user.role) {
    throw new ForbiddenError("No organization membership");
  }
  return {
    userId: session.user.id,
    orgId: session.user.orgId,
    role: session.user.role,
  };
}

/** Throws unless the context's role is one of the allowed roles. */
export function requireRole(ctx: SessionContext, ...allowed: Role[]): void {
  if (!allowed.includes(ctx.role)) {
    throw new ForbiddenError("Insufficient role");
  }
}

/** True for org administrators (ADMIN or OWNER). */
export function isAdmin(role: Role): boolean {
  return role === "ADMIN" || role === "OWNER";
}
