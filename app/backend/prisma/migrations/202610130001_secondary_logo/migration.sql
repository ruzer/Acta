-- Optional second logo (an area or collaborating entity) and its name. Additive only:
-- no existing row, logo or saved choice changes, and installations without a second logo are unaffected.
ALTER TYPE "BrandingAssetKind" ADD VALUE 'LOGO_SECONDARY';

ALTER TABLE "OrganizationSettings" ADD COLUMN "secondaryName" TEXT;
