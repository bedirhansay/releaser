import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { auth } from "@/auth";
import { getReleaseForUser } from "@/features/releases/releases.service";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ReleaseDetailClient } from "@/features/releases/components/release-detail-client";
import { parseRelease } from "@/types/release-schemas";

export default async function ReleaseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  const release = session?.user?.id
    ? await getReleaseForUser(session.user.id, id)
    : null;
  if (!release) notFound();

  // `release.payload` is `Prisma.JsonValue`; we trust our own writer but
  // validate at the boundary so the client component receives typed data.
  const payload = parseRelease(release.payload);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <Link
        href="/dashboard/history"
        className={cn(
          buttonVariants({ variant: "ghost", size: "sm" }),
          "self-start gap-2",
        )}
      >
        <ArrowLeft className="h-4 w-4" />
        Geçmişe dön
      </Link>

      <ReleaseDetailClient
        release={{
          id: release.id,
          title: release.title,
          markdown: release.markdown,
          repoOwner: release.repoOwner,
          repoName: release.repoName,
          baseRef: release.baseRef,
          headRef: release.headRef,
          modelUsed: release.modelUsed,
          risks: payload.risks ?? [],
        }}
      />
    </div>
  );
}
