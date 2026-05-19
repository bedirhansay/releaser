import { z } from "zod";
import {
  RELEASE_CATEGORIES,
  RISK_KINDS,
  type CategorizedReleaseNotes,
  type GeneratedRelease,
} from "./release";

/**
 * Runtime-checked schemas mirroring the domain types in `./release.ts`.
 *
 * The shape matches `GeneratedRelease` exactly. Use these at the boundaries
 * where a `Json` payload re-enters typed code — usually when reading a
 * `ReleaseHistory.payload` row or when accepting a saved release in a POST
 * body — so the rest of the codebase can rely on the types without a cast.
 */

const releaseEntrySchema = z.object({
  title: z.string(),
  description: z.string().optional(),
  commitShas: z.array(z.string()).optional().default([]),
  prNumbers: z.array(z.number()).optional(),
});

const notesSchema = z.object(
  Object.fromEntries(
    RELEASE_CATEGORIES.map((c) => [
      c,
      z.array(releaseEntrySchema).optional().default([]),
    ]),
  ) as Record<
    (typeof RELEASE_CATEGORIES)[number],
    z.ZodDefault<z.ZodOptional<z.ZodArray<typeof releaseEntrySchema>>>
  >,
);

const riskSchema = z.object({
  kind: z.enum(RISK_KINDS),
  severity: z.enum(["low", "medium", "high"]),
  summary: z.string(),
  evidence: z.array(z.string()).optional().default([]),
});

export const generatedReleaseSchema = z.object({
  title: z.string(),
  summary: z.string(),
  notes: notesSchema,
  risks: z.array(riskSchema).optional().default([]),
  markdown: z.string(),
  modelUsed: z.string(),
});

export type ParsedRelease = z.infer<typeof generatedReleaseSchema>;

/**
 * Parse with a friendly fallback for legacy rows that pre-date a schema
 * tightening. Callers that need to fail loudly should use
 * `generatedReleaseSchema.parse` directly.
 */
export function parseRelease(input: unknown): GeneratedRelease {
  const result = generatedReleaseSchema.safeParse(input);
  if (result.success) return result.data as GeneratedRelease;
  // The schema is lenient (every field has a default); a hard failure here
  // means the payload is genuinely malformed. Return an empty-but-typed
  // shape so the UI can still render something.
  return {
    title: "Untitled release",
    summary: "",
    notes: emptyNotes(),
    risks: [],
    markdown: "",
    modelUsed: "unknown",
  };
}

function emptyNotes(): CategorizedReleaseNotes {
  return Object.fromEntries(
    RELEASE_CATEGORIES.map((c) => [c, []]),
  ) as unknown as CategorizedReleaseNotes;
}
