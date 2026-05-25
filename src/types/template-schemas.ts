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
  .min(1)
  .max(40);

/** Parse a `sections` JSON column with a safe empty fallback for bad rows. */
export function parseTemplateSections(input: unknown): TemplateSection[] {
  const result = templateSectionsSchema.safeParse(input);
  return result.success ? result.data : [];
}
