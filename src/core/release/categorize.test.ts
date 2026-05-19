import { describe, expect, it } from "vitest";
import { categorizeCommit } from "./categorize";
import type { Commit } from "@/core/git/types";

function commit(message: string): Commit {
  return {
    sha: "abc1234",
    shortSha: "abc1234",
    message,
    url: "",
    date: "",
    author: { name: null, email: null, login: null, avatarUrl: null },
  };
}

describe("categorizeCommit", () => {
  it.each([
    ["feat: add x", "features"],
    ["feat(api): scope works", "features"],
    ["fix: panic on empty input", "fixes"],
    ["fix(auth)!: rotate keys — breaking", "breaking"],
    ["perf: avoid n^2 loop", "performance"],
    ["refactor: extract helper", "refactors"],
    ["sec: sanitize redirect", "security"],
    ["docs: update README", "docs"],
    ["chore: bump deps", "chore"],
    ["ci: add lint job", "chore"],
    ["BREAKING CHANGE: drop v1 api", "breaking"],
  ])("classifies %j as %s", (msg, expected) => {
    expect(categorizeCommit(commit(msg))).toBe(expected);
  });

  it("falls back on keywords when no conventional prefix", () => {
    expect(categorizeCommit(commit("bug in checkout"))).toBe("fixes");
    expect(categorizeCommit(commit("introduce a workspace switcher"))).toBe(
      "features",
    );
    expect(categorizeCommit(commit("optimize compare endpoint"))).toBe(
      "performance",
    );
    expect(categorizeCommit(commit("escape user input properly"))).toBe(
      "security",
    );
  });

  it("defaults to chore for messages with no signal", () => {
    expect(categorizeCommit(commit("typo"))).toBe("chore");
    expect(categorizeCommit(commit("updates"))).toBe("chore");
  });
});
