import { GitProviderError } from "@/core/git/errors";

/**
 * Base directory under which the "local" git provider may read repositories.
 * Read from LOCAL_REPOS_DIR. Returns null when the feature is disabled (unset),
 * so callers can decide whether to surface "local" as an option.
 */
export function localReposDir(): string | null {
  const dir = process.env.LOCAL_REPOS_DIR?.trim();
  return dir ? dir : null;
}

/** True when the local provider is enabled (LOCAL_REPOS_DIR is configured). */
export function isLocalProviderConfigured(): boolean {
  return localReposDir() !== null;
}

/**
 * Like {@link localReposDir} but throws a clear error when unset — use on code
 * paths that have already committed to the local provider.
 */
export function requireLocalReposDir(): string {
  const dir = localReposDir();
  if (!dir) {
    throw new GitProviderError(
      "Local repos are disabled — set LOCAL_REPOS_DIR to enable on-disk repositories.",
    );
  }
  return dir;
}
