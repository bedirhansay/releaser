"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { fetchJson } from "@/lib/http";

export interface InstallationDTO {
  id: string;
  installationId: number;
  accountLogin: string | null;
  accountType: string | null;
  repositorySelection: string | null;
  suspended: boolean;
  createdAt: string;
}

export interface GitHubAppStatus {
  configured: boolean;
  installations: InstallationDTO[];
}

export function useGitHubApp() {
  return useQuery({
    queryKey: ["github-app"],
    queryFn: () => fetchJson<GitHubAppStatus>("/api/github/app"),
  });
}

export function useDisconnectInstallation() {
  return useMutation({
    mutationFn: (id: string) =>
      fetchJson<{ deleted: boolean }>(`/api/github/app/${id}`, {
        method: "DELETE",
      }),
  });
}
