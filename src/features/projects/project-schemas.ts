import { z } from "zod";
import { providerSchema } from "@/shared/api/provider-schema";

// Single source of truth for project request validation — shared by the API
// route handlers and the client form so both enforce identical rules and
// surface the same messages.

export const projectRepoSchema = z.object({
  provider: providerSchema,
  owner: z.string().trim().min(1, "Repo sahibi gerekli"),
  name: z.string().trim().min(1, "Repo adı gerekli"),
  role: z.string().trim().max(40, "Rol en fazla 40 karakter olabilir").optional(),
});

export const createProjectSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Proje adı gerekli")
    .max(100, "Proje adı en fazla 100 karakter olabilir"),
  slug: z.string().trim().max(60).optional(),
  description: z
    .string()
    .trim()
    .max(500, "Açıklama en fazla 500 karakter olabilir")
    .optional(),
  // Release-doc defaults (optional). Free text; injected into generated docs.
  defaultRisk: z.string().trim().max(40).optional(),
  monitoringLinks: z.string().trim().max(2000).optional(),
  signOff: z.string().trim().max(2000).optional(),
  repos: z
    .array(projectRepoSchema)
    .min(1, "En az bir repo ekle")
    .max(20, "En fazla 20 repo eklenebilir"),
});

export const updateProjectSchema = createProjectSchema.partial().refine(
  (v) =>
    v.name !== undefined ||
    v.slug !== undefined ||
    v.description !== undefined ||
    v.repos !== undefined,
  { message: "Provide at least one of: name, slug, description, repos" },
);

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
