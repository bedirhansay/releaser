"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { GitMerge, GitPullRequest } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  GenerateForm,
  type GenerateFormValue,
} from "@/features/releases/components/generate-form";
import {
  PRGenerateForm,
  type PRGenerateValue,
} from "@/features/releases/components/pr-generate-form";
import { ReleaseWorkspace } from "@/features/releases/components/release-workspace";
import {
  StepIndicator,
  type Step,
} from "@/features/releases/components/step-indicator";
import {
  useGenerateRelease,
  useGenerateFromPRs,
  type GenerateInput,
} from "@/features/releases/hooks";
import type { GeneratedRelease } from "@/types/release";
import type { GitProviderKind } from "@/core/git/types";

type Mode = "prs" | "compare";

export default function GeneratePage() {
  const [mode, setMode] = useState<Mode>("prs");
  const [context, setContext] = useState<GenerateInput | null>(null);
  const [release, setRelease] = useState<GeneratedRelease | null>(null);
  const [compareDraft, setCompareDraft] = useState<Partial<GenerateFormValue>>(
    {},
  );
  const [prDraft, setPrDraft] = useState<{
    provider?: GitProviderKind;
    owner?: string;
    repo?: string;
  }>({});

  const generateCompare = useGenerateRelease();
  const generateFromPRs = useGenerateFromPRs();

  // Step indicator adapts to the mode. The 4th step is always "Üret".
  const steps: Step[] = useMemo(() => {
    if (mode === "compare") {
      const hasProvider = !!compareDraft.provider;
      const hasRepo = !!compareDraft.owner && !!compareDraft.repo;
      const hasRefs =
        !!compareDraft.base &&
        !!compareDraft.head &&
        compareDraft.base !== compareDraft.head;
      const generated = !!release;
      const pick = (cond: boolean, prevDone: boolean): Step["state"] =>
        cond ? "done" : prevDone ? "active" : "todo";
      return [
        { label: "Sağlayıcı", state: pick(hasProvider, true) },
        { label: "Repo", state: pick(hasRepo, hasProvider) },
        { label: "Ref'ler", state: pick(hasRefs, hasRepo) },
        {
          label: "Üret",
          state: generateCompare.isPending
            ? "active"
            : generated
              ? "done"
              : hasRefs
                ? "active"
                : "todo",
        },
      ];
    }
    const hasProvider = !!prDraft.provider;
    const hasRepo = !!prDraft.owner && !!prDraft.repo;
    const generated = !!release;
    const pick = (cond: boolean, prevDone: boolean): Step["state"] =>
      cond ? "done" : prevDone ? "active" : "todo";
    return [
      { label: "Sağlayıcı", state: pick(hasProvider, true) },
      { label: "Repo", state: pick(hasRepo, hasProvider) },
      { label: "Filtre", state: hasRepo ? "active" : "todo" },
      {
        label: "Üret",
        state: generateFromPRs.isPending
          ? "active"
          : generated
            ? "done"
            : hasRepo
              ? "active"
              : "todo",
      },
    ];
  }, [
    mode,
    compareDraft,
    prDraft,
    release,
    generateCompare.isPending,
    generateFromPRs.isPending,
  ]);

  const handleCompareSubmit = async (value: GenerateFormValue) => {
    setContext(value);
    setRelease(null);
    try {
      const result = await generateCompare.mutateAsync(value);
      setRelease(result);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Üretim başarısız");
    }
  };

  const handlePRSubmit = async (value: PRGenerateValue) => {
    // Translate the PR-mode payload into the workspace's "context" shape so
    // save-to-history (which expects base/head) still works — we use the
    // filter description as the head label.
    const head =
      value.filter.type === "between-tags"
        ? value.filter.headTag
        : value.filter.type === "last-n"
          ? `last ${value.filter.n} PRs`
          : `${value.filter.since}..${value.filter.until}`;
    const base =
      value.filter.type === "between-tags" ? value.filter.baseTag : "—";

    setContext({
      provider: value.provider,
      owner: value.owner,
      repo: value.repo,
      base,
      head,
    });
    setRelease(null);
    try {
      const result = await generateFromPRs.mutateAsync(value);
      setRelease(result);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Üretim başarısız");
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
      <div>
        <span className="eyebrow text-muted-foreground">Yeni release</span>
        <h1 className="mt-2 text-balance text-3xl font-medium tracking-[-0.02em]">
          <span className="font-serif italic text-primary">Release notları</span>{" "}
          üret
        </h1>
        <p className="mt-2 max-w-xl text-sm text-muted-foreground">
          PR&apos;lardan ya da iki ref karşılaştırmasından üret. PR modu daha
          temiz çıktı verir; compare modu zaten merge edilmiş bir branch
          için bireysel commit&apos;leri ister.
        </p>
      </div>

      <div className="rounded-xl border border-border/60 bg-card/30 px-5 py-4">
        <StepIndicator steps={steps} />
      </div>

      <Card>
        <CardContent className="p-6">
          <Tabs
            value={mode}
            onValueChange={(v) => {
              setMode(v as Mode);
              setRelease(null);
            }}
          >
            <TabsList className="mb-6 w-full">
              <TabsTrigger value="prs" className="flex-1 gap-2">
                <GitPullRequest className="h-4 w-4" />
                Merged PR&apos;lardan
              </TabsTrigger>
              <TabsTrigger value="compare" className="flex-1 gap-2">
                <GitMerge className="h-4 w-4" />
                Branch karşılaştırma
              </TabsTrigger>
            </TabsList>

            <TabsContent value="prs" className="m-0">
              <PRGenerateForm
                onSubmit={handlePRSubmit}
                onChange={setPrDraft}
                isPending={generateFromPRs.isPending}
              />
            </TabsContent>

            <TabsContent value="compare" className="m-0">
              <GenerateForm
                onSubmit={handleCompareSubmit}
                onChange={setCompareDraft}
                isPending={generateCompare.isPending}
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {release && context && (
        <ReleaseWorkspace context={context} initial={release} />
      )}
    </div>
  );
}
