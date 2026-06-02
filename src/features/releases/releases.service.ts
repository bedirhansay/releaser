import type { Prisma } from "@prisma/client";
import { prisma } from "@/infrastructure/db/prisma";
import {
  ReleaseEngine,
  type ReleaseEnginePRsResult,
} from "@/core/release/engine";
import { resolveAiProviderForOrg } from "@/features/settings/ai-settings.service";
import { resolveGitProviderForOrg } from "@/core/git/resolve-provider";
import { isAdmin, type SessionContext } from "@/shared/api/require-session";
import type { GitProviderKind, PRFilterMode } from "@/core/git/types";
import type { GeneratedRelease } from "@/types/release";

/**
 * Release visibility for a member: releases they authored, or releases for a
 * project they can access (directly or via a group). Admins see all.
 */
function releaseAccessWhere(ctx: SessionContext): Prisma.ReleaseHistoryWhereInput {
  if (isAdmin(ctx.role)) return {};
  return {
    OR: [
      { createdById: ctx.userId },
      {
        project: {
          access: {
            some: {
              OR: [
                { userId: ctx.userId },
                { group: { members: { some: { userId: ctx.userId } } } },
              ],
            },
          },
        },
      },
    ],
  };
}

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
  tags?: string[];
  /** Set when the release was generated for a multi-repo Project. */
  projectId?: string;
  templateId?: string;
  release: GeneratedRelease;
}

export async function generateReleaseForOrg(
  orgId: string,
  input: GenerateReleaseInput,
): Promise<GeneratedRelease> {
  const [git, ai] = await Promise.all([
    resolveGitProviderForOrg(orgId, input.provider),
    resolveAiProviderForOrg(orgId),
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

export async function generateReleaseFromPRsForOrg(
  orgId: string,
  input: GenerateFromPRsServiceInput,
): Promise<ReleaseEnginePRsResult> {
  const [git, ai] = await Promise.all([
    resolveGitProviderForOrg(orgId, input.provider),
    resolveAiProviderForOrg(orgId),
  ]);
  const engine = new ReleaseEngine({ git, ai });
  return engine.generateFromPRs({
    owner: input.owner,
    repo: input.repo,
    filter: input.filter,
  });
}

export async function saveRelease(ctx: SessionContext, input: SaveReleaseInput) {
  return prisma.releaseHistory.create({
    data: {
      orgId: ctx.orgId,
      createdById: ctx.userId,
      projectId: input.projectId ?? null,
      templateId: input.templateId ?? null,
      provider: PROVIDER_TO_DB[input.provider],
      repoOwner: input.owner,
      repoName: input.repo,
      baseRef: input.base,
      headRef: input.head,
      title: input.title,
      tags: normalizeTags(input.tags),
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

export interface ListReleasesInput {
  /** Page size. Defaults to 20; capped at 100. */
  limit?: number;
  /** Opaque cursor — pass the value returned in `nextCursor` from the
   *  previous page. Omit on the first page. */
  cursor?: { createdAt: Date; id: string };
  /** Case-insensitive substring filter over title + markdown. */
  search?: string;
  /** Restrict to releases carrying *any* of these tags (OR semantics). */
  tags?: string[];
}

export interface ListReleasesResult {
  items: Array<{
    id: string;
    provider: "GITHUB" | "BITBUCKET" | "GITLAB";
    repoOwner: string;
    repoName: string;
    baseRef: string;
    headRef: string;
    title: string | null;
    tags: string[];
    projectId: string | null;
    projectName: string | null;
    modelUsed: string | null;
    createdAt: Date;
  }>;
  /** `null` once the list is exhausted. */
  nextCursor: { createdAt: string; id: string } | null;
}

/**
 * Cursor-based pagination over a user's releases. Using `(createdAt, id)` as
 * a compound cursor avoids the dropped-row problem you get with `OFFSET`
 * when new rows arrive during paging.
 */
export async function listReleasesForOrg(
  ctx: SessionContext,
  input: ListReleasesInput = {},
): Promise<ListReleasesResult> {
  const limit = Math.min(Math.max(input.limit ?? 20, 1), 100);
  const search = input.search?.trim();
  const tags = normalizeTags(input.tags);

  const items = await prisma.releaseHistory.findMany({
    where: {
      orgId: ctx.orgId,
      ...releaseAccessWhere(ctx),
      ...(search
        ? {
            OR: [
              { title: { contains: search, mode: "insensitive" } },
              { markdown: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
      ...(tags.length ? { tags: { hasSome: tags } } : {}),
      ...(input.cursor
        ? {
            OR: [
              { createdAt: { lt: input.cursor.createdAt } },
              {
                createdAt: input.cursor.createdAt,
                id: { lt: input.cursor.id },
              },
            ],
          }
        : {}),
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit + 1, // sentinel row to detect whether more exist
    select: {
      id: true,
      provider: true,
      repoOwner: true,
      repoName: true,
      baseRef: true,
      headRef: true,
      title: true,
      tags: true,
      projectId: true,
      project: { select: { name: true } },
      modelUsed: true,
      createdAt: true,
    },
  });

  let nextCursor: ListReleasesResult["nextCursor"] = null;
  if (items.length > limit) {
    const last = items[limit - 1];
    nextCursor = { createdAt: last.createdAt.toISOString(), id: last.id };
    items.length = limit;
  }
  // Flatten the project relation down to a plain name for the UI.
  const flat = items.map(({ project, ...rest }) => ({
    ...rest,
    projectName: project?.name ?? null,
  }));
  return { items: flat, nextCursor };
}

export async function getReleaseForOrg(ctx: SessionContext, id: string) {
  return prisma.releaseHistory.findFirst({
    where: { id, orgId: ctx.orgId, ...releaseAccessWhere(ctx) },
  });
}

export interface UpdateReleaseInput {
  title?: string;
  markdown?: string;
  tags?: string[];
}

// Updates only the user-editable surface (title + markdown + tags). The
// structured AI payload is kept frozen so we always have an audit trail of
// what the model originally produced.
export async function updateReleaseForOrg(
  ctx: SessionContext,
  id: string,
  patch: UpdateReleaseInput,
) {
  const result = await prisma.releaseHistory.updateMany({
    where: { id, orgId: ctx.orgId, ...releaseAccessWhere(ctx) },
    data: {
      ...(patch.title !== undefined ? { title: patch.title } : {}),
      ...(patch.markdown !== undefined ? { markdown: patch.markdown } : {}),
      ...(patch.tags !== undefined
        ? { tags: normalizeTags(patch.tags) }
        : {}),
    },
  });
  return result.count > 0;
}

export async function deleteReleaseForOrg(ctx: SessionContext, id: string) {
  const result = await prisma.releaseHistory.deleteMany({
    where: { id, orgId: ctx.orgId, ...releaseAccessWhere(ctx) },
  });
  return result.count > 0;
}

/**
 * Canonicalises user-authored tags: trims, drops empties, lower-cases for
 * consistent grouping/filtering, and de-dupes while preserving order. Capped
 * to keep a single release from accumulating an unbounded label set.
 */
export function normalizeTags(tags: string[] | undefined): string[] {
  if (!tags?.length) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of tags) {
    const tag = raw.trim().toLowerCase();
    if (!tag || seen.has(tag)) continue;
    seen.add(tag);
    out.push(tag);
    if (out.length >= 20) break;
  }
  return out;
}
