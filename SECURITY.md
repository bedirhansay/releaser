# Security Policy

## Reporting a vulnerability

**Please do not open public issues for security vulnerabilities.**

Email security reports to: **`security@your-domain.tld`** (replace with your
real contact when forking). We aim to acknowledge within 72 hours and to
publish a fix or mitigation within 14 days for high-severity issues.

If you don't have an email channel set up yet, use a private security
advisory through GitHub: **Security → Advisories → Report a vulnerability**.

## Supported versions

This project is pre-1.0. Only the latest `main` is supported. Once `v1.0.0`
ships, we will document a support window here.

## Threat model & current posture

Releaser is a small fullstack app that integrates with third-party APIs
(GitHub, Bitbucket, OpenAI-compatible LLMs). The most sensitive data it
handles are **OAuth access tokens** and **user-authored markdown**.

### What we do

- **Session-gated APIs.** Every route under `/api/repos` and `/api/releases`
  resolves a session user id; all DB queries scope by that id.
- **No write scopes.** OAuth scopes requested are read-only for both GitHub
  (`read:user user:email repo`) and Bitbucket (`account email repository`).
- **At-rest token encryption.** Stored OAuth tokens are encrypted with
  AES-256-GCM using `TOKEN_ENCRYPTION_KEY`. Plaintext rows from older
  installs are decrypted opportunistically and re-encrypted on next refresh.
- **Per-user rate limit** on AI generation endpoints to bound cost from a
  compromised or hostile session.
- **CSP-adjacent response headers.** `X-Frame-Options`, `X-Content-Type-Options`,
  `Referrer-Policy`, `Strict-Transport-Security` are set globally.
- **No source code in storage.** The release engine only persists the AI's
  structured output + the final markdown — not the source diff.

### What's still on the roadmap

- A full Content-Security-Policy header (Monaco editor needs a careful CSP).
- Audit logging of CRUD operations on `ReleaseHistory`.
- Encryption-key rotation tooling.
- Tighter outbound egress allowlist for AI providers.

## Hardening before shipping

If you intend to run Releaser publicly:

1. **Set `TOKEN_ENCRYPTION_KEY`** to a strong random value
   (`openssl rand -base64 32`). Never reuse a dev value.
2. **Set `AUTH_SECRET`** to a strong random value.
3. **Use a managed Postgres** (Neon, Supabase, RDS) with encryption at rest.
4. **Restrict OAuth scopes** to `public_repo` if you don't need private repos.
5. **Tighten the rate limit** in `src/shared/api/rate-limit.ts` to match
   your AI cost budget.
6. **Front the app with a CDN/WAF** (Cloudflare, fly.io, Vercel) for
   additional surface protection.
7. **Rotate the GitHub OAuth Client Secret** if you ever committed it to
   git history.

## Known limitations

- The in-memory rate limiter is per-process. In a multi-instance deployment,
  replace it with a shared store (Upstash Redis, Cloudflare KV, …).
- Errors thrown during AI generation may include the upstream provider's
  message. In production, only `5xx` errors are sanitized to a generic
  string; `4xx` messages pass through to help the user diagnose.
