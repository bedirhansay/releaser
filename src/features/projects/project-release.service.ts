import { resolveAiProviderForOrg } from "@/features/settings/ai-settings.service";
import { resolveGitProviderForOrg } from "@/core/git/resolve-provider";
import {
  buildTemplateMarkdown,
  type RelevantPR,
} from "@/core/release/markdown";
import type { SessionContext } from "@/shared/api/require-session";
import type {
  GitProvider,
  GitProviderKind,
  PRFilterMode,
} from "@/core/git/types";
import type { AITemplateRepoContext } from "@/core/ai/types";
import { RELEASE_CATEGORIES, type GeneratedRelease } from "@/types/release";
import { getProjectForOrg } from "./projects.service";
import { saveRelease } from "@/features/releases/releases.service";
import {
  ensureDefaultTemplateForOrg,
  getTemplateForOrg,
} from "@/features/templates/templates.service";

export interface GenerateProjectReleaseInput {
  projectId: string;
  /** Omit to fall back to the user's default template. */
  templateId?: string;
  /** One PR window applied to every repo in the project. */
  filter: PRFilterMode;
  /**
   * Per-release overrides for the deterministic header. Sign-off + risk are a
   * release-level responsibility (each release can differ), prefilled from the
   * project defaults but set here at generation time.
   */
  meta?: {
    version?: string;
    date?: string;
    risk?: string;
    signOff?: string;
  };
}

/** Version hint from the window when generating between two tags. */
function versionFromFilter(filter: PRFilterMode): string | undefined {
  return filter.type === "between-tags" ? filter.headTag : undefined;
}

/**
 * Renders an ISO "YYYY-MM-DD" date as Turkish "DD.MM.YYYY" for the doc meta.
 * Passes through anything that isn't a clean ISO date untouched.
 */
function formatTrDate(value: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim());
  return m ? `${m[3]}.${m[2]}.${m[1]}` : value;
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
export async function generateProjectReleaseForOrg(
  ctx: SessionContext,
  input: GenerateProjectReleaseInput,
): Promise<GenerateProjectReleaseResult> {
  const project = await getProjectForOrg(ctx, input.projectId);
  if (!project) throw new Error("Project not found.");
  if (project.repos.length === 0) {
    throw new Error("This project has no repositories yet.");
  }

  const template = input.templateId
    ? await getTemplateForOrg(ctx.orgId, input.templateId)
    : await ensureDefaultTemplateForOrg(ctx.orgId, ctx.userId);
  if (!template) throw new Error("Template not found.");
  if (template.sections.length === 0) {
    throw new Error("This template has no sections.");
  }

  const ai = await resolveAiProviderForOrg(ctx.orgId);

  // One git provider per distinct provider kind (a project may mix GitHub +
  // Bitbucket repos), resolved once and reused across that provider's repos.
  const providerKinds = Array.from(
    new Set(project.repos.map((r) => r.provider)),
  );
  const gitByKind = new Map<GitProviderKind, GitProvider>();
  await Promise.all(
    providerKinds.map(async (kind) => {
      gitByKind.set(kind, await resolveGitProviderForOrg(ctx.orgId, kind));
    }),
  );

  // Gather PRs for every repo in parallel.
  const repoContexts = await Promise.all(
    project.repos.map(async (repo): Promise<
      AITemplateRepoContext & { prCount: number; prLinks: RelevantPR[] }
    > => {
      const git = gitByKind.get(repo.provider)!;
      const repoFullName = `${repo.owner}/${repo.name}`;
      const prs = await git.listPullRequests({
        owner: repo.owner,
        repo: repo.name,
        filter: input.filter,
      });
      return {
        repoFullName,
        role: repo.role,
        prCount: prs.length,
        // Real PR links for the deterministic "Relevant PRs" block.
        prLinks: prs.map((p) => ({
          repoFullName,
          number: p.number,
          title: p.title,
          url: p.url,
        })),
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

  // Prefer a clean "{product} {version}" title when a version is supplied,
  // so the title never embeds the PR window. Falls back to the AI title.
  const releaseTitle = input.meta?.version
    ? `${project.name} ${input.meta.version}`
    : aiOut.title;

  const relevantPRs = repoContexts.flatMap((r) => r.prLinks);
  const markdown = buildTemplateMarkdown({
    title: releaseTitle,
    projectName: project.name,
    windowLabel,
    sections: template.sections.map((s) => ({
      heading: s.heading,
      content: aiOut.sections[s.id] ?? "",
    })),
    meta: {
      product: project.name,
      version: input.meta?.version ?? versionFromFilter(input.filter),
      date: input.meta?.date
        ? formatTrDate(input.meta.date)
        : new Date().toLocaleDateString("tr-TR"),
      risk: input.meta?.risk ?? project.defaultRisk,
    },
    // Release-level responsibility: per-release sign-off overrides the project
    // default template; monitoring stays a project constant.
    signOff: input.meta?.signOff ?? project.signOff,
    monitoring: project.monitoringLinks,
    relevantPRs,
  });

  return {
    title: releaseTitle,
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
export async function saveProjectReleaseForOrg(
  ctx: SessionContext,
  input: SaveProjectReleaseInput,
) {
  const project = await getProjectForOrg(ctx, input.projectId);
  if (!project) throw new Error("Project not found.");

  return saveRelease(ctx, {
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
