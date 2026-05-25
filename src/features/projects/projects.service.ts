import { prisma } from "@/infrastructure/db/prisma";
import type { GitProviderKind } from "@/core/git/types";

type DbProvider = "GITHUB" | "BITBUCKET" | "GITLAB";

// lowercase GitProviderKind -> Prisma enum (write path).
const PROVIDER_TO_DB = {
  github: "GITHUB",
  bitbucket: "BITBUCKET",
  gitlab: "GITLAB",
} as const satisfies Record<GitProviderKind, DbProvider>;

// Prisma enum -> lowercase GitProviderKind (read path).
const DB_TO_PROVIDER = {
  GITHUB: "github",
  BITBUCKET: "bitbucket",
  GITLAB: "gitlab",
} as const satisfies Record<DbProvider, GitProviderKind>;

export interface ProjectRepoInput {
  provider: GitProviderKind;
  owner: string;
  name: string;
  role?: string | null;
}

export interface CreateProjectInput {
  name: string;
  slug?: string | null;
  description?: string | null;
  repos: ProjectRepoInput[];
}

export interface UpdateProjectInput {
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

export async function createProjectForUser(
  userId: string,
  input: CreateProjectInput,
) {
  const project = await prisma.project.create({
    data: {
      userId,
      name: input.name,
      slug: input.slug ?? null,
      description: input.description ?? null,
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

export async function listProjectsForUser(
  userId: string,
): Promise<ProjectListItem[]> {
  const projects = await prisma.project.findMany({
    where: { userId },
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

export async function getProjectForUser(userId: string, id: string) {
  const project = await prisma.project.findFirst({
    where: { id, userId },
    include: { repos: true },
  });
  if (!project) return null;

  return {
    id: project.id,
    name: project.name,
    slug: project.slug,
    description: project.description,
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
export async function updateProjectForUser(
  userId: string,
  id: string,
  patch: UpdateProjectInput,
): Promise<boolean> {
  const owned = await prisma.project.findFirst({
    where: { id, userId },
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

export async function deleteProjectForUser(
  userId: string,
  id: string,
): Promise<boolean> {
  const result = await prisma.project.deleteMany({ where: { id, userId } });
  return result.count > 0;
}
