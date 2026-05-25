import { createAppAuth } from "@octokit/auth-app";
import { Octokit } from "@octokit/rest";

/**
 * GitHub App authentication helpers.
 *
 * Login stays on OAuth (identity); repo *access* uses GitHub App installation
 * tokens — short-lived (1h), scoped to exactly the repos the user granted at
 * install time. This is the Coolify model: least-privilege, per-repo, revocable
 * by the user from GitHub at any time.
 *
 * All functions degrade gracefully: if the App isn't configured (env missing),
 * `isGitHubAppConfigured()` returns false and callers fall back to OAuth.
 */

export interface GitHubAppConfig {
  appId: string;
  privateKey: string;
  slug: string;
  clientId?: string;
  clientSecret?: string;
}

export function getGitHubAppConfig(): GitHubAppConfig | null {
  const appId = process.env.GITHUB_APP_ID;
  const rawKey = process.env.GITHUB_APP_PRIVATE_KEY;
  const slug = process.env.GITHUB_APP_SLUG;
  if (!appId || !rawKey || !slug) return null;
  return {
    appId,
    // Allow the PEM to be provided either raw (with real newlines) or with
    // escaped "\n" (common when stored in a single-line env var / secret).
    privateKey: rawKey.includes("\\n") ? rawKey.replace(/\\n/g, "\n") : rawKey,
    slug,
    clientId: process.env.GITHUB_APP_CLIENT_ID,
    clientSecret: process.env.GITHUB_APP_CLIENT_SECRET,
  };
}

export function isGitHubAppConfigured(): boolean {
  return getGitHubAppConfig() !== null;
}

/** The URL a user visits to install the App and pick repositories. */
export function getInstallUrl(state?: string): string | null {
  const cfg = getGitHubAppConfig();
  if (!cfg) return null;
  const base = `https://github.com/apps/${cfg.slug}/installations/new`;
  return state ? `${base}?state=${encodeURIComponent(state)}` : base;
}

/**
 * Mint a fresh installation access token for the given installation. Tokens are
 * short-lived; we always request a new one rather than caching, keeping the
 * blast radius of any leak minimal. octokit's auth-app handles the JWT signing.
 */
export async function getInstallationToken(
  installationId: number,
): Promise<string> {
  const cfg = getGitHubAppConfig();
  if (!cfg) {
    throw new Error("GitHub App is not configured on this server.");
  }
  const auth = createAppAuth({
    appId: cfg.appId,
    privateKey: cfg.privateKey,
    clientId: cfg.clientId,
    clientSecret: cfg.clientSecret,
  });
  const { token } = await auth({ type: "installation", installationId });
  return token;
}

export interface InstallationMeta {
  accountLogin: string | null;
  accountType: string | null;
  repositorySelection: string | null;
}

/**
 * Read an installation's account + repo-selection metadata using App-level
 * (JWT) auth. Called right after install to enrich the stored record.
 */
export async function getInstallationMeta(
  installationId: number,
): Promise<InstallationMeta> {
  const cfg = getGitHubAppConfig();
  if (!cfg) throw new Error("GitHub App is not configured on this server.");
  const octokit = new Octokit({
    authStrategy: createAppAuth,
    auth: {
      appId: cfg.appId,
      privateKey: cfg.privateKey,
      clientId: cfg.clientId,
      clientSecret: cfg.clientSecret,
    },
  });
  const { data } = await octokit.apps.getInstallation({
    installation_id: installationId,
  });
  const account = data.account as
    | { login?: string; type?: string }
    | null
    | undefined;
  return {
    accountLogin: account?.login ?? null,
    accountType: account?.type ?? null,
    repositorySelection: data.repository_selection ?? null,
  };
}
