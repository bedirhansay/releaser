import { describe, expect, it } from "vitest";
import { buildMarkdown } from "./markdown";
import {
  RELEASE_CATEGORIES,
  type CategorizedReleaseNotes,
  type ReleaseEntry,
} from "@/types/release";

function emptyNotes(
  overrides: Partial<CategorizedReleaseNotes> = {},
): CategorizedReleaseNotes {
  const base = Object.fromEntries(
    RELEASE_CATEGORIES.map((c) => [c, [] as ReleaseEntry[]]),
  ) as CategorizedReleaseNotes;
  return { ...base, ...overrides };
}

describe("buildMarkdown", () => {
  it("renders a clean header with repo + ref span", () => {
    const md = buildMarkdown({
      title: "Release 1.0",
      summary: "First cut",
      repoFullName: "acme/web",
      base: "v0.9.0",
      head: "v1.0.0",
      notes: emptyNotes(),
      risks: [],
    });
    expect(md).toContain("# Release 1.0");
    expect(md).toContain("acme/web");
    expect(md).toContain("`v0.9.0`");
    expect(md).toContain("`v1.0.0`");
    expect(md).toContain("First cut");
  });

  it("omits sections that have no entries", () => {
    const md = buildMarkdown({
      title: "T",
      summary: "",
      repoFullName: "a/b",
      base: "x",
      head: "y",
      notes: emptyNotes(),
      risks: [],
    });
    for (const cat of RELEASE_CATEGORIES) {
      expect(md).not.toMatch(new RegExp(`## .*${cat}`, "i"));
    }
  });

  it("includes entry refs (commit shorthand + PR numbers)", () => {
    const md = buildMarkdown({
      title: "T",
      summary: "",
      repoFullName: "a/b",
      base: "x",
      head: "y",
      notes: emptyNotes({
        features: [
          {
            title: "Workspace selector",
            commitShas: ["abcdef1234"],
            prNumbers: [42],
          },
        ],
      }),
      risks: [],
    });
    expect(md).toContain("`abcdef1`");
    expect(md).toContain("#42");
    expect(md).toContain("Workspace selector");
  });

  it("renders risk strip with severity + evidence", () => {
    const md = buildMarkdown({
      title: "T",
      summary: "",
      repoFullName: "a/b",
      base: "x",
      head: "y",
      notes: emptyNotes(),
      risks: [
        {
          kind: "auth",
          severity: "high",
          summary: "Session refresh changed",
          evidence: ["src/auth/session.ts"],
        },
      ],
    });
    expect(md).toContain("⚠️ Risk Analysis");
    expect(md).toContain("high");
    expect(md).toContain("Session refresh changed");
    expect(md).toContain("src/auth/session.ts");
  });
});
