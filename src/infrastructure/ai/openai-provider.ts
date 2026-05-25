import OpenAI from "openai";
import { z } from "zod";
import type {
  AIPRsInput,
  AIProvider,
  AIReleaseInput,
  AIReleaseOutput,
  AITemplateInput,
  AITemplateOutput,
} from "@/core/ai/types";
import { RELEASE_CATEGORIES, RISK_KINDS } from "@/types/release";

// Models sometimes drop fields or use slightly different naming. The schema
// below is intentionally lenient: every nullable/optional field has a sane
// default so a partially-correct response still produces usable output.
const releaseEntrySchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  commitShas: z.array(z.string()).optional().default([]),
  prNumbers: z.array(z.number()).optional(),
});

const notesSchema = z
  .object(
    Object.fromEntries(
      RELEASE_CATEGORIES.map((c) => [
        c,
        z.array(releaseEntrySchema).optional().default([]),
      ]),
    ) as Record<
      (typeof RELEASE_CATEGORIES)[number],
      z.ZodDefault<z.ZodOptional<z.ZodArray<typeof releaseEntrySchema>>>
    >,
  )
  .optional()
  .default(() =>
    Object.fromEntries(RELEASE_CATEGORIES.map((c) => [c, []])) as Record<
      (typeof RELEASE_CATEGORIES)[number],
      []
    >,
  );

const riskSchema = z.object({
  kind: z.enum(RISK_KINDS),
  severity: z.enum(["low", "medium", "high"]).optional().default("medium"),
  // Tolerate the model dropping `summary` — fall back to a generic note.
  summary: z.string().optional().default("Risk detected (no summary)"),
  evidence: z.array(z.string()).optional().default([]),
});

const releaseResponseSchema = z.object({
  title: z.string().optional().default("Release"),
  summary: z.string().optional().default(""),
  notes: notesSchema,
  risks: z.array(riskSchema).optional().default([]),
});

const SYSTEM_PROMPT = `You are a senior release manager generating professional, customer-facing release notes from a structured Git change summary.

Rules:
- Be precise and developer-focused. Avoid marketing fluff.
- Group entries into the provided categories. Omit empty categories from your reasoning but still return them in the response (empty arrays are OK).
- Prefer one entry per logical change, not per commit. Group related commits together using their SHAs.
- Title must be short and punchy (max ~80 chars).
- Summary: 2-3 sentence overview.
- For risks: only include items with clear evidence in the diff. Every risk MUST have a non-empty "summary".
- Respond with JSON ONLY matching the schema below — no prose, no markdown fences.

The response MUST be a single JSON object with EXACTLY these fields:
{
  "title": "string (required)",
  "summary": "string (required, 2-3 sentences)",
  "notes": {
    "features":    [{ "title": "string", "description": "string?", "commitShas": ["sha"], "prNumbers": [123] }],
    "fixes":       [...same shape...],
    "refactors":   [...],
    "performance": [...],
    "security":    [...],
    "breaking":    [...],
    "docs":        [...],
    "chore":       [...]
  },
  "risks": [
    { "kind": "auth|database|payment|config",
      "severity": "low|medium|high",
      "summary": "string (REQUIRED, non-empty)",
      "evidence": ["file path or commit sha"] }
  ]
}

Use empty arrays for categories with no entries. Use [] for risks if none. Never omit the "notes" or "risks" keys.`;

function buildUserPrompt(input: AIReleaseInput): string {
  const commitLines = input.commits
    .map(
      (c) =>
        `- ${c.sha.slice(0, 7)}${c.prNumber ? ` (#${c.prNumber})` : ""} — ${c.message.split("\n")[0]}${c.author ? ` [${c.author}]` : ""}`,
    )
    .join("\n");
  const fileLines = input.files
    .map(
      (f) =>
        `- ${f.path} (${f.status}, +${f.additions}/-${f.deletions})`,
    )
    .join("\n");
  const riskLines = input.riskHints.length
    ? input.riskHints
        .map(
          (r) =>
            `- ${r.kind}/${r.severity}: ${r.summary} (evidence: ${r.evidence.join(", ")})`,
        )
        .join("\n")
    : "(none auto-detected)";

  return [
    `Repository: ${input.repoFullName}`,
    `Comparing: ${input.base}...${input.head}`,
    ``,
    `Commits (${input.commits.length}):`,
    commitLines || "(none)",
    ``,
    `Changed files (${input.files.length}):`,
    fileLines || "(none)",
    ``,
    `Heuristic risk hints:`,
    riskLines,
    ``,
    `Categories to use: ${RELEASE_CATEGORIES.join(", ")}.`,
    `Risk kinds: ${RISK_KINDS.join(", ")}.`,
  ].join("\n");
}

// Works with OpenAI itself AND any OpenAI-compatible endpoint:
//   - GLM (Zhipu)     → AI_BASE_URL=https://open.bigmodel.cn/api/paas/v4
//   - DeepSeek        → AI_BASE_URL=https://api.deepseek.com/v1
//   - Together / Groq → their respective base URLs
//   - Local Ollama    → AI_BASE_URL=http://localhost:11434/v1
// Set AI_API_KEY + AI_MODEL accordingly. OPENAI_* env names are still honored
// as fallbacks for plain OpenAI deployments.
export class OpenAIProvider implements AIProvider {
  readonly name: string;
  readonly model: string;
  private readonly client: OpenAI;

  constructor(opts?: { apiKey?: string; model?: string; baseURL?: string; name?: string }) {
    const apiKey =
      opts?.apiKey ?? process.env.AI_API_KEY ?? process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("AI_API_KEY (or OPENAI_API_KEY) is not set");
    }
    const baseURL =
      opts?.baseURL ?? process.env.AI_BASE_URL ?? process.env.OPENAI_BASE_URL;
    this.client = new OpenAI({ apiKey, baseURL });
    this.model =
      opts?.model ??
      process.env.AI_MODEL ??
      process.env.OPENAI_MODEL ??
      "gpt-4o-mini";
    this.name = opts?.name ?? (baseURL ? "openai-compatible" : "openai");
  }

  async generateReleaseNotes(input: AIReleaseInput): Promise<AIReleaseOutput> {
    return this.complete(SYSTEM_PROMPT, buildUserPrompt(input));
  }

  async generateFromPullRequests(
    input: AIPRsInput,
  ): Promise<AIReleaseOutput> {
    return this.complete(SYSTEM_PROMPT, buildPRsUserPrompt(input));
  }

  async generateFromTemplate(
    input: AITemplateInput,
  ): Promise<AITemplateOutput> {
    const completion = await this.client.chat.completions.create({
      model: this.model,
      response_format: { type: "json_object" },
      temperature: 0.3,
      messages: [
        { role: "system", content: TEMPLATE_SYSTEM_PROMPT },
        { role: "user", content: buildTemplateUserPrompt(input) },
      ],
    });

    const raw = completion.choices[0]?.message?.content;
    if (!raw) throw new Error("AI returned an empty response");

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error("AI returned non-JSON response");
    }

    const result = templateResponseSchema.safeParse(parsed);
    if (!result.success) {
      throw new Error(
        `AI template response failed validation: ${result.error.message}`,
      );
    }

    // Guarantee every requested section has an entry, even if the model
    // skipped one — keeps the rendered document structurally complete.
    const sections: Record<string, string> = {};
    for (const spec of input.sections) {
      sections[spec.id] = result.data.sections[spec.id]?.trim() || "_—_";
    }
    return { title: result.data.title, sections };
  }

  private async complete(
    system: string,
    user: string,
  ): Promise<AIReleaseOutput> {
    const completion = await this.client.chat.completions.create({
      model: this.model,
      response_format: { type: "json_object" },
      temperature: 0.2,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    });

    const raw = completion.choices[0]?.message?.content;
    if (!raw) throw new Error("AI returned an empty response");

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error("AI returned non-JSON response");
    }

    const result = releaseResponseSchema.safeParse(parsed);
    if (!result.success) {
      throw new Error(
        `AI response failed validation: ${result.error.message}`,
      );
    }
    return result.data as AIReleaseOutput;
  }
}

// ─── Template-driven, multi-repo generation ──────────────────────────────────

const templateResponseSchema = z.object({
  title: z.string().optional().default("Release"),
  // The model returns a map of sectionId → markdown content. Be lenient:
  // missing sections are backfilled by the caller.
  sections: z.record(z.string(), z.string()).optional().default({}),
});

const TEMPLATE_SYSTEM_PROMPT = `You are a senior release manager. You write a structured release document for a product that may span MULTIPLE repositories (e.g. a backend and a frontend), grouped under one project.

You are given:
- The project name and the release window.
- For each repository: its role (backend / frontend / …) and the merged pull requests in scope.
- An ORDERED list of template sections. Each section has an "id", a "heading", and an "instruction" describing exactly what to write there.

Rules:
- Write content for EVERY section id, following that section's instruction precisely.
- Content is GitHub-flavoured Markdown WITHOUT the heading itself (the caller adds the heading). Use sub-bullets, tables, bold as the instruction implies.
- Attribute changes to the right repository/role when relevant (e.g. group Backend vs Frontend).
- Reference PRs as #<number> where useful. Be precise and developer-focused; avoid marketing fluff.
- For fields you cannot infer from the changes (version numbers, sign-off names, dates, monitoring links), produce sensible PLACEHOLDERS the user can edit (e.g. _([isim])_, vYYYY-MM-DD, TODO).
- Respond with JSON ONLY — no prose, no markdown fences.

The response MUST be a single JSON object:
{
  "title": "string — short release title",
  "sections": { "<sectionId>": "markdown content for that section", ... }
}
Include an entry for every section id you were given.`;

function buildTemplateUserPrompt(input: AITemplateInput): string {
  const MAX_BODY = 500;
  const repoBlocks = input.repos
    .map((r) => {
      const prLines = r.pullRequests.length
        ? r.pullRequests
            .map((p) => {
              const body = p.body
                ? p.body.length > MAX_BODY
                  ? `${p.body.slice(0, MAX_BODY)}…`
                  : p.body
                : "";
              const labels = p.labels.length
                ? ` [labels: ${p.labels.join(", ")}]`
                : "";
              const author = p.author ? ` by @${p.author}` : "";
              return `  - #${p.number}: ${p.title}${author}${labels}${
                body ? `\n      ${body.replace(/\n+/g, " ")}` : ""
              }`;
            })
            .join("\n")
        : "  (no merged PRs in window)";
      return `Repository: ${r.repoFullName}${
        r.role ? ` (role: ${r.role})` : ""
      }\n${prLines}`;
    })
    .join("\n\n");

  const sectionLines = input.sections
    .map((s, i) => `${i + 1}. id="${s.id}" — ${s.heading}\n   → ${s.instruction}`)
    .join("\n");

  return [
    `Project: ${input.projectName}`,
    `Release window: ${input.windowLabel}`,
    ``,
    `=== Repositories & changes ===`,
    repoBlocks,
    ``,
    `=== Sections to write (in order) ===`,
    sectionLines,
  ].join("\n");
}

function buildPRsUserPrompt(input: AIPRsInput): string {
  // Truncate each PR body so a single huge description can't blow our token
  // budget — keep enough for context but not the whole essay.
  const MAX_BODY = 600;
  const prLines = input.pullRequests
    .map((p) => {
      const body = p.body
        ? p.body.length > MAX_BODY
          ? `${p.body.slice(0, MAX_BODY)}…`
          : p.body
        : "";
      const labels = p.labels.length ? ` [labels: ${p.labels.join(", ")}]` : "";
      const author = p.author ? ` by @${p.author}` : "";
      return `### PR #${p.number}: ${p.title}${author}${labels}\n${body}`.trim();
    })
    .join("\n\n");
  const riskLines = input.riskHints.length
    ? input.riskHints
        .map(
          (r) =>
            `- ${r.kind}/${r.severity}: ${r.summary} (evidence: ${r.evidence.join(", ")})`,
        )
        .join("\n")
    : "(none auto-detected)";

  return [
    `Repository: ${input.repoFullName}`,
    `Window: ${input.windowLabel}`,
    `Pull requests in scope (${input.pullRequests.length}):`,
    "",
    prLines || "(none)",
    "",
    `Heuristic risk hints (from labels):`,
    riskLines,
    "",
    `Categories to use: ${RELEASE_CATEGORIES.join(", ")}.`,
    `Risk kinds: ${RISK_KINDS.join(", ")}.`,
    "",
    "Each release-note entry should correspond to ONE PR (or group strongly-related PRs).",
    "Always populate prNumbers with the source PR numbers; leave commitShas empty for PR-based releases.",
  ].join("\n");
}
