"use client";

import { useMemo } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useProjects } from "@/features/projects/hooks";
import type { GitProviderKind } from "@/core/git/types";

const PROVIDER_LABEL: Record<GitProviderKind, string> = {
  github: "GitHub",
  bitbucket: "Bitbucket",
  gitlab: "GitLab",
  local: "Local",
};

export interface ProjectRepoEntry {
  projectName: string;
  provider: GitProviderKind;
  owner: string;
  name: string;
}

/** Stable key for a repo entry; also doubles as the Select item value. */
function entryKey(e: { provider: GitProviderKind; owner: string; name: string }) {
  return `${e.provider}:${e.owner}/${e.name}`;
}

/**
 * Primary, reliable repo picker for the standalone release wizard: it lists the
 * repos the user already defined inside their projects (from our own DB via
 * useProjects()), so it never hits the unreliable external listing endpoints
 * (Bitbucket returns 410, GitHub can 401).
 *
 * Selecting an entry hands the parent the full { provider, owner, name } tuple
 * so it can sync its own provider + owner/repo state. When the user has no
 * project repos, this renders a muted hint instead and the parent's manual
 * entry remains the only path.
 */
export function ProjectRepoSelect({
  value,
  onSelect,
}: {
  /** Currently-selected entry, or null. Used only to reflect selection. */
  value: { provider: GitProviderKind; owner: string; name: string } | null;
  onSelect: (entry: ProjectRepoEntry) => void;
}) {
  const projects = useProjects();

  const entries = useMemo<ProjectRepoEntry[]>(() => {
    const list = projects.data ?? [];
    const seen = new Set<string>();
    const out: ProjectRepoEntry[] = [];
    for (const project of list) {
      for (const repo of project.repos ?? []) {
        const key = entryKey(repo);
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({
          projectName: project.name,
          provider: repo.provider,
          owner: repo.owner,
          name: repo.name,
        });
      }
    }
    return out;
  }, [projects.data]);

  // No project repos yet → muted hint; parent keeps its manual entry below.
  if (projects.isSuccess && entries.length === 0) {
    return (
      <p className="text-[11px] text-muted-foreground">
        Henüz proje repon yok — elle gir.
      </p>
    );
  }

  // Still loading and nothing to show yet: render nothing to avoid a flash.
  if (entries.length === 0) return null;

  const selectedKey = value ? entryKey(value) : undefined;

  return (
    <Select
      value={selectedKey}
      onValueChange={(key) => {
        const entry = entries.find((e) => entryKey(e) === key);
        if (entry) onSelect(entry);
      }}
    >
      <SelectTrigger className="w-full">
        <SelectValue placeholder="Projelerinden seç" />
      </SelectTrigger>
      <SelectContent>
        {entries.map((e) => (
          <SelectItem key={entryKey(e)} value={entryKey(e)}>
            <span className="font-medium">{e.projectName}</span>
            <span className="text-muted-foreground">
              · {e.owner}/{e.name}
            </span>
            <span className="font-mono text-[10px] text-muted-foreground">
              {PROVIDER_LABEL[e.provider]}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
