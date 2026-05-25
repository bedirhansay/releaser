import Link from "next/link";
import {
  ArrowUpRight,
  BoxSelect,
  GitBranch,
  GitPullRequest,
  ListChecks,
  Lock,
  ShieldAlert,
  SparklesIcon,
  Wand2,
} from "lucide-react";
import { auth } from "@/auth";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  MarketingFooter,
  MarketingHeader,
} from "@/components/marketing/marketing-shell";
import { ReleasePreviewCard } from "@/components/marketing/release-preview-card";
import { GithubIcon } from "@/components/icons/github";
import { BitbucketIcon } from "@/components/icons/bitbucket";

export default async function HomePage() {
  const session = await auth();
  const primaryHref = session ? "/dashboard" : "/login";
  const primaryLabel = session ? "Uygulamayı aç" : "Giriş yap & başla";

  return (
    <div className="flex flex-1 flex-col">
      <MarketingHeader />

      {/* ───────────────────────── HERO ───────────────────────── */}
      <section className="relative isolate overflow-hidden">
        <div className="bg-aurora pointer-events-none absolute inset-0 -z-10" />
        <div className="bg-grid pointer-events-none absolute inset-0 -z-10 opacity-60 [mask-image:radial-gradient(ellipse_at_center,black_50%,transparent_85%)]" />

        <div className="mx-auto grid w-full max-w-6xl gap-12 px-6 pt-20 pb-24 md:grid-cols-[1.05fr_0.95fr] md:gap-16 md:pt-28 md:pb-32">
          <div className="flex flex-col justify-center">
            <span className="eyebrow reveal inline-flex w-fit items-center gap-2 rounded-full border border-border/70 bg-card/70 px-3 py-1 text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse-dot" />
              Release notes, zevkle otomatize
            </span>

            <h1 className="reveal reveal-delay-1 mt-6 text-balance text-[2.6rem] font-medium leading-[1.05] tracking-[-0.025em] md:text-[3.6rem]">
              Commit&apos;leri,{" "}
              <span className="font-serif italic text-primary">
                takımının okuyacağı
              </span>{" "}
              sürüm notlarına çevir.
            </h1>

            <p className="reveal reveal-delay-2 mt-6 max-w-xl text-balance text-base leading-relaxed text-muted-foreground md:text-lg">
              Bir repo bağla. İki ref ya da merge edilmiş PR&apos;lar seç.
              Releaser diff&apos;i kategorize eder, riskli değişiklikleri
              işaretler ve sana changelog&apos;a yapıştırılmaya hazır markdown
              verir.
            </p>

            <div className="reveal reveal-delay-3 mt-9 flex flex-wrap items-center gap-3">
              <Link
                href={primaryHref}
                className={cn(
                  buttonVariants({ size: "lg" }),
                  "gap-2 px-5 shadow-lg shadow-primary/20",
                )}
              >
                {primaryLabel}
                <ArrowUpRight className="h-4 w-4" />
              </Link>
              <Link
                href="/guide"
                className={cn(
                  buttonVariants({ size: "lg", variant: "outline" }),
                  "gap-2 px-5",
                )}
              >
                Rehberi oku
              </Link>
            </div>

            <div className="reveal reveal-delay-4 mt-10 flex items-center gap-4 text-xs text-muted-foreground">
              <span className="eyebrow">Çalıştığı yerler</span>
              <span className="inline-flex items-center gap-1.5">
                <GithubIcon className="h-3.5 w-3.5" /> GitHub
              </span>
              <span className="text-border">·</span>
              <span className="inline-flex items-center gap-1.5">
                <BitbucketIcon className="h-3.5 w-3.5" /> Bitbucket
              </span>
              <span className="text-border">·</span>
              <span className="font-mono">GLM · OpenAI · DeepSeek · Ollama</span>
            </div>
          </div>

          <div className="reveal reveal-delay-3 relative md:pl-4">
            {/* Decorative wire connector behind the card */}
            <svg
              className="pointer-events-none absolute -inset-6 -z-10 opacity-40"
              viewBox="0 0 400 400"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M40 60 H160 V200 H260 V340 H380"
                stroke="oklch(0.78 0.16 62)"
                strokeWidth="1"
                className="animate-wire"
              />
              <circle cx="40" cy="60" r="3" fill="oklch(0.78 0.16 62)" />
              <circle cx="380" cy="340" r="3" fill="oklch(0.78 0.16 62)" />
            </svg>
            <ReleasePreviewCard />
          </div>
        </div>
      </section>

      {/* ───────────────────────── HOW IT WORKS ───────────────────────── */}
      <section
        id="how"
        className="relative border-t border-border/60 bg-card/30"
      >
        <div className="mx-auto w-full max-w-6xl px-6 py-20">
          <div className="max-w-2xl">
            <span className="eyebrow text-muted-foreground">
              Nasıl çalışır
            </span>
            <h2 className="mt-3 text-balance text-3xl font-medium tracking-[-0.02em] md:text-4xl">
              Üç dürüst adım.{" "}
              <span className="font-serif italic text-primary">Sihir yok.</span>
            </h2>
            <p className="mt-3 text-muted-foreground">
              Releaser, sağlayıcının API&apos;si ile senin seçtiğin bir AI
              modelinin üzerine ince bir katmandan ibaret. Her şey
              session&apos;ına özel, server tarafında.
            </p>
          </div>

          <ol className="relative mt-14 grid gap-10 md:grid-cols-3 md:gap-8">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute left-0 right-0 top-7 hidden h-px bg-gradient-to-r from-transparent via-border to-transparent md:block"
            />
            <Step
              n="01"
              icon={<GitBranch className="h-4 w-4" />}
              title="Repo'nu bağla"
              body="GitHub ya da Bitbucket ile giriş yap. Kodunu okumuyoruz — sadece commit metadatasını ve merge edilmiş PR'ları."
            />
            <Step
              n="02"
              icon={<GitPullRequest className="h-4 w-4" />}
              title="Bir aralık seç"
              body="İki ref karşılaştır ya da son N merged PR'yi batch'le. Lockfile, dist/, binary dosyalar otomatik elenir."
            />
            <Step
              n="03"
              icon={<Wand2 className="h-4 w-4" />}
              title="Üret &amp; gönder"
              body="AI sağlayıcın kategorize edilmiş notları yazar. Monaco editörde düzenle, markdown'ı kopyala, geçmişe kaydet."
            />
          </ol>
        </div>
      </section>

      {/* ───────────────────────── FEATURES GRID ───────────────────────── */}
      <section id="features" className="border-t border-border/60">
        <div className="mx-auto w-full max-w-6xl px-6 py-20">
          <div className="grid gap-3 md:grid-cols-2 md:items-end md:gap-12">
            <div>
              <span className="eyebrow text-muted-foreground">Özellikler</span>
              <h2 className="mt-3 text-balance text-3xl font-medium tracking-[-0.02em] md:text-4xl">
                Release çıkarmanın{" "}
                <span className="font-serif italic text-primary">
                  sıkıcı kısımları
                </span>{" "}
                için.
              </h2>
            </div>
            <p className="text-muted-foreground md:max-w-md md:text-right">
              Org dashboard&apos;u yok, commit&apos;lerini takip eden analytics
              yok — sadece sürekli ertelediğin o tek iş.
            </p>
          </div>

          <div className="mt-12 grid gap-px overflow-hidden rounded-2xl border border-border/60 bg-border/60 sm:grid-cols-2 lg:grid-cols-3">
            <FeatureCell
              icon={<ListChecks className="h-4 w-4" />}
              title="Kategorize çıktı"
              body="Features, fixes, refactors, performance, security, breaking — önceden gruplanmış, asla bir madde duvarı değil."
            />
            <FeatureCell
              icon={<ShieldAlert className="h-4 w-4" />}
              title="Risk analizi"
              body="Auth, DB migration, payment, env/config — review'dan önce kanıtla birlikte severity'siyle işaretlenir."
            />
            <FeatureCell
              icon={<SparklesIcon className="h-4 w-4" />}
              title="Kendi AI'ını getir"
              body="OpenAI, GLM (Z.AI), DeepSeek, Groq, Ollama. Tek env var ile model değişir — kod değişmez."
            />
            <FeatureCell
              icon={<BoxSelect className="h-4 w-4" />}
              title="Monaco editör"
              body="Yan yana canlı markdown önizlemesi. Kopyala, .md indir, ya da release geçmişine kaydet."
            />
            <FeatureCell
              icon={<GitPullRequest className="h-4 w-4" />}
              title="PR-farkında gruplama"
              body="Commit'ler merged PR ile geldiyse Releaser PR'a göre gruplar ve çıktıda PR numarasını yüzeye çıkarır."
            />
            <FeatureCell
              icon={<Lock className="h-4 w-4" />}
              title="Session'a özel"
              body="OAuth token'ları server'da kalır. Her API çağrısı session-gated; her release tek kullanıcıya scope'lu."
            />
          </div>
        </div>
      </section>

      {/* ───────────────────────── CLOSING CTA ───────────────────────── */}
      <section className="relative border-t border-border/60">
        <div className="bg-aurora pointer-events-none absolute inset-0 -z-10 opacity-60" />
        <div className="mx-auto w-full max-w-3xl px-6 py-24 text-center">
          <h2 className="text-balance text-3xl font-medium tracking-[-0.02em] md:text-5xl">
            Changelog&apos;a{" "}
            <span className="font-serif italic text-primary">
              &ldquo;çeşitli düzeltmeler ve iyileştirmeler&rdquo;
            </span>{" "}
            yapıştırmayı bırak.
          </h2>
          <div className="mt-8 inline-flex flex-wrap items-center justify-center gap-3">
            <Link
              href={primaryHref}
              className={cn(
                buttonVariants({ size: "lg" }),
                "gap-2 px-5 shadow-lg shadow-primary/20",
              )}
            >
              {primaryLabel}
              <ArrowUpRight className="h-4 w-4" />
            </Link>
            <Link
              href="/guide"
              className={cn(
                buttonVariants({ size: "lg", variant: "ghost" }),
                "gap-2 px-5",
              )}
            >
              Nasıl çalışıyor?
            </Link>
          </div>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}

function Step({
  n,
  icon,
  title,
  body,
}: {
  n: string;
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <li className="relative flex flex-col">
      <div className="relative z-10 flex items-center gap-3">
        <div className="grid h-14 w-14 place-items-center rounded-full border border-border/80 bg-background text-primary shadow-sm">
          {icon}
        </div>
        <div className="font-mono text-xs text-muted-foreground">
          adım {n}
        </div>
      </div>
      <h3 className="mt-5 text-lg font-medium tracking-tight">{title}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
        {body}
      </p>
    </li>
  );
}

function FeatureCell({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="group bg-background p-6 transition-colors hover:bg-card">
      <div className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-accent text-accent-foreground">
        {icon}
      </div>
      <h3 className="mt-4 text-base font-medium tracking-tight">{title}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
        {body}
      </p>
    </div>
  );
}
