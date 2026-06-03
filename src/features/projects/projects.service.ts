import type { Prisma } from "@prisma/client";
import { prisma } from "@/infrastructure/db/prisma";
import { isAdmin, type SessionContext } from "@/shared/api/require-session";
import type { GitProviderKind } from "@/core/git/types";

type DbProvider = "GITHUB" | "BITBUCKET" | "GITLAB" | "LOCAL";

// lowercase GitProviderKind -> Prisma enum (write path).
const PROVIDER_TO_DB = {
  github: "GITHUB",
  bitbucket: "BITBUCKET",
  gitlab: "GITLAB",
  local: "LOCAL",
} as const satisfies Record<GitProviderKind, DbProvider>;

// Prisma enum -> lowercase GitProviderKind (read path).
const DB_TO_PROVIDER = {
  GITHUB: "github",
  BITBUCKET: "bitbucket",
  GITLAB: "gitlab",
  LOCAL: "local",
} as const satisfies Record<DbProvider, GitProviderKind>;

export interface ProjectRepoInput {
  provider: GitProviderKind;
  owner: string;
  name: string;
  role?: string | null;
}

export interface ProjectMetaInput {
  defaultRisk?: string | null;
  monitoringLinks?: string | null;
  signOff?: string | null;
}

export interface CreateProjectInput extends ProjectMetaInput {
  name: string;
  slug?: string | null;
  description?: string | null;
  repos: ProjectRepoInput[];
}

export interface UpdateProjectInput extends ProjectMetaInput {
  name?: string;
  slug?: string | null;
  description?: string | null;
  repos?: ProjectRepoInput[];
}

// Translates a service-level repo input into the Prisma nested-create shape,
// mapping the lowercase provider onto the DB enum.
function toRepoCreate(repo: ProjectRepoInput) {
  return {
    provider: PROVIDER_TO_DB[repo.provider],
    owner: repo.owner,
    name: repo.name,
    role: repo.role ?? null,
  };
}

/**
 * Visibility filter for a member: only projects granted to them directly or
 * via one of their groups. Admins/owners see everything in the org, so they
 * get an empty extra-filter. Returned as a Prisma `where` fragment.
 */
async function accessWhere(ctx: SessionContext): Promise<Prisma.ProjectWhereInput> {
  if (isAdmin(ctx.role)) return {};
  const groups = await prisma.groupMember.findMany({
    where: { userId: ctx.userId },
    select: { groupId: true },
  });
  const groupIds = groups.map((g) => g.groupId);
  return {
    access: {
      some: {
        OR: [
          { userId: ctx.userId },
          ...(groupIds.length ? [{ groupId: { in: groupIds } }] : []),
        ],
      },
    },
  };
}

export async function createProjectForOrg(
  ctx: SessionContext,
  input: CreateProjectInput,
) {
  const project = await prisma.project.create({
    data: {
      orgId: ctx.orgId,
      createdById: ctx.userId,
      name: input.name,
      slug: input.slug ?? null,
      description: input.description ?? null,
      defaultRisk: input.defaultRisk ?? null,
      monitoringLinks: input.monitoringLinks ?? null,
      signOff: input.signOff ?? null,
      repos: { create: input.repos.map(toRepoCreate) },
    },
    select: { id: true },
  });
  return project;
}

export interface ProjectListItem {
  id: string;
  name: string;
  slug: string | null;
  description: string | null;
  defaultRisk: string | null;
  monitoringLinks: string | null;
  signOff: string | null;
  createdAt: Date;
  updatedAt: Date;
  repos: Array<{
    id: string;
    provider: GitProviderKind;
    owner: string;
    name: string;
    role: string | null;
  }>;
  releaseCount: number;
}

export async function listProjectsForOrg(
  ctx: SessionContext,
): Promise<ProjectListItem[]> {
  const projects = await prisma.project.findMany({
    where: { orgId: ctx.orgId, ...(await accessWhere(ctx)) },
    orderBy: { createdAt: "desc" },
    include: {
      repos: true,
      _count: { select: { releases: true } },
    },
  });

  return projects.map((p) => ({
    id: p.id,
    name: p.name,
    slug: p.slug,
    description: p.description,
    defaultRisk: p.defaultRisk,
    monitoringLinks: p.monitoringLinks,
    signOff: p.signOff,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
    repos: p.repos.map((r) => ({
      id: r.id,
      provider: DB_TO_PROVIDER[r.provider],
      owner: r.owner,
      name: r.name,
      role: r.role,
    })),
    releaseCount: p._count.releases,
  }));
}

export async function getProjectForOrg(ctx: SessionContext, id: string) {
  const project = await prisma.project.findFirst({
    where: { id, orgId: ctx.orgId, ...(await accessWhere(ctx)) },
    include: { repos: true },
  });
  if (!project) return null;

  return {
    id: project.id,
    name: project.name,
    slug: project.slug,
    description: project.description,
    defaultRisk: project.defaultRisk,
    monitoringLinks: project.monitoringLinks,
    signOff: project.signOff,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
    repos: project.repos.map((r) => ({
      id: r.id,
      provider: DB_TO_PROVIDER[r.provider],
      owner: r.owner,
      name: r.name,
      role: r.role,
    })),
  };
}

// Replaces scalar fields when provided. When `repos` is supplied we treat it
// as the full desired set: drop the existing rows and recreate, all inside a
// transaction so a project never ends up with a half-applied repo list.
export async function updateProjectForOrg(
  ctx: SessionContext,
  id: string,
  patch: UpdateProjectInput,
): Promise<boolean> {
  const owned = await prisma.project.findFirst({
    where: { id, orgId: ctx.orgId },
    select: { id: true },
  });
  if (!owned) return false;

  await prisma.$transaction(async (tx) => {
    await tx.project.update({
      where: { id },
      data: {
        ...(patch.name !== undefined ? { name: patch.name } : {}),
        ...(patch.slug !== undefined ? { slug: patch.slug } : {}),
        ...(patch.description !== undefined
          ? { description: patch.description }
          : {}),
        ...(patch.defaultRisk !== undefined
          ? { defaultRisk: patch.defaultRisk }
          : {}),
        ...(patch.monitoringLinks !== undefined
          ? { monitoringLinks: patch.monitoringLinks }
          : {}),
        ...(patch.signOff !== undefined ? { signOff: patch.signOff } : {}),
      },
    });

    if (patch.repos !== undefined) {
      await tx.projectRepo.deleteMany({ where: { projectId: id } });
      await tx.projectRepo.createMany({
        data: patch.repos.map((repo) => ({
          projectId: id,
          ...toRepoCreate(repo),
        })),
      });
    }
  });

  return true;
}

export async function deleteProjectForOrg(
  ctx: SessionContext,
  id: string,
): Promise<boolean> {
  const result = await prisma.project.deleteMany({
    where: { id, orgId: ctx.orgId },
  });
  return result.count > 0;
}
