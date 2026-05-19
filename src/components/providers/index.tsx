import type { ReactNode } from "react";
import { ThemeProvider } from "./theme-provider";
import { QueryProvider } from "./query-provider";
import { SessionProvider } from "./session-provider";
import { Toaster } from "@/components/ui/sonner";

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <ThemeProvider
        attribute="class"
        defaultTheme="dark"
        enableSystem
        disableTransitionOnChange
      >
        <QueryProvider>
          {children}
          <Toaster richColors closeButton />
        </QueryProvider>
      </ThemeProvider>
    </SessionProvider>
  );
}
