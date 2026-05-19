// Shared domain types used across core/, infrastructure/ and the UI.

export const RELEASE_CATEGORIES = [
  "features",
  "fixes",
  "refactors",
  "performance",
  "security",
  "breaking",
  "docs",
  "chore",
] as const;

export type ReleaseCategory = (typeof RELEASE_CATEGORIES)[number];

export const RISK_KINDS = [
  "auth",
  "database",
  "payment",
  "config",
] as const;

export type RiskKind = (typeof RISK_KINDS)[number];

export interface RiskFinding {
  kind: RiskKind;
  severity: "low" | "medium" | "high";
  summary: string;
  evidence: string[]; // e.g. file paths or commit shas
}

export interface ReleaseEntry {
  title: string;
  description?: string;
  commitShas: string[];
  prNumbers?: number[];
}

export type CategorizedReleaseNotes = Record<ReleaseCategory, ReleaseEntry[]>;

export interface GeneratedRelease {
  title: string;
  summary: string;
  notes: CategorizedReleaseNotes;
  risks: RiskFinding[];
  markdown: string;
  modelUsed: string;
}
