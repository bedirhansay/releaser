"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  useGroups,
  useProjectAccess,
  useSetProjectAccess,
  type ProjectAccessDTO,
} from "@/features/org/hooks";

/**
 * Group-based access for a project (admin only). Toggling groups grants the
 * project to those teams; members of a selected group then see the project.
 * Existing individual-user grants are preserved untouched.
 */
export function ProjectAccessSection({ projectId }: { projectId: string }) {
  const qc = useQueryClient();
  const groups = useGroups();
  const access = useProjectAccess(projectId);
  const save = useSetProjectAccess();
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Seed selection from the loaded access set once it arrives, re-syncing if
  // the fetched data identity changes. Done during render (not in an effect)
  // per React's "adjusting state on prop change" pattern.
  const [syncedFrom, setSyncedFrom] = useState<ProjectAccessDTO | null>(null);
  if (access.data && access.data !== syncedFrom) {
    setSyncedFrom(access.data);
    setSelected(new Set(access.data.groups.map((g) => g.id)));
  }

  const toggle = (groupId: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });

  const onSave = async () => {
    try {
      await save.mutateAsync({
        projectId,
        groupIds: [...selected],
        userIds: access.data?.users.map((u) => u.userId) ?? [],
      });
      await qc.invalidateQueries({ queryKey: ["project", projectId, "access"] });
      toast.success("Erişim güncellendi");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Güncellenemedi");
    }
  };

  const allGroups = groups.data ?? [];

  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Erişim (gruplar)</span>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={onSave}
          disabled={save.isPending || access.isLoading}
          className="gap-1.5"
        >
          {save.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          Erişimi kaydet
        </Button>
      </div>
      {groups.isLoading || access.isLoading ? (
        <p className="text-xs text-muted-foreground">Yükleniyor…</p>
      ) : allGroups.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Henüz grup yok — Takım sayfasından grup oluştur.
        </p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {allGroups.map((g) => {
            const on = selected.has(g.id);
            return (
              <button
                key={g.id}
                type="button"
                onClick={() => toggle(g.id)}
                className={cn(
                  "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition-colors",
                  on
                    ? "border-primary/40 bg-primary/10 text-foreground"
                    : "border-border text-muted-foreground hover:bg-accent",
                )}
              >
                {on && <Check className="h-3 w-3 text-primary" />}
                {g.name}
              </button>
            );
          })}
        </div>
      )}
      <p className="text-[11px] text-muted-foreground">
        Yöneticiler tüm projeleri görür. Üyeler yalnız erişimi verilen projeleri.
      </p>
    </div>
  );
}
