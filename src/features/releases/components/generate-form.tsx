"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Loader2, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  useBranches,
  useLinkedProviders,
  useRepositories,
} from "@/features/repositories/hooks";
import { RepoCombobox } from "@/features/repositories/components/repo-combobox";
import type { GitProviderKind } from "@/core/git/types";

const PROVIDER_LABEL: Record<GitProviderKind, string> = {
  github: "GitHub",
  bitbucket: "Bitbucket",
  gitlab: "GitLab",
};

export interface GenerateFormValue {
  provider: GitProviderKind;
  owner: string;
  repo: string;
  base: string;
  head: string;
}

export function GenerateForm({
  onSubmit,
  onChange,
  isPending,
}: {
  onSubmit: (value: GenerateFormValue) => void;
  onChange?: (partial: Partial<GenerateFormValue>) => void;
  isPending?: boolean;
}) {
  const providers = useLinkedProviders();
  const [provider, setProvider] = useState<GitProviderKind | null>(null);
  const [repoFullName, setRepoFullName] = useState<string | null>(null);
  const [base, setBase] = useState<string | null>(null);
  const [head, setHead] = useState<string | null>(null);

  useEffect(() => {
    if (!provider && providers.data && providers.data.length > 0) {
      setProvider(providers.data[0]);
    }
  }, [providers.data, provider]);

  useEffect(() => {
    setRepoFullName(null);
    setBase(null);
    setHead(null);
  }, [provider]);

  // Search is now driven inside the combobox via cmdk's internal filter, so we
  // just fetch the whole (recent) repo list once per provider.
  const repos = useRepositories(provider ?? "github", "");
  const selected = useMemo(
    () => repos.data?.find((r) => r.fullName === repoFullName) ?? null,
    [repos.data, repoFullName],
  );
  const branches = useBranches(
    provider ?? "github",
    selected?.owner ?? null,
    selected?.name ?? null,
  );

  // Surface form state upward so the page can drive a step indicator without
  // turning into a controlled-input prop drilling exercise.
  useEffect(() => {
    onChange?.({
      provider: provider ?? undefined,
      owner: selected?.owner,
      repo: selected?.name,
      base: base ?? undefined,
      head: head ?? undefined,
    });
  }, [provider, selected, base, head, onChange]);

  const linked = providers.data ?? [];
  const noProviders = providers.isSuccess && linked.length === 0;
  const canSubmit =
    !!provider && selected && base && head && base !== head && !isPending;

  if (noProviders) {
    return (
      <div className="rounded-md border border-border/60 bg-card/40 p-6 text-sm">
        <p className="font-medium">Bağlı git sağlayıcı yok.</p>
        <p className="mt-1 text-muted-foreground">
          Release notlarını üretmeye başlamak için GitHub veya Bitbucket bağla.
        </p>
        <Link
          href="/login"
          className="mt-3 inline-flex text-primary underline"
        >
          Sağlayıcı bağlamak için giriş yap →
        </Link>
      </div>
    );
  }

  return (
    <form
      className="grid gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        if (!canSubmit || !selected || !base || !head || !provider) return;
        onSubmit({
          provider,
          owner: selected.owner,
          repo: selected.name,
          base,
          head,
        });
      }}
    >
      {linked.length > 1 && (
        <div className="grid gap-2">
          <Label>Sağlayıcı</Label>
          <Select
            value={provider ?? undefined}
            onValueChange={(v) => setProvider(v as GitProviderKind)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Sağlayıcı seç" />
            </SelectTrigger>
            <SelectContent>
              {linked.map((p) => (
                <SelectItem key={p} value={p}>
                  {PROVIDER_LABEL[p]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="grid gap-2">
        <Label>Repo</Label>
        <RepoCombobox
          value={repoFullName}
          onChange={(fullName) => {
            setRepoFullName(fullName);
            setBase(null);
            setHead(null);
          }}
          repos={repos.data ?? []}
          isLoading={repos.isLoading || providers.isLoading}
          error={
            repos.error ? (repos.error as Error).message : null
          }
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label>Base branch</Label>
          <Select
            value={base ?? undefined}
            onValueChange={setBase}
            disabled={!selected || branches.isLoading}
          >
            <SelectTrigger>
              <SelectValue
                placeholder={
                  selected
                    ? branches.isLoading
                      ? "Yükleniyor…"
                      : "Base seç"
                    : "Önce bir repo seç"
                }
              />
            </SelectTrigger>
            <SelectContent>
              {(branches.data ?? []).map((b) => (
                <SelectItem key={b.name} value={b.name}>
                  {b.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-2">
          <Label>Head branch</Label>
          <Select
            value={head ?? undefined}
            onValueChange={setHead}
            disabled={!selected || branches.isLoading}
          >
            <SelectTrigger>
              <SelectValue
                placeholder={
                  selected ? "Head seç" : "Önce bir repo seç"
                }
              />
            </SelectTrigger>
            <SelectContent>
              {(branches.data ?? []).map((b) => (
                <SelectItem key={b.name} value={b.name}>
                  {b.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Button type="submit" disabled={!canSubmit} className="w-full gap-2">
        {isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Wand2 className="h-4 w-4" />
        )}
        {isPending ? "Release notları üretiliyor…" : "Release notları üret"}
      </Button>
    </form>
  );
}
