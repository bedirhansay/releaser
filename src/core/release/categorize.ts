import type { Commit } from "@/core/git/types";
import type { ReleaseCategory } from "@/types/release";

// Conventional-commits + heuristic prefix matching. Returns a best-effort
// category; the AI provider gets the final say on grouping.
const CATEGORY_PATTERNS: Array<[ReleaseCategory, RegExp]> = [
  ["breaking", /^(?:[a-z]+(?:\([^)]+\))?!:|BREAKING CHANGE)/i],
  ["features", /^(?:feat|feature)(?:\([^)]+\))?:/i],
  ["fixes", /^fix(?:\([^)]+\))?:/i],
  ["performance", /^perf(?:\([^)]+\))?:/i],
  ["security", /^(?:sec|security)(?:\([^)]+\))?:/i],
  ["refactors", /^(?:refactor|refac)(?:\([^)]+\))?:/i],
  ["docs", /^docs(?:\([^)]+\))?:/i],
  ["chore", /^(?:chore|build|ci|test|style)(?:\([^)]+\))?:/i],
];

const KEYWORD_FALLBACK: Array<[ReleaseCategory, RegExp]> = [
  ["fixes", /\b(fix|bug|hotfix|patch)\b/i],
  ["features", /\b(add|introduce|implement|new)\b/i],
  ["performance", /\b(perf|optimi[sz]e|speed up|faster)\b/i],
  ["security", /\b(vuln|cve|exploit|sanitiz|escape|xss|csrf)\b/i],
  ["refactors", /\b(refactor|cleanup|rename|simplif)\b/i],
  ["docs", /\b(docs|readme|comment)\b/i],
];

export function categorizeCommit(commit: Commit): ReleaseCategory {
  const firstLine = commit.message.split("\n")[0];
  for (const [cat, pattern] of CATEGORY_PATTERNS) {
    if (pattern.test(firstLine)) return cat;
  }
  for (const [cat, pattern] of KEYWORD_FALLBACK) {
    if (pattern.test(firstLine)) return cat;
  }
  return "chore";
}
