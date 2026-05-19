import { auth } from "@/auth";

export class UnauthorizedError extends Error {
  readonly status = 401 as const;
  constructor(message = "Not authenticated") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export async function requireSessionUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) throw new UnauthorizedError();
  return session.user.id;
}
