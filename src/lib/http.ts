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
      .catch(() => ({ error: res.statusText }) as { error?: string });
    throw new Error(body?.error ?? `Request failed: ${res.status}`);
  }
  return (await res.json()) as T;
}
