import { NextResponse } from "next/server";
import { prisma } from "@/infrastructure/db/prisma";

// Liveness/readiness probe for load balancers and uptime monitors. Verifies
// the process is up AND can reach the database. Public by design (no secrets in
// the response). Never cached.
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json(
      { status: "ok", db: "up", time: new Date().toISOString() },
      { headers: { "cache-control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { status: "degraded", db: "down", time: new Date().toISOString() },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }
}

export const dynamic = "force-dynamic";
