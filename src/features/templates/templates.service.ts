import type { Prisma } from "@prisma/client";
import { prisma } from "@/infrastructure/db/prisma";
import {
  DEFAULT_TEMPLATE_SECTIONS,
  type TemplateSection,
} from "@/types/template";
import { parseTemplateSections } from "@/types/template-schemas";

export interface CreateTemplateInput {
  name: string;
  description?: string | null;
  projectId?: string | null;
  sections: TemplateSection[];
  isDefault?: boolean;
}

export interface UpdateTemplateInput {
  name?: string;
  description?: string | null;
  projectId?: string | null;
  sections?: TemplateSection[];
}

/** Shape returned to callers — `sections` is always parsed back to typed
 *  `TemplateSection[]` so the raw JSON column never leaks out of the service. */
export interface TemplateRecord {
  id: string;
  name: string;
  description: string | null;
  projectId: string | null;
  isDefault: boolean;
  sections: TemplateSection[];
  createdAt: Date;
  updatedAt: Date;
}

// Prisma's `findMany`/`create` returns `sections` as the opaque `JsonValue`
// type. We always funnel rows through here so the JSON column is decoded once,
// in one place, and callers get the typed `TemplateSection[]` view.
function mapTemplate(row: {
  id: string;
  name: string;
  description: string | null;
  projectId: string | null;
  isDefault: boolean;
  sections: Prisma.JsonValue;
  createdAt: Date;
  updatedAt: Date;
}): TemplateRecord {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    projectId: row.projectId,
    isDefault: row.isDefault,
    sections: parseTemplateSections(row.sections),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function createTemplateForUser(
  userId: string,
  input: CreateTemplateInput,
): Promise<TemplateRecord> {
  const created = await prisma.releaseTemplate.create({
    data: {
      userId,
      name: input.name,
      description: input.description ?? null,
      projectId: input.projectId ?? null,
      // `TemplateSection[]` is JSON-serialisable by construction, but Prisma's
      // `InputJsonValue` type can't see that statically — mirrored on read by
      // `parseTemplateSections` for full round-trip type safety.
      sections: input.sections as unknown as Prisma.InputJsonValue,
      isDefault: input.isDefault ?? false,
    },
  });
  return mapTemplate(created);
}

export async function listTemplatesForUser(
  userId: string,
  opts?: { projectId?: string },
): Promise<TemplateRecord[]> {
  const rows = await prisma.releaseTemplate.findMany({
    where: {
      userId,
      ...(opts?.projectId ? { projectId: opts.projectId } : {}),
    },
    // Default template floats to the top; otherwise most recently touched first.
    orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
  });
  return rows.map(mapTemplate);
}

export async function getTemplateForUser(
  userId: string,
  id: string,
): Promise<TemplateRecord | null> {
  const row = await prisma.releaseTemplate.findFirst({
    where: { id, userId },
  });
  return row ? mapTemplate(row) : null;
}

// Ownership is enforced by scoping the `updateMany` to `{ id, userId }`, so a
// user can never patch another user's template. Returns whether a row matched.
export async function updateTemplateForUser(
  userId: string,
  id: string,
  patch: UpdateTemplateInput,
): Promise<boolean> {
  const result = await prisma.releaseTemplate.updateMany({
    where: { id, userId },
    data: {
      ...(patch.name !== undefined ? { name: patch.name } : {}),
      ...(patch.description !== undefined
        ? { description: patch.description }
        : {}),
      ...(patch.projectId !== undefined
        ? { projectId: patch.projectId }
        : {}),
      ...(patch.sections !== undefined
        ? {
            sections: patch.sections as unknown as Prisma.InputJsonValue,
          }
        : {}),
    },
  });
  return result.count > 0;
}

export async function deleteTemplateForUser(
  userId: string,
  id: string,
): Promise<boolean> {
  const result = await prisma.releaseTemplate.deleteMany({
    where: { id, userId },
  });
  return result.count > 0;
}

/**
 * Idempotently guarantees a user has at least one template. On first run we
 * seed the opinionated finsel starter as the default; thereafter we just hand
 * back the existing default (or the first available) template.
 */
export async function ensureDefaultTemplateForUser(
  userId: string,
): Promise<TemplateRecord> {
  const existing = await listTemplatesForUser(userId);
  if (existing.length > 0) {
    return existing.find((t) => t.isDefault) ?? existing[0];
  }
  return createTemplateForUser(userId, {
    name: "Varsayılan şablon (finsel)",
    sections: DEFAULT_TEMPLATE_SECTIONS,
    isDefault: true,
  });
}
