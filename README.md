# Releaser

AI-powered release notes generator. Connect a GitHub or Bitbucket repo,
pick refs **or** a batch of merged pull requests, and Releaser will draft a
categorized, risk-annotated changelog you can ship.

> Status: pre-1.0 MVP. Architecture is stable; security hardening for
> production deploys is documented in [SECURITY.md](./SECURITY.md).

## Stack

- **Next.js 16** (App Router) + **TypeScript** (strict)
- **PostgreSQL** + **Prisma 7** (driver-adapter for `pg`)
- **Auth.js v5** — GitHub + Bitbucket OAuth
- **TailwindCSS v4** + **shadcn/ui** + dark mode default
- **TanStack Query** for client data
- **OpenAI SDK** — works with anything OpenAI-compatible
  (OpenAI, GLM / Z.AI, DeepSeek, Together, Groq, Ollama)
- **Monaco editor** + **react-markdown** for the editor/preview surface
- **Vitest** for unit tests

## Architecture

```
src/
  app/                      Next.js routes (pages + thin API handlers)
  components/               Reusable UI (shadcn primitives + brand assets)
  features/                 Vertical slices: service + hooks + components
    repositories/
    releases/
  core/                     Pure domain — no I/O
    git/                    GitProvider interface + factory
    ai/                     AIProvider interface + factory
    release/                Release engine (categorize, risks, markdown)
  infrastructure/           Concrete adapters (Octokit, OpenAI, Prisma, crypto)
    github/
    bitbucket/
    ai/
    db/
    crypto/                 Token cipher (AES-256-GCM)
  shared/                   Cross-cutting helpers (api response, rate limit, http)
  types/                    Shared domain types and Zod schemas
```

Dependency direction is one-way: `app → features → core ← infrastructure`.
`core/` defines interfaces; `infrastructure/` implements them; factories
do the wiring. Adding a new provider (BitbucketProvider, GitLabProvider)
or a new AI vendor never touches application code.

## Two ways to generate

### From merged pull requests (default)

The grown-up flow. Pick a filter:

- **Last N merged PRs** — the most recent N, optionally scoped to one base branch
- **Date range** — everything merged between two dates
- **Between tags** — everything merged in `v1.0.0 → v1.1.0`

…and Releaser ships PR titles, bodies, labels and authors to the AI to
group cleanly. Also supports `state = "merged" | "open" | "all"` for the
first two filters — useful for previewing an upcoming changelog from
open PRs.

### From branch compare (alternative)

The traditional flow. Pick a base ref and a head ref; Releaser pulls the
diff, prunes lockfiles/dist/binaries, and asks the model to summarize the
commits.

Both flows share the same engine and the same output schema (categorized
notes + risk findings + markdown).

## Projects, templates & releases

Beyond single-repo generation, Releaser supports a multi-repo, templated flow:

- **Projects** bundle several repositories (e.g. a product = `backend` +
  `frontend`). One release spans them all; repos can be role-tagged.
- **Editable templates** define the document structure as an ordered list of
  sections (`heading` + an AI `instruction`). The AI drafts every section, so
  the same project always produces the same shape. A finsel-style default
  ships out of the box and is fully editable.
- **Tags** — free-form labels on saved releases (e.g. `backend`/`frontend`),
  filterable in history.
- **Per-user AI keys (BYO-LLM)** — each user can set their own OpenAI-compatible
  key/endpoint in Settings; it's encrypted at rest and used for their
  generations, falling back to the shared `AI_*` env when unset.
- **GitHub App access (Coolify-style)** — optional fine-grained, per-repo,
  read-only repo access via short-lived installation tokens. Login stays on
  OAuth; the App only grants repo data access. Falls back to OAuth when not
  configured.

## Getting started

```bash
pnpm install

# Postgres — local docker is fine for dev
docker run -d --name releaser-pg -p 5432:5432 \
  -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=releaser postgres:16

cp .env.example .env
# fill in the env values, then (local dev):
pnpm db:push
pnpm dev

# Production uses versioned migrations instead of db:push:
pnpm db:migrate:deploy
```

> Changing the Prisma schema regenerates the client — restart `pnpm dev`
> afterwards so the running server picks it up.

Open <http://localhost:3000> (or 3002 if 3000 is taken). The
[`/guide`](http://localhost:3000/guide) page is a complete end-to-end walkthrough.

### Required env

```env
DATABASE_URL=postgresql://...
AUTH_SECRET=...                # openssl rand -base64 32
TOKEN_ENCRYPTION_KEY=...       # openssl rand -base64 32 — encrypts OAuth tokens at rest

# At least one provider:
AUTH_GITHUB_ID=...
AUTH_GITHUB_SECRET=...
AUTH_BITBUCKET_ID=...
AUTH_BITBUCKET_SECRET=...

# AI provider (OpenAI-compatible) — shared fallback; users can override per-account:
AI_API_KEY=...
AI_BASE_URL=                   # blank for OpenAI; URL for GLM / DeepSeek / Groq / Ollama
AI_MODEL=gpt-4o-mini           # or glm-4.6, deepseek-chat, llama-3.3-70b-versatile, llama3
```

Optional, for production:

```env
# GitHub App (Coolify-style per-repo access). See .env.example for setup steps.
GITHUB_APP_ID=...
GITHUB_APP_PRIVATE_KEY=...      # PEM; newlines may be escaped as \n
GITHUB_APP_SLUG=...
GITHUB_APP_CLIENT_ID=...
GITHUB_APP_CLIENT_SECRET=...
GITHUB_APP_WEBHOOK_SECRET=...

# Distributed rate-limit + AI quota across instances (else in-process):
UPSTASH_REDIS_REST_URL=...
UPSTASH_REDIS_REST_TOKEN=...
```

The server validates required env at boot (`src/instrumentation.ts`) so a
misconfigured deploy fails fast with a clear message.

## API endpoints

All routes require an authenticated session, except `/api/health` and
`/api/github/app/webhook` (HMAC-verified) which are public by design.

| Method | Path | Purpose |
| ------ | ---- | ------- |
| GET    | `/api/health` | Liveness/readiness probe (DB ping) |
| GET    | `/api/providers` | List git providers linked to the user |
| GET    | `/api/repos?provider=...` | List the user's repos |
| GET    | `/api/repos/{owner}/{repo}/branches?provider=...` | List branches |
| GET    | `/api/repos/{owner}/{repo}/tags?provider=...` | List tags |
| GET    | `/api/repos/{owner}/{repo}/compare?provider=...&base=...&head=...` | Branch compare |
| POST   | `/api/repos/{owner}/{repo}/pulls` | List PRs by filter (body: `{ provider, filter }`) |
| POST   | `/api/releases/generate` | Generate from branch compare |
| POST   | `/api/releases/generate/from-prs` | Generate from PRs (body: `{ provider, owner, repo, filter }`) |
| GET    | `/api/releases` | List saved releases (current user) |
| POST   | `/api/releases` | Save a generated release |
| GET    | `/api/releases/{id}` | Read one |
| PATCH  | `/api/releases/{id}` | Update title, markdown and/or tags |
| DELETE | `/api/releases/{id}` | Delete a release |
| GET/POST | `/api/projects` | List / create projects (multi-repo) |
| GET/PATCH/DELETE | `/api/projects/{id}` | Read / update / delete a project |
| POST   | `/api/projects/{id}/generate` | Generate a templated release across the project's repos |
| POST   | `/api/projects/{id}/releases` | Save a generated project release |
| GET/POST | `/api/templates` | List / create editable templates |
| GET/PATCH/DELETE | `/api/templates/{id}` | Read / update / delete a template |
| GET/PUT | `/api/settings/ai` | Read status / set per-user AI key (BYO-LLM) |
| GET    | `/api/github/app` | GitHub App config status + installations |
| DELETE | `/api/github/app/{id}` | Forget an installation locally |
| GET    | `/api/github/app/install` | Start the App install flow |
| GET    | `/api/github/app/callback` | Post-install callback |
| POST   | `/api/github/app/webhook` | Installation lifecycle (HMAC-verified, public) |

## Scripts

| Script              | What it does                       |
| ------------------- | ---------------------------------- |
| `pnpm dev`          | Next.js dev server (Turbopack)     |
| `pnpm build`        | Production build                   |
| `pnpm start`        | Run the production build           |
| `pnpm lint`         | ESLint                             |
| `pnpm typecheck`    | `tsc --noEmit`                     |
| `pnpm test`         | Vitest (one-shot)                  |
| `pnpm test:watch`   | Vitest (watch mode)                |
| `pnpm db:push`      | Push Prisma schema to DB (dev)     |
| `pnpm db:migrate`   | Create + apply a migration (dev)   |
| `pnpm db:migrate:deploy` | Apply migrations (production) |
| `pnpm db:studio`    | Prisma Studio                      |

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md). Bugs and ideas welcome via
GitHub issues. Security reports: please read [SECURITY.md](./SECURITY.md)
first.

## License

[MIT](./LICENSE) — © 2026 Bedirhan Say.
