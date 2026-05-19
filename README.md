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

## Getting started

```bash
pnpm install

# Postgres — local docker is fine for dev
docker run -d --name releaser-pg -p 5432:5432 \
  -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=releaser postgres:16

cp .env.example .env
# fill in the env values, then:
pnpm db:push
pnpm dev
```

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

# AI provider (OpenAI-compatible):
AI_API_KEY=...
AI_BASE_URL=                   # blank for OpenAI; URL for GLM / DeepSeek / Groq / Ollama
AI_MODEL=gpt-4o-mini           # or glm-4.6, deepseek-chat, llama-3.3-70b-versatile, llama3
```

## API endpoints

All routes require an authenticated session.

| Method | Path | Purpose |
| ------ | ---- | ------- |
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
| PATCH  | `/api/releases/{id}` | Update title and/or markdown |
| DELETE | `/api/releases/{id}` | Delete a release |

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
| `pnpm db:push`      | Push Prisma schema to DB           |
| `pnpm db:migrate`   | Create + apply a migration         |
| `pnpm db:studio`    | Prisma Studio                      |

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md). Bugs and ideas welcome via
GitHub issues. Security reports: please read [SECURITY.md](./SECURITY.md)
first.

## License

[MIT](./LICENSE) — © 2026 Bedirhan Say.
