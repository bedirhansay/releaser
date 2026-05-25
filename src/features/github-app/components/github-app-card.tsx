"use client";

import { useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  Loader2,
  ShieldCheck,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { toast } from "sonner";
import { GithubIcon } from "@/components/icons/github";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useDisconnectInstallation,
  useGitHubApp,
} from "@/features/github-app/hooks";

export function GitHubAppCard() {
  const qc = useQueryClient();
  const status = useGitHubApp();
  const disconnect = useDisconnectInstallation();

  const handleDisconnect = async (id: string) => {
    try {
      await disconnect.mutateAsync(id);
      toast.success("Bağlantı kaldırıldı — GitHub'dan da kaldırmayı unutma");
      await qc.invalidateQueries({ queryKey: ["github-app"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Kaldırılamadı");
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <GithubIcon className="h-4 w-4" />
          GitHub erişimi (App)
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <p className="text-sm text-muted-foreground">
          Repolarına erişim için <span className="font-medium text-foreground">GitHub App</span>{" "}
          kurarsın — kurulumda <span className="font-medium text-foreground">hangi repoları</span>{" "}
          vereceğini sen seçersin, salt-okunur ve kısa ömürlü token kullanılır.
          Giriş yine OAuth ile; bu sadece repo erişimi içindir.
        </p>

        {status.isLoading ? (
          <Skeleton className="h-10 w-full" />
        ) : !status.data?.configured ? (
          <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-sm">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <div>
              <p className="font-medium text-foreground">
                GitHub App henüz sunucuda yapılandırılmamış
              </p>
              <p className="mt-0.5 text-muted-foreground">
                Yöneticinin <code className="font-mono">GITHUB_APP_ID</code>,{" "}
                <code className="font-mono">GITHUB_APP_PRIVATE_KEY</code> ve{" "}
                <code className="font-mono">GITHUB_APP_SLUG</code> değerlerini
                eklemesi gerekiyor.
              </p>
            </div>
          </div>
        ) : (
          <>
            {status.data.installations.length > 0 ? (
              <div className="flex flex-col gap-2">
                {status.data.installations.map((inst) => (
                  <div
                    key={inst.id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-border/70 bg-muted/30 px-3 py-2.5"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <ShieldCheck className="h-4 w-4 shrink-0 text-primary" />
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">
                          {inst.accountLogin ?? `Installation #${inst.installationId}`}
                        </div>
                        <div className="font-mono text-[11px] text-muted-foreground">
                          {inst.repositorySelection === "all"
                            ? "tüm repolar"
                            : "seçili repolar"}
                          {inst.suspended && " · askıda"}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {!inst.suspended && (
                        <Badge className="gap-1">
                          <CheckCircle2 className="h-3 w-3" /> aktif
                        </Badge>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDisconnect(inst.id)}
                        disabled={disconnect.isPending}
                        className="gap-1.5 text-destructive"
                      >
                        {disconnect.isPending ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" />
                        )}
                        Kaldır
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Henüz bağlı bir GitHub App kurulumun yok.
              </p>
            )}

            {/* Full-page navigation to a redirecting API route (OAuth-style),
                not a client transition — a plain anchor is correct here. */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a
              href="/api/github/app/install"
              className="inline-flex w-fit items-center gap-2 rounded-lg bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              <GithubIcon className="h-4 w-4" />
              {status.data.installations.length > 0
                ? "Başka repo ekle / yeniden yapılandır"
                : "GitHub App'i kur"}
            </a>
          </>
        )}
      </CardContent>
    </Card>
  );
}
