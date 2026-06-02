import "next-auth";
import "next-auth/jwt";
import type { Role } from "@prisma/client";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      /** Active organization for this session (null if user has no membership). */
      orgId: string | null;
      /** Role within the active organization. */
      role: Role | null;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    orgId: string | null;
    role: Role | null;
    /** Epoch ms of the last membership re-check (for periodic revalidation). */
    refreshedAt?: number;
  }
}
