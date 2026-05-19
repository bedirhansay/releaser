"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, MoreHorizontal, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useDeleteRelease } from "@/features/releases/hooks";

// Per-row action menu for the history list. Currently only delete; future
// items (regenerate, duplicate) can land here without changing callers.
export function HistoryRowActions({
  id,
  title,
}: {
  id: string;
  title: string;
}) {
  const [open, setOpen] = useState(false);
  const remove = useDeleteRelease();
  const router = useRouter();
  const qc = useQueryClient();

  const handleDelete = async () => {
    try {
      await remove.mutateAsync(id);
      toast.success("Release silindi");
      setOpen(false);
      // The history list is driven by a client-side useInfiniteQuery, so a
      // bare router.refresh() doesn't touch its cache. Invalidate the
      // releases queries (any search variant) to force a refetch.
      await qc.invalidateQueries({ queryKey: ["releases"] });
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Silinemedi");
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Eylemler"
          onClick={(e) => e.stopPropagation()}
        >
          <MoreHorizontal className="h-4 w-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="w-40"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Base UI's Menu.Item requires a Menu.Group ancestor — wrapping
              even a single item keeps the runtime from blowing up. */}
          <DropdownMenuGroup>
            <DropdownMenuItem
              // Base UI's MenuItem exposes onClick, not onSelect — using the
              // wrong prop is silently dropped, which is why the menu used to
              // do nothing at all.
              onClick={() => setOpen(true)}
              className="text-destructive"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Sil
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bu release&apos;i silmek istediğinden emin misin?</DialogTitle>
            <DialogDescription>
              <span className="font-medium text-foreground">{title}</span>{" "}
              kalıcı olarak silinecek. Geri alınamaz.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setOpen(false)}
              disabled={remove.isPending}
            >
              Vazgeç
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={remove.isPending}
              className="gap-2"
            >
              {remove.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              Sil
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
