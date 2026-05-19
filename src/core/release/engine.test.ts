import { describe, expect, it } from "vitest";
import { ReleaseEngine } from "./engine";
import type { AIProvider, AIPRsInput, AIReleaseInput } from "@/core/ai/types";
import type {
  Branch,
  ChangedFile,
  Commit,
  CompareParams,
  CompareResult,
  GitProvider,
  PullRequest,
  Tag,
} from "@/core/git/types";

function commit(sha: string, message: string): Commit {
  return {
    sha,
    shortSha: sha.slice(0, 7),
    message,
    url: "",
    date: "2026-05-01T00:00:00Z",
    author: { name: "Alice", email: null, login: "alice", avatarUrl: null },
  };
}

function file(path: string): ChangedFile {
  return { path, status: "modified", additions: 5, deletions: 1 };
}

function makeGit(overrides: Partial<GitProvider> = {}): GitProvider {
  return {
    kind: "github",
    getRepositories: async () => [],
    getBranches: async () => [] as Branch[],
    getCommits: async () => [],
    compareBranches: async ({ base, head }: CompareParams): Promise<CompareResult> => ({
      base,
      head,
      aheadBy: 2,
      behindBy: 0,
      commits: [
        commit("aaaaaa1", "feat: add foo"),
        commit("bbbbbb2", "fix(auth): rotate token"),
      ],
      files: [file("src/auth/session.ts"), file("README.md")],
    }),
    getChangedFiles: async () => [],
    listPullRequests: async (): Promise<PullRequest[]> => [],
    listTags: async (): Promise<Tag[]> => [],
    ...overrides,
  };
}

function makeAI(): AIProvider {
  const calls: { input: AIReleaseInput | AIPRsInput; kind: "compare" | "prs" }[] = [];
  return {
    name: "mock",
    model: "test",
    generateReleaseNotes: async (input: AIReleaseInput) => {
      calls.push({ input, kind: "compare" });
      return {
        title: "Mock release",
        summary: "Two commits.",
        notes: {
          features: [
            { title: "add foo", description: undefined, commitShas: ["aaaaaa1"] },
          ],
          fixes: [],
          refactors: [],
          performance: [],
          security: [],
          breaking: [],
          docs: [],
          chore: [],
        },
        risks: [],
      };
    },
    generateFromPullRequests: async (input: AIPRsInput) => {
      calls.push({ input, kind: "prs" });
      return {
        title: "PR-based mock",
        summary: "",
        notes: {
          features: [],
          fixes: [],
          refactors: [],
          performance: [],
          security: [],
          breaking: [],
          docs: [],
          chore: [],
        },
        risks: [],
      };
    },
    // @ts-expect-error — visible only on the mock
    calls,
  };
}

describe("ReleaseEngine.generate", () => {
  it("rejects empty windows", async () => {
    const engine = new ReleaseEngine({
      git: makeGit({
        compareBranches: async () => ({
          base: "x",
          head: "y",
          aheadBy: 0,
          behindBy: 0,
          commits: [],
          files: [],
        }),
      }),
      ai: makeAI(),
    });
    await expect(
      engine.generate({ owner: "a", repo: "b", base: "x", head: "y" }),
    ).rejects.toThrow(/no commits/i);
  });

  it("calls AI with commits, files, and risk hints; unions risks", async () => {
    const ai = makeAI();
    const engine = new ReleaseEngine({ git: makeGit(), ai });
    const out = await engine.generate({
      owner: "a",
      repo: "b",
      base: "main",
      head: "feature",
    });
    expect(out.title).toBe("Mock release");
    expect(out.modelUsed).toBe("mock:test");
    // Heuristic risk hint (auth file change) merged in even though AI returned [].
    expect(out.risks.find((r) => r.kind === "auth")).toBeDefined();
    // Markdown contains the heuristic risk.
    expect(out.markdown).toContain("Risk Analysis");
  });
});

describe("ReleaseEngine.generateFromPRs", () => {
  it("rejects empty PR windows", async () => {
    const engine = new ReleaseEngine({
      git: makeGit({ listPullRequests: async () => [] }),
      ai: makeAI(),
    });
    await expect(
      engine.generateFromPRs({
        owner: "a",
        repo: "b",
        filter: { type: "last-n", n: 10 },
      }),
    ).rejects.toThrow(/no merged pull requests/i);
  });

  it("derives risk hints from PR labels and surfaces them", async () => {
    const pr: PullRequest = {
      number: 42,
      title: "Refresh session",
      body: null,
      state: "merged",
      url: "",
      author: { login: "alice", name: "Alice", email: null, avatarUrl: null },
      labels: ["auth"],
      baseRef: "main",
      headRef: "feature",
      mergedAt: "2026-05-01T00:00:00Z",
      createdAt: "2026-04-30T00:00:00Z",
      mergeCommitSha: "ccc",
    };
    const engine = new ReleaseEngine({
      git: makeGit({ listPullRequests: async () => [pr] }),
      ai: makeAI(),
    });
    const out = await engine.generateFromPRs({
      owner: "a",
      repo: "b",
      filter: { type: "last-n", n: 1 },
    });
    expect(out.pullRequests).toHaveLength(1);
    expect(out.risks.find((r) => r.kind === "auth")?.severity).toBe("high");
  });
});
