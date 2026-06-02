import bcrypt from "bcryptjs";
import type { Role } from "@prisma/client";
import { prisma } from "@/infrastructure/db/prisma";
import { ForbiddenError } from "@/shared/api/require-session";

// ───────────────────────── Members ─────────────────────────

export interface MemberRecord {
  membershipId: string;
  userId: string;
  name: string | null;
  email: string | null;
  role: Role;
  createdAt: Date;
}

export async function listMembers(orgId: string): Promise<MemberRecord[]> {
  const rows = await prisma.membership.findMany({
    where: { orgId },
    include: { user: true },
    orderBy: { createdAt: "asc" },
  });
  return rows.map((m) => ({
    membershipId: m.id,
    userId: m.userId,
    name: m.user.name,
    email: m.user.email,
    role: m.role,
    createdAt: m.createdAt,
  }));
}

export interface CreateMemberInput {
  email: string;
  name?: string | null;
  password: string;
  role: Role;
}

/**
 * Provisions a member: creates the user (with a password) if new, then ensures
 * a membership in the org with the given role. If the email already exists the
 * existing account is reused (password untouched) and just added to the org.
 */
export async function createMember(
  orgId: string,
  input: CreateMemberInput,
): Promise<MemberRecord> {
  const email = input.email.trim().toLowerCase();
  const passwordHash = await bcrypt.hash(input.password, 10);

  const user = await prisma.user.upsert({
    where: { email },
    update: { ...(input.name !== undefined ? { name: input.name } : {}) },
    create: { email, name: input.name ?? null, passwordHash },
  });

  const membership = await prisma.membership.upsert({
    where: { userId_orgId: { userId: user.id, orgId } },
    update: { role: input.role },
    create: { userId: user.id, orgId, role: input.role },
  });

  return {
    membershipId: membership.id,
    userId: user.id,
    name: user.name,
    email: user.email,
    role: membership.role,
    createdAt: membership.createdAt,
  };
}

/** Guards against demoting/removing the org's last OWNER. */
async function assertNotLastOwner(orgId: string, membershipId: string) {
  const target = await prisma.membership.findFirst({
    where: { id: membershipId, orgId },
    select: { role: true },
  });
  if (target?.role !== "OWNER") return;
  const owners = await prisma.membership.count({
    where: { orgId, role: "OWNER" },
  });
  if (owners <= 1) {
    throw new ForbiddenError("Son OWNER kaldırılamaz veya rolü düşürülemez.");
  }
}

export async function updateMemberRole(
  orgId: string,
  membershipId: string,
  role: Role,
  actorRole: Role,
): Promise<boolean> {
  const target = await prisma.membership.findFirst({
    where: { id: membershipId, orgId },
    select: { role: true },
  });
  if (!target) return false;
  // Only an OWNER may grant OWNER or alter an existing OWNER's role. Without
  // this an ADMIN could self-promote to OWNER (or demote a real OWNER) and take
  // over the org — the route gate alone allows ADMINs in here.
  if (
    (role === "OWNER" || target.role === "OWNER") &&
    actorRole !== "OWNER"
  ) {
    throw new ForbiddenError(
      "Yalnızca OWNER, OWNER rolünü atayabilir veya değiştirebilir.",
    );
  }
  if (role !== "OWNER") await assertNotLastOwner(orgId, membershipId);
  const result = await prisma.membership.updateMany({
    where: { id: membershipId, orgId },
    data: { role },
  });
  return result.count > 0;
}

export async function removeMember(
  orgId: string,
  membershipId: string,
  actorRole: Role,
): Promise<boolean> {
  const target = await prisma.membership.findFirst({
    where: { id: membershipId, orgId },
    select: { role: true },
  });
  if (!target) return false;
  // An ADMIN must not be able to remove an OWNER.
  if (target.role === "OWNER" && actorRole !== "OWNER") {
    throw new ForbiddenError("Yalnızca OWNER bir OWNER'ı kaldırabilir.");
  }
  await assertNotLastOwner(orgId, membershipId);
  const result = await prisma.membership.deleteMany({
    where: { id: membershipId, orgId },
  });
  return result.count > 0;
}

// ───────────────────────── Groups ─────────────────────────

export interface GroupRecord {
  id: string;
  name: string;
  createdAt: Date;
  members: Array<{ userId: string; name: string | null; email: string | null }>;
}

export async function listGroups(orgId: string): Promise<GroupRecord[]> {
  const rows = await prisma.group.findMany({
    where: { orgId },
    orderBy: { name: "asc" },
    include: { members: { include: { user: true } } },
  });
  return rows.map((g) => ({
    id: g.id,
    name: g.name,
    createdAt: g.createdAt,
    members: g.members.map((m) => ({
      userId: m.userId,
      name: m.user.name,
      email: m.user.email,
    })),
  }));
}

export async function createGroup(orgId: string, name: string) {
  return prisma.group.create({
    data: { orgId, name: name.trim() },
    select: { id: true },
  });
}

export async function deleteGroup(
  orgId: string,
  groupId: string,
): Promise<boolean> {
  const result = await prisma.group.deleteMany({
    where: { id: groupId, orgId },
  });
  return result.count > 0;
}

/** Adds a user to a group — both must belong to the org. */
export async function addGroupMember(
  orgId: string,
  groupId: string,
  userId: string,
): Promise<boolean> {
  const [group, membership] = await Promise.all([
    prisma.group.findFirst({ where: { id: groupId, orgId }, select: { id: true } }),
    prisma.membership.findFirst({
      where: { userId, orgId },
      select: { id: true },
    }),
  ]);
  if (!group || !membership) {
    throw new ForbiddenError("Grup veya kullanıcı bu organizasyonda değil.");
  }
  await prisma.groupMember.upsert({
    where: { groupId_userId: { groupId, userId } },
    update: {},
    create: { groupId, userId },
  });
  return true;
}

export async function removeGroupMember(
  orgId: string,
  groupId: string,
  userId: string,
): Promise<boolean> {
  const group = await prisma.group.findFirst({
    where: { id: groupId, orgId },
    select: { id: true },
  });
  if (!group) return false;
  const result = await prisma.groupMember.deleteMany({
    where: { groupId, userId },
  });
  return result.count > 0;
}

// ───────────────────── Project access ─────────────────────

export interface ProjectAccessRecord {
  groups: Array<{ id: string; name: string }>;
  users: Array<{ userId: string; name: string | null; email: string | null }>;
}

export async function getProjectAccess(
  orgId: string,
  projectId: string,
): Promise<ProjectAccessRecord | null> {
  const project = await prisma.project.findFirst({
    where: { id: projectId, orgId },
    select: { id: true },
  });
  if (!project) return null;
  const rows = await prisma.projectAccess.findMany({
    where: { projectId },
    include: { group: true, user: true },
  });
  return {
    groups: rows
      .filter((r) => r.group)
      .map((r) => ({ id: r.group!.id, name: r.group!.name })),
    users: rows
      .filter((r) => r.user)
      .map((r) => ({
        userId: r.user!.id,
        name: r.user!.name,
        email: r.user!.email,
      })),
  };
}

/**
 * Replaces a project's access set with the given groups + users. Validates
 * everything belongs to the org, then swaps in a transaction.
 */
export async function setProjectAccess(
  orgId: string,
  projectId: string,
  input: { groupIds: string[]; userIds: string[] },
): Promise<boolean> {
  const project = await prisma.project.findFirst({
    where: { id: projectId, orgId },
    select: { id: true },
  });
  if (!project) return false;

  const [validGroups, validMembers] = await Promise.all([
    prisma.group.findMany({
      where: { orgId, id: { in: input.groupIds } },
      select: { id: true },
    }),
    prisma.membership.findMany({
      where: { orgId, userId: { in: input.userIds } },
      select: { userId: true },
    }),
  ]);
  const groupIds = validGroups.map((g) => g.id);
  const userIds = validMembers.map((m) => m.userId);

  await prisma.$transaction([
    prisma.projectAccess.deleteMany({ where: { projectId } }),
    prisma.projectAccess.createMany({
      data: [
        ...groupIds.map((groupId) => ({ projectId, groupId })),
        ...userIds.map((userId) => ({ projectId, userId })),
      ],
    }),
  ]);
  return true;
}
