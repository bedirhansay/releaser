// Provider-agnostic git domain types.
// Both GitHub and (future) Bitbucket/GitLab providers must map their native
// payloads onto these shapes — application code must never depend on a
// provider-specific type.

export type GitProviderKind = "github" | "bitbucket" | "gitlab" | "local";

export interface Repository {
  id: string;
  fullName: string; // "owner/name"
  name: string;
  owner: string;
  defaultBranch: string;
  private: boolean;
  description: string | null;
  url: string;
  pushedAt: string | null;
}

export interface Branch {
  name: string;
  sha: string;
  protected: boolean;
}

export interface CommitAuthor {
  name: string | null;
  email: string | null;
  login: string | null;
  avatarUrl: string | null;
}

export interface Commit {
  sha: string;
  shortSha: string;
  message: string;
  url: string;
  date: string;
  author: CommitAuthor;
  prNumber?: number;
}

export interface ChangedFile {
  path: string;
  status: "added" | "modified" | "removed" | "renamed";
  additions: number;
  deletions: number;
  previousPath?: string;
}

export interface CompareResult {
  base: string;
  head: string;
  aheadBy: number;
  behindBy: number;
  commits: Commit[];
  files: ChangedFile[];
}

export interface PullRequest {
  number: number;
  title: string;
  body: string | null;
  state: "open" | "closed" | "merged";
  url: string;
  author: CommitAuthor;
  labels: string[];
  baseRef: string;
  headRef: string;
  mergedAt: string | null;
  createdAt: string;
  mergeCommitSha: string | null;
}

export interface Tag {
  name: string;
  sha: string;
  date?: string;
}

// "merged" | "open" | "all" — applies to last-n / date-range. Between-tags
// is always merged-only since open PRs aren't part of a release lineage yet.
export type PRState = "merged" | "open" | "all";

export type PRFilterMode =
  | { type: "last-n"; n: number; base?: string; state?: PRState }
  | { type: "date-range"; since: string; until: string; base?: string; state?: PRState }
  | { type: "between-tags"; baseTag: string; headTag: string };

export interface ListReposParams {
  perPage?: number;
  page?: number;
  search?: string;
}

export interface CompareParams {
  owner: string;
  repo: string;
  base: string;
  head: string;
}

export interface ListBranchesParams {
  owner: string;
  repo: string;
  perPage?: number;
}

export interface ListCommitsParams {
  owner: string;
  repo: string;
  sha?: string; // branch or commit
  perPage?: number;
}

export interface ListPullRequestsParams {
  owner: string;
  repo: string;
  filter: PRFilterMode;
}

export interface ListTagsParams {
  owner: string;
  repo: string;
  perPage?: number;
}

export interface GitProvider {
  readonly kind: GitProviderKind;
  getRepositories(params?: ListReposParams): Promise<Repository[]>;
  getBranches(params: ListBranchesParams): Promise<Branch[]>;
  getCommits(params: ListCommitsParams): Promise<Commit[]>;
  compareBranches(params: CompareParams): Promise<CompareResult>;
  getChangedFiles(params: CompareParams): Promise<ChangedFile[]>;
  // Honors the PRState in the filter (defaults to "merged" when omitted).
  listPullRequests(params: ListPullRequestsParams): Promise<PullRequest[]>;
  listTags(params: ListTagsParams): Promise<Tag[]>;
}
