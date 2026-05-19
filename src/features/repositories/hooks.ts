"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { fetchJson } from "@/lib/http";
import type {
  Branch,
  GitProviderKind,
  PRFilterMode,
  PullRequest,
  Repository,
  Tag,
} from "@/core/git/types";

export function useLinkedProviders() {
  return useQuery({
    queryKey: ["providers"],
    queryFn: () =>
      fetchJson<{ providers: GitProviderKind[] }>("/api/providers").then(
        (r) => r.providers,
      ),
  });
}

export function useRepositories(provider: GitProviderKind, search: string) {
  return useQuery({
    queryKey: ["repos", provider, search],
    queryFn: () => {
      const qs = new URLSearchParams({ provider });
      if (search) qs.set("search", search);
      return fetchJson<{ repos: Repository[] }>(
        `/api/repos?${qs.toString()}`,
      ).then((r) => r.repos);
    },
  });
}

export function useBranches(
  provider: GitProviderKind,
  owner: string | null,
  repo: string | null,
) {
  return useQuery({
    queryKey: ["branches", provider, owner, repo],
    enabled: Boolean(owner && repo),
    queryFn: () =>
      fetchJson<{ branches: Branch[] }>(
        `/api/repos/${owner}/${repo}/branches?provider=${provider}`,
      ).then((r) => r.branches),
  });
}

export function useTags(
  provider: GitProviderKind,
  owner: string | null,
  repo: string | null,
) {
  return useQuery({
    queryKey: ["tags", provider, owner, repo],
    enabled: Boolean(owner && repo),
    queryFn: () =>
      fetchJson<{ tags: Tag[] }>(
        `/api/repos/${owner}/${repo}/tags?provider=${provider}`,
      ).then((r) => r.tags),
  });
}

export interface PullRequestsPreviewInput {
  provider: GitProviderKind;
  owner: string;
  repo: string;
  filter: PRFilterMode;
}

export function usePullRequestsPreview() {
  return useMutation({
    mutationFn: async (input: PullRequestsPreviewInput) => {
      const data = await fetchJson<{ pulls: PullRequest[] }>(
        `/api/repos/${input.owner}/${input.repo}/pulls`,
        {
          method: "POST",
          body: JSON.stringify({
            provider: input.provider,
            filter: input.filter,
          }),
        },
      );
      return data.pulls;
    },
  });
}
