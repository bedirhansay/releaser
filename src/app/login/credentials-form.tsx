"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Primary login: email + password (Credentials). Members are provisioned by an
 * admin and sign in here; the seeded superadmin too. OAuth stays available
 * below for linking a git connection to the org.
 */
export function CredentialsForm({
  redirectTo,
  defaultEmail = "",
  defaultPassword = "",
}: {
  redirectTo: string;
  /** Dev-only prefill so you don't retype the seeded superadmin each time. */
  defaultEmail?: string;
  defaultPassword?: string;
}) {
  const router = useRouter();
  const [email, setEmail] = useState(defaultEmail);
  const [password, setPassword] = useState(defaultPassword);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pending) return;
    setError(null);
    setPending(true);
    try {
      const res = await signIn("credentials", {
        email: email.trim(),
        password,
        redirect: false,
      });
      if (res?.error) {
        setError("E-posta veya şifre hatalı.");
        return;
      }
      router.push(redirectTo);
      router.refresh();
    } catch {
      setError("Giriş yapılamadı. Tekrar dene.");
    } finally {
      setPending(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-3 text-left">
      <div className="space-y-1.5">
        <Label htmlFor="login-email">E-posta</Label>
        <Input
          id="login-email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="ad@sirket.com"
          required
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="login-password">Şifre</Label>
        <Input
          id="login-password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" size="lg" className="w-full gap-2" disabled={pending}>
        {pending && <Loader2 className="h-4 w-4 animate-spin" />}
        Giriş yap
      </Button>
    </form>
  );
}
