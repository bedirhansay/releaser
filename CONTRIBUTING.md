# Contributing to Releaser

Thanks for stopping by. Releaser is intentionally small — a tight tool that
turns Git history into release notes. Contributions that keep it that way
are very welcome.

## Ground rules

- **Small PRs.** One concern per PR. Easier to review, easier to revert.
- **No new framework or runtime dependencies** without prior discussion.
- **Match the architecture.** Business logic lives in `src/core` and
  `src/features`; route handlers in `src/app/api` should stay thin
  delegators. New external services go in `src/infrastructure` behind a
  domain-defined interface.
- **TypeScript strict.** No `any`. If you must reach for a cast, comment why.

## Project layout

```
src/
  app/                Next.js routes (pages + thin API handlers)
  components/         Reusable UI primitives and brand assets
  features/           Vertical slices: service + hooks + components per domain
  core/               Pure domain — interfaces + engine, no I/O
    git/              GitProvider interface (GitHub, Bitbucket, …)
    ai/               AIProvider interface
    release/          Release engine (categorize, risks, markdown)
  infrastructure/     Concrete adapters (Octokit, OpenAI, Prisma, crypto)
  shared/             Cross-cutting helpers (api response, auth, http)
  types/              Shared domain types and Zod schemas
```

The dependency direction is:

```
app → features → core → (infrastructure injected via factory)
```

`core/` must never import from `infrastructure/` directly — factories do
the wiring.

## Development setup

```bash
pnpm install
cp .env.example .env       # then fill in real values
docker run -d --name releaser-pg -p 5432:5432 \
  -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=releaser postgres:16
pnpm db:push
pnpm dev
```

## Scripts

| Script             | What it does                       |
| ------------------ | ---------------------------------- |
| `pnpm dev`         | Next.js dev server (Turbopack)     |
| `pnpm build`       | Production build                   |
| `pnpm start`       | Run the production build           |
| `pnpm lint`        | ESLint                             |
| `pnpm typecheck`   | `tsc --noEmit`                     |
| `pnpm test`        | Vitest (unit + integration)        |
| `pnpm db:push`     | Push Prisma schema to DB           |
| `pnpm db:migrate`  | Create + apply a migration         |
| `pnpm db:studio`   | Prisma Studio                      |

## Adding a new git provider

1. Implement `GitProvider` in `src/infrastructure/<provider>/<provider>-provider.ts`.
2. Wire it into `src/core/git/provider-factory.ts`.
3. If the provider has its own OAuth flow, add an Auth.js provider under
   `src/auth/providers/`.
4. Add a `GitProviderKind` enum value and a label in
   `src/features/repositories/repositories.service.ts`.
5. Update `prisma/schema.prisma` `GitProviderKind` enum and run
   `pnpm db:push`.

## Adding a new AI provider

If it speaks the OpenAI chat-completions schema, you don't need new code —
just set `AI_BASE_URL` + `AI_MODEL`. For non-compatible providers:

1. Implement `AIProvider` in `src/infrastructure/ai/<provider>-provider.ts`.
2. Add a kind to `AIProviderKind` and wire `createAIProvider`.

## Tests

```bash
pnpm test          # one-shot
pnpm test --watch  # watch mode
```

Tests live next to source files (`*.test.ts`) or under `__tests__/`.
Cover business logic (engine, categorizer, risk detector, markdown builder,
token cipher). External services are mocked.

## Commit style

Conventional Commits encouraged but not enforced:

```
feat(engine): support orphan-branch compare
fix(github): handle 404 from compare endpoint distinctly
refactor(http): extract shared fetch helper
```

## Reporting bugs

Please include:

1. What you did (steps to reproduce)
2. What you expected
3. What happened (error message, screenshot)
4. Versions (`node -v`, `pnpm -v`, `git -v`), OS, browser

For security issues, see [SECURITY.md](./SECURITY.md) — do not open a
public issue.
