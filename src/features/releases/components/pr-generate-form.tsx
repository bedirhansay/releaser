"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { GitPullRequest, Loader2, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  useBranches,
  useLinkedProviders,
  usePullRequestsPreview,
  useRepositories,
  useTags,
} from "@/features/repositories/hooks";
import { RepoCombobox } from "@/features/repositories/components/repo-combobox";
import type {
  GitProviderKind,
  PRFilterMode,
  PRState,
} from "@/core/git/types";
import { cn } from "@/lib/utils";

const PROVIDER_LABEL: Record<GitProviderKind, string> = {
  github: "GitHub",
  bitbucket: "Bitbucket",
  gitlab: "GitLab",
};

/** How many days to default the date-range filter to. */
const DEFAULT_RANGE_DAYS = 14;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export interface PRGenerateValue {
  provider: GitProviderKind;
  owner: string;
  repo: string;
  filter: PRFilterMode;
}

export function PRGenerateForm({
  onSubmit,
  onChange,
  isPending,
}: {
  onSubmit: (value: PRGenerateValue) => void;
  onChange?: (partial: { provider?: GitProviderKind; owner?: string; repo?: string }) => void;
  isPending?: boolean;
}) {
  const providers = useLinkedProviders();
  const [provider, setProvider] = useState<GitProviderKind | null>(null);
  const [repoFullName, setRepoFullName] = useState<string | null>(null);
  const [mode, setMode] = useState<PRFilterMode["type"]>("last-n");
  // Applies to last-n / date-range; between-tags is implicitly merged-only.
  const [prState, setPrState] = useState<PRState>("merged");

  // last-n state
  const [n, setN] = useState(10);
  const [baseBranch, setBaseBranch] = useState<string | null>(null);

  // date-range — default to the last DEFAULT_RANGE_DAYS, today inclusive.
  const today = new Date();
  const rangeStart = new Date(today.getTime() - DEFAULT_RANGE_DAYS * MS_PER_DAY);
  const [since, setSince] = useState(rangeStart.toISOString().slice(0, 10));
  const [until, setUntil] = useState(today.toISOString().slice(0, 10));

  // between-tags state
  const [baseTag, setBaseTag] = useState<string | null>(null);
  const [headTag, setHeadTag] = useState<string | null>(null);

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
  const tags = useTags(
    provider ?? "github",
    selected?.owner ?? null,
    selected?.name ?? null,
  );
  const preview = usePullRequestsPreview();

  // Auto-pick first linked provider; reset downstream selections when provider
  // / repo changes (otherwise stale base/head tags leak across repos).
  useEffect(() => {
    if (!provider && providers.data && providers.data.length > 0) {
      setProvider(providers.data[0]);
    }
  }, [providers.data, provider]);

  useEffect(() => {
    setRepoFullName(null);
    setBaseBranch(null);
    setBaseTag(null);
    setHeadTag(null);
    preview.reset();
  }, [provider]);

  useEffect(() => {
    setBaseBranch(null);
    setBaseTag(null);
    setHeadTag(null);
    preview.reset();
  }, [repoFullName]);

  useEffect(() => {
    onChange?.({
      provider: provider ?? undefined,
      owner: selected?.owner,
      repo: selected?.name,
    });
  }, [provider, selected, onChange]);

  const linked = providers.data ?? [];
  const noProviders = providers.isSuccess && linked.length === 0;

  const currentFilter: PRFilterMode | null = useMemo(() => {
    if (mode === "last-n") {
      return {
        type: "last-n",
        n,
        base: baseBranch ?? undefined,
        state: prState,
      };
    }
    if (mode === "date-range") {
      return {
        type: "date-range",
        since,
        until,
        base: baseBranch ?? undefined,
        state: prState,
      };
    }
    if (baseTag && headTag) {
      return { type: "between-tags", baseTag, headTag };
    }
    return null;
  }, [mode, n, since, until, baseBranch, baseTag, headTag, prState]);

  const canSubmit =
    !!provider && !!selected && !!currentFilter && !isPending;

  const handlePreview = async () => {
    if (!provider || !selected || !currentFilter) return;
    try {
      await preview.mutateAsync({
        provider,
        owner: selected.owner,
        repo: selected.name,
        filter: currentFilter,
      });
    } catch {
      /* surface via preview.error */
    }
  };

  if (noProviders) {
    return (
      <div className="rounded-md border border-border/60 bg-card/40 p-6 text-sm">
        <p className="font-medium">Bağlı git sağlayıcı yok.</p>
        <p className="mt-1 text-muted-foreground">
          PR&apos;lardan release üretmek için bir sağlayıcı bağla.
        </p>
        <Link
          href="/login"
          className="mt-3 inline-flex text-primary underline"
        >
          Giriş yap →
        </Link>
      </div>
    );
  }

  return (
    <form
      className="grid gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        if (!canSubmit || !provider || !selected || !currentFilter) return;
        onSubmit({
          provider,
          owner: selected.owner,
          repo: selected.name,
          filter: currentFilter,
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
          onChange={setRepoFullName}
          repos={repos.data ?? []}
          isLoading={repos.isLoading || providers.isLoading}
          error={repos.error ? (repos.error as Error).message : null}
        />
      </div>

      <div className="grid gap-2">
        <Label>Filtre</Label>
        <Tabs value={mode} onValueChange={(v) => setMode(v as PRFilterMode["type"])}>
          <TabsList className="w-full">
            <TabsTrigger value="last-n" className="flex-1">
              Son N
            </TabsTrigger>
            <TabsTrigger value="date-range" className="flex-1">
              Tarih aralığı
            </TabsTrigger>
            <TabsTrigger value="between-tags" className="flex-1">
              Tag&apos;ler arası
            </TabsTrigger>
          </TabsList>

          {/* PR state pill — only applies to last-n / date-range; between-tags
              implicitly works on merged. */}
          {mode !== "between-tags" && (
            <div className="mt-4 flex items-center gap-2">
              <span className="eyebrow text-muted-foreground">Durum</span>
              <div className="inline-flex rounded-md border border-border/70 bg-card/40 p-0.5 text-xs">
                {(
                  [
                    { v: "merged", label: "Merged" },
                    { v: "open", label: "Open" },
                    { v: "all", label: "Hepsi" },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.v}
                    type="button"
                    onClick={() => setPrState(opt.v)}
                    className={cn(
                      "rounded-[5px] px-2.5 py-1 transition-colors",
                      prState === opt.v
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <span className="font-mono text-[10px] text-muted-foreground">
                {prState === "merged" && "yayınlanan değişiklikler"}
                {prState === "open" && "henüz birleşmeyen — upcoming changelog"}
                {prState === "all" && "hem merged hem open"}
              </span>
            </div>
          )}

          <TabsContent value="last-n" className="m-0 pt-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label>Kaç PR?</Label>
                <Input
                  type="number"
                  min={1}
                  max={100}
                  value={n}
                  onChange={(e) => setN(Number(e.target.value) || 1)}
                />
              </div>
              <div className="grid gap-2">
                <Label>Hedef branch (opsiyonel)</Label>
                <Select
                  value={baseBranch ?? "__any__"}
                  onValueChange={(v) =>
                    setBaseBranch(v === "__any__" ? null : v)
                  }
                  disabled={!selected || branches.isLoading}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Tüm hedefler" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__any__">Tüm hedefler</SelectItem>
                    {(branches.data ?? []).map((b) => (
                      <SelectItem key={b.name} value={b.name}>
                        {b.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="date-range" className="m-0 pt-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="grid gap-2">
                <Label>Başlangıç</Label>
                <Input
                  type="date"
                  value={since}
                  onChange={(e) => setSince(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label>Bitiş</Label>
                <Input
                  type="date"
                  value={until}
                  onChange={(e) => setUntil(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label>Hedef branch (opsiyonel)</Label>
                <Select
                  value={baseBranch ?? "__any__"}
                  onValueChange={(v) =>
                    setBaseBranch(v === "__any__" ? null : v)
                  }
                  disabled={!selected || branches.isLoading}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Tüm hedefler" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__any__">Tüm hedefler</SelectItem>
                    {(branches.data ?? []).map((b) => (
                      <SelectItem key={b.name} value={b.name}>
                        {b.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="between-tags" className="m-0 pt-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label>Önceki tag (base)</Label>
                <Select
                  value={baseTag ?? undefined}
                  onValueChange={setBaseTag}
                  disabled={!selected || tags.isLoading}
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={
                        selected
                          ? tags.isLoading
                            ? "Yükleniyor…"
                            : "Tag seç"
                          : "Önce bir repo seç"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {(tags.data ?? []).map((t) => (
                      <SelectItem key={t.name} value={t.name}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Yeni tag (head)</Label>
                <Select
                  value={headTag ?? undefined}
                  onValueChange={setHeadTag}
                  disabled={!selected || tags.isLoading}
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={selected ? "Tag seç" : "Önce bir repo seç"}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {(tags.data ?? []).map((t) => (
                      <SelectItem key={t.name} value={t.name}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {selected && !tags.isLoading && (tags.data?.length ?? 0) === 0 && (
              <p className="mt-2 text-xs text-muted-foreground">
                Bu repo&apos;da henüz tag yok. Önce <code>git tag v1.0.0</code>{" "}
                veya GitHub Releases üzerinden tag oluşturmalısın.
              </p>
            )}
          </TabsContent>
        </Tabs>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Button
          type="button"
          variant="outline"
          className="gap-2"
          disabled={!canSubmit || preview.isPending}
          onClick={handlePreview}
        >
          {preview.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <GitPullRequest className="h-4 w-4" />
          )}
          PR&apos;ları önizle
        </Button>
        <Button type="submit" disabled={!canSubmit} className="flex-1 gap-2">
          {isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Wand2 className="h-4 w-4" />
          )}
          {isPending ? "Üretiliyor…" : "Release notları üret"}
        </Button>
      </div>

      {preview.error && (
        <p className="text-sm text-destructive">
          {(preview.error as Error).message}
        </p>
      )}

      {preview.data && preview.data.length > 0 && (
        <div className="rounded-lg border border-border/60 bg-card/30">
          <div className="flex items-center justify-between border-b border-border/60 px-4 py-2">
            <span className="font-mono text-xs text-muted-foreground">
              {preview.data.length} PR seçildi
            </span>
            <span className="font-mono text-[10px] text-muted-foreground">
              Bu listenin tamamı modele gönderilecek
            </span>
          </div>
          <ul className="max-h-64 divide-y divide-border/60 overflow-y-auto">
            {preview.data.map((pr) => (
              <li
                key={pr.number}
                className="grid grid-cols-[auto_1fr_auto] items-center gap-3 px-4 py-2 text-sm"
              >
                <span className="font-mono text-[11px] text-muted-foreground">
                  #{pr.number}
                </span>
                <span className="min-w-0 truncate">{pr.title}</span>
                <span className="flex items-center gap-1">
                  {pr.labels.slice(0, 2).map((l) => (
                    <Badge
                      key={l}
                      variant="outline"
                      className={cn(
                        "border-border/60 font-mono text-[10px]",
                      )}
                    >
                      {l}
                    </Badge>
                  ))}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {preview.data && preview.data.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Bu filtreyle eşleşen merged PR bulunamadı.
        </p>
      )}
    </form>
  );
}
