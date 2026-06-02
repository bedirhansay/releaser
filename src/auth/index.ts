import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/infrastructure/db/prisma";
import { encryptToken } from "@/infrastructure/crypto/token-cipher";
import { consumeDistributed } from "@/shared/api/rate-limit-distributed";
import { POLICIES } from "@/shared/api/rate-limit";
import { Bitbucket, type BitbucketProfile } from "./providers/bitbucket";

/**
 * How long a JWT's cached org/role is trusted before we re-check the DB. Bounds
 * the window in which a removed or demoted member keeps stale access (the JWT
 * strategy otherwise trusts the token for its full lifetime).
 */
const MEMBERSHIP_TTL_MS = 5 * 60 * 1000;

// Auth.js v5. Sessions are JWT-based (required for the Credentials provider),
// so the active org + role ride along in the token. Login is primarily email/
// password (Credentials) for admin-provisioned members + the seeded superadmin;
// GitHub/Bitbucket OAuth stay available to link a git connection for the org.
//
// Tokens from OAuth are mirrored into our domain `GitConnection` table on link
// (encrypted), scoped to the linking user's active organization.

const credentialsSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
});

/** First membership for a user → their active org + role (single-org for now). */
async function activeMembership(userId: string) {
  return prisma.membership.findFirst({
    where: { userId },
    orderBy: { createdAt: "asc" },
    select: { orgId: true, role: true },
  });
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 7 },
  providers: [
    Credentials({
      credentials: {
        email: { label: "E-posta", type: "email" },
        password: { label: "Şifre", type: "password" },
      },
      async authorize(raw) {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;
        const { email, password } = parsed.data;
        const emailKey = email.toLowerCase();

        // Throttle credential brute-force before doing any (costly) bcrypt work.
        const rl = await consumeDistributed(`login:${emailKey}`, POLICIES.LOGIN);
        if (!rl.allowed) return null;

        const user = await prisma.user.findUnique({
          where: { email: emailKey },
        });
        if (!user?.passwordHash) return null;

        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) return null;

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image,
        };
      },
    }),
    GitHub({
      clientId: process.env.AUTH_GITHUB_ID,
      clientSecret: process.env.AUTH_GITHUB_SECRET,
      authorization: {
        params: {
          // `repo` covers private repos; drop to `public_repo` if you only
          // care about public repositories.
          scope: "read:user user:email repo",
        },
      },
    }),
    Bitbucket({
      clientId: process.env.AUTH_BITBUCKET_ID,
      clientSecret: process.env.AUTH_BITBUCKET_SECRET,
    }),
  ],
  callbacks: {
    // Persist identity + active org/role into the JWT. Membership is resolved
    // at sign-in, on explicit refresh, and re-checked at most every
    // MEMBERSHIP_TTL_MS — NOT on every request — so a removed/demoted member
    // loses access within minutes without a DB hit per `auth()` call.
    async jwt({ token, user, trigger }) {
      if (user?.id) token.id = user.id;
      const now = Date.now();
      const stale =
        token.refreshedAt === undefined ||
        now - token.refreshedAt > MEMBERSHIP_TTL_MS;
      const needsMembership =
        Boolean(user) ||
        trigger === "update" ||
        token.orgId === undefined ||
        stale;
      if (token.id && needsMembership) {
        const m = await activeMembership(token.id);
        token.orgId = m?.orgId ?? null;
        token.role = m?.role ?? null;
        token.refreshedAt = now;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id;
        session.user.orgId = token.orgId ?? null;
        session.user.role = token.role ?? null;
      }
      return session;
    },
  },
  events: {
    async linkAccount({ user, account, profile }) {
      if (!user.id || !account.access_token) return;

      // Mirror the OAuth token into the org's GitConnection (encrypted). The
      // connection belongs to the linking user's active org so the whole team
      // shares it. No membership yet → skip (can't scope it to an org).
      const membership = await activeMembership(user.id);
      if (!membership?.orgId) return;
      const orgId = membership.orgId;
      const encrypted = encryptToken(account.access_token);

      if (account.provider === "github") {
        const githubProfile = profile as { login?: string } | undefined;
        await prisma.gitConnection.upsert({
          where: { orgId_provider: { orgId, provider: "GITHUB" } },
          update: {
            accessToken: encrypted,
            scope: account.scope ?? null,
            accountLogin: githubProfile?.login ?? null,
          },
          create: {
            orgId,
            provider: "GITHUB",
            accessToken: encrypted,
            scope: account.scope ?? null,
            accountLogin: githubProfile?.login ?? null,
          },
        });
        return;
      }

      if (account.provider === "bitbucket") {
        const bbProfile = profile as BitbucketProfile | undefined;
        await prisma.gitConnection.upsert({
          where: { orgId_provider: { orgId, provider: "BITBUCKET" } },
          update: {
            accessToken: encrypted,
            scope: account.scope ?? null,
            accountLogin: bbProfile?.username ?? null,
          },
          create: {
            orgId,
            provider: "BITBUCKET",
            accessToken: encrypted,
            scope: account.scope ?? null,
            accountLogin: bbProfile?.username ?? null,
          },
        });
      }
    },
  },
  pages: {
    signIn: "/login",
  },
});
