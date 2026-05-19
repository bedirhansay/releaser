import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  __resetForTests,
  consume,
  enforce,
  RateLimitError,
} from "./rate-limit";

beforeEach(() => {
  __resetForTests();
});

describe("rate-limit / consume", () => {
  it("allows up to `limit` requests in a window", () => {
    const cfg = { limit: 3, window: 60_000 };
    for (let i = 0; i < 3; i++) {
      expect(consume("u1", cfg).allowed).toBe(true);
    }
    expect(consume("u1", cfg).allowed).toBe(false);
  });

  it("isolates buckets per key", () => {
    const cfg = { limit: 1, window: 60_000 };
    expect(consume("u1", cfg).allowed).toBe(true);
    expect(consume("u2", cfg).allowed).toBe(true);
    expect(consume("u1", cfg).allowed).toBe(false);
  });

  it("refills linearly across time", () => {
    vi.useFakeTimers();
    const start = new Date("2026-05-19T00:00:00Z").getTime();
    vi.setSystemTime(start);
    const cfg = { limit: 4, window: 60_000 };
    expect(consume("u", cfg).allowed).toBe(true); // 3 left
    expect(consume("u", cfg).allowed).toBe(true); // 2
    expect(consume("u", cfg).allowed).toBe(true); // 1
    expect(consume("u", cfg).allowed).toBe(true); // 0
    expect(consume("u", cfg).allowed).toBe(false);

    // Advance half a window — should refill by 2 tokens.
    vi.setSystemTime(start + 30_000);
    expect(consume("u", cfg).allowed).toBe(true);
    expect(consume("u", cfg).allowed).toBe(true);
    expect(consume("u", cfg).allowed).toBe(false);
    vi.useRealTimers();
  });

  it("reports a retry-after when blocked", () => {
    const cfg = { limit: 1, window: 60_000 };
    consume("u", cfg);
    const result = consume("u", cfg);
    expect(result.allowed).toBe(false);
    expect(result.retryAfterSec).toBeGreaterThan(0);
    expect(result.retryAfterSec).toBeLessThanOrEqual(60);
  });
});

describe("rate-limit / enforce", () => {
  it("throws RateLimitError when the bucket is empty", () => {
    const cfg = { limit: 1, window: 60_000 };
    enforce("u", cfg);
    expect(() => enforce("u", cfg)).toThrowError(RateLimitError);
  });
});
