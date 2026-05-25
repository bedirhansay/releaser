"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { fetchJson } from "@/lib/http";

export interface AiSettingStatus {
  hasKey: boolean;
  baseUrl: string | null;
  model: string | null;
  envFallbackAvailable: boolean;
}

export function useAiSetting() {
  return useQuery({
    queryKey: ["ai-setting"],
    queryFn: () =>
      fetchJson<{ ai: AiSettingStatus }>("/api/settings/ai").then((r) => r.ai),
  });
}

export interface SaveAiSettingInput {
  apiKey?: string;
  baseUrl?: string | null;
  model?: string | null;
}

export function useSaveAiSetting() {
  return useMutation({
    mutationFn: (input: SaveAiSettingInput) =>
      fetchJson<{ ai: AiSettingStatus }>("/api/settings/ai", {
        method: "PUT",
        body: JSON.stringify(input),
      }).then((r) => r.ai),
  });
}
