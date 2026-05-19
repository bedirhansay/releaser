import Link from "next/link";
import { auth } from "@/auth";
import { Logo, LogoMark } from "@/components/brand/logo";
import { buttonVariants } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/guide", label: "Rehber" },
  { href: "/#how", label: "Nasıl çalışır" },
  { href: "/#features", label: "Özellikler" },
];

export async function MarketingHeader() {
  const session = await auth();
  return (
    <header className="sticky top-0 z-30 border-b border-border/60 bg-background/70 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-6">
        <Link
          href="/"
          className="group inline-flex items-center gap-2"
          aria-label="Releaser ana sayfa"
        >
          <Logo size={28} />
        </Link>
        <nav className="hidden items-center gap-7 md:flex">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="text-sm text-muted-foreground underline-grow hover:text-foreground"
            >
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          {session ? (
            <Link
              href="/dashboard"
              className={cn(buttonVariants({ size: "sm" }))}
            >
              Uygulamayı aç
            </Link>
          ) : (
            <Link
              href="/login"
              className={cn(buttonVariants({ size: "sm" }))}
            >
              Giriş yap
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}

export function MarketingFooter() {
  return (
    <footer className="border-t border-border/60 mt-24">
      <div className="mx-auto grid w-full max-w-6xl gap-8 px-6 py-12 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <div className="flex items-center gap-2.5">
            <LogoMark size={24} />
            <span className="text-sm font-medium tracking-[-0.01em]">
              Releaser
            </span>
          </div>
          <p className="mt-3 max-w-sm text-sm text-muted-foreground">
            Git geçmişini takımının gerçekten okuyacağı sürüm notlarına
            çevirmek için ufak, görüşlü bir araç.
          </p>
          <p className="mt-6 font-mono text-xs text-muted-foreground/80">
            v0.1.0 · MVP
          </p>
        </div>
        <FooterColumn
          title="Ürün"
          items={[
            { href: "/#how", label: "Nasıl çalışır" },
            { href: "/#features", label: "Özellikler" },
            { href: "/guide", label: "Rehber" },
          ]}
        />
        <FooterColumn
          title="Entegrasyonlar"
          items={[
            { href: "/guide#providers", label: "GitHub" },
            { href: "/guide#providers", label: "Bitbucket" },
            { href: "/guide#ai", label: "AI sağlayıcıları" },
          ]}
        />
        <FooterColumn
          title="Yasal"
          items={[
            { href: "/guide#faq", label: "Gizlilik" },
            { href: "/guide#providers", label: "OAuth scope'ları" },
          ]}
        />
      </div>
      <div className="border-t border-border/60">
        <div className="mx-auto flex h-12 w-full max-w-6xl items-center justify-between px-6 font-mono text-[11px] text-muted-foreground">
          <span>© {new Date().getFullYear()} Releaser</span>
          <span className="hidden sm:inline">
            Next.js · Prisma · GLM ile yapıldı
          </span>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({
  title,
  items,
}: {
  title: string;
  items: { href: string; label: string }[];
}) {
  return (
    <div>
      <h4 className="eyebrow text-muted-foreground">{title}</h4>
      <ul className="mt-3 space-y-1.5">
        {items.map((i) => (
          <li key={i.href + i.label}>
            <Link
              href={i.href}
              className="text-sm text-foreground/90 underline-grow hover:text-foreground"
            >
              {i.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
