"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useAddGroupMember,
  useCreateGroup,
  useDeleteGroup,
  useGroups,
  useMembers,
  useRemoveGroupMember,
} from "@/features/org/hooks";

export function GroupsManager() {
  const qc = useQueryClient();
  const groups = useGroups();
  const members = useMembers();
  const createGroup = useCreateGroup();
  const deleteGroup = useDeleteGroup();
  const addMember = useAddGroupMember();
  const removeMember = useRemoveGroupMember();
  const [name, setName] = useState("");

  const invalidate = () => qc.invalidateQueries({ queryKey: ["org", "groups"] });

  const onCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || createGroup.isPending) return;
    try {
      await createGroup.mutateAsync(name.trim());
      setName("");
      await invalidate();
      toast.success("Grup oluşturuldu");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Oluşturulamadı");
    }
  };

  const onDelete = async (groupId: string) => {
    try {
      await deleteGroup.mutateAsync(groupId);
      await invalidate();
      toast.success("Grup silindi");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Silinemedi");
    }
  };

  const onAdd = async (groupId: string, userId: string) => {
    try {
      await addMember.mutateAsync({ groupId, userId });
      await invalidate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Eklenemedi");
    }
  };

  const onRemove = async (groupId: string, userId: string) => {
    try {
      await removeMember.mutateAsync({ groupId, userId });
      await invalidate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Çıkarılamadı");
    }
  };

  const allMembers = members.data ?? [];

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-medium">Gruplar</h2>
        <p className="text-sm text-muted-foreground">
          Ekipleri grupla (örn. &quot;frontend&quot;) ve projelere grup olarak
          erişim ver.
        </p>
      </div>

      <form onSubmit={onCreate} className="flex gap-2">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Yeni grup adı, örn. frontend"
          className="max-w-xs"
        />
        <Button type="submit" size="sm" className="gap-1.5" disabled={createGroup.isPending}>
          {createGroup.isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Plus className="h-3.5 w-3.5" />
          )}
          Grup ekle
        </Button>
      </form>

      {groups.isLoading ? (
        <p className="text-sm text-muted-foreground">Yükleniyor…</p>
      ) : groups.error ? (
        <p className="text-sm text-destructive">{(groups.error as Error).message}</p>
      ) : (groups.data ?? []).length === 0 ? (
        <p className="text-sm text-muted-foreground">Henüz grup yok.</p>
      ) : (
        <div className="space-y-3">
          {(groups.data ?? []).map((g) => {
            const memberIds = new Set(g.members.map((m) => m.userId));
            const candidates = allMembers.filter((m) => !memberIds.has(m.userId));
            return (
              <div
                key={g.id}
                className="space-y-3 rounded-lg border border-border/70 bg-card/40 p-3"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">{g.name}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => onDelete(g.id)}
                    aria-label="Grubu sil"
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {g.members.length === 0 && (
                    <span className="text-xs text-muted-foreground">
                      Üye yok
                    </span>
                  )}
                  {g.members.map((m) => (
                    <span
                      key={m.userId}
                      className="inline-flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-xs"
                    >
                      {m.name ?? m.email}
                      <button
                        type="button"
                        onClick={() => onRemove(g.id, m.userId)}
                        aria-label="Çıkar"
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>

                {candidates.length > 0 && (
                  <Select
                    value=""
                    onValueChange={(userId) => {
                      if (typeof userId === "string" && userId) {
                        onAdd(g.id, userId);
                      }
                    }}
                  >
                    <SelectTrigger size="sm" className="w-56">
                      <SelectValue placeholder="Üye ekle…" />
                    </SelectTrigger>
                    <SelectContent>
                      {candidates.map((m) => (
                        <SelectItem key={m.userId} value={m.userId}>
                          {m.name ?? m.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
