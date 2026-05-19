"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import {
  Check,
  Copy,
  Download,
  Loader2,
  Pencil,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MarkdownEditor } from "@/components/markdown/markdown-editor";
import { MarkdownPreview } from "@/components/markdown/markdown-preview";
import { RiskList } from "@/features/releases/components/risk-list";
import {
  useDeleteRelease,
  useUpdateRelease,
} from "@/features/releases/hooks";
import type { RiskFinding } from "@/types/release";

export interface ReleaseDetail {
  id: string;
  title: string | null;
  markdown: string;
  repoOwner: string;
  repoName: string;
  baseRef: string;
  headRef: string;
  modelUsed: string | null;
  risks: RiskFinding[];
}

export function ReleaseDetailClient({ release }: { release: ReleaseDetail }) {
  const router = useRouter();
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(release.title ?? "");
  const [markdown, setMarkdown] = useState(release.markdown);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const update = useUpdateRelease();
  const remove = useDeleteRelease();

  const isDirty = title !== (release.title ?? "") || markdown !== release.markdown;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(markdown);
      toast.success("Markdown panoya kopyalandı");
    } catch {
      toast.error("Kopyalanamadı");
    }
  };

  const handleDownload = () => {
    const blob = new Blob([markdown], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${release.repoName}-${release.baseRef}-${release.headRef}.md`.replace(
      /\s+/g,
      "-",
    );
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSave = async () => {
    try {
      await update.mutateAsync({ id: release.id, title, markdown });
      toast.success("Değişiklikler kaydedildi");
      setEditing(false);
      // Server component re-renders pick up the new values; client-side
      // history query needs its own cache invalidation.
      await qc.invalidateQueries({ queryKey: ["releases"] });
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Kayıt başarısız");
    }
  };

  const handleCancel = () => {
    setTitle(release.title ?? "");
    setMarkdown(release.markdown);
    setEditing(false);
  };

  const handleDelete = async () => {
    try {
      await remove.mutateAsync(release.id);
      toast.success("Release silindi");
      await qc.invalidateQueries({ queryKey: ["releases"] });
      router.push("/dashboard/history");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Silinemedi");
    }
  };

  return (
    <>
      {/* Header — title + meta + actions */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          {editing ? (
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="text-2xl font-medium tracking-[-0.02em]"
              placeholder="Release başlığı"
            />
          ) : (
            <h1 className="text-2xl font-medium tracking-[-0.02em]">
              {release.title ?? `${release.baseRef} → ${release.headRef}`}
            </h1>
          )}
          <p className="mt-1 font-mono text-xs text-muted-foreground">
            {release.repoOwner}/{release.repoName} ·{" "}
            <span className="text-primary/80">{release.baseRef}</span>
            {" → "}
            <span className="text-primary/80">{release.headRef}</span>
            {release.modelUsed && (
              <span className="ml-2">· {release.modelUsed}</span>
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {editing ? (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCancel}
                disabled={update.isPending}
                className="gap-2"
              >
                <X className="h-4 w-4" />
                İptal
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                disabled={!isDirty || update.isPending}
                className="gap-2"
              >
                {update.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Check className="h-4 w-4" />
                )}
                Kaydet
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopy}
                className="gap-2"
              >
                <Copy className="h-4 w-4" /> Kopyala
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownload}
                className="gap-2"
              >
                <Download className="h-4 w-4" /> .md indir
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditing(true)}
                className="gap-2"
              >
                <Pencil className="h-4 w-4" /> Düzenle
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setDeleteOpen(true)}
                className="gap-2"
              >
                <Trash2 className="h-4 w-4" /> Sil
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Markdown panel — editor when editing, preview otherwise */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {editing ? "Markdown — düzenleniyor" : "Release notları"}
          </CardTitle>
        </CardHeader>
        <CardContent className={editing ? "p-0" : ""}>
          {editing ? (
            <div className="h-[60vh] border-t border-border/60">
              <MarkdownEditor value={markdown} onChange={setMarkdown} />
            </div>
          ) : (
            <MarkdownPreview markdown={markdown} />
          )}
        </CardContent>
      </Card>

      {/* Risks always shown */}
      <Card>
        <CardHeader>
          <CardTitle>Riskler</CardTitle>
        </CardHeader>
        <CardContent>
          <RiskList risks={release.risks} />
        </CardContent>
      </Card>

      {/* Delete confirmation */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bu release&apos;i silmek istediğinden emin misin?</DialogTitle>
            <DialogDescription>
              Bu işlem geri alınamaz. Markdown, AI çıktısı ve risk geçmişi
              kalıcı olarak silinecek.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setDeleteOpen(false)}
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
