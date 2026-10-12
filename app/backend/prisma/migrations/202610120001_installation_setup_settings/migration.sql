-- CreateEnum
CREATE TYPE "SetupState" AS ENUM ('PENDING', 'COMPLETED');

-- CreateEnum
CREATE TYPE "BrandingAssetKind" AS ENUM ('LOGO', 'FAVICON');

-- CreateTable
CREATE TABLE "InstallationSetup" (
    "id" TEXT NOT NULL DEFAULT 'installation',
    "state" "SetupState" NOT NULL DEFAULT 'PENDING',
    "tokenHash" TEXT,
    "tokenIssuedAt" TIMESTAMPTZ(3),
    "tokenExpiresAt" TIMESTAMPTZ(3),
    "completedAt" TIMESTAMPTZ(3),
    "completedById" UUID,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "InstallationSetup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganizationSettings" (
    "organizationId" UUID NOT NULL,
    "appName" TEXT,
    "shortName" TEXT,
    "accent" TEXT,
    "locale" TEXT,
    "timezone" TEXT,
    "lockVersion" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "updatedById" UUID,

    CONSTRAINT "OrganizationSettings_pkey" PRIMARY KEY ("organizationId")
);

-- CreateTable
CREATE TABLE "BrandingAsset" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "kind" "BrandingAssetKind" NOT NULL,
    "contentType" TEXT NOT NULL,
    "byteSize" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "content" BYTEA NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" UUID NOT NULL,

    CONSTRAINT "BrandingAsset_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BrandingAsset_organizationId_kind_key" ON "BrandingAsset"("organizationId", "kind");

-- AddForeignKey
ALTER TABLE "InstallationSetup" ADD CONSTRAINT "InstallationSetup_completedById_fkey" FOREIGN KEY ("completedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "OrganizationSettings" ADD CONSTRAINT "OrganizationSettings_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "OrganizationSettings" ADD CONSTRAINT "OrganizationSettings_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "BrandingAsset" ADD CONSTRAINT "BrandingAsset_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "BrandingAsset" ADD CONSTRAINT "BrandingAsset_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- The installation has exactly one setup record, and a stored image stays small.
ALTER TABLE "InstallationSetup" ADD CONSTRAINT "InstallationSetup_single_row" CHECK ("id" = 'installation');
ALTER TABLE "InstallationSetup" ADD CONSTRAINT "InstallationSetup_completed_has_time" CHECK ("state" <> 'COMPLETED' OR "completedAt" IS NOT NULL);
ALTER TABLE "BrandingAsset" ADD CONSTRAINT "BrandingAsset_size" CHECK ("byteSize" = octet_length("content") AND "byteSize" BETWEEN 1 AND 524288);

-- Installations that already have an administrator never see the first-run wizard.
INSERT INTO "InstallationSetup" ("id", "state", "completedAt", "updatedAt")
SELECT 'installation', 'COMPLETED', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE EXISTS (SELECT 1 FROM "User" WHERE "isOrganizationAdmin");

-- Runtime role: the setup row and the settings are never deleted.
GRANT SELECT, INSERT, UPDATE ON "InstallationSetup", "OrganizationSettings" TO requirements_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON "BrandingAsset" TO requirements_app;
