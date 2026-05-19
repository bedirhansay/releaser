import { beforeAll, describe, expect, it } from "vitest";
import {
  __resetKeyCacheForTests,
  decryptToken,
  encryptToken,
} from "./token-cipher";

beforeAll(() => {
  process.env.TOKEN_ENCRYPTION_KEY = "test-encryption-key-long-enough-for-prod";
  __resetKeyCacheForTests();
});

describe("token-cipher", () => {
  it("round-trips a typical access token", () => {
    const tok = "ghp_" + "x".repeat(36);
    const enc = encryptToken(tok);
    expect(enc).not.toContain(tok);
    expect(decryptToken(enc)).toBe(tok);
  });

  it("produces different ciphertexts for the same input (random IV)", () => {
    const tok = "ghp_" + "y".repeat(36);
    const a = encryptToken(tok);
    const b = encryptToken(tok);
    expect(a).not.toBe(b);
    expect(decryptToken(a)).toBe(tok);
    expect(decryptToken(b)).toBe(tok);
  });

  it("passes plaintext GitHub tokens through unchanged (legacy rows)", () => {
    // A token shaped like a GitHub PAT that pre-dates the cipher migration.
    const legacy = "ghp_abc123def456ghi789jkl012mno345pqr678";
    expect(decryptToken(legacy)).toBe(legacy);
  });

  it("rejects keys that are too short", () => {
    process.env.TOKEN_ENCRYPTION_KEY = "abc";
    __resetKeyCacheForTests();
    expect(() => encryptToken("anything")).toThrow(/missing or too short/i);
    // restore for downstream tests
    process.env.TOKEN_ENCRYPTION_KEY = "test-encryption-key-long-enough-for-prod";
    __resetKeyCacheForTests();
  });
});
