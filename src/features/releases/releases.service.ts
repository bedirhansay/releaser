import type { Prisma } from "@prisma/client";
import { prisma } from "@/infrastructure/db/prisma";
import {
  ReleaseEngine,
  type ReleaseEnginePRsResult,
} from "@/core/release/engine";
import { createAIProvider } from "@/core/ai/provider-factory";
import { resolveGitProviderForUser } from "@/core/git/resolve-provider";
import type { GitProviderKind, PRFilterMode } from "@/core/git/types";
import type { GeneratedRelease } from "@/types/release";

const PROVIDER_TO_DB = {
  github: "GITHUB",
  bitbucket: "BITBUCKET",
  gitlab: "GITLAB",
} as const satisfies Record<GitProviderKind, "GITHUB" | "BITBUCKET" | "GITLAB">;

export interface GenerateReleaseInput {
  provider: GitProviderKind;
  owner: string;
  repo: string;
  base: string;
  head: string;
}

export interface SaveReleaseInput {
  provider: GitProviderKind;
  owner: string;
  repo: string;
  base: string;
  head: string;
  title: string;
  markdown: string;
  release: GeneratedRelease;
}

export async function generateReleaseForUser(
  userId: string,
  input: GenerateReleaseInput,
): Promise<GeneratedRelease> {
  const [git, ai] = await Promise.all([
    resolveGitProviderForUser(userId, input.provider),
    Promise.resolve(createAIProvider()),
  ]);
  const engine = new ReleaseEngine({ git, ai });
  return engine.generate(input);
}

export interface GenerateFromPRsServiceInput {
  provider: GitProviderKind;
  owner: string;
  repo: string;
  filter: PRFilterMode;
}

export async function generateReleaseFromPRsForUser(
  userId: string,
  input: GenerateFromPRsServiceInput,
): Promise<ReleaseEnginePRsResult> {
  const [git, ai] = await Promise.all([
    resolveGitProviderForUser(userId, input.provider),
    Promise.resolve(createAIProvider()),
  ]);
  const engine = new ReleaseEngine({ git, ai });
  return engine.generateFromPRs({
    owner: input.owner,
    repo: input.repo,
    filter: input.filter,
  });
}

export async function saveRelease(userId: string, input: SaveReleaseInput) {
  return prisma.releaseHistory.create({
    data: {
      userId,
      provider: PROVIDER_TO_DB[input.provider],
      repoOwner: input.owner,
      repoName: input.repo,
      baseRef: input.base,
      headRef: input.head,
      title: input.title,
      markdown: input.markdown,
      // `GeneratedRelease` is JSON-serialisable by construction (no Date /
       // class instances), but Prisma's `InputJsonValue` type can't see that
       // statically, so the cast stays here intentionally. Mirrored on read
       // by `parseRelease` for full round-trip type safety.
      payload: input.release as unknown as Prisma.InputJsonValue,
      modelUsed: input.release.modelUsed,
    },
  });
}

export async function listReleasesForUser(userId: string, limit = 30) {
  return prisma.releaseHistory.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      provider: true,
      repoOwner: true,
      repoName: true,
      baseRef: true,
      headRef: true,
      title: true,
      modelUsed: true,
      createdAt: true,
    },
  });
}

export async function getReleaseForUser(userId: string, id: string) {
  return prisma.releaseHistory.findFirst({
    where: { id, userId },
  });
}

export interface UpdateReleaseInput {
  title?: string;
  markdown?: string;
}

// Updates only the user-editable surface (title + markdown). The structured
// AI payload is kept frozen so we always have an audit trail of what the
// model originally produced.
export async function updateReleaseForUser(
  userId: string,
  id: string,
  patch: UpdateReleaseInput,
) {
  const result = await prisma.releaseHistory.updateMany({
    where: { id, userId },
    data: {
      ...(patch.title !== undefined ? { title: patch.title } : {}),
      ...(patch.markdown !== undefined ? { markdown: patch.markdown } : {}),
    },
  });
  return result.count > 0;
}

export async function deleteReleaseForUser(userId: string, id: string) {
  const result = await prisma.releaseHistory.deleteMany({
    where: { id, userId },
  });
  return result.count > 0;
}
