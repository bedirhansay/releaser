import { prisma } from "@/infrastructure/db/prisma";
import { resolveGitProviderForOrg } from "@/core/git/resolve-provider";
import { isLocalProviderConfigured } from "@/infrastructure/local/config";
import type {
  GitProviderKind,
  ListPullRequestsParams,
} from "@/core/git/types";

export interface ListReposInput {
  search?: string;
  perPage?: number;
  page?: number;
}

export async function listOrgRepositories(
  orgId: string,
  provider: GitProviderKind,
  input: ListReposInput = {},
) {
  const git = await resolveGitProviderForOrg(orgId, provider);
  return git.getRepositories(input);
}

export async function listBranches(
  orgId: string,
  provider: GitProviderKind,
  params: { owner: string; repo: string },
) {
  const git = await resolveGitProviderForOrg(orgId, provider);
  return git.getBranches(params);
}

export async function compareBranches(
  orgId: string,
  provider: GitProviderKind,
  params: { owner: string; repo: string; base: string; head: string },
) {
  const git = await resolveGitProviderForOrg(orgId, provider);
  return git.compareBranches(params);
}

export async function listTags(
  orgId: string,
  provider: GitProviderKind,
  params: { owner: string; repo: string },
) {
  const git = await resolveGitProviderForOrg(orgId, provider);
  return git.listTags(params);
}

export async function listPullRequests(
  orgId: string,
  provider: GitProviderKind,
  params: ListPullRequestsParams,
) {
  const git = await resolveGitProviderForOrg(orgId, provider);
  return git.listPullRequests(params);
}

// Lightweight: returns just the provider kinds the org has linked, so the UI
// can render the right picker without leaking access tokens.
const PROVIDER_FROM_DB = {
  GITHUB: "github",
  BITBUCKET: "bitbucket",
  GITLAB: "gitlab",
  LOCAL: "local",
} as const satisfies Record<string, GitProviderKind>;

type DbProvider = keyof typeof PROVIDER_FROM_DB;

export async function listLinkedProviders(
  orgId: string,
): Promise<GitProviderKind[]> {
  // Repo access can come from two places: an OAuth GitConnection, OR a GitHub
  // App installation (which has no GitConnection row). Count both so the UI
  // surfaces "github" when only the App is connected.
  const [connections, ghInstall] = await Promise.all([
    prisma.gitConnection.findMany({ where: { orgId }, select: { provider: true } }),
    prisma.gitHubInstallation.findFirst({
      where: { orgId, suspended: false },
      select: { id: true },
    }),
  ]);
  const providers = new Set(
    connections.map((c) => PROVIDER_FROM_DB[c.provider as DbProvider]),
  );
  if (ghInstall) providers.add("github");
  // The local provider needs no connection row — surface it whenever the
  // on-disk repos directory is configured (LOCAL_REPOS_DIR).
  if (isLocalProviderConfigured()) providers.add("local");
  return [...providers];
}
