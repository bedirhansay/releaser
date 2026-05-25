"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Check, KeyRound, Loader2, ShieldCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useAiSetting, useSaveAiSetting } from "@/features/settings/hooks";

export function AiSettingsForm() {
  const qc = useQueryClient();
  const status = useAiSetting();
  const save = useSaveAiSetting();

  const [apiKey, setApiKey] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [model, setModel] = useState("");

  // Prefill non-secret fields once the status loads. Derived so we don't fight
  // a setState-in-effect; users can still overwrite freely.
  const data = status.data;

  const handleSave = async () => {
    try {
      await save.mutateAsync({
        // Only send the key when the user typed one — empty leaves it as-is.
        ...(apiKey ? { apiKey } : {}),
        baseUrl: baseUrl || null,
        model: model || null,
      });
      setApiKey("");
      toast.success("AI ayarları kaydedildi");
      await qc.invalidateQueries({ queryKey: ["ai-setting"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Kaydedilemedi");
    }
  };

  const handleClearKey = async () => {
    try {
      await save.mutateAsync({ apiKey: "" });
      setApiKey("");
      toast.success("Anahtar silindi — ortak anahtara dönüldü");
      await qc.invalidateQueries({ queryKey: ["ai-setting"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Silinemedi");
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <KeyRound className="h-4 w-4 text-primary" />
          Kendi AI anahtarın (BYO-LLM)
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <p className="text-sm text-muted-foreground">
          OpenAI ya da OpenAI-uyumlu herhangi bir endpoint (Azure OpenAI,
          DeepSeek, GLM, Ollama…) kullanabilirsin. Anahtarın{" "}
          <span className="font-medium text-foreground">AES-256 ile şifreli</span>{" "}
          saklanır ve hiçbir zaman geri gösterilmez. Boş bırakırsan ortak
          sistem anahtarı kullanılır.
        </p>

        {status.isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-2/3" />
          </div>
        ) : (
          <>
            {/* Current status */}
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border/70 bg-muted/30 px-3 py-2 text-sm">
              {data?.hasKey ? (
                <Badge className="gap-1">
                  <ShieldCheck className="h-3 w-3" /> Kendi anahtarın aktif
                </Badge>
              ) : data?.envFallbackAvailable ? (
                <Badge variant="secondary">Ortak sistem anahtarı kullanılıyor</Badge>
              ) : (
                <Badge variant="destructive">Anahtar yok — üretim çalışmaz</Badge>
              )}
              {data?.model && (
                <span className="font-mono text-xs text-muted-foreground">
                  model: {data.model}
                </span>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ai-key">API anahtarı</Label>
              <Input
                id="ai-key"
                type="password"
                autoComplete="off"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={
                  data?.hasKey ? "•••••••• (değiştirmek için yeni anahtar yaz)" : "sk-…"
                }
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="ai-base">Base URL (opsiyonel)</Label>
                <Input
                  id="ai-base"
                  value={baseUrl}
                  onChange={(e) => setBaseUrl(e.target.value)}
                  placeholder={data?.baseUrl ?? "https://api.openai.com/v1"}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="ai-model">Model (opsiyonel)</Label>
                <Input
                  id="ai-model"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  placeholder={data?.model ?? "gpt-4o-mini"}
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={handleSave} disabled={save.isPending} className="gap-2">
                {save.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Check className="h-4 w-4" />
                )}
                Kaydet
              </Button>
              {data?.hasKey && (
                <Button
                  variant="ghost"
                  onClick={handleClearKey}
                  disabled={save.isPending}
                  className="gap-2 text-destructive"
                >
                  <Trash2 className="h-4 w-4" /> Anahtarı sil
                </Button>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
