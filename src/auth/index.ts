import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/infrastructure/db/prisma";
import { encryptToken } from "@/infrastructure/crypto/token-cipher";
import { Bitbucket, type BitbucketProfile } from "./providers/bitbucket";

// Auth.js v5. GitHub + Bitbucket OAuth. Tokens are mirrored into our domain
// `GitConnection` table on link, so application code never has to read from
// the auth-internal Account rows.
export const {
  handlers,
  auth,
  signIn,
  signOut,
} = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "database" },
  providers: [
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
    async session({ session, user }) {
      if (session.user) session.user.id = user.id;
      return session;
    },
  },
  events: {
    async linkAccount({ user, account, profile }) {
      if (!user.id || !account.access_token) return;

      // Mirror the OAuth access token into our domain table — encrypted at
      // rest so a database leak doesn't immediately surrender API access.
      const encrypted = encryptToken(account.access_token);

      if (account.provider === "github") {
        const githubProfile = profile as { login?: string } | undefined;
        await prisma.gitConnection.upsert({
          where: { userId_provider: { userId: user.id, provider: "GITHUB" } },
          update: {
            accessToken: encrypted,
            scope: account.scope ?? null,
            accountLogin: githubProfile?.login ?? null,
          },
          create: {
            userId: user.id,
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
          where: { userId_provider: { userId: user.id, provider: "BITBUCKET" } },
          update: {
            accessToken: encrypted,
            scope: account.scope ?? null,
            accountLogin: bbProfile?.username ?? null,
          },
          create: {
            userId: user.id,
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
