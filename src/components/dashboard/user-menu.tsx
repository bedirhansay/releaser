"use client";

import { LogOut } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export interface UserMenuProps {
  user: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
  /** Server action — Next will marshal this across the client boundary. */
  signOutAction: () => Promise<void>;
}

/**
 * Avatar + dropdown for the dashboard header. Lives in a client component
 * so Base UI's `render` prop closure stays on the client side; the
 * sign-out server action is passed in as a prop from the layout.
 */
export function UserMenu({ user, signOutAction }: UserMenuProps) {
  const initials =
    user.name
      ?.split(" ")
      .map((w) => w[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() ?? "U";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="inline-flex h-8 w-8 items-center justify-center rounded-full outline-none ring-offset-2 ring-offset-background transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
        aria-label="Open user menu"
      >
        <Avatar className="h-8 w-8">
          <AvatarImage src={user.image ?? undefined} alt="" />
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>
          <div className="text-sm">{user.name}</div>
          <div className="text-xs text-muted-foreground">{user.email}</div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <form action={signOutAction}>
          <DropdownMenuItem
            render={(props) => (
              <button type="submit" {...props}>
                <LogOut className="mr-2 h-4 w-4" />
                Çıkış yap
              </button>
            )}
          />
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
