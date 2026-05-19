import Link from "next/link";
import { auth } from "@/auth";
import { listReleasesForUser } from "@/features/releases/releases.service";
import { Card, CardContent } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { GitCommit, Sparkles } from "lucide-react";
import { HistoryRowActions } from "@/features/releases/components/history-row-actions";

export default async function HistoryPage() {
  const session = await auth();
  const releases = session?.user?.id
    ? await listReleasesForUser(session.user.id, 50)
    : [];

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
      <div>
        <span className="eyebrow text-muted-foreground">Geçmiş</span>
        <h1 className="mt-2 text-3xl font-medium tracking-[-0.02em]">
          Üretilen{" "}
          <span className="font-serif italic text-primary">release&apos;ler</span>
        </h1>
        <p className="mt-2 max-w-xl text-sm text-muted-foreground">
          Şimdiye kadar ürettiğin tüm release&apos;ler burada. Birine
          tıklayarak markdown&apos;ı ve riskleri tekrar açabilirsin; satırdaki
          menüden sileyebilirsin.
        </p>
      </div>

      {releases.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <div className="grid h-14 w-14 place-items-center rounded-full border border-border bg-card text-primary">
              <Sparkles className="h-5 w-5" />
            </div>
            <div className="font-serif text-xl italic">Henüz release yok</div>
            <p className="max-w-sm text-sm text-muted-foreground">
              İlk release&apos;ini üretmek için generate akışına git.
            </p>
            <Link
              href="/dashboard/generate"
              className={cn(buttonVariants({ size: "sm" }), "mt-2")}
            >
              İlkini üret
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border/60">
          {releases.map((r, i) => {
            const title = r.title ?? `${r.baseRef} → ${r.headRef}`;
            return (
              <div
                key={r.id}
                className={cn(
                  "group relative grid grid-cols-[auto_1fr_auto_auto] items-center gap-4 px-5 py-4 transition-colors hover:bg-accent",
                  i > 0 && "border-t border-border/60",
                )}
              >
                {/* Absolute-positioned link covers the row; the action menu
                    lifts itself above via z-index so its click doesn't navigate. */}
                <Link
                  href={`/dashboard/history/${r.id}`}
                  aria-label={title}
                  className="absolute inset-0"
                />
                <GitCommit className="relative h-4 w-4 text-muted-foreground group-hover:text-primary" />
                <div className="relative min-w-0">
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
                <div className="relative font-mono text-[11px] text-muted-foreground">
                  {new Date(r.createdAt).toLocaleDateString("tr-TR")}
                </div>
                <div className="relative z-10">
                  <HistoryRowActions id={r.id} title={title} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
