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

/**
 * Ensures a template's `projectId`, when set, points at a project in the same
 * org. Without this a caller could link their template to another org's project
 * id (the FK only references Project.id), leaking existence / creating a
 * cross-tenant reference.
 */
async function assertProjectInOrg(orgId: string, projectId?: string | null) {
  if (!projectId) return;
  const project = await prisma.project.findFirst({
    where: { id: projectId, orgId },
    select: { id: true },
  });
  if (!project) {
    throw new Error("Project not found in this organization.");
  }
}

export async function createTemplateForOrg(
  orgId: string,
  createdById: string,
  input: CreateTemplateInput,
): Promise<TemplateRecord> {
  await assertProjectInOrg(orgId, input.projectId);
  const created = await prisma.releaseTemplate.create({
    data: {
      orgId,
      createdById,
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

export async function listTemplatesForOrg(
  orgId: string,
  opts?: { projectId?: string },
): Promise<TemplateRecord[]> {
  const rows = await prisma.releaseTemplate.findMany({
    where: {
      orgId,
      ...(opts?.projectId ? { projectId: opts.projectId } : {}),
    },
    // Default template floats to the top; otherwise most recently touched first.
    orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
  });
  return rows.map(mapTemplate);
}

export async function getTemplateForOrg(
  orgId: string,
  id: string,
): Promise<TemplateRecord | null> {
  const row = await prisma.releaseTemplate.findFirst({
    where: { id, orgId },
  });
  return row ? mapTemplate(row) : null;
}

// Scoped to `{ id, orgId }` so a template can only be patched within its own
// org. Returns whether a row matched.
export async function updateTemplateForOrg(
  orgId: string,
  id: string,
  patch: UpdateTemplateInput,
): Promise<boolean> {
  await assertProjectInOrg(orgId, patch.projectId);
  const result = await prisma.releaseTemplate.updateMany({
    where: { id, orgId },
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

export async function deleteTemplateForOrg(
  orgId: string,
  id: string,
): Promise<boolean> {
  const result = await prisma.releaseTemplate.deleteMany({
    where: { id, orgId },
  });
  return result.count > 0;
}

/**
 * Idempotently guarantees an org has at least one template. On first run we
 * seed the opinionated finsel starter as the default; thereafter we just hand
 * back the existing default (or the first available) template.
 */
export async function ensureDefaultTemplateForOrg(
  orgId: string,
  createdById: string,
): Promise<TemplateRecord> {
  const existing = await listTemplatesForOrg(orgId);
  if (existing.length > 0) {
    return existing.find((t) => t.isDefault) ?? existing[0];
  }
  return createTemplateForOrg(orgId, createdById, {
    name: "Varsayılan şablon (finsel)",
    sections: DEFAULT_TEMPLATE_SECTIONS,
    isDefault: true,
  });
}
