import { RateLimitError, type RateLimitConfig } from "./rate-limit";

/**
 * Distributed-friendly rate limiter using a fixed-window counter.
 *
 * When `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` are set, counters
 * live in Upstash Redis so the limit holds across serverless instances. With
 * no Redis configured it falls back to an in-process Map — fine for a single
 * instance / local dev. Redis errors fail *open* (fall back to memory) so a
 * store blip never takes generation offline.
 *
 * Fixed-window (vs the token bucket in `rate-limit.ts`) is used here because it
 * maps to a single atomic INCR — trivial to do correctly over Redis REST.
 */

interface WindowResult {
  allowed: boolean;
  remaining: number;
  retryAfterSec: number;
}

// ── In-memory fallback ───────────────────────────────────────────────────────

const memStore = new Map<string, { count: number; resetAt: number }>();

function memConsume(
  key: string,
  limit: number,
  windowMs: number,
): WindowResult {
  const now = Date.now();
  const entry = memStore.get(key);
  if (!entry || entry.resetAt <= now) {
    memStore.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, retryAfterSec: 0 };
  }
  if (entry.count >= limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSec: Math.ceil((entry.resetAt - now) / 1000),
    };
  }
  entry.count += 1;
  return { allowed: true, remaining: limit - entry.count, retryAfterSec: 0 };
}

// ── Upstash Redis REST ───────────────────────────────────────────────────────

async function redisCommand(
  url: string,
  token: string,
  command: (string | number)[],
): Promise<unknown> {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(command),
    // Never cache rate-limit traffic.
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Upstash error ${res.status}`);
  }
  const data = (await res.json()) as { result?: unknown; error?: string };
  if (data.error) throw new Error(`Upstash error: ${data.error}`);
  return data.result;
}

async function redisConsume(
  url: string,
  token: string,
  key: string,
  limit: number,
  windowMs: number,
): Promise<WindowResult> {
  // Bucket the key by window so old counters roll off naturally.
  const windowKey = `rl:${key}:${Math.floor(Date.now() / windowMs)}`;
  const count = Number(await redisCommand(url, token, ["INCR", windowKey]));
  // Set the TTL once, on the first hit of the window.
  if (count === 1) {
    await redisCommand(url, token, ["PEXPIRE", windowKey, windowMs]);
  }
  if (count > limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSec: Math.ceil(windowMs / 1000),
    };
  }
  return { allowed: true, remaining: Math.max(0, limit - count), retryAfterSec: 0 };
}

// ── Public API ───────────────────────────────────────────────────────────────

export async function consumeDistributed(
  key: string,
  cfg: RateLimitConfig,
): Promise<WindowResult> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (url && token) {
    try {
      return await redisConsume(url, token, key, cfg.limit, cfg.window);
    } catch (err) {
      // Fail open to the in-memory limiter so a Redis outage degrades
      // gracefully rather than blocking every generation.
      console.error("[rate-limit] Redis store failed, using memory:", err);
    }
  }
  return memConsume(key, cfg.limit, cfg.window);
}

/** Enforce a policy or throw `RateLimitError`. Async variant of `enforce`. */
export async function enforceDistributed(
  key: string,
  cfg: RateLimitConfig,
): Promise<void> {
  const result = await consumeDistributed(key, cfg);
  if (!result.allowed) {
    throw new RateLimitError(
      `Rate limit exceeded — retry in ${result.retryAfterSec}s.`,
      result.retryAfterSec,
    );
  }
}

/** Visible for tests only. */
export function __resetDistributedForTests(): void {
  memStore.clear();
}
