import { z } from "zod";

/**
 * Server environment contract. Validated once at process start (see
 * `src/instrumentation.ts`) so a misconfigured deploy fails fast and loudly
 * instead of 500-ing on the first request that touches the missing value.
 *
 * Only secrets that are *always* required are mandatory here. OAuth provider
 * credentials and the global AI key are optional — providers are opt-in and AI
 * is now bring-your-own-key per user (with the env values as a shared fallback).
 */
const envSchema = z.object({
  // Always required.
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  AUTH_SECRET: z.string().min(1, "AUTH_SECRET is required"),
  TOKEN_ENCRYPTION_KEY: z
    .string()
    .min(32, "TOKEN_ENCRYPTION_KEY must be at least 32 characters"),

  // OAuth providers — optional, but you need at least one to let users sign in.
  AUTH_GITHUB_ID: z.string().optional(),
  AUTH_GITHUB_SECRET: z.string().optional(),
  AUTH_BITBUCKET_ID: z.string().optional(),
  AUTH_BITBUCKET_SECRET: z.string().optional(),

  // GitHub App (Coolify-style repo access). Optional — when configured, users
  // can install the App to grant fine-grained, per-repo read access. Repo data
  // then flows through short-lived installation tokens instead of OAuth scope.
  GITHUB_APP_ID: z.string().optional(),
  GITHUB_APP_PRIVATE_KEY: z.string().optional(),
  GITHUB_APP_SLUG: z.string().optional(),
  GITHUB_APP_CLIENT_ID: z.string().optional(),
  GITHUB_APP_CLIENT_SECRET: z.string().optional(),
  GITHUB_APP_WEBHOOK_SECRET: z.string().optional(),

  // Shared AI fallback (used when a user hasn't set their own key).
  AI_API_KEY: z.string().optional(),
  AI_BASE_URL: z.string().optional(),
  AI_MODEL: z.string().optional(),
  // Set to "true" to allow a private/loopback AI baseUrl (e.g. a local Ollama at
  // http://localhost:11434/v1). Left unset, such hosts are rejected as SSRF.
  AI_ALLOW_PRIVATE_BASEURL: z.string().optional(),

  // Optional distributed rate-limit / quota store. When both are set the rate
  // limiter coordinates across instances; otherwise it falls back to in-process.
  UPSTASH_REDIS_REST_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),

  // Optional "local" git provider. When set, release notes can be generated
  // straight from git clones on disk under this directory — no OAuth/token.
  // In Docker this is a mounted volume (e.g. /repos); run directly it can point
  // anywhere readable (e.g. ~/projects).
  LOCAL_REPOS_DIR: z.string().optional(),
});

export type ServerEnv = z.infer<typeof envSchema>;

let cached: ServerEnv | null = null;

/**
 * Parse + cache the validated environment. Throws an aggregated, readable error
 * listing every missing/invalid variable. Safe to call repeatedly.
 */
export function validateServerEnv(): ServerEnv {
  if (cached) return cached;
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("\n");
    throw new Error(
      `Invalid server environment — fix these before starting:\n${issues}`,
    );
  }
  // Soft warning: at least one OAuth provider should be configured.
  const hasGithub = parsed.data.AUTH_GITHUB_ID && parsed.data.AUTH_GITHUB_SECRET;
  const hasBitbucket =
    parsed.data.AUTH_BITBUCKET_ID && parsed.data.AUTH_BITBUCKET_SECRET;
  if (!hasGithub && !hasBitbucket) {
    console.warn(
      "[env] No OAuth provider configured — users won't be able to sign in. " +
        "Set AUTH_GITHUB_ID/SECRET or AUTH_BITBUCKET_ID/SECRET.",
    );
  }
  cached = parsed.data;
  return cached;
}
