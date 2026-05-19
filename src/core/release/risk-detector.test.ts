import { describe, expect, it } from "vitest";
import { detectRisks } from "./risk-detector";
import type { ChangedFile, Commit } from "@/core/git/types";

function file(path: string, additions = 1, deletions = 0): ChangedFile {
  return { path, status: "modified", additions, deletions };
}

function commit(message: string, sha = "abc1234"): Commit {
  return {
    sha,
    shortSha: sha.slice(0, 7),
    message,
    url: "",
    date: "",
    author: { name: null, email: null, login: null, avatarUrl: null },
  };
}

describe("detectRisks", () => {
  it("flags auth file changes as high", () => {
    const risks = detectRisks([file("src/auth/session.ts")], []);
    expect(risks.find((r) => r.kind === "auth")).toMatchObject({
      kind: "auth",
      severity: "high",
    });
  });

  it("flags database migrations as high", () => {
    const risks = detectRisks(
      [file("prisma/migrations/001_init/migration.sql")],
      [],
    );
    expect(risks.find((r) => r.kind === "database")?.severity).toBe("high");
  });

  it("aggregates evidence per kind without duplicates", () => {
    const risks = detectRisks(
      [file("payments/stripe.ts"), file("payments/checkout.ts")],
      [commit("fix(payment): update invoice format")],
    );
    const payment = risks.find((r) => r.kind === "payment");
    expect(payment).toBeDefined();
    expect(payment!.evidence.length).toBeGreaterThanOrEqual(2);
  });

  it("promotes severity when a higher-severity rule also matches", () => {
    const risks = detectRisks(
      [file("config/feature.yaml"), file(".env.example")],
      [],
    );
    const cfg = risks.find((r) => r.kind === "config");
    expect(["low", "medium"]).toContain(cfg!.severity);
  });

  it("sorts findings by severity desc", () => {
    const risks = detectRisks(
      [file(".github/workflows/ci.yml"), file("src/auth/login.ts")],
      [],
    );
    const order = risks.map((r) => r.severity);
    expect(order[0]).toBe("high");
  });

  it("caps evidence list at 12", () => {
    const files = Array.from({ length: 20 }, (_, i) =>
      file(`src/auth/handler${i}.ts`),
    );
    const risks = detectRisks(files, []);
    const auth = risks.find((r) => r.kind === "auth")!;
    expect(auth.evidence.length).toBeLessThanOrEqual(13); // 12 + the "…" marker
    expect(auth.evidence).toContain("…");
  });

  it("returns empty when nothing matches", () => {
    expect(detectRisks([file("README.md")], [commit("chore: tidy up")])).toEqual([]);
  });
});
