import type { GitProvider, GitProviderKind } from "./types";
import { GitAuthError } from "./errors";
import { GitHubProvider } from "@/infrastructure/github/github-provider";
import { BitbucketProvider } from "@/infrastructure/bitbucket/bitbucket-provider";
import { LocalGitProvider } from "@/infrastructure/local/local-provider";
import { requireLocalReposDir } from "@/infrastructure/local/config";

export interface CreateGitProviderInput {
  kind: GitProviderKind;
  accessToken: string;
}

export function createGitProvider({
  kind,
  accessToken,
}: CreateGitProviderInput): GitProvider {
  switch (kind) {
    case "github":
      return new GitHubProvider(accessToken);
    case "bitbucket":
      return new BitbucketProvider(accessToken);
    case "local":
      // No token — reads on-disk clones under LOCAL_REPOS_DIR.
      return new LocalGitProvider(requireLocalReposDir());
    case "gitlab":
      throw new GitAuthError(`Provider "${kind}" not implemented yet`);
    default: {
      const exhaustive: never = kind;
      throw new Error(`Unknown git provider: ${String(exhaustive)}`);
    }
  }
}
