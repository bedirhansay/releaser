import { CheckCircle2, TriangleAlert } from "lucide-react";
import { auth, signIn } from "@/auth";
import { BitbucketIcon } from "@/components/icons/bitbucket";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { listLinkedProviders } from "@/features/repositories/repositories.service";

/**
 * Bitbucket uses plain OAuth (no App installation), so connecting is a sign-in
 * link that mirrors the token onto the org's GitConnection. Server component:
 * reads config + current connection state, exposes an admin-only connect action.
 */
export async function BitbucketCard() {
  const session = await auth();
  const orgId = session?.user?.orgId ?? null;
  const isAdmin =
    session?.user?.role === "OWNER" || session?.user?.role === "ADMIN";

  const configured = Boolean(process.env.AUTH_BITBUCKET_ID);
  const connected = orgId
    ? (await listLinkedProviders(orgId)).includes("bitbucket")
    : false;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <BitbucketIcon className="h-4 w-4" />
          Bitbucket erişimi (OAuth)
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <p className="text-sm text-muted-foreground">
          Bitbucket repolarına erişim OAuth ile sağlanır. Bağlandığında token
          organizasyon adına saklanır; tüm ekip aynı bağlantıyı kullanır.
        </p>

        {!configured ? (
          <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-sm">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <div>
              <p className="font-medium text-foreground">
                Bitbucket henüz sunucuda yapılandırılmamış
              </p>
              <p className="mt-0.5 text-muted-foreground">
                Yöneticinin <code className="font-mono">AUTH_BITBUCKET_ID</code>{" "}
                ve <code className="font-mono">AUTH_BITBUCKET_SECRET</code>{" "}
                değerlerini (Bitbucket OAuth consumer) ayarlaması gerekiyor.
              </p>
            </div>
          </div>
        ) : connected ? (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2.5 text-sm">
            <span className="flex items-center gap-2 font-medium text-foreground">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              Bitbucket bağlı
            </span>
            {isAdmin && (
              <ReconnectButton label="Yeniden bağla" variant="ghost" />
            )}
          </div>
        ) : isAdmin ? (
          <ReconnectButton label="Bitbucket bağla" variant="outline" />
        ) : (
          <p className="text-sm text-muted-foreground">
            Bitbucket bağlı değil. Bir yöneticinin bağlaması gerekiyor.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function ReconnectButton({
  label,
  variant,
}: {
  label: string;
  variant: "outline" | "ghost";
}) {
  return (
    <form
      action={async () => {
        "use server";
        await signIn("bitbucket", { redirectTo: "/dashboard/settings" });
      }}
    >
      <Button type="submit" variant={variant} size="sm" className="gap-2">
        <BitbucketIcon className="h-4 w-4" />
        {label}
      </Button>
    </form>
  );
}
