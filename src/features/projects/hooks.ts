"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { fetchJson } from "@/lib/http";
import type { GitProviderKind, PRFilterMode } from "@/core/git/types";

export interface ProjectRepoDTO {
  id?: string;
  provider: GitProviderKind;
  owner: string;
  name: string;
  role: string | null;
}

export interface ProjectDTO {
  id: string;
  name: string;
  slug: string | null;
  description: string | null;
  repos: ProjectRepoDTO[];
  releaseCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

// ─── Queries ─────────────────────────────────────────────────────────────────

export function useProjects() {
  return useQuery({
    queryKey: ["projects"],
    queryFn: () =>
      fetchJson<{ projects: ProjectDTO[] }>("/api/projects").then(
        (r) => r.projects,
      ),
  });
}

export function useProject(id: string | null) {
  return useQuery({
    queryKey: ["project", id],
    enabled: Boolean(id),
    queryFn: () =>
      fetchJson<{ project: ProjectDTO }>(`/api/projects/${id}`).then(
        (r) => r.project,
      ),
  });
}

// ─── Mutations ───────────────────────────────────────────────────────────────

export interface ProjectInput {
  name: string;
  slug?: string;
  description?: string;
  repos: Array<{
    provider: GitProviderKind;
    owner: string;
    name: string;
    role?: string;
  }>;
}

export function useCreateProject() {
  return useMutation({
    mutationFn: (input: ProjectInput) =>
      fetchJson<{ project: { id: string } }>("/api/projects", {
        method: "POST",
        body: JSON.stringify(input),
      }).then((r) => r.project),
  });
}

export function useUpdateProject() {
  return useMutation({
    mutationFn: ({ id, ...patch }: ProjectInput & { id: string }) =>
      fetchJson<{ project: { id: string } }>(`/api/projects/${id}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      }).then((r) => r.project),
  });
}

export function useDeleteProject() {
  return useMutation({
    mutationFn: (id: string) =>
      fetchJson<{ deleted: boolean }>(`/api/projects/${id}`, {
        method: "DELETE",
      }),
  });
}

// ─── Project release generation ──────────────────────────────────────────────

export interface ProjectReleaseRepoResult {
  repoFullName: string;
  role: string | null;
  prCount: number;
}

export interface GeneratedProjectRelease {
  title: string;
  markdown: string;
  sections: Record<string, string>;
  windowLabel: string;
  modelUsed: string;
  project: { id: string; name: string };
  template: { id: string; name: string };
  repos: ProjectReleaseRepoResult[];
  primaryRepo: { provider: GitProviderKind; owner: string; name: string };
  totalPRs: number;
}

export function useGenerateProjectRelease() {
  return useMutation({
    mutationFn: ({
      projectId,
      templateId,
      filter,
    }: {
      projectId: string;
      templateId?: string;
      filter: PRFilterMode;
    }) =>
      fetchJson<{ release: GeneratedProjectRelease }>(
        `/api/projects/${projectId}/generate`,
        {
          method: "POST",
          body: JSON.stringify({ templateId, filter }),
        },
      ).then((r) => r.release),
  });
}

export interface SaveProjectReleaseInput {
  projectId: string;
  templateId?: string;
  title: string;
  markdown: string;
  tags?: string[];
  windowLabel: string;
  modelUsed: string;
  primaryRepo: { provider: GitProviderKind; owner: string; name: string };
}

export function useSaveProjectRelease() {
  return useMutation({
    mutationFn: ({ projectId, ...body }: SaveProjectReleaseInput) =>
      fetchJson<{ release: { id: string } }>(
        `/api/projects/${projectId}/releases`,
        {
          method: "POST",
          body: JSON.stringify(body),
        },
      ).then((r) => r.release),
  });
}
