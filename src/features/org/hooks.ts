"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { fetchJson } from "@/lib/http";

export type Role = "OWNER" | "ADMIN" | "MEMBER";

export interface MemberDTO {
  membershipId: string;
  userId: string;
  name: string | null;
  email: string | null;
  role: Role;
  createdAt: string;
}

export interface GroupDTO {
  id: string;
  name: string;
  createdAt: string;
  members: Array<{ userId: string; name: string | null; email: string | null }>;
}

export interface ProjectAccessDTO {
  groups: Array<{ id: string; name: string }>;
  users: Array<{ userId: string; name: string | null; email: string | null }>;
}

// ─── Members ───────────────────────────────────────────────────────────────

export function useMembers() {
  return useQuery({
    queryKey: ["org", "members"],
    queryFn: () =>
      fetchJson<{ members: MemberDTO[] }>("/api/org/members").then(
        (r) => r.members,
      ),
  });
}

export function useCreateMember() {
  return useMutation({
    mutationFn: (input: {
      email: string;
      name?: string;
      password: string;
      role: "ADMIN" | "MEMBER";
    }) =>
      fetchJson<{ member: MemberDTO }>("/api/org/members", {
        method: "POST",
        body: JSON.stringify(input),
      }).then((r) => r.member),
  });
}

export function useUpdateMemberRole() {
  return useMutation({
    mutationFn: ({ membershipId, role }: { membershipId: string; role: Role }) =>
      fetchJson(`/api/org/members/${membershipId}`, {
        method: "PATCH",
        body: JSON.stringify({ role }),
      }),
  });
}

export function useRemoveMember() {
  return useMutation({
    mutationFn: (membershipId: string) =>
      fetchJson(`/api/org/members/${membershipId}`, { method: "DELETE" }),
  });
}

// ─── Groups ──────────────────────────────────────────────────────────────

export function useGroups() {
  return useQuery({
    queryKey: ["org", "groups"],
    queryFn: () =>
      fetchJson<{ groups: GroupDTO[] }>("/api/org/groups").then((r) => r.groups),
  });
}

export function useCreateGroup() {
  return useMutation({
    mutationFn: (name: string) =>
      fetchJson<{ group: { id: string } }>("/api/org/groups", {
        method: "POST",
        body: JSON.stringify({ name }),
      }),
  });
}

export function useDeleteGroup() {
  return useMutation({
    mutationFn: (groupId: string) =>
      fetchJson(`/api/org/groups/${groupId}`, { method: "DELETE" }),
  });
}

export function useAddGroupMember() {
  return useMutation({
    mutationFn: ({ groupId, userId }: { groupId: string; userId: string }) =>
      fetchJson(`/api/org/groups/${groupId}/members`, {
        method: "POST",
        body: JSON.stringify({ userId }),
      }),
  });
}

export function useRemoveGroupMember() {
  return useMutation({
    mutationFn: ({ groupId, userId }: { groupId: string; userId: string }) =>
      fetchJson(`/api/org/groups/${groupId}/members`, {
        method: "DELETE",
        body: JSON.stringify({ userId }),
      }),
  });
}

// ─── Project access ────────────────────────────────────────────────────────

export function useProjectAccess(projectId: string | null) {
  return useQuery({
    queryKey: ["project", projectId, "access"],
    enabled: Boolean(projectId),
    queryFn: () =>
      fetchJson<{ access: ProjectAccessDTO }>(
        `/api/projects/${projectId}/access`,
      ).then((r) => r.access),
  });
}

export function useSetProjectAccess() {
  return useMutation({
    mutationFn: ({
      projectId,
      groupIds,
      userIds,
    }: {
      projectId: string;
      groupIds: string[];
      userIds: string[];
    }) =>
      fetchJson(`/api/projects/${projectId}/access`, {
        method: "PUT",
        body: JSON.stringify({ groupIds, userIds }),
      }),
  });
}
