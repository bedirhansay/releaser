import {
  RELEASE_CATEGORIES,
  type CategorizedReleaseNotes,
  type ReleaseEntry,
  type RiskFinding,
} from "@/types/release";

const CATEGORY_LABELS: Record<(typeof RELEASE_CATEGORIES)[number], string> = {
  features: "✨ Features",
  fixes: "🐛 Fixes",
  refactors: "♻️ Refactors",
  performance: "⚡ Performance",
  security: "🔒 Security",
  breaking: "💥 Breaking Changes",
  docs: "📝 Docs",
  chore: "🧹 Chore",
};

const RISK_LABELS: Record<RiskFinding["kind"], string> = {
  auth: "🔐 Auth",
  database: "🗄️ Database",
  payment: "💳 Payment",
  config: "⚙️ Config",
};

const SEVERITY_BADGE: Record<RiskFinding["severity"], string> = {
  low: "`low`",
  medium: "`medium`",
  high: "`high`",
};

function renderEntry(entry: ReleaseEntry): string {
  const refs = [
    ...entry.commitShas.map((s) => `\`${s.slice(0, 7)}\``),
    ...(entry.prNumbers?.map((n) => `#${n}`) ?? []),
  ];
  const tail = refs.length ? ` (${refs.join(", ")})` : "";
  const body = entry.description ? `\n  ${entry.description}` : "";
  return `- **${entry.title}**${tail}${body}`;
}

export interface BuildMarkdownInput {
  title: string;
  summary: string;
  repoFullName: string;
  base: string;
  head: string;
  notes: CategorizedReleaseNotes;
  risks: RiskFinding[];
}

export function buildMarkdown(input: BuildMarkdownInput): string {
  const lines: string[] = [];
  lines.push(`# ${input.title}`);
  lines.push("");
  lines.push(
    `_${input.repoFullName} · \`${input.base}\` → \`${input.head}\`_`,
  );
  lines.push("");
  if (input.summary) {
    lines.push(input.summary);
    lines.push("");
  }

  for (const category of RELEASE_CATEGORIES) {
    const entries = input.notes[category] ?? [];
    if (!entries.length) continue;
    lines.push(`## ${CATEGORY_LABELS[category]}`);
    lines.push("");
    for (const entry of entries) lines.push(renderEntry(entry));
    lines.push("");
  }

  if (input.risks.length) {
    lines.push(`## ⚠️ Risk Analysis`);
    lines.push("");
    for (const risk of input.risks) {
      const evidence = risk.evidence.length
        ? ` — _${risk.evidence.join(", ")}_`
        : "";
      lines.push(
        `- ${RISK_LABELS[risk.kind]} ${SEVERITY_BADGE[risk.severity]} — ${risk.summary}${evidence}`,
      );
    }
    lines.push("");
  }

  return lines.join("\n").trimEnd() + "\n";
}
