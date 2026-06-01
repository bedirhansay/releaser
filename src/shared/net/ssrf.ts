/**
 * SSRF guard for user-supplied outbound URLs (currently the per-org AI
 * `baseUrl`, which the server POSTs to during generation with the org's API
 * key attached).
 *
 * Without this, an admin could point `baseUrl` at an internal address
 * (cloud metadata `169.254.169.254`, `localhost`, RFC1918 hosts) and make the
 * server issue authenticated requests there — metadata theft, internal port
 * scanning, or exfiltrating the org's AI key to an attacker-controlled box.
 *
 * Local endpoints are a legitimate use case (e.g. Ollama at
 * `http://localhost:11434/v1`), so private hosts are allowed only when the
 * operator opts in with `AI_ALLOW_PRIVATE_BASEURL=true`.
 */

function isPrivateHostname(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, ""); // strip IPv6 brackets

  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal")
  ) {
    return true;
  }

  // IPv6 loopback / unspecified / link-local / unique-local.
  if (host === "::1" || host === "::" || host === "0:0:0:0:0:0:0:1") return true;
  if (host.startsWith("fe80:") || host.startsWith("fc") || host.startsWith("fd")) {
    return true;
  }

  // IPv4 literals — block loopback, link-local (incl. cloud metadata), and the
  // RFC1918 private ranges.
  const m = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (m) {
    const [a, b] = [Number(m[1]), Number(m[2])];
    if (a === 127) return true; // 127.0.0.0/8 loopback
    if (a === 0) return true; // 0.0.0.0/8
    if (a === 10) return true; // 10.0.0.0/8
    if (a === 169 && b === 254) return true; // 169.254.0.0/16 link-local + metadata
    if (a === 192 && b === 168) return true; // 192.168.0.0/16
    if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
  }

  return false;
}

/**
 * True when `raw` is a well-formed http(s) URL pointing at a public host.
 * Private/loopback hosts are rejected unless `AI_ALLOW_PRIVATE_BASEURL=true`.
 * Designed for use inside a Zod `.refine(...)` so failures surface as 422s.
 */
export function isPublicHttpUrl(raw: string): boolean {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return false;
  if (process.env.AI_ALLOW_PRIVATE_BASEURL === "true") return true;
  return !isPrivateHostname(url.hostname);
}
