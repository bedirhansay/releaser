"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Crown, Loader2, Plus, Trash2, UsersRound } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useCreateMember,
  useMembers,
  useRemoveMember,
  useUpdateMemberRole,
  type Role,
} from "@/features/org/hooks";

const ROLE_LABEL: Record<Role, string> = {
  OWNER: "Sahip",
  ADMIN: "Yönetici",
  MEMBER: "Üye",
};

function initials(value: string) {
  const parts = value.trim().split(/[\s@.]+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export function MembersManager() {
  const qc = useQueryClient();
  const members = useMembers();
  const updateRole = useUpdateMemberRole();
  const remove = useRemoveMember();

  const invalidate = () =>
    qc.invalidateQueries({ queryKey: ["org", "members"] });

  const onRoleChange = async (membershipId: string, role: Role) => {
    try {
      await updateRole.mutateAsync({ membershipId, role });
      await invalidate();
      toast.success("Rol güncellendi");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Güncellenemedi");
    }
  };

  const onRemove = async (membershipId: string) => {
    try {
      await remove.mutateAsync(membershipId);
      await invalidate();
      toast.success("Üye kaldırıldı");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Kaldırılamadı");
    }
  };

  const data = members.data ?? [];

  return (
    <Card className="border-border/60">
      <CardHeader className="border-b">
        <CardTitle>Üyeler</CardTitle>
        <CardDescription>Ekip üyelerini ekle, rollerini yönet.</CardDescription>
        <CardAction>
          <AddMemberDialog onDone={invalidate} />
        </CardAction>
      </CardHeader>

      <CardContent className="px-0">
        {members.isLoading ? (
          <p className="px-4 py-3 text-sm text-muted-foreground">Yükleniyor…</p>
        ) : members.error ? (
          <p className="px-4 py-3 text-sm text-destructive">
            {(members.error as Error).message}
          </p>
        ) : data.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
            <UsersRound className="h-8 w-8 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">
              Henüz üye yok. İlk üyeyi ekleyerek başla.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border/60">
            {data.map((m) => {
              const label = m.name ?? m.email ?? m.userId;
              return (
                <li
                  key={m.membershipId}
                  className="flex items-center gap-3 px-4 py-3 text-sm transition-colors hover:bg-muted/40"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                    {initials(label)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{label}</div>
                    {m.email && (
                      <div className="truncate text-xs text-muted-foreground">
                        {m.email}
                      </div>
                    )}
                  </div>
                  {m.role === "OWNER" ? (
                    <Badge variant="secondary">
                      <Crown />
                      {ROLE_LABEL.OWNER}
                    </Badge>
                  ) : (
                    <Select
                      value={m.role}
                      onValueChange={(v) =>
                        onRoleChange(m.membershipId, v as Role)
                      }
                    >
                      <SelectTrigger size="sm" className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ADMIN">
                          {ROLE_LABEL.ADMIN}
                        </SelectItem>
                        <SelectItem value="MEMBER">
                          {ROLE_LABEL.MEMBER}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    disabled={m.role === "OWNER"}
                    onClick={() => onRemove(m.membershipId)}
                    aria-label="Üyeyi kaldır"
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function AddMemberDialog({ onDone }: { onDone: () => void }) {
  const create = useCreateMember();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"ADMIN" | "MEMBER">("MEMBER");

  const reset = () => {
    setEmail("");
    setName("");
    setPassword("");
    setRole("MEMBER");
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (create.isPending) return;
    try {
      await create.mutateAsync({
        email: email.trim(),
        name: name.trim() || undefined,
        password,
        role,
      });
      toast.success("Üye eklendi");
      reset();
      setOpen(false);
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Eklenemedi");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button size="sm" className="gap-1.5">
            <Plus className="h-3.5 w-3.5" /> Üye ekle
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Yeni üye</DialogTitle>
          <DialogDescription>
            Üye bu e-posta ve şifreyle giriş yapar. Şifreyi sonra değiştirebilir.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="m-email">E-posta</Label>
            <Input
              id="m-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ad@sirket.com"
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="m-name">İsim (opsiyonel)</Label>
            <Input
              id="m-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="m-password">Geçici şifre</Label>
            <Input
              id="m-password"
              type="text"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="en az 8 karakter"
              required
            />
          </div>
          <div className="grid gap-2">
            <Label>Rol</Label>
            <Select value={role} onValueChange={(v) => setRole(v as "ADMIN" | "MEMBER")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="MEMBER">{ROLE_LABEL.MEMBER}</SelectItem>
                <SelectItem value="ADMIN">{ROLE_LABEL.ADMIN}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
              disabled={create.isPending}
            >
              Vazgeç
            </Button>
            <Button type="submit" disabled={create.isPending} className="gap-2">
              {create.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Ekle
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
