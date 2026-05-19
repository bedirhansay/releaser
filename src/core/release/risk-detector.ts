import type { ChangedFile, Commit } from "@/core/git/types";
import type { RiskFinding, RiskKind } from "@/types/release";

interface RiskRule {
  kind: RiskKind;
  severity: RiskFinding["severity"];
  summary: string;
  matchPath?: RegExp;
  matchMessage?: RegExp;
}

const RULES: RiskRule[] = [
  // --- auth ---
  {
    kind: "auth",
    severity: "high",
    summary: "Authentication / session handling changes detected",
    matchPath: /(auth|session|jwt|oauth|login|signin|signup|password)/i,
  },
  {
    kind: "auth",
    severity: "medium",
    summary: "Commit message mentions auth-related changes",
    matchMessage: /\b(auth|oauth|jwt|session|login|password|2fa|mfa)\b/i,
  },

  // --- database ---
  {
    kind: "database",
    severity: "high",
    summary: "Database migration files changed",
    matchPath:
      /(migrations?\/|prisma\/schema\.prisma$|knex.*migrations|alembic\/versions|liquibase|flyway\/sql)/i,
  },
  {
    kind: "database",
    severity: "medium",
    summary: "Schema or ORM model changes detected",
    matchPath: /(schema\.|models?\.|entities?\/|repositories?\/)/i,
  },

  // --- payment ---
  {
    kind: "payment",
    severity: "high",
    summary: "Payment / billing code touched",
    matchPath: /(payment|billing|stripe|paypal|checkout|invoice|subscription)/i,
  },
  {
    kind: "payment",
    severity: "medium",
    summary: "Commit message mentions payment / billing",
    matchMessage: /\b(payment|billing|stripe|paypal|invoice|subscription)\b/i,
  },

  // --- config ---
  {
    kind: "config",
    severity: "medium",
    summary: "Environment / configuration files changed",
    matchPath:
      /(^|\/)(\.env|\.env\.|env\.example|config\/|next\.config|tsconfig|docker|Dockerfile|\.ya?ml$|terraform|helm)/i,
  },
  {
    kind: "config",
    severity: "low",
    summary: "Build / CI configuration touched",
    matchPath: /(\.github\/workflows|circleci|gitlab-ci|jenkins|Makefile|turbo\.json)/i,
  },
];

const SEVERITY_RANK: Record<RiskFinding["severity"], number> = {
  low: 1,
  medium: 2,
  high: 3,
};

function pickHigher(a: RiskFinding["severity"], b: RiskFinding["severity"]) {
  return SEVERITY_RANK[a] >= SEVERITY_RANK[b] ? a : b;
}

export function detectRisks(
  files: ChangedFile[],
  commits: Commit[],
): RiskFinding[] {
  // Aggregate per-kind so we don't emit a finding per file.
  const byKind = new Map<RiskKind, RiskFinding>();

  const upsert = (kind: RiskKind, finding: Omit<RiskFinding, "evidence"> & { evidence: string }) => {
    const existing = byKind.get(kind);
    if (!existing) {
      byKind.set(kind, {
        kind,
        severity: finding.severity,
        summary: finding.summary,
        evidence: [finding.evidence],
      });
      return;
    }
    if (!existing.evidence.includes(finding.evidence)) {
      existing.evidence.push(finding.evidence);
    }
    existing.severity = pickHigher(existing.severity, finding.severity);
    if (existing.evidence.length > 1) {
      existing.summary = finding.summary; // keep the latest high-severity summary
    }
  };

  for (const file of files) {
    for (const rule of RULES) {
      if (rule.matchPath?.test(file.path)) {
        upsert(rule.kind, {
          kind: rule.kind,
          severity: rule.severity,
          summary: rule.summary,
          evidence: file.path,
        });
      }
    }
  }

  for (const commit of commits) {
    const firstLine = commit.message.split("\n")[0];
    for (const rule of RULES) {
      if (rule.matchMessage?.test(firstLine)) {
        upsert(rule.kind, {
          kind: rule.kind,
          severity: rule.severity,
          summary: rule.summary,
          evidence: commit.shortSha,
        });
      }
    }
  }

  // Cap evidence list — long lists are noisy in the UI and prompt.
  for (const finding of byKind.values()) {
    if (finding.evidence.length > 12) {
      finding.evidence = [...finding.evidence.slice(0, 12), "…"];
    }
  }

  return Array.from(byKind.values()).sort(
    (a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity],
  );
}
