import { Octokit } from "@octokit/rest";
import type {
  Branch,
  ChangedFile,
  Commit,
  CompareParams,
  CompareResult,
  GitProvider,
  ListBranchesParams,
  ListCommitsParams,
  ListPullRequestsParams,
  ListReposParams,
  ListTagsParams,
  PullRequest,
  Repository,
  Tag,
} from "@/core/git/types";
import {
  GitAuthError,
  GitNotFoundError,
  GitProviderError,
} from "@/core/git/errors";

const MERGE_PR_RE = /Merge pull request #(\d+)/i;
const SQUASH_PR_RE = /\(#(\d+)\)\s*$/m;

function extractPrNumber(message: string): number | undefined {
  const merge = message.match(MERGE_PR_RE);
  if (merge) return Number(merge[1]);
  const squash = message.match(SQUASH_PR_RE);
  if (squash) return Number(squash[1]);
  return undefined;
}

function wrapError(err: unknown): never {
  const status = (err as { status?: number })?.status;
  if (status === 401 || status === 403) throw new GitAuthError();
  if (status === 404) throw new GitNotFoundError();
  throw new GitProviderError(
    err instanceof Error ? err.message : "GitHub request failed",
    err,
    status,
  );
}

export interface GitHubProviderOptions {
  /**
   * When true the token is a GitHub App *installation* token, so repository
   * listing must come from the installation's granted set rather than the
   * user-scoped endpoint. All other calls are identical.
   */
  installation?: boolean;
}

export class GitHubProvider implements GitProvider {
  readonly kind = "github" as const;
  private readonly octokit: Octokit;
  private readonly installation: boolean;

  constructor(accessToken: string, options: GitHubProviderOptions = {}) {
    if (!accessToken) throw new GitAuthError("Missing GitHub access token");
    this.octokit = new Octokit({ auth: accessToken });
    this.installation = options.installation ?? false;
  }

  async getRepositories(params: ListReposParams = {}): Promise<Repository[]> {
    try {
      const mapRepo = (r: {
        id: number;
        full_name: string;
        name: string;
        owner: { login: string };
        default_branch: string;
        private: boolean;
        description: string | null;
        html_url: string;
        pushed_at?: string | null;
      }): Repository => ({
        id: String(r.id),
        fullName: r.full_name,
        name: r.name,
        owner: r.owner.login,
        defaultBranch: r.default_branch,
        private: r.private,
        description: r.description,
        url: r.html_url,
        pushedAt: r.pushed_at ?? null,
      });

      // App installation tokens can only see the repos the user granted; the
      // user-scoped "listForAuthenticatedUser" endpoint 403s for them.
      const repos = this.installation
        ? (
            await this.octokit.apps.listReposAccessibleToInstallation({
              per_page: params.perPage ?? 100,
              page: params.page ?? 1,
            })
          ).data.repositories.map(mapRepo)
        : (
            await this.octokit.repos.listForAuthenticatedUser({
              per_page: params.perPage ?? 50,
              page: params.page ?? 1,
              sort: "pushed",
              visibility: "all",
              affiliation: "owner,collaborator,organization_member",
            })
          ).data.map(mapRepo);

      const search = params.search?.toLowerCase();
      return search
        ? repos.filter((r) => r.fullName.toLowerCase().includes(search))
        : repos;
    } catch (err) {
      wrapError(err);
    }
  }

  async getBranches({
    owner,
    repo,
    perPage = 100,
  }: ListBranchesParams): Promise<Branch[]> {
    try {
      const { data } = await this.octokit.repos.listBranches({
        owner,
        repo,
        per_page: perPage,
      });
      return data.map((b) => ({
        name: b.name,
        sha: b.commit.sha,
        protected: b.protected,
      }));
    } catch (err) {
      wrapError(err);
    }
  }

  async getCommits({
    owner,
    repo,
    sha,
    perPage = 50,
  }: ListCommitsParams): Promise<Commit[]> {
    try {
      const { data } = await this.octokit.repos.listCommits({
        owner,
        repo,
        sha,
        per_page: perPage,
      });
      return data.map<Commit>((c) => ({
        sha: c.sha,
        shortSha: c.sha.slice(0, 7),
        message: c.commit.message,
        url: c.html_url,
        date: c.commit.author?.date ?? c.commit.committer?.date ?? "",
        author: {
          name: c.commit.author?.name ?? c.author?.login ?? null,
          email: c.commit.author?.email ?? null,
          login: c.author?.login ?? null,
          avatarUrl: c.author?.avatar_url ?? null,
        },
        prNumber: extractPrNumber(c.commit.message),
      }));
    } catch (err) {
      wrapError(err);
    }
  }

  async compareBranches({
    owner,
    repo,
    base,
    head,
  }: CompareParams): Promise<CompareResult> {
    try {
      const { data } = await this.octokit.repos.compareCommitsWithBasehead({
        owner,
        repo,
        basehead: `${base}...${head}`,
      });
      // (catch below narrows the 404 message for missing refs)
      const commits: Commit[] = data.commits.map((c) => ({
        sha: c.sha,
        shortSha: c.sha.slice(0, 7),
        message: c.commit.message,
        url: c.html_url,
        date: c.commit.author?.date ?? c.commit.committer?.date ?? "",
        author: {
          name: c.commit.author?.name ?? c.author?.login ?? null,
          email: c.commit.author?.email ?? null,
          login: c.author?.login ?? null,
          avatarUrl: c.author?.avatar_url ?? null,
        },
        prNumber: extractPrNumber(c.commit.message),
      }));
      const files: ChangedFile[] = (data.files ?? []).map((f) => ({
        path: f.filename,
        status: (f.status as ChangedFile["status"]) ?? "modified",
        additions: f.additions ?? 0,
        deletions: f.deletions ?? 0,
        previousPath: f.previous_filename ?? undefined,
      }));
      return {
        base,
        head,
        aheadBy: data.ahead_by,
        behindBy: data.behind_by,
        commits,
        files,
      };
    } catch (err) {
      const status = (err as { status?: number })?.status;
      // Octokit attaches the raw GitHub body to `response.data` on RequestError.
      const ghBody =
        (err as { response?: { data?: { message?: string } } })?.response
          ?.data?.message;
      if (status === 404) {
        // GitHub returns 404 both when a ref is missing AND when two refs
        // have no common ancestor — distinguish using the body message.
        if (ghBody && /no common ancestor/i.test(ghBody)) {
          throw new GitNotFoundError(
            `${base} and ${head} share no common ancestor in ${owner}/${repo}. These branches have unrelated histories — pick refs from the same lineage.`,
          );
        }
        throw new GitNotFoundError(
          ghBody
            ? `GitHub: ${ghBody}`
            : `Cannot compare ${base}…${head} in ${owner}/${repo} — one of the refs does not exist (or you don't have access).`,
        );
      }
      wrapError(err);
    }
  }

  async getChangedFiles(params: CompareParams): Promise<ChangedFile[]> {
    const compare = await this.compareBranches(params);
    return compare.files;
  }

  async listTags({
    owner,
    repo,
    perPage = 50,
  }: ListTagsParams): Promise<Tag[]> {
    try {
      const { data } = await this.octokit.repos.listTags({
        owner,
        repo,
        per_page: perPage,
      });
      return data.map((t) => ({
        name: t.name,
        sha: t.commit.sha,
      }));
    } catch (err) {
      wrapError(err);
    }
  }

  async listPullRequests({
    owner,
    repo,
    filter,
  }: ListPullRequestsParams): Promise<PullRequest[]> {
    try {
      switch (filter.type) {
        case "last-n":
          return await this.fetchLastN(
            owner,
            repo,
            filter.n,
            filter.base,
            filter.state ?? "merged",
          );
        case "date-range":
          return await this.fetchInRange(
            owner,
            repo,
            filter.since,
            filter.until,
            filter.base,
            filter.state ?? "merged",
          );
        case "between-tags":
          // Between tags only makes sense for merged PRs.
          return await this.fetchMergedBetweenTags(
            owner,
            repo,
            filter.baseTag,
            filter.headTag,
          );
      }
    } catch (err) {
      wrapError(err);
    }
  }

  // --- internal helpers ---

  private toPullRequest(
    pr: Awaited<
      ReturnType<Octokit["pulls"]["list"]>
    >["data"][number] & { merged_at?: string | null },
  ): PullRequest {
    return {
      number: pr.number,
      title: pr.title,
      body: pr.body ?? null,
      state: pr.merged_at ? "merged" : (pr.state as PullRequest["state"]),
      url: pr.html_url,
      author: {
        login: pr.user?.login ?? null,
        name: pr.user?.login ?? null,
        email: null,
        avatarUrl: pr.user?.avatar_url ?? null,
      },
      labels: (pr.labels ?? [])
        .map((l) => (typeof l === "string" ? l : l.name))
        .filter((n): n is string => Boolean(n)),
      baseRef: pr.base?.ref ?? "",
      headRef: pr.head?.ref ?? "",
      mergedAt: pr.merged_at ?? null,
      createdAt: pr.created_at,
      mergeCommitSha: pr.merge_commit_sha ?? null,
    };
  }

  private stateToGitHub(
    state: "merged" | "open" | "all",
  ): "open" | "closed" | "all" {
    // "merged" maps to closed + filter; "all" to all.
    if (state === "open") return "open";
    if (state === "all") return "all";
    return "closed";
  }

  private acceptByState(
    pr: { merged_at?: string | null; state?: string | null },
    state: "merged" | "open" | "all",
  ): boolean {
    if (state === "merged") return Boolean(pr.merged_at);
    if (state === "open") return pr.state === "open";
    return true;
  }

  private async fetchLastN(
    owner: string,
    repo: string,
    n: number,
    base: string | undefined,
    state: "merged" | "open" | "all",
  ): Promise<PullRequest[]> {
    const ghState = this.stateToGitHub(state);
    const out: PullRequest[] = [];
    const perPage = Math.min(Math.max(n * 2, 30), 100);
    let page = 1;
    while (out.length < n && page <= 5) {
      const { data } = await this.octokit.pulls.list({
        owner,
        repo,
        state: ghState,
        sort: "updated",
        direction: "desc",
        per_page: perPage,
        page,
        base,
      });
      if (data.length === 0) break;
      for (const pr of data) {
        if (this.acceptByState(pr, state)) out.push(this.toPullRequest(pr));
        if (out.length >= n) break;
      }
      page += 1;
    }
    return out;
  }

  private async fetchInRange(
    owner: string,
    repo: string,
    since: string,
    until: string,
    base: string | undefined,
    state: "merged" | "open" | "all",
  ): Promise<PullRequest[]> {
    const ghState = this.stateToGitHub(state);
    const sinceT = new Date(since).getTime();
    const untilT = new Date(until).getTime();
    const out: PullRequest[] = [];
    let page = 1;
    while (page <= 10) {
      const { data } = await this.octokit.pulls.list({
        owner,
        repo,
        state: ghState,
        sort: "updated",
        direction: "desc",
        per_page: 100,
        page,
        base,
      });
      if (data.length === 0) break;
      let pastWindow = false;
      for (const pr of data) {
        if (!this.acceptByState(pr, state)) continue;
        // For open PRs we range by created_at; for merged/all by merged_at
        // falling back to updated_at.
        const ref =
          state === "open"
            ? pr.created_at
            : (pr.merged_at ?? pr.updated_at ?? pr.created_at);
        const t = new Date(ref).getTime();
        if (t < sinceT) {
          pastWindow = true;
          continue;
        }
        if (t > untilT) continue;
        out.push(this.toPullRequest(pr));
      }
      if (pastWindow) break;
      page += 1;
    }
    return out;
  }

  private async fetchMergedBetweenTags(
    owner: string,
    repo: string,
    baseTag: string,
    headTag: string,
  ): Promise<PullRequest[]> {
    // Use compare to enumerate commits in (baseTag, headTag], then look up the
    // PR associated with each merge commit. Skips squash-merged commits whose
    // PR has to be inferred from the message — we parse #NUM there.
    const compare = await this.compareBranches({
      owner,
      repo,
      base: baseTag,
      head: headTag,
    });
    const prNumbers = new Set<number>();
    for (const c of compare.commits) {
      if (c.prNumber) prNumbers.add(c.prNumber);
    }
    if (prNumbers.size === 0) return [];

    // Octokit doesn't expose a bulk endpoint; fetch in parallel with a small
    // concurrency cap to stay polite with the secondary rate limit.
    const numbers = Array.from(prNumbers);
    const results: PullRequest[] = [];
    const CONCURRENCY = 5;
    for (let i = 0; i < numbers.length; i += CONCURRENCY) {
      const batch = numbers.slice(i, i + CONCURRENCY);
      const settled = await Promise.allSettled(
        batch.map((n) =>
          this.octokit.pulls.get({ owner, repo, pull_number: n }),
        ),
      );
      for (const s of settled) {
        if (s.status === "fulfilled" && s.value.data.merged_at) {
          results.push(
            this.toPullRequest(
              s.value.data as Parameters<
                GitHubProvider["toPullRequest"]
              >[0],
            ),
          );
        }
      }
    }
    // Sort by merge time desc (most recent first).
    results.sort(
      (a, b) =>
        new Date(b.mergedAt ?? 0).getTime() -
        new Date(a.mergedAt ?? 0).getTime(),
    );
    return results;
  }
}
