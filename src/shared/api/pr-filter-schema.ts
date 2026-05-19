import { z } from "zod";

// Mirrors the discriminated PRFilterMode from core/git/types.ts so route
// handlers can validate query/body shapes without re-importing the domain
// type into the request layer.
const prStateSchema = z.enum(["merged", "open", "all"]);

export const prFilterSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("last-n"),
    n: z.coerce.number().int().min(1).max(100),
    base: z.string().min(1).optional(),
    state: prStateSchema.optional(),
  }),
  z.object({
    type: z.literal("date-range"),
    since: z.string().min(1),
    until: z.string().min(1),
    base: z.string().min(1).optional(),
    state: prStateSchema.optional(),
  }),
  z.object({
    type: z.literal("between-tags"),
    baseTag: z.string().min(1),
    headTag: z.string().min(1),
  }),
]);

export type PRFilterInput = z.infer<typeof prFilterSchema>;
