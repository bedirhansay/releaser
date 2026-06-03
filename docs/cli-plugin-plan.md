# Releaser CLI + Claude Plugin — Plan

Goal: take everything the web app does for **release generation** and make it usable
from the terminal (CLI) **and** as a global **Claude plugin** — with **no database**.
Releases are `.md` files written into the project directory; config is a local file.

---

## 1. Guiding decisions (agreed)

- **No DB.** Output = `.md` files in the repo (`releases/<version>.md`), versioned in git.
  Optional `releases/index.json` for a quick list. Config = a local file.
- **Local-git first.** Default data source is the cloned repo (`git log base..head`),
  so it works offline, needs no token, and sidesteps provider API limits (Bitbucket 410).
  Provider PR data (richer: titles/labels/bodies) is **opt-in** when a token is present.
- **Two modes, one core:**
  - **Claude plugin** → Claude itself writes the narrative (no AI key, no cost).
  - **Standalone CLI** → BYO OpenAI-compatible key for CI / non-Claude use.
- **Reuse the finsel template format** (same section JSON the web app uses).
- **Multi-project / arbitrary repo set → one release** (easier than the web's one-project model).
- **Auth surface ≈ zero.** The web app's Auth.js / org / RBAC / Bitbucket OAuth consumer /
  GitHub App machinery existed only because it is multi-tenant SaaS. A single-user local tool
  needs none of it. The only credential is the **Claude/Anthropic token you already have**
  (and in plugin mode even that is managed by Claude Code). Local git needs no token at all.
  A provider token is **optional** — only if you want rich PR data (titles/labels/bodies)
  instead of plain commit messages.

## 2. What transfers vs. what changes

| Web feature | CLI / Plugin |
| --- | --- |
| Multi-repo project → one release | ✅ config "project" = list of repos |
| **2 projects → one release** | ✅ `--project web --project api` (or `--repos a,b,c`) |
| Finsel template (sections/headings/instructions) | ✅ same JSON, in `.releaser/templates/` |
| PR window (last-N / date / tags) | ✅ `--last`, `--since/--until`, `--tag v1..v2` |
| Meta (product/version/date/risk), sign-off, monitoring, Relevant PRs | ✅ config defaults + flags |
| Provider PRs (GitHub/Bitbucket) | ✅ opt-in via token; else local git commits |
| AI drafting | ✅ Claude (plugin) or BYO key (CLI) |
| Edit / preview loop | CLI: edit the output file · Plugin: refine by chatting |
| **History + search UI** | → `.md` files in `releases/` (git history) + optional index.json |
| **Org / RBAC / teams / access** | ❌ dropped — single-user local tool, not needed |
| Saved projects/templates in DB | → `releaser.config.json` + `.releaser/templates/*.json` |

Net: all **generation** capability transfers; only the **SaaS shell** (multi-tenant
org/RBAC, DB-backed history UI) is dropped because it's meaningless locally.

## 3. Architecture — extract a shared core

Turn the repo into a small workspace; the web app and CLI share one engine.

```
packages/
  core/                 # framework-agnostic engine (no Next, no Prisma)
    git/                # provider interfaces + types (from src/core/git)
    providers/          # github, bitbucket clients (from src/infrastructure/*)
    local-git/          # NEW: read commits/tags from the local repo
    ai/                 # template-driven drafting (from src/core/ai)
    release/            # markdown.ts, template types, meta/sign-off/PRs
    template/           # finsel template + parser
apps/
  web/                  # the existing Next.js app (uses packages/core)
  cli/                  # NEW: the `releaser` binary
plugin/                 # NEW: Claude Code plugin (skill + command + scripts)
```

`packages/core` is the single source of truth. Web keeps its DB/org/UI on top;
CLI/plugin add a thin config + git layer. (If a full monorepo is too heavy to start,
phase 1 can keep core inside the current repo and just add `apps/cli`.)

## 4. Config (no DB)

`releaser.config.json` at repo root (created by `releaser init`):

```jsonc
{
  "product": "finsel",
  "defaultTemplate": ".releaser/templates/finsel.json",
  "outDir": "releases",
  "ai": { "provider": "claude" },         // or "openai" + env key for CI
  "meta": {
    "defaultRisk": "MEDIUM",
    "monitoring": ["Sentry: https://…", "Grafana: https://…"],
    "signOff": ["Code Owner: ", "QA: ", "Management: "]
  },
  "projects": {
    "web":  { "repos": [{ "provider": "local", "path": "." }] },
    "api":  { "repos": [{ "provider": "bitbucket", "owner": "releaser-mersel", "name": "api" }] }
  }
}
```

Templates live as JSON (identical shape to the web app's `TemplateSection[]`).

## 5. CLI surface

```
releaser init                       # scaffold config + finsel template
releaser generate [options]         # main command
releaser list                       # list releases/*.md (+ index.json)
```

`generate` options:
- Repos:   `--project <name>` (repeatable) | `--repo owner/name` (repeatable) | default = cwd repo
- Provider: `--provider local|github|bitbucket` (default local)
- Window:  `--tag v1..v2` | `--since YYYY-MM-DD --until YYYY-MM-DD` | `--last N`
- Doc:     `--template <path>` `--version <v>` `--date <d>` `--risk <r>` `--sign-off <...>`
- Output:  `--out <path>` (default `releases/<version>.md`) · `--json` · `--stdout`
- AI:      `--ai claude|openai` · `--no-ai` (deterministic skeleton only)
- Flow:    interactive by default; `--yes` = non-interactive (CI)

Defaults mirror the web app: version `v<today>`, date today, window = last 14 days.

## 6. Interactivity (the "selecting PRs" question)

- **CLI interactive**: when no window/repo flags, prompt with arrow-key menus
  (pick repos, pick window, multiselect PRs to include/exclude) — like `gh`.
- **CLI non-interactive** (`--yes` / flags): no prompts, ideal for CI.
- **Claude plugin**: selection becomes conversation — Claude lists the found PRs,
  you say "drop the chores, move X to Breaking, add Kaan to sign-off", it redrafts.

## 7. Claude plugin shape ("global plugin")

```
plugin/
  .claude-plugin/plugin.json        # manifest (name, version, components)
  commands/release.md               # slash command  ->  /release
  skills/release-notes/SKILL.md     # instructions + finsel template + how-to
  scripts/gather.mjs                # DETERMINISTIC: git window, PR links, meta skeleton
  (optional) mcp/server.mjs         # exposes generate_release tool (Claude Desktop)
```

Flow when you run `/release` (or just ask Claude in natural language):
1. `gather.mjs` runs deterministically → collects commits/PRs in the window,
   builds the meta header + real "Relevant PRs" links + the template skeleton (JSON/MD).
2. **Claude** fills the narrative sections per the finsel template (no API key — Claude is the LLM).
3. You refine by chatting; Claude writes the final `.md` into your project dir.

Install globally (e.g. `~/.claude` or a marketplace) → available in **every repo**.
The exact manifest/marketplace format will be verified against the Claude Code docs
before building.

## 8. Distribution

- CLI: `package.json` `bin` → `releaser` (publish to npm, or `npx`).
- Plugin: global Claude Code plugin (own repo recommended if publishing to a marketplace;
  can also live here under `plugin/`).

## 9. Phased rollout

- **Phase 1 — core + CLI (local-git, BYO key).** Extract engine, `releaser init/generate`,
  local-git window, finsel template, writes `.md`. Multi-repo + multi-project. CI-friendly (`--yes`).
- **Phase 2 — Claude plugin.** `/release` command + skill + `gather.mjs`; Claude drafts, no key.
- **Phase 3 — enrichment & polish.** Provider PR data (gh/bitbucket), interactive PR multiselect,
  `releases/index.json`, optional MCP server for Claude Desktop.

## 10. Open questions

1. Plugin lives **in this repo** (`plugin/`) or its **own repo** (cleaner for a marketplace)?
2. Keep a `releases/index.json` for `releaser list`, or rely purely on the `.md` files?
3. CLI distribution now (npm) or later — start with `npx`/local link?
4. Multi-project "one release": merge all repos under one doc (default), or one section per project?
