import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  Database,
  GitBranch,
  GitMerge,
  KeyRound,
  Pencil,
  ServerCog,
  ShieldCheck,
  Sparkles,
  TerminalSquare,
  Wand2,
} from "lucide-react";
import {
  MarketingFooter,
  MarketingHeader,
} from "@/components/marketing/marketing-shell";
import { GithubIcon } from "@/components/icons/github";
import { BitbucketIcon } from "@/components/icons/bitbucket";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata = {
  title: "Rehber — Releaser",
  description:
    "Releaser'ı baştan sona kur: sağlayıcı bağla, AI modelini ayarla ve ilk release notlarını gönder.",
};

const SECTIONS = [
  { id: "prereqs", label: "Gereksinimler" },
  { id: "providers", label: "Sağlayıcı bağla" },
  { id: "ai", label: "AI modeli seç" },
  { id: "flow", label: "Not üret" },
  { id: "edit", label: "Düzenle & dışa aktar" },
  { id: "faq", label: "SSS" },
  { id: "troubleshooting", label: "Sorun giderme" },
];

export default async function GuidePage() {
  return (
    <div className="flex flex-1 flex-col">
      <MarketingHeader />

      <main className="mx-auto w-full max-w-6xl px-6 py-16 md:py-24">
        {/* Header */}
        <div className="max-w-2xl">
          <span className="eyebrow text-muted-foreground">Rehber</span>
          <h1 className="mt-3 text-balance text-4xl font-medium leading-[1.1] tracking-[-0.025em] md:text-5xl">
            Sıfırdan{" "}
            <span className="font-serif italic text-primary">
              gönderilmiş bir changelog&apos;a
            </span>{" "}
            beş dakikada.
          </h1>
          <p className="mt-5 text-balance text-muted-foreground md:text-lg">
            Pragmatik bir adım adım — neye ihtiyacın var, nereye tıklayacaksın
            ve bir şey ters gittiğinde ne yapacaksın.
          </p>
        </div>

        <div className="mt-12 grid gap-12 lg:grid-cols-[220px_1fr]">
          {/* TOC */}
          <aside className="hidden lg:block">
            <nav className="sticky top-24 space-y-1 text-sm">
              <div className="eyebrow mb-3 text-muted-foreground">
                Bu sayfada
              </div>
              {SECTIONS.map((s) => (
                <Link
                  key={s.id}
                  href={`#${s.id}`}
                  className="block rounded-md px-2 py-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  {s.label}
                </Link>
              ))}
            </nav>
          </aside>

          <div className="min-w-0 space-y-20">
            {/* PREREQUISITES */}
            <Section
              id="prereqs"
              eyebrow="Başlamadan önce"
              title="Elinde olması gereken üç şey"
              lead="Releaser kendi GitHub uygulamasını ya da AI anahtarını getirmiyor — onları sen getiriyorsun. Bedeli bir dakikalık kurulum, karşılığı kimlik bilgilerinin tam kontrolü."
            >
              <div className="grid gap-3 sm:grid-cols-3">
                <Prereq
                  icon={<GithubIcon className="h-4 w-4" />}
                  title="Bir git hesabı"
                  body="GitHub ya da Bitbucket. Kişisel hesap da olur."
                />
                <Prereq
                  icon={<Database className="h-4 w-4" />}
                  title="Bir Postgres URL'i"
                  body="Local Docker, Neon, Supabase — fark etmez."
                />
                <Prereq
                  icon={<KeyRound className="h-4 w-4" />}
                  title="Bir AI API anahtarı"
                  body="GLM, OpenAI, DeepSeek, Ollama, Groq…"
                />
              </div>
            </Section>

            {/* PROVIDERS */}
            <Section
              id="providers"
              eyebrow="Adım 1"
              title="Bir sağlayıcı bağla"
              lead="İki yol — takımın hangisini kullanıyorsa onu seç. İkisini de bağlayıp generate formunda seçim yapabilirsin."
            >
              <div className="grid gap-4 md:grid-cols-2">
                <ProviderCard
                  icon={<GithubIcon className="h-5 w-5" />}
                  name="GitHub"
                  steps={[
                    "Settings → Developer settings → OAuth Apps → New OAuth App yolunu izle.",
                    <>
                      Callback URL:{" "}
                      <code className="rounded bg-muted px-1 py-0.5 font-mono text-[12px]">
                        http://localhost:3000/api/auth/callback/github
                      </code>
                      .
                    </>,
                    <>
                      <strong>Client ID</strong>&apos;yi kopyala ve bir{" "}
                      <strong>Client Secret</strong> oluştur.
                    </>,
                    <>
                      İkisini{" "}
                      <code className="rounded bg-muted px-1 py-0.5 font-mono text-[12px]">
                        .env
                      </code>{" "}
                      içine <code>AUTH_GITHUB_ID</code> ve{" "}
                      <code>AUTH_GITHUB_SECRET</code> olarak yapıştır.
                    </>,
                  ]}
                  scope="read:user user:email repo"
                />
                <ProviderCard
                  icon={<BitbucketIcon className="h-5 w-5" />}
                  name="Bitbucket"
                  steps={[
                    "Workspace settings → OAuth consumers → Add consumer yolunu izle.",
                    <>
                      Callback URL:{" "}
                      <code className="rounded bg-muted px-1 py-0.5 font-mono text-[12px]">
                        http://localhost:3000/api/auth/callback/bitbucket
                      </code>
                      .
                    </>,
                    <>
                      İzinler: <strong>Account</strong> (read),{" "}
                      <strong>Email</strong> (read),{" "}
                      <strong>Repositories</strong> (read).
                    </>,
                    <>
                      <strong>Key</strong> ve <strong>Secret</strong>&apos;i{" "}
                      <code className="rounded bg-muted px-1 py-0.5 font-mono text-[12px]">
                        AUTH_BITBUCKET_ID
                      </code>
                      ,{" "}
                      <code className="rounded bg-muted px-1 py-0.5 font-mono text-[12px]">
                        AUTH_BITBUCKET_SECRET
                      </code>
                      &apos;e yaz.
                    </>,
                  ]}
                  scope="account email repository"
                />
              </div>
            </Section>

            {/* AI MODEL */}
            <Section
              id="ai"
              eyebrow="Adım 2"
              title="Bir AI modeli seç"
              lead="AI sağlayıcısı tasarımdan OpenAI-compatible — OpenAI'ın chat completions şemasını konuşan her şey çalışır. Üç env değişkeni, hepsi bu."
            >
              <EnvBlock />

              <div className="mt-6 grid gap-2 text-sm">
                <CodeRow
                  label="OpenAI"
                  url="(AI_BASE_URL'i boş bırak)"
                  model="gpt-4o-mini"
                />
                <CodeRow
                  label="Z.AI (GLM Coding Plan)"
                  url="https://api.z.ai/api/coding/paas/v4"
                  model="glm-4.6"
                />
                <CodeRow
                  label="DeepSeek"
                  url="https://api.deepseek.com/v1"
                  model="deepseek-chat"
                />
                <CodeRow
                  label="Groq"
                  url="https://api.groq.com/openai/v1"
                  model="llama-3.3-70b-versatile"
                />
                <CodeRow
                  label="Ollama (lokal)"
                  url="http://localhost:11434/v1"
                  model="llama3"
                />
              </div>

              <Callout tone="info">
                Sağlayıcı değiştirmek sadece konfigürasyon işi — engine kodu
                hangi modeli seçtiğine bakmıyor bile.
              </Callout>
            </Section>

            {/* GENERATE FLOW */}
            <Section
              id="flow"
              eyebrow="Adım 3"
              title="Release notları üret"
              lead="Dashboard'a git, Generate'e bas, dört seçim yap."
            >
              <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <FlowStep
                  n="1"
                  icon={<ServerCog className="h-4 w-4" />}
                  title="Sağlayıcı"
                  body="İkisini de bağladıysan GitHub ya da Bitbucket seç."
                />
                <FlowStep
                  n="2"
                  icon={<GitBranch className="h-4 w-4" />}
                  title="Repo"
                  body="Combobox son repolarını listeler. İsme göre ara."
                />
                <FlowStep
                  n="3"
                  icon={<GitMerge className="h-4 w-4" />}
                  title="Ref'ler"
                  body="Base ← head. Aradaki diff modele gönderilir."
                />
                <FlowStep
                  n="4"
                  icon={<Wand2 className="h-4 w-4" />}
                  title="Üret"
                  body="AI kategorize edilmiş notlar + riskler döner."
                />
              </ol>

              <Callout tone="info">
                <strong className="text-foreground">PR modu</strong> yolda —
                &ldquo;Son N merged PR&rdquo; ya da iki tag arası seçersin,
                Releaser modele PR başına temiz gruplamayla diff yollar. O
                gelene kadar branch compare desteklenen akış.
              </Callout>
            </Section>

            {/* EDIT & EXPORT */}
            <Section
              id="edit"
              eyebrow="Adım 4"
              title="Önce düzenle, sonra dışa aktar"
              lead="Releaser seni split editöre indirir — solda Monaco, sağda canlı markdown önizlemesi."
            >
              <div className="grid gap-3 sm:grid-cols-3">
                <SmallCard
                  icon={<Pencil className="h-4 w-4" />}
                  title="Inline düzenle"
                  body="Başlıkları değiştir, chore item'ları çıkar, özeti yeniden yaz. Sadece sen — autosave yok."
                />
                <SmallCard
                  icon={<TerminalSquare className="h-4 w-4" />}
                  title="Markdown'ı kopyala"
                  body="Tek tıkla tüm dokümanı clipboard'a kopyalar."
                />
                <SmallCard
                  icon={<CheckCircle2 className="h-4 w-4" />}
                  title="Geçmişe kaydet"
                  body="Kaydedilen her release Postgres'te, sana özel. /dashboard/history'den tekrar açabilirsin."
                />
              </div>
            </Section>

            {/* FAQ */}
            <Section
              id="faq"
              eyebrow="SSS"
              title="Sık sorulanlar"
              lead=""
            >
              <dl className="divide-y divide-border/60 rounded-xl border border-border/60">
                <Faq
                  q="Access token'larım at-rest şifreli mi?"
                  a="MVP'de değil — Postgres'te düz metin olarak duruyor. Production'a çıkmadan pgcrypto ya da app-layer AES ile sar, anahtarı secret manager'dan al."
                />
                <Faq
                  q="Releaser hangi scope'ları istiyor?"
                  a="GitHub: read:user, user:email, repo (sadece public istiyorsan public_repo'ya düşür). Bitbucket: account, email, repository. Hepsi read-only; commit ya da PR yazmıyoruz."
                />
                <Faq
                  q="AI ne kadar büyük bir diff'i kaldırabilir?"
                  a="Lockfile'lar, dist/, build/ ve binary dosyalar atılır, sonra churn'a göre top-N gönderilir. Çok büyük pencereler için PR modunu tercih et (yolda)."
                />
                <Faq
                  q="AI'ı self-host edebilir miyim?"
                  a="Evet — AI_BASE_URL'i lokal Ollama'ya (http://localhost:11434/v1) çevir, llama3 / qwen2.5-coder gibi modeller kullan. Veri makineden çıkmıyor."
                />
                <Faq
                  q="Releaser kodumu ya da diff'lerimi saklıyor mu?"
                  a="Compare payload'ı sadece üretim sırasında memory'de duruyor. AI'ın yapılandırılmış çıktısı + nihai markdown saklanıyor — kaynak diff değil."
                />
              </dl>
            </Section>

            {/* TROUBLESHOOTING */}
            <Section
              id="troubleshooting"
              eyebrow="Sorun giderme"
              title="Bir şeyler ters gittiğinde"
              lead=""
            >
              <div className="grid gap-3">
                <Trouble
                  title="Giriş sırasında GitHub 404 dönüyor"
                  diag="Client ID boş ya da yanlış, veya OAuth App'teki callback URL dev portuyla eşleşmiyor."
                  fix="Önce .env'yi aç: AUTH_GITHUB_ID gerçekten ~20-char Client ID mi (40-char secret değil) kontrol et. Sonra callback URL'in tam olarak localhost:<PORT>/api/auth/callback/github olduğundan emin ol."
                />
                <Trouble
                  title="“No common ancestor between main and master”"
                  diag="İki ref'in ortak bir history'si yok. GitHub bunları gerçekten karşılaştıramıyor — bu bir Releaser hatası değil."
                  fix="Aynı soydan ref'ler seç (örn. main ile main'den fork olmuş bir feature branch). Ya da PR modunu kullan (yolda) — branch'ten bağımsız çalışır."
                />
                <Trouble
                  title="Z.AI: “Insufficient balance or no resource package”"
                  diag="Standart /api/paas/v4 endpoint'i pay-as-you-go. Coding Plan abonelikleri farklı bir path'te yaşıyor."
                  fix={
                    <>
                      Şunu ayarla:{" "}
                      <code className="rounded bg-muted px-1 py-0.5 font-mono text-[12px]">
                        AI_BASE_URL=https://api.z.ai/api/coding/paas/v4
                      </code>
                      , ve glm-4.6 gibi bir coding-plan modeli kullan.
                    </>
                  }
                />
                <Trouble
                  title="“AI provider out of credits or rate-limited” (429)"
                  diag="Ya kredi tükendi ya da dakika bazlı rate limit'e takıldın."
                  fix="Bir dakika bekleyip tekrar dene, veya farklı bir AI sağlayıcısına geç — sadece AI_BASE_URL + AI_MODEL değişir."
                />
              </div>
            </Section>

            {/* Closing CTA */}
            <div className="rounded-2xl border border-border/60 bg-card/40 p-8 text-center">
              <h3 className="font-serif text-2xl italic text-foreground">
                Sen hazır olduğunda hazır.
              </h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Kurulum hakkında okumak, yapmaktan daha uzun sürüyor.
              </p>
              <Link
                href="/login"
                className={cn(
                  buttonVariants({ size: "lg" }),
                  "mt-6 gap-2 px-5 shadow-lg shadow-primary/20",
                )}
              >
                <Sparkles className="h-4 w-4" />
                Giriş yap &amp; dene
              </Link>
            </div>
          </div>
        </div>
      </main>

      <MarketingFooter />
    </div>
  );
}

/* ----------------------------- helpers ----------------------------- */

function Section({
  id,
  eyebrow,
  title,
  lead,
  children,
}: {
  id: string;
  eyebrow: string;
  title: string;
  lead?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24">
      <div className="eyebrow text-muted-foreground">{eyebrow}</div>
      <h2 className="mt-2 text-balance text-2xl font-medium tracking-[-0.02em] md:text-3xl">
        {title}
      </h2>
      {lead && (
        <p className="mt-3 max-w-3xl text-muted-foreground">{lead}</p>
      )}
      <div className="mt-6">{children}</div>
    </section>
  );
}

function Prereq({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-lg border border-border/60 bg-card/40 p-4">
      <div className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-accent text-accent-foreground">
        {icon}
      </div>
      <div className="mt-3 font-medium">{title}</div>
      <p className="mt-1 text-sm text-muted-foreground">{body}</p>
    </div>
  );
}

function ProviderCard({
  icon,
  name,
  steps,
  scope,
}: {
  icon: React.ReactNode;
  name: string;
  steps: React.ReactNode[];
  scope: string;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-border/60 bg-card/40">
      <div className="flex items-center gap-3 border-b border-border/60 px-5 py-3">
        <div className="grid h-8 w-8 place-items-center rounded-md bg-foreground/5">
          {icon}
        </div>
        <div className="text-base font-medium">{name}</div>
        <span className="ml-auto font-mono text-[10px] text-muted-foreground">
          scope: {scope}
        </span>
      </div>
      <ol className="space-y-3 px-5 py-5 text-sm text-foreground/90">
        {steps.map((s, i) => (
          <li key={i} className="flex gap-3">
            <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-border/70 font-mono text-[10px] text-muted-foreground">
              {i + 1}
            </span>
            <div className="leading-relaxed">{s}</div>
          </li>
        ))}
      </ol>
    </div>
  );
}

function EnvBlock() {
  return (
    <pre className="overflow-x-auto rounded-xl border border-border/60 bg-foreground/[0.03] p-5 font-mono text-[12.5px] leading-relaxed">
      <code>
        <span className="text-muted-foreground"># .env</span>
        {"\n"}
        AI_API_KEY=<span className="text-primary">&quot;sk-...&quot;</span>
        {"\n"}
        AI_BASE_URL=<span className="text-primary">
          &quot;https://api.openai.com/v1&quot;
        </span>
        {"\n"}
        AI_MODEL=<span className="text-primary">&quot;gpt-4o-mini&quot;</span>
      </code>
    </pre>
  );
}

function CodeRow({
  label,
  url,
  model,
}: {
  label: string;
  url: string;
  model: string;
}) {
  return (
    <div className="grid grid-cols-[1fr_auto] items-center gap-3 rounded-md border border-border/50 bg-card/30 px-4 py-2 sm:grid-cols-[180px_1fr_auto]">
      <div className="font-medium">{label}</div>
      <code className="truncate font-mono text-[12px] text-muted-foreground">
        {url}
      </code>
      <code className="font-mono text-[12px] text-primary">{model}</code>
    </div>
  );
}

function FlowStep({
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
    <li className="rounded-lg border border-border/60 bg-card/30 p-4">
      <div className="flex items-center gap-2">
        <span className="grid h-7 w-7 place-items-center rounded-full bg-primary/10 text-primary">
          {icon}
        </span>
        <span className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
          adım {n}
        </span>
      </div>
      <div className="mt-3 font-medium">{title}</div>
      <p className="mt-1 text-sm text-muted-foreground">{body}</p>
    </li>
  );
}

function SmallCard({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-lg border border-border/60 bg-card/40 p-4">
      <div className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-accent text-accent-foreground">
        {icon}
      </div>
      <div className="mt-3 font-medium">{title}</div>
      <p className="mt-1 text-sm text-muted-foreground">{body}</p>
    </div>
  );
}

function Faq({ q, a }: { q: string; a: string }) {
  return (
    <details className="group p-5 [&[open]>summary>svg]:rotate-45">
      <summary className="flex cursor-pointer list-none items-start justify-between gap-4 font-medium">
        <span>{q}</span>
        <svg
          className="mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform"
          viewBox="0 0 16 16"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M8 3v10M3 8h10"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      </summary>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{a}</p>
    </details>
  );
}

function Trouble({
  title,
  diag,
  fix,
}: {
  title: string;
  diag: string;
  fix: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border/60 bg-card/40 p-5">
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 text-primary" />
        <span className="font-medium">{title}</span>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        <span className="eyebrow mr-2 text-foreground/60">Neden</span>
        {diag}
      </p>
      <div className="mt-1.5 text-sm text-foreground/90">
        <span className="eyebrow mr-2 text-foreground/60">Çözüm</span>
        {fix}
      </div>
    </div>
  );
}

function Callout({
  tone,
  children,
}: {
  tone: "info" | "warn";
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "mt-6 flex items-start gap-3 rounded-lg border px-4 py-3 text-sm",
        tone === "info"
          ? "border-primary/30 bg-primary/[0.06] text-foreground/90"
          : "border-destructive/30 bg-destructive/[0.06] text-foreground/90",
      )}
    >
      <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
      <div>{children}</div>
    </div>
  );
}
