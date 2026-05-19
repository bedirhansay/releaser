"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { fetchJson } from "@/lib/http";
import type {
  GitProviderKind,
  PRFilterMode,
  PullRequest,
} from "@/core/git/types";
import type { GeneratedRelease } from "@/types/release";

// ─── Generate ────────────────────────────────────────────────────────────────

export interface GenerateInput {
  provider: GitProviderKind;
  owner: string;
  repo: string;
  base: string;
  head: string;
}

export function useGenerateRelease() {
  return useMutation({
    mutationFn: (input: GenerateInput) =>
      fetchJson<{ release: GeneratedRelease }>("/api/releases/generate", {
        method: "POST",
        body: JSON.stringify(input),
      }).then((r) => r.release),
  });
}

export interface GenerateFromPRsHookInput {
  provider: GitProviderKind;
  owner: string;
  repo: string;
  filter: PRFilterMode;
}

export interface GeneratedReleaseFromPRs extends GeneratedRelease {
  pullRequests: PullRequest[];
}

export function useGenerateFromPRs() {
  return useMutation({
    mutationFn: (input: GenerateFromPRsHookInput) =>
      fetchJson<{ release: GeneratedReleaseFromPRs }>(
        "/api/releases/generate/from-prs",
        {
          method: "POST",
          body: JSON.stringify(input),
        },
      ).then((r) => r.release),
  });
}

// ─── Save / list / mutate persisted releases ─────────────────────────────────

export interface SaveInput extends GenerateInput {
  title: string;
  markdown: string;
  release: GeneratedRelease;
}

export function useSaveRelease() {
  return useMutation({
    mutationFn: (input: SaveInput) =>
      fetchJson<{ release: { id: string } }>("/api/releases", {
        method: "POST",
        body: JSON.stringify(input),
      }).then((r) => r.release),
  });
}

export interface HistoryItem {
  id: string;
  provider: "GITHUB" | "BITBUCKET" | "GITLAB";
  repoOwner: string;
  repoName: string;
  baseRef: string;
  headRef: string;
  title: string | null;
  modelUsed: string | null;
  createdAt: string;
}

export function useReleaseHistory() {
  return useQuery({
    queryKey: ["releases"],
    queryFn: () =>
      fetchJson<{ releases: HistoryItem[] }>("/api/releases").then(
        (r) => r.releases,
      ),
  });
}

export interface UpdateReleaseHookInput {
  id: string;
  title?: string;
  markdown?: string;
}

export function useUpdateRelease() {
  return useMutation({
    mutationFn: ({ id, ...patch }: UpdateReleaseHookInput) =>
      fetchJson<{ release: { id: string } }>(`/api/releases/${id}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      }).then((r) => r.release),
  });
}

export function useDeleteRelease() {
  return useMutation({
    mutationFn: (id: string) =>
      fetchJson<{ deleted: boolean }>(`/api/releases/${id}`, {
        method: "DELETE",
      }),
  });
}
