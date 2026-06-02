import { prisma } from "@/infrastructure/db/prisma";
import { getInstallationToken } from "@/infrastructure/github/app-auth";

export interface InstallationRecord {
  id: string;
  installationId: number;
  accountLogin: string | null;
  accountType: string | null;
  repositorySelection: string | null;
  suspended: boolean;
  createdAt: Date;
}

/**
 * Persist (or refresh) a GitHub App installation for an org. Called from the
 * post-install callback. `installationId` is globally unique, so we upsert on
 * it — re-installing or re-configuring updates the same row.
 */
export async function saveInstallationForOrg(
  orgId: string,
  installationId: number,
  meta: {
    accountLogin?: string | null;
    accountType?: string | null;
    repositorySelection?: string | null;
  } = {},
): Promise<void> {
  await prisma.gitHubInstallation.upsert({
    where: { installationId },
    create: {
      orgId,
      installationId,
      accountLogin: meta.accountLogin ?? null,
      accountType: meta.accountType ?? null,
      repositorySelection: meta.repositorySelection ?? null,
    },
    update: {
      orgId,
      suspended: false,
      ...(meta.accountLogin !== undefined
        ? { accountLogin: meta.accountLogin }
        : {}),
      ...(meta.accountType !== undefined
        ? { accountType: meta.accountType }
        : {}),
      ...(meta.repositorySelection !== undefined
        ? { repositorySelection: meta.repositorySelection }
        : {}),
    },
  });
}

export async function listInstallationsForOrg(
  orgId: string,
): Promise<InstallationRecord[]> {
  const rows = await prisma.gitHubInstallation.findMany({
    where: { orgId },
    orderBy: { createdAt: "desc" },
  });
  return rows.map((r) => ({
    id: r.id,
    installationId: r.installationId,
    accountLogin: r.accountLogin,
    accountType: r.accountType,
    repositorySelection: r.repositorySelection,
    suspended: r.suspended,
    createdAt: r.createdAt,
  }));
}

/** The installation we use for repo access — newest active one wins. */
export async function getPrimaryInstallationForOrg(
  orgId: string,
): Promise<InstallationRecord | null> {
  const row = await prisma.gitHubInstallation.findFirst({
    where: { orgId, suspended: false },
    orderBy: { createdAt: "desc" },
  });
  if (!row) return null;
  return {
    id: row.id,
    installationId: row.installationId,
    accountLogin: row.accountLogin,
    accountType: row.accountType,
    repositorySelection: row.repositorySelection,
    suspended: row.suspended,
    createdAt: row.createdAt,
  };
}

/** Mint a fresh installation token for the org's active installation. */
export async function getInstallationTokenForOrg(
  orgId: string,
): Promise<string | null> {
  const installation = await getPrimaryInstallationForOrg(orgId);
  if (!installation) return null;
  return getInstallationToken(installation.installationId);
}

/** Forget an installation locally (record only; user revokes on GitHub). */
export async function deleteInstallationForOrg(
  orgId: string,
  id: string,
): Promise<boolean> {
  const result = await prisma.gitHubInstallation.deleteMany({
    where: { id, orgId },
  });
  return result.count > 0;
}

/** Mark an installation suspended/deleted — used by the webhook handler. */
export async function markInstallationSuspended(
  installationId: number,
  suspended: boolean,
): Promise<void> {
  await prisma.gitHubInstallation.updateMany({
    where: { installationId },
    data: { suspended },
  });
}

export async function deleteInstallationById(
  installationId: number,
): Promise<void> {
  await prisma.gitHubInstallation.deleteMany({ where: { installationId } });
}
