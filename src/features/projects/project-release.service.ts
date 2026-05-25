import { resolveAiProviderForUser } from "@/features/settings/ai-settings.service";
import { resolveGitProviderForUser } from "@/core/git/resolve-provider";
import { buildTemplateMarkdown } from "@/core/release/markdown";
import type {
  GitProvider,
  GitProviderKind,
  PRFilterMode,
} from "@/core/git/types";
import type { AITemplateRepoContext } from "@/core/ai/types";
import { RELEASE_CATEGORIES, type GeneratedRelease } from "@/types/release";
import { getProjectForUser } from "./projects.service";
import { saveRelease } from "@/features/releases/releases.service";
import {
  ensureDefaultTemplateForUser,
  getTemplateForUser,
} from "@/features/templates/templates.service";

export interface GenerateProjectReleaseInput {
  projectId: string;
  /** Omit to fall back to the user's default template. */
  templateId?: string;
  /** One PR window applied to every repo in the project. */
  filter: PRFilterMode;
}

export interface ProjectReleaseRepoResult {
  repoFullName: string;
  role: string | null;
  prCount: number;
}

export interface GenerateProjectReleaseResult {
  title: string;
  markdown: string;
  /** section id → drafted content (heading excluded). */
  sections: Record<string, string>;
  windowLabel: string;
  modelUsed: string;
  project: { id: string; name: string };
  template: { id: string; name: string };
  repos: ProjectReleaseRepoResult[];
  /** Used as the stored row's repo anchor (history is single-repo at the DB
   *  level; the full repo set lives on the Project). */
  primaryRepo: { provider: GitProviderKind; owner: string; name: string };
  totalPRs: number;
}

/**
 * Generates a single release document for a *project* — fanning out across all
 * of its repos, gathering merged PRs in the chosen window, then letting the AI
 * fill each template section. Output structure is fixed by the template, so the
 * same project always produces the same shape.
 */
export async function generateProjectReleaseForUser(
  userId: string,
  input: GenerateProjectReleaseInput,
): Promise<GenerateProjectReleaseResult> {
  const project = await getProjectForUser(userId, input.projectId);
  if (!project) throw new Error("Project not found.");
  if (project.repos.length === 0) {
    throw new Error("This project has no repositories yet.");
  }

  const template = input.templateId
    ? await getTemplateForUser(userId, input.templateId)
    : await ensureDefaultTemplateForUser(userId);
  if (!template) throw new Error("Template not found.");
  if (template.sections.length === 0) {
    throw new Error("This template has no sections.");
  }

  const ai = await resolveAiProviderForUser(userId);

  // One git provider per distinct provider kind (a project may mix GitHub +
  // Bitbucket repos), resolved once and reused across that provider's repos.
  const providerKinds = Array.from(
    new Set(project.repos.map((r) => r.provider)),
  );
  const gitByKind = new Map<GitProviderKind, GitProvider>();
  await Promise.all(
    providerKinds.map(async (kind) => {
      gitByKind.set(kind, await resolveGitProviderForUser(userId, kind));
    }),
  );

  // Gather PRs for every repo in parallel.
  const repoContexts = await Promise.all(
    project.repos.map(async (repo): Promise<
      AITemplateRepoContext & { prCount: number }
    > => {
      const git = gitByKind.get(repo.provider)!;
      const prs = await git.listPullRequests({
        owner: repo.owner,
        repo: repo.name,
        filter: input.filter,
      });
      return {
        repoFullName: `${repo.owner}/${repo.name}`,
        role: repo.role,
        prCount: prs.length,
        pullRequests: prs.map((p) => ({
          number: p.number,
          title: p.title,
          body: p.body,
          author: p.author.login ?? p.author.name,
          labels: p.labels,
          mergedAt: p.mergedAt,
        })),
      };
    }),
  );

  const totalPRs = repoContexts.reduce((sum, r) => sum + r.prCount, 0);
  if (totalPRs === 0) {
    throw new Error(
      "No pull requests matched the chosen window across this project's repos.",
    );
  }

  const windowLabel = describeWindow(input.filter);

  const aiOut = await ai.generateFromTemplate({
    projectName: project.name,
    windowLabel,
    repos: repoContexts.map(({ repoFullName, role, pullRequests }) => ({
      repoFullName,
      role,
      pullRequests,
    })),
    sections: template.sections,
  });

  const markdown = buildTemplateMarkdown({
    title: aiOut.title,
    projectName: project.name,
    windowLabel,
    sections: template.sections.map((s) => ({
      heading: s.heading,
      content: aiOut.sections[s.id] ?? "",
    })),
  });

  return {
    title: aiOut.title,
    markdown,
    sections: aiOut.sections,
    windowLabel,
    modelUsed: `${ai.name}:${ai.model}`,
    project: { id: project.id, name: project.name },
    template: { id: template.id, name: template.name },
    repos: repoContexts.map((r) => ({
      repoFullName: r.repoFullName,
      role: r.role,
      prCount: r.prCount,
    })),
    primaryRepo: {
      provider: project.repos[0].provider,
      owner: project.repos[0].owner,
      name: project.repos[0].name,
    },
    totalPRs,
  };
}

export interface SaveProjectReleaseInput {
  projectId: string;
  templateId?: string;
  title: string;
  markdown: string;
  tags?: string[];
  windowLabel: string;
  primaryRepo: { provider: GitProviderKind; owner: string; name: string };
  modelUsed: string;
}

/**
 * Persists a project release. The DB row is single-repo (`ReleaseHistory`), so
 * we anchor it to the project's primary repo and tag it with `projectId`; the
 * full multi-repo context is reconstructable from the linked Project.
 */
export async function saveProjectReleaseForUser(
  userId: string,
  input: SaveProjectReleaseInput,
) {
  const project = await getProjectForUser(userId, input.projectId);
  if (!project) throw new Error("Project not found.");

  return saveRelease(userId, {
    provider: input.primaryRepo.provider,
    owner: input.primaryRepo.owner,
    repo: input.primaryRepo.name,
    base: "—",
    head: input.windowLabel,
    title: input.title,
    markdown: input.markdown,
    tags: input.tags,
    projectId: input.projectId,
    templateId: input.templateId,
    release: {
      title: input.title,
      summary: "",
      notes: emptyNotes(),
      risks: [],
      markdown: input.markdown,
      modelUsed: input.modelUsed,
    },
  });
}

function emptyNotes(): GeneratedRelease["notes"] {
  return Object.fromEntries(
    RELEASE_CATEGORIES.map((c) => [c, []]),
  ) as unknown as GeneratedRelease["notes"];
}

function describeWindow(filter: PRFilterMode): string {
  switch (filter.type) {
    case "last-n":
      return `son ${filter.n} PR${filter.base ? ` → ${filter.base}` : ""}`;
    case "date-range":
      return `${filter.since} – ${filter.until}`;
    case "between-tags":
      return `${filter.baseTag} → ${filter.headTag}`;
  }
}
