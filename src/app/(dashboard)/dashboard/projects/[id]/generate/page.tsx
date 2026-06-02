import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { auth } from "@/auth";
import { getProjectForOrg } from "@/features/projects/projects.service";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ProjectGenerateClient } from "@/features/projects/components/project-generate-client";

export default async function ProjectGeneratePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  const project =
    session?.user?.id && session.user.orgId && session.user.role
      ? await getProjectForOrg(
          {
            userId: session.user.id,
            orgId: session.user.orgId,
            role: session.user.role,
          },
          id,
        )
      : null;
  if (!project) notFound();

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <Link
        href="/dashboard/projects"
        className={cn(
          buttonVariants({ variant: "ghost", size: "sm" }),
          "self-start gap-2",
        )}
      >
        <ArrowLeft className="h-4 w-4" />
        Projelere dön
      </Link>

      <div>
        <span className="eyebrow text-muted-foreground">Proje release&apos;i</span>
        <h1 className="mt-2 text-3xl font-medium tracking-[-0.02em]">
          {project.name}{" "}
          <span className="font-serif italic text-primary">release&apos;i</span>
        </h1>
        <p className="mt-2 max-w-xl text-sm text-muted-foreground">
          Şablonu ve PR penceresini seç; tüm repolardaki değişiklikler tek bir
          standart dokümanda toplanır. Üretilen taslağı düzenleyip kaydedebilirsin.
        </p>
      </div>

      <ProjectGenerateClient
        project={{
          id: project.id,
          name: project.name,
          slug: project.slug,
          description: project.description,
          repos: project.repos,
        }}
      />
    </div>
  );
}
