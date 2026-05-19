import { prisma } from "@/infrastructure/db/prisma";
import { resolveGitProviderForUser } from "@/core/git/resolve-provider";
import type {
  GitProviderKind,
  ListPullRequestsParams,
} from "@/core/git/types";

export interface ListReposInput {
  search?: string;
  perPage?: number;
  page?: number;
}

export async function listUserRepositories(
  userId: string,
  provider: GitProviderKind,
  input: ListReposInput = {},
) {
  const git = await resolveGitProviderForUser(userId, provider);
  return git.getRepositories(input);
}

export async function listBranches(
  userId: string,
  provider: GitProviderKind,
  params: { owner: string; repo: string },
) {
  const git = await resolveGitProviderForUser(userId, provider);
  return git.getBranches(params);
}

export async function compareBranches(
  userId: string,
  provider: GitProviderKind,
  params: { owner: string; repo: string; base: string; head: string },
) {
  const git = await resolveGitProviderForUser(userId, provider);
  return git.compareBranches(params);
}

export async function listTags(
  userId: string,
  provider: GitProviderKind,
  params: { owner: string; repo: string },
) {
  const git = await resolveGitProviderForUser(userId, provider);
  return git.listTags(params);
}

export async function listPullRequests(
  userId: string,
  provider: GitProviderKind,
  params: ListPullRequestsParams,
) {
  const git = await resolveGitProviderForUser(userId, provider);
  return git.listPullRequests(params);
}

// Lightweight: returns just the provider kinds the user has linked, so the UI
// can render the right picker without leaking access tokens.
const PROVIDER_FROM_DB = {
  GITHUB: "github",
  BITBUCKET: "bitbucket",
  GITLAB: "gitlab",
} as const satisfies Record<string, GitProviderKind>;

type DbProvider = keyof typeof PROVIDER_FROM_DB;

export async function listLinkedProviders(
  userId: string,
): Promise<GitProviderKind[]> {
  const connections = await prisma.gitConnection.findMany({
    where: { userId },
    select: { provider: true },
  });
  return connections.map((c) => PROVIDER_FROM_DB[c.provider as DbProvider]);
}
