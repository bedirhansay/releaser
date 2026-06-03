import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { LocalGitProvider } from "./local-provider";
import { GitNotFoundError, GitProviderError } from "@/core/git/errors";

// Sets up a real on-disk git repo so we exercise the actual `git` CLI parsing.
let baseDir: string;
const REPO = "demo";

function git(cwd: string, args: string[]) {
  execFileSync("git", args, {
    cwd,
    stdio: "pipe",
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: "Tester",
      GIT_AUTHOR_EMAIL: "tester@example.com",
      GIT_COMMITTER_NAME: "Tester",
      GIT_COMMITTER_EMAIL: "tester@example.com",
    },
  });
}

beforeAll(() => {
  baseDir = mkdtempSync(path.join(tmpdir(), "releaser-local-"));
  const repo = path.join(baseDir, REPO);
  mkdirSync(repo);
  git(repo, ["init", "-q", "-b", "main"]);
  writeFileSync(path.join(repo, "a.txt"), "one\n");
  git(repo, ["add", "."]);
  git(repo, ["commit", "-q", "-m", "feat: first commit (#1)"]);
  git(repo, ["tag", "v1"]);
  writeFileSync(path.join(repo, "a.txt"), "one\ntwo\n");
  writeFileSync(path.join(repo, "b.txt"), "new file\n");
  git(repo, ["add", "."]);
  git(repo, ["commit", "-q", "-m", "fix: second commit (#2)"]);
  git(repo, ["tag", "v2"]);
});

afterAll(() => {
  if (baseDir) rmSync(baseDir, { recursive: true, force: true });
});

describe("LocalGitProvider", () => {
  it("lists on-disk repos under the base dir", async () => {
    const provider = new LocalGitProvider(baseDir);
    const repos = await provider.getRepositories();
    expect(repos).toHaveLength(1);
    expect(repos[0]).toMatchObject({
      name: REPO,
      owner: "local",
      fullName: `local/${REPO}`,
      defaultBranch: "main",
    });
  });

  it("returns commits with parsed PR numbers", async () => {
    const provider = new LocalGitProvider(baseDir);
    const commits = await provider.getCommits({
      owner: "local",
      repo: REPO,
      perPage: 10,
    });
    expect(commits).toHaveLength(2);
    expect(commits[0].message).toContain("second commit");
    expect(commits[0].prNumber).toBe(2);
    expect(commits[1].prNumber).toBe(1);
  });

  it("compares two tags", async () => {
    const provider = new LocalGitProvider(baseDir);
    const cmp = await provider.compareBranches({
      owner: "local",
      repo: REPO,
      base: "v1",
      head: "v2",
    });
    expect(cmp.aheadBy).toBe(1);
    expect(cmp.behindBy).toBe(0);
    expect(cmp.commits).toHaveLength(1);
    const paths = cmp.files.map((f) => f.path).sort();
    expect(paths).toEqual(["a.txt", "b.txt"]);
    const added = cmp.files.find((f) => f.path === "b.txt");
    expect(added?.status).toBe("added");
  });

  it("lists tags", async () => {
    const provider = new LocalGitProvider(baseDir);
    const tags = await provider.listTags({ owner: "local", repo: REPO });
    // Order is by creatordate desc, but same-second commits can tie — just
    // assert both tags are surfaced.
    expect(tags.map((t) => t.name).sort()).toEqual(["v1", "v2"]);
  });

  it("rejects pull request requests (unsupported for local)", async () => {
    const provider = new LocalGitProvider(baseDir);
    await expect(provider.listPullRequests()).rejects.toBeInstanceOf(
      GitProviderError,
    );
  });

  it("blocks path traversal outside the base dir", async () => {
    const provider = new LocalGitProvider(baseDir);
    await expect(
      provider.getBranches({ owner: "local", repo: "../../etc" }),
    ).rejects.toBeInstanceOf(GitNotFoundError);
  });

  it("errors for a non-existent repo", async () => {
    const provider = new LocalGitProvider(baseDir);
    await expect(
      provider.getBranches({ owner: "local", repo: "nope" }),
    ).rejects.toBeInstanceOf(GitNotFoundError);
  });
});
