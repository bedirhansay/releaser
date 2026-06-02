import { z } from "zod";
import type { TemplateSection } from "./template";

/**
 * Runtime validation for editable template sections. Used at API boundaries
 * (create/update template) and when reading the `ReleaseTemplate.sections`
 * JSON column back into typed code.
 */
export const templateSectionSchema = z.object({
  id: z.string().min(1).max(64),
  heading: z.string().trim().min(1).max(120),
  instruction: z.string().trim().min(1).max(2000),
});

export const templateSectionsSchema = z
  .array(templateSectionSchema)
  .min(1, "En az bir bölüm gerekli")
  .max(40, "En fazla 40 bölüm olabilir");

/**
 * Create payload for a template — shared by the API route and the client
 * editor so both validate identically and show the same messages.
 */
export const createTemplateSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Şablon adı gerekli")
    .max(100, "Şablon adı en fazla 100 karakter olabilir"),
  description: z
    .string()
    .trim()
    .max(500, "Açıklama en fazla 500 karakter olabilir")
    .optional(),
  projectId: z.string().min(1).optional(),
  sections: templateSectionsSchema,
});

/** Parse a `sections` JSON column with a safe empty fallback for bad rows. */
export function parseTemplateSections(input: unknown): TemplateSection[] {
  const result = templateSectionsSchema.safeParse(input);
  return result.success ? result.data : [];
}
