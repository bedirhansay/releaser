import { prisma } from "@/infrastructure/db/prisma";
import {
  decryptToken,
  encryptToken,
} from "@/infrastructure/crypto/token-cipher";
import {
  getInstallationToken,
  isGitHubAppConfigured,
} from "@/infrastructure/github/app-auth";
import { GitHubProvider } from "@/infrastructure/github/github-provider";
import { GitAuthError } from "./errors";
import { createGitProvider } from "./provider-factory";
import type { GitProvider, GitProviderKind } from "./types";

const PROVIDER_TO_DB: Record<
  GitProviderKind,
  "GITHUB" | "BITBUCKET" | "GITLAB"
> = {
  github: "GITHUB",
  bitbucket: "BITBUCKET",
  gitlab: "GITLAB",
};

export async function resolveGitProviderForUser(
  userId: string,
  kind: GitProviderKind = "github",
): Promise<GitProvider> {
  // Prefer a GitHub App installation (Coolify-style, least-privilege per-repo
  // access via short-lived tokens) when the App is configured and the user has
  // installed it. Fall back to the OAuth connection otherwise.
  if (kind === "github" && isGitHubAppConfigured()) {
    const installation = await prisma.gitHubInstallation.findFirst({
      where: { userId, suspended: false },
      orderBy: { createdAt: "desc" },
      select: { installationId: true },
    });
    if (installation) {
      const token = await getInstallationToken(installation.installationId);
      return new GitHubProvider(token, { installation: true });
    }
  }

  const connection = await prisma.gitConnection.findUnique({
    where: { userId_provider: { userId, provider: PROVIDER_TO_DB[kind] } },
  });
  if (!connection) {
    throw new GitAuthError(
      kind === "github"
        ? "No GitHub access. Install the GitHub App or connect via OAuth."
        : `No ${kind} connection linked for this user`,
    );
  }

  const accessToken = decryptToken(connection.accessToken);

  // Opportunistic re-encryption: if a legacy plaintext row was decrypted as
  // pass-through, encrypt it now so it'll be safe in the next leak. Best
  // effort — failure to update doesn't block the request.
  if (accessToken === connection.accessToken) {
    try {
      await prisma.gitConnection.update({
        where: { id: connection.id },
        data: { accessToken: encryptToken(accessToken) },
      });
    } catch {
      /* ignore — read path must keep working */
    }
  }

  return createGitProvider({ kind, accessToken });
}
