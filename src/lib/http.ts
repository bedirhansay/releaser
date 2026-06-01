/**
 * Minimal typed fetch helper for client-side data hooks. Centralised so we
 * don't redefine `credentials`, JSON headers, and error unwrapping in every
 * hook file.
 *
 * The shape returned to callers always matches the API contract: a successful
 * response is parsed as JSON, an error response is rethrown with the server's
 * `error` field as the message (so toast/error UI never has to guess).
 */
export async function fetchJson<T>(
  url: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(url, {
    credentials: "include",
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res
      .json()
      .catch(() => ({ error: res.statusText }) as ApiErrorBody);
    throw new Error(extractErrorMessage(body, res.status));
  }
  return (await res.json()) as T;
}

interface ZodFlatten {
  formErrors?: string[];
  fieldErrors?: Record<string, string[] | undefined>;
}

interface ApiErrorBody {
  error?: string;
  details?: unknown;
}

/**
 * Prefer a specific field/validation message over the generic envelope. The
 * server wraps Zod failures as `{ error: "Invalid request", details: flatten }`
 * (422); surfacing the first concrete message makes form errors actionable
 * instead of opaque.
 */
function extractErrorMessage(body: ApiErrorBody, status: number): string {
  const flat = body?.details as ZodFlatten | undefined;
  if (flat && typeof flat === "object") {
    const fieldMsg = flat.fieldErrors
      ? Object.values(flat.fieldErrors).flat().filter(Boolean)[0]
      : undefined;
    const msg = fieldMsg ?? flat.formErrors?.[0];
    if (msg) return msg;
  }
  return body?.error ?? `Request failed: ${status}`;
}
