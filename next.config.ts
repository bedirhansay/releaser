import type { NextConfig } from "next";

/**
 * Conservative security headers applied to every response.
 *
 * Intentionally avoided here:
 *  - Content-Security-Policy: Monaco editor + react-markdown need a
 *    carefully crafted CSP. Tracked separately so we don't ship one that
 *    breaks the editor.
 *  - Permissions-Policy: nothing browser-API-heavy yet.
 *
 * HSTS only takes effect over HTTPS, so it's a no-op locally but enforces
 * the policy in production.
 */
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains",
  },
];

const nextConfig: NextConfig = {
  // Prisma + driver-adapter + pg are native-ish Node packages; tell Next to
  // load them as regular Node modules at runtime instead of bundling. Prevents
  // Turbopack from trying to resolve their versioned pnpm paths at runtime.
  serverExternalPackages: ["@prisma/client", "@prisma/adapter-pg", "pg"],
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
