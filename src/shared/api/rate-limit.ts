/**
 * Per-key token-bucket rate limiter, in-process.
 *
 * This is intentionally simple: it survives within a single Node process and
 * does NOT coordinate across instances. For multi-instance deploys swap the
 * bucket store for a shared backing (Upstash Redis, Cloudflare KV, …).
 *
 * The bucket refills linearly: at any instant, `tokens = min(limit, prev +
 * elapsed / window * limit)`. This avoids "thundering herd at window edge"
 * that a hard sliding-window has.
 */

export interface RateLimitConfig {
  /** Maximum number of requests in `window` (the bucket size). */
  limit: number;
  /** Refill window in milliseconds. */
  window: number;
}

interface Bucket {
  tokens: number;
  lastRefill: number;
}

const buckets = new Map<string, Bucket>();

export interface RateLimitResult {
  allowed: boolean;
  /** Remaining whole tokens after this consume attempt. */
  remaining: number;
  /** Seconds until the bucket can serve one more request. */
  retryAfterSec: number;
}

export function consume(
  key: string,
  cfg: RateLimitConfig,
): RateLimitResult {
  const now = Date.now();
  const existing = buckets.get(key);
  const bucket: Bucket = existing
    ? refill(existing, cfg, now)
    : { tokens: cfg.limit, lastRefill: now };

  if (bucket.tokens < 1) {
    buckets.set(key, bucket);
    const tokensToWait = 1 - bucket.tokens;
    const retryAfterSec = Math.ceil((tokensToWait * cfg.window) / cfg.limit / 1000);
    return { allowed: false, remaining: 0, retryAfterSec };
  }

  bucket.tokens -= 1;
  buckets.set(key, bucket);
  return {
    allowed: true,
    remaining: Math.floor(bucket.tokens),
    retryAfterSec: 0,
  };
}

function refill(bucket: Bucket, cfg: RateLimitConfig, now: number): Bucket {
  const elapsed = Math.max(0, now - bucket.lastRefill);
  const added = (elapsed / cfg.window) * cfg.limit;
  return {
    tokens: Math.min(cfg.limit, bucket.tokens + added),
    lastRefill: now,
  };
}

export class RateLimitError extends Error {
  readonly status = 429 as const;
  constructor(
    message = "Too many requests",
    readonly retryAfterSec: number = 60,
  ) {
    super(message);
    this.name = "RateLimitError";
  }
}

/** Common policies — keep call sites readable. */
export const POLICIES = {
  /** 10 AI generations per hour per user — bounds cost from a hostile session. */
  AI_GENERATE: { limit: 10, window: 60 * 60 * 1000 } satisfies RateLimitConfig,
  /** 50 AI generations per rolling 24h per user — a daily cost ceiling. */
  AI_DAILY_QUOTA: {
    limit: 50,
    window: 24 * 60 * 60 * 1000,
  } satisfies RateLimitConfig,
} as const;

/**
 * Convenience: enforce a policy or throw. Call sites stay one-liners.
 */
export function enforce(key: string, cfg: RateLimitConfig): void {
  const result = consume(key, cfg);
  if (!result.allowed) {
    throw new RateLimitError(
      `Rate limit exceeded — retry in ${result.retryAfterSec}s.`,
      result.retryAfterSec,
    );
  }
}

/** Visible for tests only. */
export function __resetForTests(): void {
  buckets.clear();
}
