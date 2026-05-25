"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { fetchJson } from "@/lib/http";
import type { TemplateSection } from "@/types/template";

export interface TemplateDTO {
  id: string;
  name: string;
  description: string | null;
  projectId: string | null;
  isDefault: boolean;
  sections: TemplateSection[];
  createdAt?: string;
  updatedAt?: string;
}

export function useTemplates(projectId?: string) {
  return useQuery({
    queryKey: ["templates", projectId ?? null],
    queryFn: () => {
      const qs = projectId ? `?projectId=${projectId}` : "";
      return fetchJson<{ templates: TemplateDTO[] }>(
        `/api/templates${qs}`,
      ).then((r) => r.templates);
    },
  });
}

export function useTemplate(id: string | null) {
  return useQuery({
    queryKey: ["template", id],
    enabled: Boolean(id),
    queryFn: () =>
      fetchJson<{ template: TemplateDTO }>(`/api/templates/${id}`).then(
        (r) => r.template,
      ),
  });
}

export interface TemplateInput {
  name: string;
  description?: string;
  projectId?: string | null;
  sections: TemplateSection[];
}

export function useCreateTemplate() {
  return useMutation({
    mutationFn: (input: TemplateInput) =>
      fetchJson<{ template: { id: string } }>("/api/templates", {
        method: "POST",
        body: JSON.stringify(input),
      }).then((r) => r.template),
  });
}

export function useUpdateTemplate() {
  return useMutation({
    mutationFn: ({ id, ...patch }: TemplateInput & { id: string }) =>
      fetchJson<{ template: { id: string } }>(`/api/templates/${id}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      }).then((r) => r.template),
  });
}

export function useDeleteTemplate() {
  return useMutation({
    mutationFn: (id: string) =>
      fetchJson<{ deleted: boolean }>(`/api/templates/${id}`, {
        method: "DELETE",
      }),
  });
}
