"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useCreateProject,
  useUpdateProject,
  type ProjectDTO,
} from "@/features/projects/hooks";
import type { GitProviderKind } from "@/core/git/types";

// Only GitHub + Bitbucket are offered here; GitLab exists in the type union
// but the project flow doesn't surface it yet.
const PROVIDER_OPTIONS: { value: GitProviderKind; label: string }[] = [
  { value: "github", label: "GitHub" },
  { value: "bitbucket", label: "Bitbucket" },
];

interface RepoRow {
  provider: GitProviderKind;
  owner: string;
  name: string;
  role: string;
}

const emptyRow = (): RepoRow => ({
  provider: "github",
  owner: "",
  name: "",
  role: "",
});

const rowsFromProject = (project?: ProjectDTO): RepoRow[] => {
  if (!project || project.repos.length === 0) return [emptyRow()];
  return project.repos.map((r) => ({
    provider: r.provider,
    owner: r.owner,
    name: r.name,
    role: r.role ?? "",
  }));
};

export function ProjectFormDialog({
  project,
  trigger,
}: {
  project?: ProjectDTO;
  trigger: React.ReactNode;
}) {
  const isEdit = Boolean(project);
  const qc = useQueryClient();
  const create = useCreateProject();
  const update = useUpdateProject();
  const pending = create.isPending || update.isPending;

  const [open, setOpen] = useState(false);
  const [name, setName] = useState(project?.name ?? "");
  const [description, setDescription] = useState(project?.description ?? "");
  const [rows, setRows] = useState<RepoRow[]>(() => rowsFromProject(project));

  // When the dialog reopens, snap the fields back to the source project so an
  // abandoned edit never leaks into the next session.
  const handleOpenChange = (next: boolean) => {
    if (next) {
      setName(project?.name ?? "");
      setDescription(project?.description ?? "");
      setRows(rowsFromProject(project));
    }
    setOpen(next);
  };

  const updateRow = (index: number, patch: Partial<RepoRow>) =>
    setRows((prev) =>
      prev.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    );

  const addRow = () => setRows((prev) => [...prev, emptyRow()]);

  const removeRow = (index: number) =>
    setRows((prev) =>
      prev.length === 1 ? prev : prev.filter((_, i) => i !== index),
    );

  const filledRepos = rows.filter(
    (r) => r.owner.trim() && r.name.trim(),
  );
  const canSubmit = name.trim().length > 0 && filledRepos.length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || pending) return;

    const repos = filledRepos.map((r) => ({
      provider: r.provider,
      owner: r.owner.trim(),
      name: r.name.trim(),
      role: r.role.trim() || undefined,
    }));

    try {
      if (isEdit && project) {
        await update.mutateAsync({
          id: project.id,
          name: name.trim(),
          description: description.trim() || undefined,
          repos,
        });
        toast.success("Proje güncellendi");
      } else {
        await create.mutateAsync({
          name: name.trim(),
          description: description.trim() || undefined,
          repos,
        });
        toast.success("Proje oluşturuldu");
      }
      await qc.invalidateQueries({ queryKey: ["projects"] });
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Bir hata oluştu");
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={trigger as React.ReactElement} />
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Projeyi düzenle" : "Yeni proje"}
          </DialogTitle>
          <DialogDescription>
            Bir proje birden fazla repo&apos;yu (örneğin backend + frontend) tek
            bir release altında toplar.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="grid gap-5">
          <div className="grid gap-2">
            <Label htmlFor="project-name">Proje adı</Label>
            <Input
              id="project-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="finsel"
              autoFocus
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="project-description">Açıklama (opsiyonel)</Label>
            <Textarea
              id="project-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Bu proje neyi kapsıyor?"
              className="min-h-16"
            />
          </div>

          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <Label>Repo&apos;lar</Label>
              <span className="font-mono text-[11px] text-muted-foreground">
                en az bir repo
              </span>
            </div>

            <div className="flex flex-col gap-2">
              {rows.map((row, i) => (
                <div
                  key={i}
                  className="grid grid-cols-[7rem_1fr_1fr_1fr_auto] items-center gap-2 rounded-lg border border-border/70 bg-card/40 p-2"
                >
                  <Select
                    value={row.provider}
                    onValueChange={(v) =>
                      updateRow(i, { provider: v as GitProviderKind })
                    }
                  >
                    <SelectTrigger className="w-full" size="sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PROVIDER_OPTIONS.map((p) => (
                        <SelectItem key={p.value} value={p.value}>
                          {p.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    value={row.owner}
                    onChange={(e) => updateRow(i, { owner: e.target.value })}
                    placeholder="owner"
                    aria-label="Repo sahibi"
                  />
                  <Input
                    value={row.name}
                    onChange={(e) => updateRow(i, { name: e.target.value })}
                    placeholder="repo"
                    aria-label="Repo adı"
                  />
                  <Input
                    value={row.role}
                    onChange={(e) => updateRow(i, { role: e.target.value })}
                    placeholder="backend / frontend"
                    aria-label="Rol"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => removeRow(i)}
                    disabled={rows.length === 1}
                    aria-label="Repo&apos;yu kaldır"
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addRow}
              className="w-fit gap-1.5"
            >
              <Plus className="h-3.5 w-3.5" /> Repo ekle
            </Button>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
              disabled={pending}
            >
              Vazgeç
            </Button>
            <Button type="submit" disabled={!canSubmit || pending} className="gap-2">
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              {isEdit ? "Kaydet" : "Oluştur"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
