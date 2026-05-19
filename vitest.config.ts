import { defineConfig } from "vitest/config";
import path from "node:path";

/**
 * Vitest config — Node environment (we test pure domain code, not React
 * components). Path alias mirrors tsconfig so imports work the same.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/core/**", "src/infrastructure/crypto/**", "src/shared/api/rate-limit.ts"],
      reporter: ["text", "html"],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
