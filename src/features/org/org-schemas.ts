import { z } from "zod";

// Shared validation for org administration — members, groups, project access.

export const roleSchema = z.enum(["OWNER", "ADMIN", "MEMBER"]);

export const createMemberSchema = z.object({
  email: z.string().trim().email("Geçerli bir e-posta gir"),
  name: z.string().trim().max(100).optional(),
  password: z
    .string()
    .min(8, "Şifre en az 8 karakter olmalı")
    .max(200),
  // ADMIN can provision admins/members; OWNER is granted via role change only.
  role: z.enum(["ADMIN", "MEMBER"]).default("MEMBER"),
});

export const updateMemberSchema = z.object({ role: roleSchema });

export const createGroupSchema = z.object({
  name: z.string().trim().min(1, "Grup adı gerekli").max(60),
});

export const groupMemberSchema = z.object({
  userId: z.string().min(1),
});

export const projectAccessSchema = z.object({
  groupIds: z.array(z.string().min(1)).max(100).default([]),
  userIds: z.array(z.string().min(1)).max(200).default([]),
});
