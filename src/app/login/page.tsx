import Link from "next/link";
import { redirect } from "next/navigation";
import { auth, signIn } from "@/auth";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { GithubIcon } from "@/components/icons/github";
import { BitbucketIcon } from "@/components/icons/bitbucket";
import { Logo } from "@/components/brand/logo";
import { CredentialsForm } from "./credentials-form";

interface PageProps {
  searchParams: Promise<{ from?: string }>;
}

export default async function LoginPage({ searchParams }: PageProps) {
  const session = await auth();
  if (session) redirect("/dashboard");
  const { from } = await searchParams;
  const redirectTo = from && from.startsWith("/") ? from : "/dashboard";

  // Prefill the seeded superadmin in local dev only — never in production, so
  // the credentials never ship in a deployed bundle.
  const isDev = process.env.NODE_ENV !== "production";
  const defaultEmail = isDev ? (process.env.SUPERADMIN_EMAIL ?? "") : "";
  const defaultPassword = isDev ? (process.env.SUPERADMIN_PASSWORD ?? "") : "";

  return (
    <div className="relative isolate flex flex-1 items-center justify-center px-6 py-16">
      <div className="bg-aurora pointer-events-none absolute inset-0 -z-10 opacity-70" />
      <div className="bg-grid pointer-events-none absolute inset-0 -z-10 opacity-50 [mask-image:radial-gradient(ellipse_at_center,black_40%,transparent_85%)]" />

      <div className="w-full max-w-md">
        <Link
          href="/"
          className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <Logo size={28} />
        </Link>

        <Card className="border-border/70 bg-card/80 backdrop-blur">
          <CardHeader className="space-y-2 text-center">
            <CardTitle className="font-serif text-3xl italic text-foreground">
              Tekrar hoş geldin
            </CardTitle>
            <CardDescription>
              Yöneticinin tanımladığı e-posta ve şifreyle giriş yap.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <CredentialsForm
              redirectTo={redirectTo}
              defaultEmail={defaultEmail}
              defaultPassword={defaultPassword}
            />

            <div className="flex items-center gap-3 pt-1">
              <Separator className="flex-1" />
              <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                git bağlamak için
              </span>
              <Separator className="flex-1" />
            </div>

            <form
              action={async () => {
                "use server";
                await signIn("github", { redirectTo });
              }}
            >
              <Button
                type="submit"
                size="lg"
                variant="outline"
                className="w-full gap-2"
              >
                <GithubIcon className="h-4 w-4" />
                GitHub ile devam et
              </Button>
            </form>

            <form
              action={async () => {
                "use server";
                await signIn("bitbucket", { redirectTo });
              }}
            >
              <Button
                type="submit"
                size="lg"
                variant="outline"
                className="w-full gap-2"
              >
                <BitbucketIcon className="h-4 w-4" />
                Bitbucket ile devam et
              </Button>
            </form>

            <p className="pt-3 text-center text-xs text-muted-foreground">
              İlk defa mı geldin?{" "}
              <Link href="/guide" className="text-foreground underline-grow">
                Önce rehberi oku
              </Link>
              .
            </p>
          </CardContent>
        </Card>

        <p className="mt-6 text-center font-mono text-[11px] text-muted-foreground">
          Repo&apos;na hiç yazmıyoruz. OAuth token&apos;ları server&apos;da kalır.
        </p>
      </div>
    </div>
  );
}
