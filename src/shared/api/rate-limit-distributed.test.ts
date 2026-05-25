import { afterEach, describe, expect, it } from "vitest";
import {
  __resetDistributedForTests,
  consumeDistributed,
} from "./rate-limit-distributed";

// With no UPSTASH_* env set, the limiter uses its in-process fixed-window store.
afterEach(() => __resetDistributedForTests());

describe("consumeDistributed (in-memory fallback)", () => {
  it("allows up to the limit, then blocks", async () => {
    const cfg = { limit: 3, window: 60_000 };
    const key = "user:test";
    expect((await consumeDistributed(key, cfg)).allowed).toBe(true);
    expect((await consumeDistributed(key, cfg)).allowed).toBe(true);
    const third = await consumeDistributed(key, cfg);
    expect(third.allowed).toBe(true);
    expect(third.remaining).toBe(0);

    const blocked = await consumeDistributed(key, cfg);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSec).toBeGreaterThan(0);
  });

  it("tracks separate keys independently", async () => {
    const cfg = { limit: 1, window: 60_000 };
    expect((await consumeDistributed("a", cfg)).allowed).toBe(true);
    expect((await consumeDistributed("a", cfg)).allowed).toBe(false);
    // Different key still has its full budget.
    expect((await consumeDistributed("b", cfg)).allowed).toBe(true);
  });

  it("refills after the window elapses", async () => {
    const cfg = { limit: 1, window: 10 }; // 10ms window
    expect((await consumeDistributed("w", cfg)).allowed).toBe(true);
    expect((await consumeDistributed("w", cfg)).allowed).toBe(false);
    await new Promise((r) => setTimeout(r, 15));
    expect((await consumeDistributed("w", cfg)).allowed).toBe(true);
  });
});
