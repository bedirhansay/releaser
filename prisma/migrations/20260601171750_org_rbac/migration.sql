-- CreateEnum
CREATE TYPE "Role" AS ENUM ('OWNER', 'ADMIN', 'MEMBER');

-- DropForeignKey
ALTER TABLE "AiSetting" DROP CONSTRAINT "AiSetting_userId_fkey";

-- DropForeignKey
ALTER TABLE "GitConnection" DROP CONSTRAINT "GitConnection_userId_fkey";

-- DropForeignKey
ALTER TABLE "GitHubInstallation" DROP CONSTRAINT "GitHubInstallation_userId_fkey";

-- DropForeignKey
ALTER TABLE "Project" DROP CONSTRAINT "Project_userId_fkey";

-- DropForeignKey
ALTER TABLE "ReleaseHistory" DROP CONSTRAINT "ReleaseHistory_userId_fkey";

-- DropForeignKey
ALTER TABLE "ReleaseTemplate" DROP CONSTRAINT "ReleaseTemplate_userId_fkey";

-- DropIndex
DROP INDEX "AiSetting_userId_key";

-- DropIndex
DROP INDEX "GitConnection_userId_provider_key";

-- DropIndex
DROP INDEX "GitHubInstallation_userId_idx";

-- DropIndex
DROP INDEX "Project_userId_idx";

-- DropIndex
DROP INDEX "Project_userId_name_key";

-- DropIndex
DROP INDEX "ReleaseHistory_userId_createdAt_idx";

-- DropIndex
DROP INDEX "ReleaseHistory_userId_repoOwner_repoName_idx";

-- DropIndex
DROP INDEX "ReleaseTemplate_userId_idx";

-- AlterTable
ALTER TABLE "AiSetting" DROP COLUMN "userId",
ADD COLUMN     "orgId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "GitConnection" DROP COLUMN "userId",
ADD COLUMN     "orgId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "GitHubInstallation" DROP COLUMN "userId",
ADD COLUMN     "orgId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Project" DROP COLUMN "userId",
ADD COLUMN     "createdById" TEXT,
ADD COLUMN     "orgId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "ReleaseHistory" DROP COLUMN "userId",
ADD COLUMN     "createdById" TEXT,
ADD COLUMN     "orgId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "ReleaseTemplate" DROP COLUMN "userId",
ADD COLUMN     "createdById" TEXT,
ADD COLUMN     "orgId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "passwordHash" TEXT;

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Membership" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'MEMBER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Membership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Group" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Group_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroupMember" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GroupMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectAccess" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "groupId" TEXT,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectAccess_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");

-- CreateIndex
CREATE INDEX "Membership_orgId_idx" ON "Membership"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "Membership_userId_orgId_key" ON "Membership"("userId", "orgId");

-- CreateIndex
CREATE INDEX "Group_orgId_idx" ON "Group"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "Group_orgId_name_key" ON "Group"("orgId", "name");

-- CreateIndex
CREATE INDEX "GroupMember_userId_idx" ON "GroupMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "GroupMember_groupId_userId_key" ON "GroupMember"("groupId", "userId");

-- CreateIndex
CREATE INDEX "ProjectAccess_projectId_idx" ON "ProjectAccess"("projectId");

-- CreateIndex
CREATE INDEX "ProjectAccess_groupId_idx" ON "ProjectAccess"("groupId");

-- CreateIndex
CREATE INDEX "ProjectAccess_userId_idx" ON "ProjectAccess"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectAccess_projectId_groupId_key" ON "ProjectAccess"("projectId", "groupId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectAccess_projectId_userId_key" ON "ProjectAccess"("projectId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "AiSetting_orgId_key" ON "AiSetting"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "GitConnection_orgId_provider_key" ON "GitConnection"("orgId", "provider");

-- CreateIndex
CREATE INDEX "GitHubInstallation_orgId_idx" ON "GitHubInstallation"("orgId");

-- CreateIndex
CREATE INDEX "Project_orgId_idx" ON "Project"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "Project_orgId_name_key" ON "Project"("orgId", "name");

-- CreateIndex
CREATE INDEX "ReleaseHistory_orgId_createdAt_idx" ON "ReleaseHistory"("orgId", "createdAt");

-- CreateIndex
CREATE INDEX "ReleaseHistory_orgId_repoOwner_repoName_idx" ON "ReleaseHistory"("orgId", "repoOwner", "repoName");

-- CreateIndex
CREATE INDEX "ReleaseTemplate_orgId_idx" ON "ReleaseTemplate"("orgId");

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Group" ADD CONSTRAINT "Group_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupMember" ADD CONSTRAINT "GroupMember_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupMember" ADD CONSTRAINT "GroupMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectAccess" ADD CONSTRAINT "ProjectAccess_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectAccess" ADD CONSTRAINT "ProjectAccess_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectAccess" ADD CONSTRAINT "ProjectAccess_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GitHubInstallation" ADD CONSTRAINT "GitHubInstallation_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiSetting" ADD CONSTRAINT "AiSetting_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GitConnection" ADD CONSTRAINT "GitConnection_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReleaseTemplate" ADD CONSTRAINT "ReleaseTemplate_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReleaseTemplate" ADD CONSTRAINT "ReleaseTemplate_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReleaseHistory" ADD CONSTRAINT "ReleaseHistory_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReleaseHistory" ADD CONSTRAINT "ReleaseHistory_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

