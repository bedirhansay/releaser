"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  FileText,
  LayoutTemplate,
  Loader2,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
  useTemplates,
  useDeleteTemplate,
  type TemplateDTO,
} from "@/features/templates/hooks";
import { TemplateEditorDialog } from "@/features/templates/components/template-editor";

export function TemplatesList({ isAdmin }: { isAdmin: boolean }) {
  const query = useTemplates();
  const templates = query.data ?? [];

  if (query.isLoading) {
    return <ListSkeleton />;
  }

  if (query.error) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-sm text-destructive">
          {(query.error as Error).message}
        </CardContent>
      </Card>
    );
  }

  if (templates.length === 0) {
    return <EmptyState isAdmin={isAdmin} />;
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Top bar */}
      <div className="flex items-center justify-between">
        <span className="font-mono text-[11px] text-muted-foreground">
          <span className="font-medium text-primary">{templates.length}</span>{" "}
          şablon
        </span>
        {isAdmin && (
          <TemplateEditorDialog
            trigger={
              <Button size="sm" className="gap-2">
                <Plus /> Yeni şablon
              </Button>
            }
          />
        )}
      </div>

      <div className="flex flex-col gap-3">
        {templates.map((template) => (
          <TemplateCard key={template.id} template={template} isAdmin={isAdmin} />
        ))}
      </div>
    </div>
  );
}

function TemplateCard({
  template,
  isAdmin,
}: {
  template: TemplateDTO;
  isAdmin: boolean;
}) {
  const qc = useQueryClient();
  const remove = useDeleteTemplate();
  const [deleteOpen, setDeleteOpen] = useState(false);

  const handleDelete = async () => {
    try {
      await remove.mutateAsync(template.id);
      toast.success("Şablon silindi");
      await qc.invalidateQueries({ queryKey: ["templates"] });
      setDeleteOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Silinemedi");
    }
  };

  const previewHeadings = template.sections
    .filter((s) => s.heading.trim())
    .slice(0, 3);
  const remaining = template.sections.length - previewHeadings.length;

  return (
    <Card className="ring-border/70 shadow-sm">
      <CardContent className="flex items-start gap-4">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-border bg-card text-primary">
          <LayoutTemplate className="h-4 w-4" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{template.name}</span>
            {template.isDefault && (
              <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">
                Varsayılan
              </Badge>
            )}
          </div>

          {template.description && (
            <p className="mt-1 text-sm text-muted-foreground">
              {template.description}
            </p>
          )}

          <p className="mt-1 font-mono text-[11px] text-muted-foreground">
            {template.sections.length} bölüm
          </p>

          {previewHeadings.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {previewHeadings.map((s) => (
                <Badge
                  key={s.id}
                  variant="outline"
                  className="h-5 max-w-[16rem] truncate px-1.5 text-[10px] font-normal"
                >
                  {s.heading}
                </Badge>
              ))}
              {remaining > 0 && (
                <Badge
                  variant="ghost"
                  className="h-5 px-1.5 text-[10px] text-muted-foreground"
                >
                  +{remaining}
                </Badge>
              )}
            </div>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {isAdmin && (
            <>
              <TemplateEditorDialog
                template={template}
                trigger={
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Şablonu düzenle"
                  >
                    <Pencil />
                  </Button>
                }
              />
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setDeleteOpen(true)}
                aria-label="Şablonu sil"
                className="text-muted-foreground hover:text-destructive"
              >
                <Trash2 />
              </Button>
            </>
          )}
        </div>
      </CardContent>

      {/* Delete confirmation */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              &ldquo;{template.name}&rdquo; şablonunu silmek istediğine emin
              misin?
            </DialogTitle>
            <DialogDescription>
              Bu işlem geri alınamaz. Şablon ve tüm bölümleri kalıcı olarak
              silinecek.
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
                <Loader2 className="animate-spin" />
              ) : (
                <Trash2 />
              )}
              Sil
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function ListSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-7 w-28 rounded-lg" />
      </div>
      <div className="flex flex-col gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i} className="ring-border/70 shadow-sm">
            <CardContent className="flex items-start gap-4">
              <Skeleton className="h-9 w-9 shrink-0 rounded-lg" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-3 w-2/3" />
                <Skeleton className="h-3 w-16" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function EmptyState({ isAdmin }: { isAdmin: boolean }) {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
        <div className="grid h-14 w-14 place-items-center rounded-full border border-border bg-card text-primary">
          <FileText className="h-5 w-5" />
        </div>
        <div className="font-serif text-xl italic">Henüz şablon yok</div>
        <p className="max-w-sm text-sm text-muted-foreground">
          {isAdmin
            ? "İlk şablonunu oluştur; AI her release'i bu yapıda üretsin. Bölümleri ve başlıkları dilediğin gibi düzenleyebilirsin."
            : "Henüz bir şablon tanımlanmamış. Yöneticin bir şablon oluşturunca burada görünür."}
        </p>
        {isAdmin && (
          <TemplateEditorDialog
            trigger={
              <Button size="sm" className={cn("mt-2 gap-2")}>
                <Plus /> İlk şablonunu oluştur
              </Button>
            }
          />
        )}
      </CardContent>
    </Card>
  );
}
