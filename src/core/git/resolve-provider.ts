import { prisma } from "@/infrastructure/db/prisma";
import {
  decryptToken,
  encryptToken,
} from "@/infrastructure/crypto/token-cipher";
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
  const connection = await prisma.gitConnection.findUnique({
    where: { userId_provider: { userId, provider: PROVIDER_TO_DB[kind] } },
  });
  if (!connection) {
    throw new GitAuthError(`No ${kind} connection linked for this user`);
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
