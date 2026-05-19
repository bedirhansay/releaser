import type { AIProvider } from "@/core/ai/types";
import type { GitProvider, PRFilterMode, PullRequest } from "@/core/git/types";
import type { GeneratedRelease, RiskFinding, RiskKind } from "@/types/release";
import { categorizeCommit } from "./categorize";
import { detectRisks } from "./risk-detector";
import { buildMarkdown } from "./markdown";

export interface GenerateReleaseInput {
  owner: string;
  repo: string;
  base: string;
  head: string;
}

export interface GenerateFromPRsInput {
  owner: string;
  repo: string;
  filter: PRFilterMode;
}

export interface ReleaseEngineDeps {
  git: GitProvider;
  ai: AIProvider;
}

// Heuristic file pruning: drop generated lockfiles and giant binaries so the
// model isn't flooded with noise. Keep the top-N by churn for the AI prompt.
const NOISY_FILE_PATTERNS = [
  /(^|\/)package-lock\.json$/,
  /(^|\/)pnpm-lock\.yaml$/,
  /(^|\/)yarn\.lock$/,
  /(^|\/)bun\.lockb$/,
  /(^|\/)go\.sum$/,
  /(^|\/)Cargo\.lock$/,
  /(^|\/)Gemfile\.lock$/,
  /\.min\.(js|css)$/,
  /(^|\/)dist\//,
  /(^|\/)build\//,
];

const MAX_FILES_FOR_AI = 60;

export interface ReleaseEnginePRsResult extends GeneratedRelease {
  /** PRs that were considered — useful for the UI to surface what went in. */
  pullRequests: PullRequest[];
}

export class ReleaseEngine {
  private readonly git: GitProvider;
  private readonly ai: AIProvider;

  constructor({ git, ai }: ReleaseEngineDeps) {
    this.git = git;
    this.ai = ai;
  }

  async generate(input: GenerateReleaseInput): Promise<GeneratedRelease> {
    const compare = await this.git.compareBranches(input);

    if (compare.commits.length === 0) {
      throw new Error(
        `No commits between ${input.base} and ${input.head}. Nothing to release.`,
      );
    }

    // Heuristic local pass — categorize and detect risks so we can ship even
    // if the AI step degrades, and so the AI gets pre-digested context.
    const categorized = compare.commits.map((c) => ({
      commit: c,
      category: categorizeCommit(c),
    }));

    const riskHints = detectRisks(compare.files, compare.commits);

    // Prune noisy files and cap to top-N by churn before sending to the model.
    const relevantFiles = compare.files
      .filter((f) => !NOISY_FILE_PATTERNS.some((p) => p.test(f.path)))
      .sort((a, b) => b.additions + b.deletions - (a.additions + a.deletions))
      .slice(0, MAX_FILES_FOR_AI);

    const aiResult = await this.ai.generateReleaseNotes({
      repoFullName: `${input.owner}/${input.repo}`,
      base: input.base,
      head: input.head,
      commits: compare.commits.map((c) => ({
        sha: c.sha,
        message: c.message,
        author: c.author.login ?? c.author.name,
        prNumber: c.prNumber,
      })),
      files: relevantFiles.map((f) => ({
        path: f.path,
        status: f.status,
        additions: f.additions,
        deletions: f.deletions,
      })),
      riskHints,
    });

    // Trust the AI for grouping, but union risks: keep any high-severity local
    // hint the model dropped (defense in depth).
    const mergedRisks = mergeRisks(aiResult.risks, riskHints);

    const markdown = buildMarkdown({
      title: aiResult.title,
      summary: aiResult.summary,
      repoFullName: `${input.owner}/${input.repo}`,
      base: input.base,
      head: input.head,
      notes: aiResult.notes,
      risks: mergedRisks,
    });

    // categorized is currently informational — kept so future code (e.g. UI
    // counts, telemetry) can compare AI vs heuristic grouping cheaply.
    void categorized;

    return {
      title: aiResult.title,
      summary: aiResult.summary,
      notes: aiResult.notes,
      risks: mergedRisks,
      markdown,
      modelUsed: `${this.ai.name}:${this.ai.model}`,
    };
  }

  async generateFromPRs(
    input: GenerateFromPRsInput,
  ): Promise<ReleaseEnginePRsResult> {
    const prs = await this.git.listPullRequests({
      owner: input.owner,
      repo: input.repo,
      filter: input.filter,
    });
    if (prs.length === 0) {
      throw new Error("No merged pull requests matched the chosen window.");
    }

    const windowLabel = describeWindow(input);
    const riskHints = deriveRiskHintsFromPRs(prs);

    const aiResult = await this.ai.generateFromPullRequests({
      repoFullName: `${input.owner}/${input.repo}`,
      windowLabel,
      pullRequests: prs.map((p) => ({
        number: p.number,
        title: p.title,
        body: p.body,
        author: p.author.login ?? p.author.name,
        labels: p.labels,
        mergedAt: p.mergedAt,
      })),
      riskHints,
    });

    const mergedRisks = mergeRisks(aiResult.risks, riskHints);
    const markdown = buildMarkdown({
      title: aiResult.title,
      summary: aiResult.summary,
      repoFullName: `${input.owner}/${input.repo}`,
      base: input.filter.type === "between-tags" ? input.filter.baseTag : "—",
      head:
        input.filter.type === "between-tags"
          ? input.filter.headTag
          : windowLabel,
      notes: aiResult.notes,
      risks: mergedRisks,
    });

    return {
      title: aiResult.title,
      summary: aiResult.summary,
      notes: aiResult.notes,
      risks: mergedRisks,
      markdown,
      modelUsed: `${this.ai.name}:${this.ai.model}`,
      pullRequests: prs,
    };
  }
}

function mergeRisks(
  primary: GeneratedRelease["risks"],
  fallback: GeneratedRelease["risks"],
): GeneratedRelease["risks"] {
  const byKind = new Map(primary.map((r) => [r.kind, r]));
  for (const hint of fallback) {
    const existing = byKind.get(hint.kind);
    if (!existing) {
      byKind.set(hint.kind, hint);
      continue;
    }
    if (hint.severity === "high" && existing.severity !== "high") {
      byKind.set(hint.kind, { ...existing, severity: "high" });
    }
  }
  return Array.from(byKind.values());
}

function stateNoun(state: "merged" | "open" | "all" = "merged"): string {
  if (state === "open") return "open";
  if (state === "all") return "open or merged";
  return "merged";
}

function describeWindow(input: GenerateFromPRsInput): string {
  const { filter } = input;
  switch (filter.type) {
    case "last-n":
      return `last ${filter.n} ${stateNoun(filter.state)} PRs${filter.base ? ` into ${filter.base}` : ""}`;
    case "date-range":
      return `${stateNoun(filter.state)} between ${filter.since} and ${filter.until}${filter.base ? ` into ${filter.base}` : ""}`;
    case "between-tags":
      return `${filter.baseTag} → ${filter.headTag}`;
  }
}

// Match PR labels against domain risk kinds — a free, fast first-pass before
// AI gets the chance to refine.
const LABEL_RISK_MAP: Array<[RegExp, RiskKind, RiskFinding["severity"]]> = [
  [/auth|sso|oauth|jwt|session|login|password/i, "auth", "high"],
  [/db|database|migration|schema|prisma|sql/i, "database", "high"],
  [/payment|billing|stripe|invoice|subscription/i, "payment", "high"],
  [/config|env|infra|deploy|terraform|ci|build/i, "config", "medium"],
];

function deriveRiskHintsFromPRs(prs: PullRequest[]): RiskFinding[] {
  const byKind = new Map<RiskKind, RiskFinding>();
  for (const pr of prs) {
    for (const label of pr.labels) {
      for (const [pattern, kind, severity] of LABEL_RISK_MAP) {
        if (!pattern.test(label)) continue;
        const existing = byKind.get(kind);
        if (existing) {
          if (!existing.evidence.includes(`#${pr.number}`)) {
            existing.evidence.push(`#${pr.number}`);
          }
        } else {
          byKind.set(kind, {
            kind,
            severity,
            summary: `${label} change`,
            evidence: [`#${pr.number}`],
          });
        }
      }
    }
  }
  return Array.from(byKind.values());
}
