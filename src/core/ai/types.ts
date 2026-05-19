import type { CategorizedReleaseNotes, RiskFinding } from "@/types/release";

export interface AIReleaseInput {
  repoFullName: string;
  base: string;
  head: string;
  // Pre-categorized, deduped commit summaries — keep tokens lean.
  commits: Array<{
    sha: string;
    message: string;
    author: string | null;
    prNumber?: number;
  }>;
  // High-signal subset of changed files (paths + scale).
  files: Array<{
    path: string;
    status: string;
    additions: number;
    deletions: number;
  }>;
  // Heuristic risk hints already detected; the model should refine these.
  riskHints: RiskFinding[];
}

export interface AIPRsInput {
  repoFullName: string;
  // Human label for the window — "v1.0.0 → main", "last 25 PRs",
  // "2026-04-01 to 2026-05-01". Helps the model frame the release.
  windowLabel: string;
  pullRequests: Array<{
    number: number;
    title: string;
    body: string | null;
    author: string | null;
    labels: string[];
    mergedAt: string | null;
  }>;
  riskHints: RiskFinding[];
}

export interface AIReleaseOutput {
  title: string;
  summary: string;
  notes: CategorizedReleaseNotes;
  risks: RiskFinding[];
}

export interface AIProvider {
  readonly name: string;
  readonly model: string;
  generateReleaseNotes(input: AIReleaseInput): Promise<AIReleaseOutput>;
  generateFromPullRequests(input: AIPRsInput): Promise<AIReleaseOutput>;
}
