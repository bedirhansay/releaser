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

const API = "https://api.bitbucket.org/2.0";

// Bitbucket commit messages from PR merges look like:
//   "Merged in feature/foo (pull request #42)"
//   "Merge pull request #42 in repo"
const PR_RE = /pull request #(\d+)|#(\d+)\)\s*$/i;

function extractPrNumber(message: string): number | undefined {
  const m = message.match(PR_RE);
  if (!m) return undefined;
  return Number(m[1] ?? m[2]);
}

interface BitbucketPaged<T> {
  values: T[];
  next?: string;
  page?: number;
  size?: number;
}

interface BBUser {
  display_name?: string;
  nickname?: string;
  account_id?: string;
  links?: { avatar?: { href?: string } };
}

interface BBRepo {
  uuid: string;
  full_name: string;
  name: string;
  workspace: { slug: string };
  mainbranch?: { name: string };
  is_private: boolean;
  description: string | null;
  links: { html: { href: string } };
  updated_on: string | null;
}

interface BBBranchTarget {
  hash: string;
}

interface BBBranch {
  name: string;
  target: BBBranchTarget;
}

interface BBCommit {
  hash: string;
  message: string;
  date: string;
  author?: {
    raw?: string;
    user?: BBUser;
  };
  links: { html: { href: string } };
}

interface BBDiffStat {
  status: "added" | "modified" | "removed" | "renamed" | string;
  lines_added: number;
  lines_removed: number;
  old?: { path: string } | null;
  new?: { path: string } | null;
}

function mapStatus(s: string): ChangedFile["status"] {
  switch (s) {
    case "added":
    case "modified":
    case "removed":
    case "renamed":
      return s;
    default:
      return "modified";
  }
}

export class BitbucketProvider implements GitProvider {
  readonly kind = "bitbucket" as const;
  private readonly token: string;

  constructor(accessToken: string) {
    if (!accessToken) throw new GitAuthError("Missing Bitbucket access token");
    this.token = accessToken;
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const url = path.startsWith("http") ? path : `${API}${path}`;
    const res = await fetch(url, {
      ...init,
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${this.token}`,
        ...(init?.headers ?? {}),
      },
    });
    if (res.status === 401 || res.status === 403) {
      throw new GitAuthError("Bitbucket authentication failed");
    }
    if (res.status === 404) {
      throw new GitNotFoundError("Bitbucket resource not found");
    }
    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText);
      throw new GitProviderError(
        `Bitbucket request failed (${res.status}): ${text}`,
        undefined,
        res.status,
      );
    }
    return (await res.json()) as T;
  }

  // Walks `next` links until `cap` items collected or pages exhausted.
  private async paginate<T>(initialPath: string, cap: number): Promise<T[]> {
    const out: T[] = [];
    let url: string | undefined = initialPath;
    while (url && out.length < cap) {
      const page: BitbucketPaged<T> = await this.request(url);
      out.push(...page.values);
      url = page.next;
    }
    return out.slice(0, cap);
  }

  async getRepositories(params: ListReposParams = {}): Promise<Repository[]> {
    const perPage = Math.min(params.perPage ?? 50, 100);

    // CHANGE-2770 (Apr 14 2026): the cross-workspace `GET /2.0/repositories?
    // role=member` was removed. We now enumerate the user's workspaces, then
    // list repos per workspace — both workspace-scoped endpoints that remain
    // supported. If even workspace enumeration is unavailable, degrade to an
    // empty list so the UI falls back to manual owner/repo entry rather than
    // surfacing a 410.
    let workspaceSlugs: string[];
    try {
      const workspaces = await this.paginate<{ slug: string }>(
        `/workspaces?pagelen=100`,
        100,
      );
      workspaceSlugs = workspaces.map((w) => w.slug);
    } catch {
      return [];
    }

    const collected: BBRepo[] = [];
    for (const slug of workspaceSlugs) {
      if (collected.length >= perPage) break;
      const qs = new URLSearchParams({
        pagelen: String(perPage),
        sort: "-updated_on",
      });
      if (params.search) qs.set("q", `name ~ "${params.search}"`);
      try {
        const repos = await this.paginate<BBRepo>(
          `/repositories/${slug}?${qs.toString()}`,
          perPage,
        );
        collected.push(...repos);
      } catch {
        // A workspace we can't read shouldn't break the whole listing.
      }
    }

    // Merge across workspaces, most recently updated first, then cap.
    collected.sort((a, b) =>
      (b.updated_on ?? "").localeCompare(a.updated_on ?? ""),
    );
    return collected.slice(0, perPage).map<Repository>((r) => ({
      id: r.uuid,
      fullName: r.full_name,
      name: r.name,
      owner: r.workspace.slug,
      defaultBranch: r.mainbranch?.name ?? "main",
      private: r.is_private,
      description: r.description,
      url: r.links.html.href,
      pushedAt: r.updated_on,
    }));
  }

  async getBranches({
    owner,
    repo,
    perPage = 100,
  }: ListBranchesParams): Promise<Branch[]> {
    const branches = await this.paginate<BBBranch>(
      `/repositories/${owner}/${repo}/refs/branches?pagelen=${perPage}`,
      perPage,
    );
    return branches.map((b) => ({
      name: b.name,
      sha: b.target.hash,
      protected: false, // Bitbucket exposes this via a separate restrictions API; skip for MVP.
    }));
  }

  async getCommits({
    owner,
    repo,
    sha,
    perPage = 50,
  }: ListCommitsParams): Promise<Commit[]> {
    const path = sha
      ? `/repositories/${owner}/${repo}/commits/${encodeURIComponent(sha)}?pagelen=${perPage}`
      : `/repositories/${owner}/${repo}/commits?pagelen=${perPage}`;
    const commits = await this.paginate<BBCommit>(path, perPage);
    return commits.map((c) => this.toCommit(c));
  }

  async compareBranches({
    owner,
    repo,
    base,
    head,
  }: CompareParams): Promise<CompareResult> {
    // Bitbucket has no single "compare" endpoint; combine two calls:
    //   1. /commits?include=head&exclude=base — commits reachable from head but not base
    //   2. /diffstat/{head}..{base}            — file-level changes
    const commitsPath = `/repositories/${owner}/${repo}/commits?include=${encodeURIComponent(head)}&exclude=${encodeURIComponent(base)}&pagelen=100`;
    const diffPath = `/repositories/${owner}/${repo}/diffstat/${encodeURIComponent(head)}..${encodeURIComponent(base)}?pagelen=500`;

    const [rawCommits, rawDiffs] = await Promise.all([
      this.paginate<BBCommit>(commitsPath, 200),
      this.paginate<BBDiffStat>(diffPath, 500),
    ]);

    const commits = rawCommits.map((c) => this.toCommit(c));
    const files: ChangedFile[] = rawDiffs.map((d) => {
      const path = d.new?.path ?? d.old?.path ?? "";
      const isRename =
        d.old?.path && d.new?.path && d.old.path !== d.new.path;
      return {
        path,
        status: isRename ? "renamed" : mapStatus(d.status),
        additions: d.lines_added ?? 0,
        deletions: d.lines_removed ?? 0,
        previousPath:
          isRename && d.old?.path && d.old.path !== d.new?.path
            ? d.old.path
            : undefined,
      };
    });

    return {
      base,
      head,
      aheadBy: commits.length,
      behindBy: 0, // Bitbucket doesn't return this cheaply; leave 0 for MVP.
      commits,
      files,
    };
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
    const tags = await this.paginate<{ name: string; target: { hash: string; date?: string } }>(
      `/repositories/${owner}/${repo}/refs/tags?pagelen=${perPage}&sort=-target.date`,
      perPage,
    );
    return tags.map((t) => ({
      name: t.name,
      sha: t.target.hash,
      date: t.target.date,
    }));
  }

  async listPullRequests({
    owner,
    repo,
    filter,
  }: ListPullRequestsParams): Promise<PullRequest[]> {
    // Bitbucket's PR listing supports filtering via BBQL — we can push state,
    // date and destination-branch filters down to the API for cheap windowing.
    const base = "base" in filter ? filter.base : undefined;
    const baseClause = base ? ` AND destination.branch.name="${base}"` : "";
    const state =
      filter.type === "between-tags"
        ? "merged"
        : (filter.state ?? "merged");
    const stateClause =
      state === "merged"
        ? `state="MERGED"`
        : state === "open"
          ? `state="OPEN"`
          : `(state="OPEN" OR state="MERGED")`;
    let q = `${stateClause}${baseClause}`;
    let cap = 50;
    if (filter.type === "date-range") {
      q += ` AND updated_on >= ${filter.since.slice(0, 10)} AND updated_on <= ${filter.until.slice(0, 10)}`;
    } else if (filter.type === "last-n") {
      cap = filter.n;
    } else if (filter.type === "between-tags") {
      // Bitbucket has no equivalent of "PRs between two tags". Best effort:
      // pull all merged PRs and let the caller filter by tag-merge-date range.
      const tags = await this.listTags({ owner, repo, perPage: 200 });
      const baseT = tags.find((t) => t.name === filter.baseTag);
      const headT = tags.find((t) => t.name === filter.headTag);
      if (baseT?.date && headT?.date) {
        const since = baseT.date < headT.date ? baseT.date : headT.date;
        const until = baseT.date < headT.date ? headT.date : baseT.date;
        q += ` AND updated_on >= ${since.slice(0, 10)} AND updated_on <= ${until.slice(0, 10)}`;
      }
    }

    const qs = new URLSearchParams({
      q,
      sort: "-updated_on",
      pagelen: String(Math.min(cap, 50)),
    });
    interface BBPullRequest {
      id: number;
      title: string;
      summary?: { raw?: string };
      state: string;
      links: { html: { href: string } };
      author?: { display_name?: string; nickname?: string; links?: { avatar?: { href?: string } } };
      destination?: { branch: { name: string } };
      source?: { branch: { name: string } };
      updated_on: string;
      created_on: string;
      merge_commit?: { hash: string };
    }
    const raw = await this.paginate<BBPullRequest>(
      `/repositories/${owner}/${repo}/pullrequests?${qs.toString()}`,
      cap,
    );
    return raw.slice(0, cap).map<PullRequest>((p) => ({
      number: p.id,
      title: p.title,
      body: p.summary?.raw ?? null,
      state:
        p.state === "OPEN"
          ? "open"
          : p.state === "MERGED"
            ? "merged"
            : "closed",
      url: p.links.html.href,
      author: {
        login: p.author?.nickname ?? null,
        name: p.author?.display_name ?? p.author?.nickname ?? null,
        email: null,
        avatarUrl: p.author?.links?.avatar?.href ?? null,
      },
      // Bitbucket doesn't expose labels via the REST PR list endpoint.
      labels: [],
      baseRef: p.destination?.branch.name ?? "",
      headRef: p.source?.branch.name ?? "",
      mergedAt: p.updated_on,
      createdAt: p.created_on,
      mergeCommitSha: p.merge_commit?.hash ?? null,
    }));
  }

  private toCommit(c: BBCommit): Commit {
    const rawAuthor = c.author?.raw ?? "";
    const emailMatch = rawAuthor.match(/<([^>]+)>/);
    const nameMatch = rawAuthor.replace(/<[^>]+>/, "").trim();
    return {
      sha: c.hash,
      shortSha: c.hash.slice(0, 7),
      message: c.message,
      url: c.links.html.href,
      date: c.date,
      author: {
        name:
          c.author?.user?.display_name ??
          nameMatch ??
          c.author?.user?.nickname ??
          null,
        email: emailMatch?.[1] ?? null,
        login: c.author?.user?.nickname ?? null,
        avatarUrl: c.author?.user?.links?.avatar?.href ?? null,
      },
      prNumber: extractPrNumber(c.message),
    };
  }
}
