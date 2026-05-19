import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// Reuse the PrismaClient across hot reloads in dev to avoid exhausting DB
// connections. In production each instance creates its own client.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createClient() {
  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL ?? "",
  });
  return new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
