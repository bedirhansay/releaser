import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { ThemeToggle } from "@/components/theme-toggle";
import { Logo } from "@/components/brand/logo";
import { UserMenu } from "@/components/dashboard/user-menu";
import {
  BookOpen,
  FolderGit2,
  History,
  LayoutDashboard,
  LayoutTemplate,
  Settings,
  Users,
  Wand2,
} from "lucide-react";

const NAV_PRIMARY = [
  { href: "/dashboard", label: "Genel bakış", icon: LayoutDashboard, kbd: "1" },
  { href: "/dashboard/generate", label: "Yeni release", icon: Wand2, kbd: "2" },
  { href: "/dashboard/projects", label: "Projeler", icon: FolderGit2, kbd: "3" },
  {
    href: "/dashboard/templates",
    label: "Şablonlar",
    icon: LayoutTemplate,
    kbd: "4",
  },
  { href: "/dashboard/history", label: "Geçmiş", icon: History, kbd: "5" },
];
const NAV_SECONDARY = [
  { href: "/dashboard/settings", label: "Ayarlar", icon: Settings },
  { href: "/guide", label: "Rehber", icon: BookOpen },
];

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const isAdmin =
    session.user.role === "OWNER" || session.user.role === "ADMIN";

  return (
    <div className="flex min-h-dvh flex-1">
      <aside className="bg-sidebar text-sidebar-foreground hidden w-60 shrink-0 flex-col border-r border-sidebar-border md:flex">
        <Link
          href="/dashboard"
          className="flex h-14 items-center gap-2 border-b border-sidebar-border px-5"
          aria-label="Releaser home"
        >
          <Logo size={26} />
        </Link>

        <nav className="flex flex-1 flex-col gap-px p-3">
          <SectionLabel>Çalışma alanı</SectionLabel>
          {NAV_PRIMARY.map((item) => (
            <NavItem key={item.href} {...item} />
          ))}

          {isAdmin && (
            <>
              <SectionLabel className="mt-6">Yönetim</SectionLabel>
              <NavItem href="/dashboard/org" label="Takım" icon={Users} />
            </>
          )}

          <SectionLabel className="mt-6">Öğren</SectionLabel>
          {NAV_SECONDARY.map((item) => (
            <NavItem key={item.href} {...item} />
          ))}
        </nav>

        <div className="border-t border-sidebar-border p-3">
          <div className="rounded-md bg-sidebar-accent/50 p-3 text-xs">
            <div className="eyebrow text-sidebar-accent-foreground">
              {isAdmin ? "Yönetici" : "Çalışma alanı"}
            </div>
            <p className="mt-1.5 leading-relaxed text-muted-foreground">
              Token&apos;lar şifreli saklanır, AI üretimi rate-limit&apos;lidir.
              {isAdmin
                ? " Takım, projeler ve sağlayıcıları Yönetim'den düzenle."
                : " Erişimin yöneticin tarafından tanımlanır."}
            </p>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center justify-between border-b border-border/60 bg-background/80 px-6 backdrop-blur">
          <div className="md:hidden">
            <Logo size={26} />
          </div>
          <div className="hidden items-center gap-2 text-xs text-muted-foreground md:flex">
            <span className="eyebrow">Releaser</span>
            <span className="text-border">/</span>
            <span className="text-foreground/70">Dashboard</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Link
              href="/guide"
              className="hidden items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground md:inline-flex"
            >
              <BookOpen className="h-3.5 w-3.5" />
              Rehber
            </Link>
            <ThemeToggle />
            <UserMenu
              user={{
                name: session.user.name,
                email: session.user.email,
                image: session.user.image,
              }}
            />
          </div>
        </header>
        <main className="flex-1 px-6 py-8">{children}</main>
      </div>
    </div>
  );
}

function SectionLabel({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`eyebrow px-2 pb-1.5 pt-2 text-muted-foreground ${className ?? ""}`}
    >
      {children}
    </div>
  );
}

function NavItem({
  href,
  label,
  icon: Icon,
  kbd,
}: {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  kbd?: string;
}) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
    >
      <Icon className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
      <span className="flex-1">{label}</span>
      {kbd && (
        <kbd className="ml-auto hidden h-5 select-none items-center justify-center rounded border border-border/70 bg-background/50 px-1.5 font-mono text-[10px] text-muted-foreground group-hover:flex">
          {kbd}
        </kbd>
      )}
    </Link>
  );
}
