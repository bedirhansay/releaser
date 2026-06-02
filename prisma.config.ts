import "dotenv/config";
import { defineConfig } from "prisma/config";

// Prisma 7 — connection URL moves out of schema.prisma and into here.
// The same DATABASE_URL is also consumed at runtime via the @prisma/adapter-pg
// driver adapter in src/infrastructure/db/prisma.ts.
export default defineConfig({
  schema: "./prisma/schema.prisma",
  datasource: {
    url: process.env.DATABASE_URL ?? "",
  },
  migrations: {
    seed: "tsx prisma/seed.ts",
  },
});
