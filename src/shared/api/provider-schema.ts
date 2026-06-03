import { z } from "zod";

// Single source of truth for the provider query/body field across route
// handlers. Keep aligned with GitProviderKind in core/git/types.ts.
export const providerSchema = z
  .enum(["github", "bitbucket", "local"])
  .default("github");
