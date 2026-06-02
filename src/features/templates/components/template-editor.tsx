"use client";

import * as React from "react";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronUp, Loader2, Plus, Trash2 } from "lucide-react";
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
import { cn } from "@/lib/utils";
import {
  useCreateTemplate,
  useUpdateTemplate,
  type TemplateDTO,
} from "@/features/templates/hooks";
import {
  DEFAULT_TEMPLATE_SECTIONS,
  type TemplateSection,
} from "@/types/template";
import { createTemplateSchema } from "@/types/template-schemas";

/** Deep-copy the starter sections, giving each a fresh id for a new template. */
function freshDefaultSections(): TemplateSection[] {
  return DEFAULT_TEMPLATE_SECTIONS.map((s) => ({
    id: crypto.randomUUID(),
    heading: s.heading,
    instruction: s.instruction,
  }));
}

export function TemplateEditorDialog({
  template,
  trigger,
}: {
  template?: TemplateDTO;
  trigger: React.ReactNode;
}) {
  const isEdit = Boolean(template);
  const qc = useQueryClient();
  const create = useCreateTemplate();
  const update = useUpdateTemplate();

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [sections, setSections] = useState<TemplateSection[]>([]);

  const isPending = create.isPending || update.isPending;

  // Reset form whenever the dialog opens so it always reflects the latest
  // template (or a fresh default for create mode).
  const handleOpenChange = (next: boolean) => {
    if (next) {
      if (template) {
        setName(template.name);
        setDescription(template.description ?? "");
        setSections(
          template.sections.map((s) => ({ ...s })),
        );
      } else {
        setName("");
        setDescription("");
        setSections(freshDefaultSections());
      }
    }
    setOpen(next);
  };

  const updateSection = (
    id: string,
    patch: Partial<Pick<TemplateSection, "heading" | "instruction">>,
  ) =>
    setSections((prev) =>
      prev.map((s) => (s.id === id ? { ...s, ...patch } : s)),
    );

  const moveSection = (index: number, dir: -1 | 1) =>
    setSections((prev) => {
      const target = index + dir;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });

  const removeSection = (id: string) =>
    setSections((prev) => prev.filter((s) => s.id !== id));

  const addSection = () =>
    setSections((prev) => [
      ...prev,
      { id: crypto.randomUUID(), heading: "", instruction: "" },
    ]);

  // A valid template has a name and at least one fully filled section.
  const filledSections = sections.filter(
    (s) => s.heading.trim() && s.instruction.trim(),
  );
  const canSubmit = name.trim().length > 0 && filledSections.length > 0;

  const handleSubmit = async () => {
    if (!canSubmit || isPending) return;

    // Validate with the schema the API enforces so limit errors surface inline
    // rather than as a generic 422.
    const parsed = createTemplateSchema.safeParse({
      name: name.trim(),
      description: description.trim() || undefined,
      sections: filledSections.map((s) => ({
        id: s.id,
        heading: s.heading.trim(),
        instruction: s.instruction.trim(),
      })),
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Geçersiz form");
      return;
    }
    const payload = parsed.data;

    try {
      if (template) {
        await update.mutateAsync({ id: template.id, ...payload });
        toast.success("Şablon güncellendi");
      } else {
        await create.mutateAsync(payload);
        toast.success("Şablon oluşturuldu");
      }
      await qc.invalidateQueries({ queryKey: ["templates"] });
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "İşlem başarısız");
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={trigger as React.ReactElement} />
      <DialogContent className="flex max-h-[88vh] max-w-2xl flex-col">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Şablonu düzenle" : "Yeni şablon"}
          </DialogTitle>
          <DialogDescription>
            Bölümleri sıralı bir liste olarak tanımla. Her bölüm için bir
            başlık ve AI&apos;ın o bölüme ne yazacağını anlatan bir talimat
            ver.
          </DialogDescription>
        </DialogHeader>

        {/* Scrollable body — templates can have many sections. */}
        <div className="-mx-4 flex-1 space-y-5 overflow-y-auto px-4">
          {/* Name + description */}
          <div className="space-y-2">
            <Label htmlFor="template-name">
              Şablon adı <span className="text-destructive">*</span>
            </Label>
            <Input
              id="template-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="örn. Finsel Production Release"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="template-description">Açıklama</Label>
            <Textarea
              id="template-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Bu şablon ne zaman kullanılsın? (opsiyonel)"
              className="min-h-12"
            />
          </div>

          {/* Sections editor */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Bölümler</Label>
              <span className="font-mono text-[11px] text-muted-foreground">
                {sections.length} bölüm
              </span>
            </div>

            {sections.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
                Henüz bölüm yok. Aşağıdan ilk bölümü ekle.
              </div>
            ) : (
              <div className="space-y-3">
                {sections.map((section, i) => (
                  <div
                    key={section.id}
                    className="space-y-2 rounded-lg border border-border bg-card p-3"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[11px] text-muted-foreground">
                        {i + 1}
                      </span>
                      <Input
                        value={section.heading}
                        onChange={(e) =>
                          updateSection(section.id, { heading: e.target.value })
                        }
                        placeholder="Bölüm başlığı, örn. 🟡 Risk Definition"
                        className="flex-1"
                        aria-label="Bölüm başlığı"
                      />
                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => moveSection(i, -1)}
                          disabled={i === 0}
                          aria-label="Yukarı taşı"
                        >
                          <ChevronUp />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => moveSection(i, 1)}
                          disabled={i === sections.length - 1}
                          aria-label="Aşağı taşı"
                        >
                          <ChevronDown />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => removeSection(section.id)}
                          aria-label="Bölümü sil"
                          className="text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 />
                        </Button>
                      </div>
                    </div>
                    <Textarea
                      value={section.instruction}
                      onChange={(e) =>
                        updateSection(section.id, {
                          instruction: e.target.value,
                        })
                      }
                      placeholder="AI bu bölüme ne yazsın?"
                      aria-label="Bölüm talimatı"
                    />
                  </div>
                ))}
              </div>
            )}

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addSection}
              className="gap-2"
            >
              <Plus /> Bölüm ekle
            </Button>
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={() => setOpen(false)}
            disabled={isPending}
          >
            Vazgeç
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit || isPending}
            className={cn("gap-2")}
          >
            {isPending && <Loader2 className="animate-spin" />}
            {isEdit ? "Kaydet" : "Oluştur"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
