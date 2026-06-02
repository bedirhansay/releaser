"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Boxes, Loader2, Plus, Trash2, UserPlus, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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

function initials(value: string) {
  const parts = value.trim().split(/[\s@.]+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

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
  const data = groups.data ?? [];

  return (
    <Card className="border-border/60">
      <CardHeader className="border-b">
        <CardTitle>Gruplar</CardTitle>
        <CardDescription>
          Ekipleri grupla (örn. &quot;frontend&quot;) ve projelere grup olarak
          erişim ver.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <form onSubmit={onCreate} className="flex gap-2">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Yeni grup adı, örn. frontend"
            className="max-w-xs"
          />
          <Button
            type="submit"
            size="sm"
            className="gap-1.5"
            disabled={createGroup.isPending}
          >
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
          <p className="text-sm text-destructive">
            {(groups.error as Error).message}
          </p>
        ) : data.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border/60 px-4 py-10 text-center">
            <Boxes className="h-8 w-8 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">
              Henüz grup yok. Yukarıdan ilk grubunu oluştur.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {data.map((g) => {
              const memberIds = new Set(g.members.map((m) => m.userId));
              const candidates = allMembers.filter(
                (m) => !memberIds.has(m.userId)
              );
              return (
                <div
                  key={g.id}
                  className="space-y-3 rounded-lg border border-border/60 bg-card/40 p-3 transition-colors hover:bg-muted/30"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <Boxes className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="truncate font-medium">{g.name}</span>
                      <span className="eyebrow shrink-0 text-muted-foreground">
                        {g.members.length} üye
                      </span>
                    </div>
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
                    {g.members.map((m) => {
                      const label = m.name ?? m.email ?? m.userId;
                      return (
                        <span
                          key={m.userId}
                          className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-background py-0.5 pr-1.5 pl-1 text-xs"
                        >
                          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary">
                            {initials(label)}
                          </span>
                          {label}
                          <button
                            type="button"
                            onClick={() => onRemove(g.id, m.userId)}
                            aria-label="Çıkar"
                            className="text-muted-foreground hover:text-destructive"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      );
                    })}
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
                        <UserPlus className="h-3.5 w-3.5 text-muted-foreground" />
                        <SelectValue placeholder="Üye ekle…" />
                      </SelectTrigger>
                      <SelectContent>
                        {candidates.map((m) => (
                          <SelectItem key={m.userId} value={m.userId}>
                            {m.name ?? m.email ?? m.userId}
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
      </CardContent>
    </Card>
  );
}
