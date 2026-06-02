import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  GitCommit,
  History,
  Sparkles,
  Wand2,
} from "lucide-react";
import { listReleasesForOrg } from "@/features/releases/releases.service";
import { auth } from "@/auth";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default async function DashboardHome() {
  const session = await auth();
  const recent =
    session?.user?.id && session.user.orgId && session.user.role
      ? (
          await listReleasesForOrg(
            {
              userId: session.user.id,
              orgId: session.user.orgId,
              role: session.user.role,
            },
            { limit: 5 },
          )
        ).items
      : [];

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-10">
      {/* Hero strip */}
      <div className="relative isolate overflow-hidden rounded-2xl border border-border/60 bg-card/40">
        <div className="bg-grid pointer-events-none absolute inset-0 -z-10 opacity-50 [mask-image:radial-gradient(ellipse_at_top_left,black_30%,transparent_75%)]" />
        <div className="bg-aurora pointer-events-none absolute inset-0 -z-10 opacity-50" />
        <div className="flex flex-col gap-4 px-6 py-7 sm:flex-row sm:items-center sm:justify-between sm:px-8 sm:py-8">
          <div>
            <span className="eyebrow text-muted-foreground">
              Tekrar hoş geldin
            </span>
            <h1 className="mt-2 text-2xl font-medium tracking-[-0.015em] sm:text-3xl">
              Selam{" "}
              <span className="font-serif italic text-primary">
                {session?.user?.name?.split(" ")[0] ?? "buradakine"}
              </span>{" "}
              — bugün ne yayınlandı?
            </h1>
          </div>
          <Link
            href="/dashboard/generate"
            className={cn(
              buttonVariants({ size: "lg" }),
              "shrink-0 gap-2 px-5 shadow-lg shadow-primary/20",
            )}
          >
            <Wand2 className="h-4 w-4" />
            Yeni release
          </Link>
        </div>
      </div>

      {/* Action tiles */}
      <div className="grid gap-4 md:grid-cols-2">
        <ActionTile
          href="/dashboard/generate"
          icon={<Wand2 className="h-4 w-4" />}
          title="Compare üzerinden üret"
          body="Base / head seç, AI diff'i kategorize etsin, sen markdown'ı gönder."
        />
        <ActionTile
          href="/dashboard/history"
          icon={<History className="h-4 w-4" />}
          title="Geçmişe göz at"
          body="Önceki bir release'i tekrar aç, markdown'ı kopyala ya da bir riski incele."
        />
      </div>

      {/* Recent releases */}
      <section>
        <div className="mb-4 flex items-baseline justify-between">
          <h2 className="eyebrow text-muted-foreground">Son release&apos;ler</h2>
          {recent.length > 0 && (
            <Link
              href="/dashboard/history"
              className="text-xs text-muted-foreground underline-grow hover:text-foreground"
            >
              Tüm geçmiş →
            </Link>
          )}
        </div>

        {recent.length === 0 ? <EmptyState /> : <RecentList items={recent} />}
      </section>
    </div>
  );
}

function ActionTile({
  href,
  icon,
  title,
  body,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <Link
      href={href}
      className="group relative overflow-hidden rounded-xl border border-border/60 bg-card/30 p-5 transition-colors hover:border-primary/40 hover:bg-card"
    >
      <div className="flex items-center gap-3">
        <span className="grid h-9 w-9 place-items-center rounded-md bg-accent text-accent-foreground transition-colors group-hover:bg-primary/15 group-hover:text-primary">
          {icon}
        </span>
        <span className="font-medium">{title}</span>
        <ArrowUpRight className="ml-auto h-4 w-4 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-primary" />
      </div>
      <p className="mt-3 text-sm text-muted-foreground">{body}</p>
    </Link>
  );
}

function RecentList({
  items,
}: {
  items: Array<{
    id: string;
    title: string | null;
    repoOwner: string;
    repoName: string;
    baseRef: string;
    headRef: string;
    createdAt: Date;
  }>;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-border/60">
      {items.map((r, i) => (
        <Link
          key={r.id}
          href={`/dashboard/history/${r.id}`}
          className={cn(
            "group grid grid-cols-[auto_1fr_auto] items-center gap-4 px-4 py-3 text-sm transition-colors hover:bg-accent",
            i > 0 && "border-t border-border/60",
          )}
        >
          <GitCommit className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
          <div className="min-w-0">
            <div className="truncate font-medium">
              {r.title ?? `${r.baseRef} → ${r.headRef}`}
            </div>
            <div className="truncate font-mono text-[11px] text-muted-foreground">
              {r.repoOwner}/{r.repoName} ·{" "}
              <span className="text-primary/80">{r.baseRef}</span>
              {" → "}
              <span className="text-primary/80">{r.headRef}</span>
            </div>
          </div>
          <div className="font-mono text-[11px] text-muted-foreground">
            {new Date(r.createdAt).toLocaleDateString()}
          </div>
        </Link>
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <Card className="border-dashed">
      <CardHeader className="items-center text-center">
        <div className="grid h-14 w-14 place-items-center rounded-full border border-border bg-card text-primary">
          <Sparkles className="h-5 w-5" />
        </div>
        <CardTitle className="mt-4 font-serif text-xl italic">
          Henüz release yok
        </CardTitle>
        <CardDescription className="mx-auto max-w-sm">
          Bir repo bağla, iki ref karşılaştır — Releaser ilk changelog&apos;unu
          bir dakikadan kısa sürede çıkarır.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center justify-center gap-3 pb-8">
        <Link
          href="/dashboard/generate"
          className={cn(buttonVariants({ size: "sm" }), "gap-2")}
        >
          <Wand2 className="h-4 w-4" />
          İlkini üret
        </Link>
        <Link
          href="/guide"
          className={cn(
            buttonVariants({ size: "sm", variant: "outline" }),
            "gap-2",
          )}
        >
          <BookOpen className="h-4 w-4" />
          Rehberi oku
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </CardContent>
    </Card>
  );
}
