"use server";

import { signOut } from "@/auth";

// Extracted so it can be imported into client components — server actions
// declared inline inside a server component can't be passed across the
// server/client boundary safely.
export async function signOutAction(): Promise<void> {
  await signOut({ redirectTo: "/" });
}
