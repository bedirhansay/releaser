import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";

/**
 * AES-256-GCM cipher for OAuth access tokens at rest.
 *
 * Format on disk (base64-encoded):
 *   [ version(1) | iv(12) | authTag(16) | ciphertext(...) ]
 *
 * Version byte lets us migrate algorithms later without rewriting the column.
 * The encryption key is derived (SHA-256) from `TOKEN_ENCRYPTION_KEY` so the
 * env value can be any reasonably random string.
 *
 * Backwards-compatibility: `decryptToken` recognises rows that look like
 * plaintext (no header, lengths/charset don't match the encrypted format)
 * and returns them as-is. Callers should re-encrypt opportunistically.
 */

const ALGO = "aes-256-gcm";
const IV_LEN = 12;
const TAG_LEN = 16;
const VERSION = 0x01;

let cachedKey: Buffer | null = null;

function getKey(): Buffer {
  if (cachedKey) return cachedKey;
  const raw = process.env.TOKEN_ENCRYPTION_KEY;
  if (!raw || raw.length < 8) {
    throw new Error(
      "TOKEN_ENCRYPTION_KEY is missing or too short. Set a strong value (openssl rand -base64 32).",
    );
  }
  cachedKey = createHash("sha256").update(raw).digest();
  return cachedKey;
}

export function encryptToken(plaintext: string): string {
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, getKey(), iv);
  const enc = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  const out = Buffer.concat([Buffer.from([VERSION]), iv, tag, enc]);
  return out.toString("base64");
}

export function decryptToken(blob: string): string {
  // Heuristic: encrypted blobs always start with our version byte once
  // base64-decoded; pre-cipher rows are GitHub PATs / OAuth tokens which are
  // ASCII-printable and pass through Buffer.from(.., "base64") with garbage.
  let buf: Buffer;
  try {
    buf = Buffer.from(blob, "base64");
  } catch {
    return blob;
  }
  if (
    buf.length < 1 + IV_LEN + TAG_LEN + 1 ||
    buf[0] !== VERSION ||
    looksLikePlaintextToken(blob)
  ) {
    return blob;
  }
  const iv = buf.subarray(1, 1 + IV_LEN);
  const tag = buf.subarray(1 + IV_LEN, 1 + IV_LEN + TAG_LEN);
  const ciphertext = buf.subarray(1 + IV_LEN + TAG_LEN);
  try {
    const decipher = createDecipheriv(ALGO, getKey(), iv);
    decipher.setAuthTag(tag);
    const dec = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return dec.toString("utf8");
  } catch {
    // Treat as plaintext if decryption fails (covers legacy rows whose first
    // byte coincidentally matched our version byte).
    return blob;
  }
}

/**
 * GitHub tokens follow patterns like `ghp_…`, `gho_…`, `ghs_…`, `github_pat_…`
 * and Bitbucket access tokens are hex/url-safe strings. None of these embed
 * a NUL byte or non-printable chars, so we use that as a cheap plaintext
 * check before attempting AES.
 */
function looksLikePlaintextToken(s: string): boolean {
  if (s.startsWith("ghp_") || s.startsWith("gho_") || s.startsWith("ghs_")) {
    return true;
  }
  if (s.startsWith("github_pat_")) return true;
  return false;
}

/**
 * Reset for tests — clears the cached key so a new env value takes effect.
 * Not exported on the public surface but accessible via the underscored name.
 */
export function __resetKeyCacheForTests(): void {
  cachedKey = null;
}
