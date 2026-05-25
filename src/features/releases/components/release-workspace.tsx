"use client";

import { useState } from "react";
import { Copy, Download, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { MarkdownEditor } from "@/components/markdown/markdown-editor";
import { MarkdownPreview } from "@/components/markdown/markdown-preview";
import { RiskList } from "./risk-list";
import { TagInput } from "./tag-input";
import type { GeneratedRelease } from "@/types/release";
import { useSaveRelease, type GenerateInput } from "@/features/releases/hooks";

export function ReleaseWorkspace({
  context,
  initial,
}: {
  context: GenerateInput;
  initial: GeneratedRelease;
}) {
  const [title, setTitle] = useState(initial.title);
  const [markdown, setMarkdown] = useState(initial.markdown);
  const [tags, setTags] = useState<string[]>([]);
  const save = useSaveRelease();

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
    a.download = `${context.repo}-${context.base}-${context.head}.md`.replace(
      /\s+/g,
      "-",
    );
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSave = async () => {
    try {
      await save.mutateAsync({
        ...context,
        title,
        markdown,
        tags,
        release: { ...initial, markdown, title },
      });
      toast.success("Geçmişe kaydedildi");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Kayıt başarısız");
    }
  };

  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex flex-col gap-3 border-b border-border/60 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex-1">
          <CardTitle className="text-sm text-muted-foreground">
            {context.repo} · {context.base} → {context.head}
          </CardTitle>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="mt-2 border-0 bg-transparent px-0 text-lg font-semibold shadow-none focus-visible:ring-0"
          />
          <TagInput value={tags} onChange={setTags} className="mt-3" />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleCopy} className="gap-2">
            <Copy className="h-4 w-4" /> Kopyala
          </Button>
          <Button variant="outline" size="sm" onClick={handleDownload} className="gap-2">
            <Download className="h-4 w-4" /> .md indir
          </Button>
          <Button size="sm" onClick={handleSave} disabled={save.isPending} className="gap-2">
            {save.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Kaydet
          </Button>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <Tabs defaultValue="split" className="w-full">
          <div className="border-b border-border/60 px-4 py-2">
            <TabsList>
              <TabsTrigger value="split">Bölünmüş</TabsTrigger>
              <TabsTrigger value="edit">Düzenle</TabsTrigger>
              <TabsTrigger value="preview">Önizleme</TabsTrigger>
              <TabsTrigger value="risks">
                Riskler ({initial.risks.length})
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="split" className="m-0">
            <div className="grid h-[60vh] grid-cols-1 md:grid-cols-2">
              <div className="border-r border-border/60">
                <MarkdownEditor value={markdown} onChange={setMarkdown} />
              </div>
              <div className="overflow-y-auto p-6">
                <MarkdownPreview markdown={markdown} />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="edit" className="m-0">
            <div className="h-[60vh]">
              <MarkdownEditor value={markdown} onChange={setMarkdown} />
            </div>
          </TabsContent>

          <TabsContent value="preview" className="m-0">
            <div className="max-h-[60vh] overflow-y-auto p-6">
              <MarkdownPreview markdown={markdown} />
            </div>
          </TabsContent>

          <TabsContent value="risks" className="m-0">
            <div className="max-h-[60vh] overflow-y-auto p-6">
              <RiskList risks={initial.risks} />
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
