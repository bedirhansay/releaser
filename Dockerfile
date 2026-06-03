# syntax=docker/dockerfile:1.7

# ── Base ─────────────────────────────────────────────────────────────────────
# Debian-slim (not alpine) so Prisma's schema engine — used by `migrate deploy`
# at startup — finds the OpenSSL it links against. pnpm comes from corepack,
# pinned by the "packageManager" field in package.json.
FROM node:22-bookworm-slim AS base
ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH
# Pre-activate the pinned pnpm so it's baked into the image — no download at
# container startup (the seed step shells out to pnpm).
RUN corepack enable && corepack prepare pnpm@10.20.0 --activate && \
    apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates git && \
    rm -rf /var/lib/apt/lists/*
WORKDIR /app

# ── Dependencies ─────────────────────────────────────────────────────────────
# Install with the lockfile only; the prisma/@prisma postinstall (whitelisted in
# package.json's onlyBuiltDependencies) fetches the engine binaries here.
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY prisma ./prisma
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile

# ── Build ────────────────────────────────────────────────────────────────────
# Generate the Prisma client into node_modules/.prisma, then `next build`.
# Env validation runs at *process start* (instrumentation.ts), not at build, so
# no secrets are needed here.
FROM base AS builder
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm db:generate && pnpm build

# ── Runtime ──────────────────────────────────────────────────────────────────
# Carries the full node_modules so the same image can both run migrations/seed
# (prisma CLI + tsx) and serve the app (`next start`).
FROM base AS runner
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/next.config.ts ./next.config.ts
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder /app/prisma ./prisma
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

EXPOSE 3000
# Invoke binaries directly (not via pnpm) so startup needs no network/corepack.
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node_modules/.bin/next", "start"]
