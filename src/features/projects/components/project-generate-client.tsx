"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Copy, Download, GitBranch, Loader2, Save, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MarkdownEditor } from "@/components/markdown/markdown-editor";
import { MarkdownPreview } from "@/components/markdown/markdown-preview";
import { TagInput } from "@/features/releases/components/tag-input";
import { useTemplates } from "@/features/templates/hooks";
import {
  useGenerateProjectRelease,
  useSaveProjectRelease,
  type GeneratedProjectRelease,
  type ProjectDTO,
} from "@/features/projects/hooks";
import type { PRFilterMode } from "@/core/git/types";

/** Local "YYYY-MM-DD" for today — no timezone shift (avoids toISOString UTC). */
function isoToday(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Local "YYYY-MM-DD" for N days before today. */
function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** "12sn" or "1d 05sn" for an elapsed-seconds count. */
function fmtElapsed(total: number): string {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return m > 0 ? `${m}d ${String(s).padStart(2, "0")}sn` : `${s}sn`;
}

/**
 * Unsaved-draft persistence. The generated release lives only in React state
 * until the user clicks "Kaydet"; without this it's lost on navigation. We
 * mirror the in-progress draft to localStorage, scoped per project, and
 * restore it when the user returns. All access is window-guarded + try/catch
 * because localStorage can throw (private mode / disabled storage).
 */
interface ProjectDraft {
  result: GeneratedProjectRelease;
  title: string;
  markdown: string;
  tags: string[];
}

const draftKey = (projectId: string) => `releaser:draft:project:${projectId}`;

function readDraft(projectId: string): ProjectDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(draftKey(projectId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ProjectDraft;
    // Minimal shape check — a draft is only useful with a result.
    if (!parsed || typeof parsed !== "object" || !parsed.result) return null;
    return {
      result: parsed.result,
      title: typeof parsed.title === "string" ? parsed.title : "",
      markdown: typeof parsed.markdown === "string" ? parsed.markdown : "",
      tags: Array.isArray(parsed.tags) ? parsed.tags : [],
    };
  } catch {
    return null;
  }
}

function writeDraft(projectId: string, draft: ProjectDraft): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(draftKey(projectId), JSON.stringify(draft));
  } catch {
    // Storage unavailable/full — drafts are best-effort, so ignore.
  }
}

function clearDraft(projectId: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(draftKey(projectId));
  } catch {
    // Ignore — nothing actionable if removal fails.
  }
}

export function ProjectGenerateClient({ project }: { project: ProjectDTO }) {
  const router = useRouter();
  const qc = useQueryClient();
  const templates = useTemplates();
  const generate = useGenerateProjectRelease();
  const save = useSaveProjectRelease();

  const [templateId, setTemplateId] = useState<string | undefined>(undefined);
  // PR window — pick either "last N PRs" or a date range. The date-range
  // defaults let the user generate immediately: last 14 days through today.
  const [mode, setMode] = useState<"last-n" | "date-range">("date-range");
  const [n, setN] = useState(20);
  const [since, setSince] = useState(() => isoDaysAgo(14));
  const [until, setUntil] = useState(() => isoToday());

  // Release-level responsibility/meta — prefilled from the project's defaults
  // but set per release (each release can have different sign-off, risk, …).
  const [version, setVersion] = useState(() => `v${isoToday()}`);
  const [date, setDate] = useState(() => isoToday());
  const [risk, setRisk] = useState(project.defaultRisk ?? "");
  const [signOff, setSignOff] = useState(project.signOff ?? "");

  const [result, setResult] = useState<GeneratedProjectRelease | null>(null);
  const [title, setTitle] = useState("");
  const [markdown, setMarkdown] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [elapsed, setElapsed] = useState(0);
  // True once a stored draft has been restored — drives the inline banner.
  const [restoredDraft, setRestoredDraft] = useState(false);

  // Live elapsed-time counter while a generation is in flight — the multi-repo
  // PR scan + AI drafting can take a while, so show the user it's progressing.
  // (elapsed is reset in handleGenerate; the interval's setState is async, so
  // there's no set-state-during-effect.)
  useEffect(() => {
    if (!generate.isPending) return;
    const start = Date.now();
    const id = setInterval(
      () => setElapsed(Math.floor((Date.now() - start) / 1000)),
      1000,
    );
    return () => clearInterval(id);
  }, [generate.isPending]);

  // Restore an unsaved draft for this project, once, on the client. We can't
  // read localStorage in a useState initializer (it'd run on the server too and
  // diverge from the SSR HTML → hydration mismatch). Instead we mount with empty
  // state — matching the server — then restore via React's officially-supported
  // "adjust state while rendering" pattern: a one-time setState *during render*,
  // guarded by a state flag (not an effect → react-hooks/set-state-in-effect
  // doesn't fire; not a ref → react-hooks/refs doesn't fire). React discards the
  // in-progress render and immediately re-renders with the restored state before
  // the browser paints, so the empty workspace is never flashed.
  const [didRestore, setDidRestore] = useState(false);
  if (typeof window !== "undefined" && !didRestore) {
    setDidRestore(true);
    const draft = readDraft(project.id);
    if (draft) {
      setResult(draft.result);
      setTitle(draft.title);
      setMarkdown(draft.markdown);
      setTags(draft.tags);
      setRestoredDraft(true);
    }
  }

  // Mirror the in-progress draft to localStorage whenever it changes — but only
  // once a result exists (an empty workspace isn't worth persisting). The write
  // is a side-effect on an external store, not a setState, so it's lint-safe.
  useEffect(() => {
    if (!result) return;
    writeDraft(project.id, { result, title, markdown, tags });
  }, [project.id, result, title, markdown, tags]);

  // Drop the stored draft and reset the workspace (explicit "Taslağı temizle").
  const handleClearDraft = () => {
    clearDraft(project.id);
    setResult(null);
    setTitle("");
    setMarkdown("");
    setTags([]);
    setRestoredDraft(false);
  };

  // Default template floats first from the API, so use it unless the user
  // picks another. Derived, not stored — no setState-in-effect.
  const defaultTemplateId = templates.data?.[0]?.id;
  const effectiveTemplateId = templateId ?? defaultTemplateId;

  const buildFilter = (): PRFilterMode | null => {
    if (mode === "last-n") return { type: "last-n", n };
    if (!since || !until) return null;
    return { type: "date-range", since, until };
  };

  const handleGenerate = async () => {
    const filter = buildFilter();
    if (!filter) {
      toast.error("Lütfen tarih aralığını doldur");
      return;
    }
    setElapsed(0);
    try {
      const res = await generate.mutateAsync({
        projectId: project.id,
        templateId: effectiveTemplateId,
        filter,
        meta: {
          version: version.trim() || undefined,
          date: date.trim() || undefined,
          risk: risk.trim() || undefined,
          signOff: signOff.trim() || undefined,
        },
      });
      setResult(res);
      setTitle(res.title);
      setMarkdown(res.markdown);
      setTags([]);
      setRestoredDraft(false);
      toast.success(`${res.totalPRs} PR'dan release üretildi`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Üretim başarısız");
    }
  };

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
    a.download = `${project.name}-release.md`.replace(/\s+/g, "-");
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSave = async () => {
    if (!result) return;
    try {
      await save.mutateAsync({
        projectId: project.id,
        templateId: result.template.id,
        title,
        markdown,
        tags,
        windowLabel: result.windowLabel,
        modelUsed: result.modelUsed,
        primaryRepo: result.primaryRepo,
      });
      // Persisted to history — the unsaved-draft mirror is no longer needed.
      clearDraft(project.id);
      setRestoredDraft(false);
      toast.success("Geçmişe kaydedildi");
      await qc.invalidateQueries({ queryKey: ["releases"] });
      router.push("/dashboard/history");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Kayıt başarısız");
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Config: repos + template + window */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Release ayarları
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          {/* Repo summary */}
          <div className="flex flex-wrap gap-1.5">
            {project.repos.map((r) => (
              <Badge key={`${r.owner}/${r.name}`} variant="secondary" className="gap-1">
                <GitBranch className="h-3 w-3" />
                {r.owner}/{r.name}
                {r.role && <span className="text-muted-foreground">· {r.role}</span>}
              </Badge>
            ))}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {/* Template */}
            <div className="flex flex-col gap-1.5">
              <Label>Şablon</Label>
              <Select
                value={effectiveTemplateId}
                onValueChange={(v) => setTemplateId((v as string) ?? undefined)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Şablon seç">
                    {(value) => {
                      const t = templates.data?.find((x) => x.id === value);
                      return t
                        ? `${t.name}${t.isDefault ? " (varsayılan)" : ""}`
                        : "Şablon seç";
                    }}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {(templates.data ?? []).map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                      {t.isDefault ? " (varsayılan)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Window — last N PRs or a date range (your choice) */}
            <div className="flex flex-col gap-1.5">
              <Label>PR penceresi</Label>
              <Tabs
                value={mode}
                onValueChange={(v) => setMode(v as "last-n" | "date-range")}
              >
                <TabsList>
                  <TabsTrigger value="last-n">Son N PR</TabsTrigger>
                  <TabsTrigger value="date-range">Tarih aralığı</TabsTrigger>
                </TabsList>
                <TabsContent value="last-n" className="m-0 pt-2">
                  <Input
                    type="number"
                    min={1}
                    max={100}
                    value={n}
                    onChange={(e) => setN(Number(e.target.value))}
                    aria-label="PR sayısı"
                  />
                </TabsContent>
                <TabsContent value="date-range" className="m-0 flex gap-2 pt-2">
                  <DatePicker
                    value={since}
                    onChange={setSince}
                    placeholder="Başlangıç"
                  />
                  <DatePicker
                    value={until}
                    onChange={setUntil}
                    placeholder="Bitiş"
                  />
                </TabsContent>
              </Tabs>
            </div>
          </div>

          {/* Release-level responsibility & meta (prefilled from project) */}
          <div className="grid gap-4 border-t border-border/50 pt-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="rel-version">Version</Label>
              <Input
                id="rel-version"
                value={version}
                onChange={(e) => setVersion(e.target.value)}
                placeholder="örn. v2026-05-22"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="rel-date">Tarih</Label>
              <DatePicker id="rel-date" value={date} onChange={setDate} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="rel-risk">Risk</Label>
              <Input
                id="rel-risk"
                value={risk}
                onChange={(e) => setRisk(e.target.value)}
                placeholder="örn. MEDIUM"
              />
            </div>
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label htmlFor="rel-signoff">Sign-off (bu release için)</Label>
              <Textarea
                id="rel-signoff"
                value={signOff}
                onChange={(e) => setSignOff(e.target.value)}
                placeholder={"Code Owner: Efe\nQA: Kaan\nManagement: Berkay"}
                className="min-h-16 font-mono text-xs"
              />
              <span className="text-[11px] text-muted-foreground">
                Sorumluluk release&apos;e özeldir — proje varsayılanından doldu,
                bu release için düzenleyebilirsin.
              </span>
            </div>
          </div>

          <div>
            <Button
              onClick={handleGenerate}
              disabled={generate.isPending || !effectiveTemplateId}
              className="gap-2"
            >
              {generate.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Wand2 className="h-4 w-4" />
              )}
              {generate.isPending
                ? `Tüm repolar taranıyor… ${fmtElapsed(elapsed)}`
                : "Release üret"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Restored-draft notice — this workspace came from a saved-but-unsaved
          draft, not a fresh generation. Let the user discard it. */}
      {result && restoredDraft && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border/60 bg-muted/40 px-4 py-2.5 text-sm">
          <span className="text-muted-foreground">
            Kaydedilmemiş taslak geri yüklendi.
          </span>
          <Button variant="ghost" size="sm" onClick={handleClearDraft}>
            Taslağı temizle
          </Button>
        </div>
      )}

      {/* Result workspace */}
      {result && (
        <Card className="overflow-hidden">
          <CardHeader className="flex flex-col gap-3 border-b border-border/60 pb-4">
            <div>
              <CardTitle className="text-sm text-muted-foreground">
                {project.name} · {result.windowLabel} · {result.totalPRs} PR
              </CardTitle>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="mt-2 border-0 bg-transparent px-0 text-lg font-semibold shadow-none focus-visible:ring-0"
                placeholder="Release başlığı"
              />
              <TagInput value={tags} onChange={setTags} className="mt-3" />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleCopy} className="gap-2">
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
                size="sm"
                onClick={handleSave}
                disabled={save.isPending}
                className="gap-2"
              >
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
            </Tabs>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
