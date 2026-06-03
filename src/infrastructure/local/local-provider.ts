import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import { stat } from "node:fs/promises";
import { readdir } from "node:fs/promises";
import type {
  Branch,
  ChangedFile,
  Commit,
  CompareParams,
  CompareResult,
  GitProvider,
  ListBranchesParams,
  ListCommitsParams,
  ListReposParams,
  ListTagsParams,
  PullRequest,
  Repository,
  Tag,
} from "@/core/git/types";
import {
  GitNotFoundError,
  GitProviderError,
} from "@/core/git/errors";

const execFileAsync = promisify(execFile);

// Field/record separators for `git log` formatting — chosen because they never
// appear in commit metadata, so we can parse multi-line bodies safely.
const FS = "\x1f"; // unit separator — between fields
const RS = "\x1e"; // record separator — between commits
const LOG_FORMAT = ["%H", "%h", "%an", "%ae", "%aI", "%B"].join(FS) + RS;

const MERGE_PR_RE = /Merge pull request #(\d+)/i;
const SQUASH_PR_RE = /\(#(\d+)\)\s*$/m;

function extractPrNumber(message: string): number | undefined {
  const merge = message.match(MERGE_PR_RE);
  if (merge) return Number(merge[1]);
  const squash = message.match(SQUASH_PR_RE);
  if (squash) return Number(squash[1]);
  return undefined;
}

/**
 * Reject refs that could be mistaken for git flags or break argument parsing.
 * Combined with execFile (no shell), this closes flag-injection on ref inputs.
 */
function assertSafeRef(ref: string): void {
  if (!ref || ref.startsWith("-") || /[\0\n]/.test(ref)) {
    throw new GitProviderError(`Invalid git ref: ${JSON.stringify(ref)}`);
  }
}

/**
 * Reads release-note source data straight from git clones on disk under a
 * configured base directory — no remote API, token, or network. Pull requests
 * don't exist in a bare clone, so {@link listPullRequests} is unsupported;
 * everything else mirrors the GitHubProvider contract.
 */
export class LocalGitProvider implements GitProvider {
  readonly kind = "local" as const;

  constructor(private readonly baseDir: string) {}

  /** Resolve `repo` to an absolute path, refusing anything outside baseDir. */
  private async repoPath(repo: string): Promise<string> {
    if (/[\0]/.test(repo)) {
      throw new GitNotFoundError(`Invalid repository: ${JSON.stringify(repo)}`);
    }
    const root = path.resolve(this.baseDir);
    const full = path.resolve(root, repo);
    // Must stay within the configured base directory (block ../ traversal).
    if (full !== root && !full.startsWith(root + path.sep)) {
      throw new GitNotFoundError(
        `Repository "${repo}" is outside the allowed directory.`,
      );
    }
    try {
      const gitDir = await stat(path.join(full, ".git"));
      if (!gitDir.isDirectory() && !gitDir.isFile()) throw new Error("no .git");
    } catch {
      throw new GitNotFoundError(`"${repo}" is not a git repository.`);
    }
    return full;
  }

  /** Run a git command inside `cwd` and return stdout. */
  private async git(cwd: string, args: string[]): Promise<string> {
    try {
      const { stdout } = await execFileAsync("git", args, {
        cwd,
        maxBuffer: 64 * 1024 * 1024,
        windowsHide: true,
      });
      return stdout;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "git command failed";
      throw new GitProviderError(`Local git error: ${msg}`, err);
    }
  }

  async getRepositories(params: ListReposParams = {}): Promise<Repository[]> {
    const root = path.resolve(this.baseDir);
    let entries: string[];
    try {
      const dirents = await readdir(root, { withFileTypes: true });
      entries = dirents.filter((d) => d.isDirectory()).map((d) => d.name);
    } catch {
      throw new GitNotFoundError(
        `Local repos directory not found or unreadable: ${root}`,
      );
    }

    const repos: Repository[] = [];
    for (const name of entries) {
      const full = path.join(root, name);
      try {
        await stat(path.join(full, ".git"));
      } catch {
        continue; // not a git repo — skip
      }
      let defaultBranch = "main";
      let pushedAt: string | null = null;
      try {
        defaultBranch = (
          await this.git(full, ["symbolic-ref", "--short", "HEAD"])
        ).trim() || "main";
      } catch {
        /* detached HEAD or empty repo — keep fallback */
      }
      try {
        pushedAt = (
          await this.git(full, ["log", "-1", "--format=%cI"])
        ).trim() || null;
      } catch {
        /* no commits yet */
      }
      repos.push({
        id: name,
        fullName: `local/${name}`,
        name,
        owner: "local",
        defaultBranch,
        private: true,
        description: null,
        url: `file://${full}`,
        pushedAt,
      });
    }

    const search = params.search?.toLowerCase();
    const filtered = search
      ? repos.filter((r) => r.fullName.toLowerCase().includes(search))
      : repos;
    return filtered.sort((a, b) => (b.pushedAt ?? "").localeCompare(a.pushedAt ?? ""));
  }

  async getBranches({ repo }: ListBranchesParams): Promise<Branch[]> {
    const cwd = await this.repoPath(repo);
    const out = await this.git(cwd, [
      "for-each-ref",
      `--format=%(refname:short)${FS}%(objectname)`,
      "refs/heads",
    ]);
    return out
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        const [name, sha] = line.split(FS);
        return { name, sha, protected: false };
      });
  }

  async getCommits({
    repo,
    sha,
    perPage = 50,
  }: ListCommitsParams): Promise<Commit[]> {
    const cwd = await this.repoPath(repo);
    const args = ["log", `--format=${LOG_FORMAT}`, "-n", String(perPage)];
    if (sha) {
      assertSafeRef(sha);
      args.push("--end-of-options", sha);
    }
    const out = await this.git(cwd, args);
    return this.parseCommits(out);
  }

  async compareBranches({
    repo,
    base,
    head,
  }: CompareParams): Promise<CompareResult> {
    const cwd = await this.repoPath(repo);
    assertSafeRef(base);
    assertSafeRef(head);

    // Commits unique to `head` (two-dot), matching a GitHub compare's commit list.
    const logOut = await this.git(cwd, [
      "log",
      `--format=${LOG_FORMAT}`,
      "--end-of-options",
      `${base}..${head}`,
    ]);
    const commits = this.parseCommits(logOut);

    // ahead/behind via symmetric difference: "<behind>\t<ahead>".
    let aheadBy = commits.length;
    let behindBy = 0;
    try {
      const rl = await this.git(cwd, [
        "rev-list",
        "--left-right",
        "--count",
        "--end-of-options",
        `${base}...${head}`,
      ]);
      const [behind, ahead] = rl.trim().split(/\s+/).map((n) => Number(n) || 0);
      behindBy = behind;
      aheadBy = ahead;
    } catch {
      /* keep commit-count fallback */
    }

    const files = await this.diffFiles(cwd, base, head);
    return { base, head, aheadBy, behindBy, commits, files };
  }

  async getChangedFiles(params: CompareParams): Promise<ChangedFile[]> {
    const compare = await this.compareBranches(params);
    return compare.files;
  }

  async listTags({ repo, perPage = 50 }: ListTagsParams): Promise<Tag[]> {
    const cwd = await this.repoPath(repo);
    const out = await this.git(cwd, [
      "for-each-ref",
      "--sort=-creatordate",
      `--count=${perPage}`,
      `--format=%(refname:short)${FS}%(objectname)${FS}%(creatordate:iso-strict)`,
      "refs/tags",
    ]);
    return out
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        const [name, sha, date] = line.split(FS);
        return { name, sha, date: date || undefined };
      });
  }

  async listPullRequests(): Promise<PullRequest[]> {
    throw new GitProviderError(
      "Local repositories don't expose pull requests — use branch/tag comparison instead.",
    );
  }

  // --- internal helpers ---

  private parseCommits(logOutput: string): Commit[] {
    return logOutput
      .split(RS)
      .map((r) => r.replace(/^\n/, ""))
      .filter((r) => r.trim().length > 0)
      .map((record) => {
        const parts = record.split(FS);
        const [sha, shortSha, authorName, authorEmail, date] = parts;
        const message = (parts.slice(5).join(FS) ?? "").trim();
        return {
          sha,
          shortSha,
          message,
          url: "",
          date: date ?? "",
          author: {
            name: authorName || null,
            email: authorEmail || null,
            login: null,
            avatarUrl: null,
          },
          prNumber: extractPrNumber(message),
        } satisfies Commit;
      });
  }

  /**
   * Build the changed-file list from a `base...head` diff. Status comes from
   * --name-status, line counts from --numstat, keyed by the (post-rename) path.
   */
  private async diffFiles(
    cwd: string,
    base: string,
    head: string,
  ): Promise<ChangedFile[]> {
    const range = `${base}...${head}`;
    const [nameStatus, numstat] = await Promise.all([
      this.git(cwd, ["diff", "-M", "--name-status", "--end-of-options", range]),
      this.git(cwd, ["diff", "-M", "--numstat", "--end-of-options", range]),
    ]);

    const counts = new Map<string, { additions: number; deletions: number }>();
    for (const line of numstat.split("\n").filter(Boolean)) {
      const [addRaw, delRaw, ...rest] = line.split("\t");
      const pathField = rest.join("\t");
      const filePath = renameTargetPath(pathField);
      counts.set(filePath, {
        additions: addRaw === "-" ? 0 : Number(addRaw) || 0,
        deletions: delRaw === "-" ? 0 : Number(delRaw) || 0,
      });
    }

    const files: ChangedFile[] = [];
    for (const line of nameStatus.split("\n").filter(Boolean)) {
      const cols = line.split("\t");
      const code = cols[0] ?? "";
      const letter = code[0];
      let filePath: string;
      let previousPath: string | undefined;
      let status: ChangedFile["status"];
      if (letter === "R" || letter === "C") {
        previousPath = cols[1];
        filePath = cols[2] ?? cols[1];
        status = letter === "R" ? "renamed" : "modified";
      } else {
        filePath = cols[1] ?? "";
        status =
          letter === "A"
            ? "added"
            : letter === "D"
              ? "removed"
              : "modified";
      }
      const c = counts.get(filePath) ?? { additions: 0, deletions: 0 };
      files.push({
        path: filePath,
        status,
        additions: c.additions,
        deletions: c.deletions,
        previousPath,
      });
    }
    return files;
  }
}

/**
 * git --numstat renders renames as either "old => new" or "pre{old => new}post".
 * Return the resulting (new) path so it matches --name-status's target column.
 */
function renameTargetPath(field: string): string {
  if (!field.includes("=>")) return field;
  const braced = field.match(/^(.*)\{.* => (.*)\}(.*)$/);
  if (braced) return `${braced[1]}${braced[2]}${braced[3]}`.replace(/\/\//g, "/");
  const simple = field.match(/^.* => (.*)$/);
  return simple ? simple[1] : field;
}
