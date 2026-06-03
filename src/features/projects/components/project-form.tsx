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
import { useRepositories } from "@/features/repositories/hooks";
import { RepoCombobox } from "@/features/repositories/components/repo-combobox";
import { createProjectSchema } from "@/features/projects/project-schemas";
import { ProjectAccessSection } from "./project-access-section";
import type { GitProviderKind } from "@/core/git/types";

// Only GitHub + Bitbucket are offered here; GitLab exists in the type union
// but the project flow doesn't surface it yet.
const PROVIDER_OPTIONS: { value: GitProviderKind; label: string }[] = [
  { value: "github", label: "GitHub" },
  { value: "bitbucket", label: "Bitbucket" },
  { value: "local", label: "Local" },
];

interface RepoRow {
  provider: GitProviderKind;
  owner: string;
  name: string;
  role: string;
  /** Row falls back to manual owner/name entry instead of the repo picker. */
  manual?: boolean;
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

/**
 * A single repo row: provider + repo picker (or manual owner/name fallback) +
 * role + remove. Each row fetches the repo set for its own provider (React
 * Query dedupes shared providers), so the user picks from the repos their
 * GitHub/Bitbucket connection grants instead of typing by hand. When nothing
 * is accessible (no connection yet), it points to settings and offers manual
 * entry as a fallback.
 */
function RepoRowItem({
  row,
  canRemove,
  onChange,
  onRemove,
}: {
  row: RepoRow;
  canRemove: boolean;
  onChange: (patch: Partial<RepoRow>) => void;
  onRemove: () => void;
}) {
  const repos = useRepositories(row.provider, "");
  const list = repos.data ?? [];
  const value = row.owner && row.name ? `${row.owner}/${row.name}` : null;
  const showConnectHint =
    !row.manual && !repos.isLoading && !repos.error && list.length === 0;

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border/70 bg-card/40 p-2">
      <div className="grid grid-cols-[1fr_auto] items-center gap-2 sm:grid-cols-[7rem_minmax(0,1.6fr)_minmax(0,1fr)_auto]">
        <Select
          value={row.provider}
          onValueChange={(v) =>
            onChange({ provider: v as GitProviderKind, owner: "", name: "" })
          }
        >
          <SelectTrigger className="w-full min-w-0" size="sm">
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

        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={onRemove}
          disabled={!canRemove}
          aria-label="Repo'yu kaldır"
          className="text-muted-foreground hover:text-destructive sm:order-last"
        >
          <X className="h-4 w-4" />
        </Button>

        {row.manual ? (
          <div className="col-span-2 grid min-w-0 grid-cols-2 gap-2 sm:col-span-1">
            <Input
              value={row.owner}
              onChange={(e) => onChange({ owner: e.target.value })}
              placeholder="owner"
              aria-label="Repo sahibi"
              className="min-w-0"
            />
            <Input
              value={row.name}
              onChange={(e) => onChange({ name: e.target.value })}
              placeholder="repo"
              aria-label="Repo adı"
              className="min-w-0"
            />
          </div>
        ) : (
          <div className="col-span-2 min-w-0 sm:col-span-1">
            <RepoCombobox
              value={value}
              onChange={(fullName) => {
                const slash = fullName.indexOf("/");
                if (slash === -1) return;
                onChange({
                  owner: fullName.slice(0, slash),
                  name: fullName.slice(slash + 1),
                });
              }}
              repos={list}
              isLoading={repos.isLoading}
              error={repos.error ? (repos.error as Error).message : null}
            />
          </div>
        )}

        <Input
          value={row.role}
          onChange={(e) => onChange({ role: e.target.value })}
          placeholder="backend / frontend"
          aria-label="Rol"
          className="col-span-2 min-w-0 sm:col-span-1"
        />
      </div>

      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground sm:pl-[7.5rem]">
        {showConnectHint && (
          <span>
            Erişilebilir repo yok —{" "}
            <a
              href="/dashboard/settings"
              className="underline underline-offset-2 hover:text-foreground"
            >
              hesabını bağla
            </a>{" "}
            ya da
          </span>
        )}
        <button
          type="button"
          onClick={() => onChange({ manual: !row.manual })}
          className="underline underline-offset-2 hover:text-foreground"
        >
          {row.manual ? "listeden seç" : "elle gir"}
        </button>
      </div>
    </div>
  );
}

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
  const [defaultRisk, setDefaultRisk] = useState(project?.defaultRisk ?? "");
  const [monitoringLinks, setMonitoringLinks] = useState(
    project?.monitoringLinks ?? "",
  );
  const [signOff, setSignOff] = useState(project?.signOff ?? "");
  const [rows, setRows] = useState<RepoRow[]>(() => rowsFromProject(project));

  // When the dialog reopens, snap the fields back to the source project so an
  // abandoned edit never leaks into the next session.
  const handleOpenChange = (next: boolean) => {
    if (next) {
      setName(project?.name ?? "");
      setDescription(project?.description ?? "");
      setDefaultRisk(project?.defaultRisk ?? "");
      setMonitoringLinks(project?.monitoringLinks ?? "");
      setSignOff(project?.signOff ?? "");
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

    // Validate with the same schema the API enforces, so limit/format errors
    // surface inline instead of bouncing off the server as a generic 422.
    const parsed = createProjectSchema.safeParse({
      name: name.trim(),
      description: description.trim() || undefined,
      defaultRisk: defaultRisk.trim() || undefined,
      monitoringLinks: monitoringLinks.trim() || undefined,
      signOff: signOff.trim() || undefined,
      repos: filledRepos.map((r) => ({
        provider: r.provider,
        owner: r.owner.trim(),
        name: r.name.trim(),
        role: r.role.trim() || undefined,
      })),
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Geçersiz form");
      return;
    }
    const payload = parsed.data;

    try {
      if (isEdit && project) {
        await update.mutateAsync({ id: project.id, ...payload });
        toast.success("Proje güncellendi");
      } else {
        await create.mutateAsync(payload);
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
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Projeyi düzenle" : "Yeni proje"}
          </DialogTitle>
          <DialogDescription>
            Bir proje birden fazla repo&apos;yu (örneğin backend + frontend) tek
            bir release altında toplar.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={handleSubmit}
          className="grid gap-5"
        >
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

          {isEdit && (
          <details className="rounded-lg border border-border/70 bg-card/40 px-3 py-2">
            <summary className="cursor-pointer text-sm font-medium text-muted-foreground">
              Release dokümanı varsayılanları (opsiyonel)
            </summary>
            <div className="mt-3 grid gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="project-risk">Varsayılan risk</Label>
                <Input
                  id="project-risk"
                  value={defaultRisk}
                  onChange={(e) => setDefaultRisk(e.target.value)}
                  placeholder="örn. MEDIUM"
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="project-monitoring">İzleme linkleri</Label>
                <Textarea
                  id="project-monitoring"
                  value={monitoringLinks}
                  onChange={(e) => setMonitoringLinks(e.target.value)}
                  placeholder={"Sentry: https://…\nGrafana: https://…"}
                  className="min-h-16 font-mono text-xs"
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="project-signoff">
                  Varsayılan sign-off (rol: kişi)
                </Label>
                <Textarea
                  id="project-signoff"
                  value={signOff}
                  onChange={(e) => setSignOff(e.target.value)}
                  placeholder={"Code Owner: Efe\nQA: Kaan\nManagement: Berkay"}
                  className="min-h-16 font-mono text-xs"
                />
              </div>
              <p className="text-[11px] text-muted-foreground">
                Bunlar <span className="font-medium">varsayılan</span> — release
                üretirken ön-dolar. Sorumluluk (sign-off/risk) her release&apos;de
                ayrıca düzenlenir; monitoring proje sabitidir.
              </p>
            </div>
          </details>
          )}

          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <Label>Repo&apos;lar</Label>
              <span className="font-mono text-[11px] text-muted-foreground">
                en az bir repo
              </span>
            </div>

            <div className="flex flex-col gap-2">
              {rows.map((row, i) => (
                <RepoRowItem
                  key={i}
                  row={row}
                  canRemove={rows.length > 1}
                  onChange={(patch) => updateRow(i, patch)}
                  onRemove={() => removeRow(i)}
                />
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

          {isEdit && project && (
            <ProjectAccessSection projectId={project.id} />
          )}

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
