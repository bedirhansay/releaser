"use client";

import { useState } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import {
  FolderGit2,
  GitBranch,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  Wand2,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  useDeleteProject,
  useProjects,
  type ProjectDTO,
} from "@/features/projects/hooks";
import { ProjectFormDialog } from "@/features/projects/components/project-form";

export function ProjectsList({ isAdmin }: { isAdmin: boolean }) {
  const query = useProjects();
  const projects = query.data ?? [];

  if (query.isLoading) return <ListSkeleton />;

  if (query.error) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-sm text-destructive">
          {(query.error as Error).message}
        </CardContent>
      </Card>
    );
  }

  if (projects.length === 0) return <EmptyState isAdmin={isAdmin} />;

  return (
    <div className="flex flex-col gap-4">
      {isAdmin && (
        <div className="flex justify-end">
          <ProjectFormDialog
            trigger={
              <Button className="gap-1.5">
                <Plus className="h-4 w-4" /> Yeni proje
              </Button>
            }
          />
        </div>
      )}

      <div className="flex flex-col gap-3">
        {projects.map((project) => (
          <ProjectCard key={project.id} project={project} isAdmin={isAdmin} />
        ))}
      </div>
    </div>
  );
}

function ProjectCard({
  project,
  isAdmin,
}: {
  project: ProjectDTO;
  isAdmin: boolean;
}) {
  return (
    <Card className="ring-border/70 transition-colors hover:ring-border">
      <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <FolderGit2 className="h-4 w-4 shrink-0 text-primary" />
            <span className="truncate font-medium">{project.name}</span>
            {typeof project.releaseCount === "number" && (
              <span className="font-mono text-[11px] text-muted-foreground">
                · {project.releaseCount} release
              </span>
            )}
          </div>

          {project.description && (
            <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
              {project.description}
            </p>
          )}

          {project.repos.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {project.repos.map((repo, i) => (
                <Badge
                  key={repo.id ?? `${repo.owner}/${repo.name}-${i}`}
                  variant="secondary"
                  className="gap-1 font-mono text-[11px]"
                >
                  <GitBranch className="h-3 w-3" />
                  {repo.owner}/{repo.name}
                  {repo.role && (
                    <span className="text-muted-foreground">· {repo.role}</span>
                  )}
                </Badge>
              ))}
            </div>
          )}
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Link
            href={`/dashboard/projects/${project.id}/generate`}
            className={cn(buttonVariants({ size: "sm" }), "gap-1.5")}
          >
            <Wand2 className="h-3.5 w-3.5" /> Release üret
          </Link>
          {isAdmin && (
            <>
              <ProjectFormDialog
                project={project}
                trigger={
                  <Button variant="ghost" size="sm" className="gap-1.5">
                    <Pencil className="h-3.5 w-3.5" /> Düzenle
                  </Button>
                }
              />
              <DeleteProjectButton project={project} />
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function DeleteProjectButton({ project }: { project: ProjectDTO }) {
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();
  const remove = useDeleteProject();

  const handleDelete = async () => {
    try {
      await remove.mutateAsync(project.id);
      toast.success("Proje silindi");
      setOpen(false);
      await qc.invalidateQueries({ queryKey: ["projects"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Silinemedi");
    }
  };

  return (
    <>
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={() => setOpen(true)}
        aria-label={`${project.name} projesini sil`}
        className="text-muted-foreground hover:text-destructive"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bu projeyi silmek istediğine emin misin?</DialogTitle>
            <DialogDescription>
              <span className="font-medium text-foreground">{project.name}</span>{" "}
              projesi silinecek. Repo&apos;lar ve bağlı release&apos;ler kalır;
              yalnızca proje gruplaması kaldırılır.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setOpen(false)}
              disabled={remove.isPending}
            >
              Vazgeç
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={remove.isPending}
              className="gap-2"
            >
              {remove.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              Sil
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function ListSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <Card key={i}>
          <CardContent className="flex items-start justify-between gap-4">
            <div className="flex-1 space-y-3">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-3 w-1/2" />
              <div className="flex gap-1.5">
                <Skeleton className="h-5 w-28 rounded-4xl" />
                <Skeleton className="h-5 w-28 rounded-4xl" />
              </div>
            </div>
            <Skeleton className="h-7 w-24 rounded-md" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function EmptyState({ isAdmin }: { isAdmin: boolean }) {
  return (
    <Card className="border-dashed ring-border/60">
      <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
        <div className="grid h-14 w-14 place-items-center rounded-full border border-border bg-card text-primary">
          <FolderGit2 className="h-5 w-5" />
        </div>
        <div className="font-serif text-xl italic">Henüz proje yok</div>
        <p className="max-w-sm text-sm text-muted-foreground">
          {isAdmin
            ? "Bir proje birden fazla repo'yu tek release altında toplar. İlk projeni oluşturarak başla."
            : "Sana henüz bir projeye erişim verilmemiş. Yöneticinle iletişime geç."}
        </p>
        {isAdmin && (
          <ProjectFormDialog
            trigger={
              <Button size="sm" className="mt-2 gap-1.5">
                <Plus className="h-3.5 w-3.5" /> İlk projeni oluştur
              </Button>
            }
          />
        )}
      </CardContent>
    </Card>
  );
}
