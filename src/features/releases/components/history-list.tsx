"use client";

import { useState } from "react";
import Link from "next/link";
import { useInfiniteQuery } from "@tanstack/react-query";
import {
  GitCommit,
  Loader2,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchJson } from "@/lib/http";
import { cn } from "@/lib/utils";
import { HistoryRowActions } from "@/features/releases/components/history-row-actions";

export interface HistoryRow {
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

interface Page {
  items: HistoryRow[];
  nextCursor: { createdAt: string; id: string } | null;
}

const PAGE_SIZE = 20;

export function HistoryList() {
  const [search, setSearch] = useState("");

  // Debounce-ish: search query is stable enough as an effect dep that we
  // just refetch on every keystroke. For larger histories we can add a
  // 250ms debounce here without changing the API.
  // First-page cursor is `null` (typed alongside `nextCursor`); subsequent
  // pages reuse the cursor returned by the previous page.
  const query = useInfiniteQuery<
    Page,
    Error,
    { pages: Page[]; pageParams: Page["nextCursor"][] },
    [string, { search: string }],
    Page["nextCursor"]
  >({
    queryKey: ["releases", { search }],
    initialPageParam: null,
    getNextPageParam: (last) => last.nextCursor,
    queryFn: ({ pageParam }) => {
      const qs = new URLSearchParams({ limit: String(PAGE_SIZE) });
      if (search) qs.set("search", search);
      if (pageParam) qs.set("cursor", `${pageParam.createdAt}|${pageParam.id}`);
      return fetchJson<Page>(`/api/releases?${qs.toString()}`);
    },
  });

  const all = query.data?.pages.flatMap((p) => p.items) ?? [];
  const isInitialLoading = query.isLoading;
  const isSearching = !!search;

  return (
    <div className="flex flex-col gap-4">
      {/* Search bar — full-text over title + markdown (Postgres ILIKE). */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Title ya da markdown içinde ara…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 pr-9"
          aria-label="Release'ler içinde ara"
        />
        {search && (
          <button
            type="button"
            onClick={() => setSearch("")}
            aria-label="Aramayı temizle"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Status line above the list */}
      {!isInitialLoading && (
        <div className="flex items-center justify-between font-mono text-[11px] text-muted-foreground">
          <span>
            {all.length} sonuç
            {isSearching && all.length > 0 && (
              <span className="ml-1">· “{search}” için</span>
            )}
          </span>
          {query.isFetching && !query.isFetchingNextPage && (
            <span className="inline-flex items-center gap-1.5">
              <Loader2 className="h-3 w-3 animate-spin" /> aranıyor
            </span>
          )}
        </div>
      )}

      {isInitialLoading ? (
        <ListSkeleton />
      ) : query.error ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-destructive">
            {(query.error as Error).message}
          </CardContent>
        </Card>
      ) : all.length === 0 ? (
        <EmptyState searching={isSearching} />
      ) : (
        <>
          <div className="overflow-hidden rounded-xl border border-border/60">
            {all.map((r, i) => {
              const title = r.title ?? `${r.baseRef} → ${r.headRef}`;
              return (
                <div
                  key={r.id}
                  className={cn(
                    "group grid grid-cols-[1fr_auto] items-stretch transition-colors hover:bg-accent",
                    i > 0 && "border-t border-border/60",
                  )}
                >
                  <Link
                    href={`/dashboard/history/${r.id}`}
                    aria-label={title}
                    className="grid min-w-0 grid-cols-[auto_1fr_auto] items-center gap-4 px-5 py-4"
                  >
                    <GitCommit className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
                    <div className="min-w-0">
                      <div className="truncate font-medium">{title}</div>
                      <div className="truncate font-mono text-[11px] text-muted-foreground">
                        {r.repoOwner}/{r.repoName} ·{" "}
                        <span className="text-primary/80">{r.baseRef}</span>
                        {" → "}
                        <span className="text-primary/80">{r.headRef}</span>
                        {r.modelUsed && (
                          <>
                            <span className="mx-1.5 text-border">·</span>
                            <span>{r.modelUsed}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="font-mono text-[11px] text-muted-foreground">
                      {new Date(r.createdAt).toLocaleDateString("tr-TR")}
                    </div>
                  </Link>
                  <div className="flex items-center pr-3">
                    <HistoryRowActions id={r.id} title={title} />
                  </div>
                </div>
              );
            })}
          </div>

          {query.hasNextPage && (
            <div className="flex justify-center">
              <Button
                variant="outline"
                size="sm"
                onClick={() => query.fetchNextPage()}
                disabled={query.isFetchingNextPage}
                className="gap-2"
              >
                {query.isFetchingNextPage ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Yükleniyor…
                  </>
                ) : (
                  <>Daha fazla yükle</>
                )}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function ListSkeleton() {
  return (
    <div className="overflow-hidden rounded-xl border border-border/60">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className={cn(
            "grid grid-cols-[auto_1fr_auto] items-center gap-4 px-5 py-4",
            i > 0 && "border-t border-border/60",
          )}
        >
          <Skeleton className="h-4 w-4 rounded" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          <Skeleton className="h-3 w-16" />
        </div>
      ))}
    </div>
  );
}

function EmptyState({ searching }: { searching: boolean }) {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
        <div className="grid h-14 w-14 place-items-center rounded-full border border-border bg-card text-primary">
          <Sparkles className="h-5 w-5" />
        </div>
        <div className="font-serif text-xl italic">
          {searching ? "Sonuç bulunamadı" : "Henüz release yok"}
        </div>
        <p className="max-w-sm text-sm text-muted-foreground">
          {searching
            ? "Aramayı temizle ya da farklı bir kelimeyle dene."
            : "İlk release'ini üretmek için generate akışına git."}
        </p>
        {!searching && (
          <Link
            href="/dashboard/generate"
            className={cn(buttonVariants({ size: "sm" }), "mt-2")}
          >
            İlkini üret
          </Link>
        )}
      </CardContent>
    </Card>
  );
}
