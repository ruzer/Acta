-- AlterTable
ALTER TABLE "User" ADD COLUMN     "invitationOnly" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "allowNonNominalInvitations" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "ResponseInvitation" (
    "scopeSealed" BOOLEAN NOT NULL DEFAULT false,
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "respondentId" UUID NOT NULL,
    "createdById" UUID NOT NULL,
    "requestId" UUID NOT NULL,
    "label" TEXT NOT NULL,
    "recipientName" TEXT,
    "recipientEmail" TEXT,
    "recipientOrganization" TEXT,
    "nonNominal" BOOLEAN NOT NULL DEFAULT false,
    "areaId" UUID NOT NULL,
    "allowEvidence" BOOLEAN NOT NULL DEFAULT false,
    "tokenHash" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "revokedAt" TIMESTAMPTZ(3),
    "firstOpenedAt" TIMESTAMPTZ(3),
    "lockVersion" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ResponseInvitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvitationQuestion" (
    "projectId" UUID NOT NULL,
    "invitationId" UUID NOT NULL,
    "questionId" UUID NOT NULL,

    CONSTRAINT "InvitationQuestion_pkey" PRIMARY KEY ("invitationId","questionId")
);

-- CreateTable
CREATE TABLE "InvitationSession" (
    "id" UUID NOT NULL,
    "invitationId" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "lastSeenAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMPTZ(3),

    CONSTRAINT "InvitationSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvitationRateBucket" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "InvitationRateBucket_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "ResponseInvitation_respondentId_key" ON "ResponseInvitation"("respondentId");

-- CreateIndex
CREATE UNIQUE INDEX "ResponseInvitation_tokenHash_key" ON "ResponseInvitation"("tokenHash");

-- CreateIndex
CREATE INDEX "ResponseInvitation_projectId_createdAt_idx" ON "ResponseInvitation"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "ResponseInvitation_expiresAt_idx" ON "ResponseInvitation"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "ResponseInvitation_projectId_id_key" ON "ResponseInvitation"("projectId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "ResponseInvitation_createdById_requestId_key" ON "ResponseInvitation"("createdById", "requestId");

-- CreateIndex
CREATE INDEX "InvitationQuestion_projectId_questionId_idx" ON "InvitationQuestion"("projectId", "questionId");

-- CreateIndex
CREATE UNIQUE INDEX "InvitationSession_tokenHash_key" ON "InvitationSession"("tokenHash");

-- CreateIndex
CREATE INDEX "InvitationSession_invitationId_idx" ON "InvitationSession"("invitationId");

-- CreateIndex
CREATE INDEX "InvitationSession_expiresAt_idx" ON "InvitationSession"("expiresAt");

-- CreateIndex
CREATE INDEX "InvitationRateBucket_expiresAt_idx" ON "InvitationRateBucket"("expiresAt");

-- AddForeignKey
ALTER TABLE "ResponseInvitation" ADD CONSTRAINT "ResponseInvitation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "ResponseInvitation" ADD CONSTRAINT "ResponseInvitation_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "ResponseInvitation" ADD CONSTRAINT "ResponseInvitation_respondentId_fkey" FOREIGN KEY ("respondentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "ResponseInvitation" ADD CONSTRAINT "ResponseInvitation_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "ResponseInvitation" ADD CONSTRAINT "ResponseInvitation_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "Area"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "InvitationQuestion" ADD CONSTRAINT "InvitationQuestion_projectId_invitationId_fkey" FOREIGN KEY ("projectId", "invitationId") REFERENCES "ResponseInvitation"("projectId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "InvitationQuestion" ADD CONSTRAINT "InvitationQuestion_projectId_questionId_fkey" FOREIGN KEY ("projectId", "questionId") REFERENCES "Question"("projectId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "InvitationSession" ADD CONSTRAINT "InvitationSession_invitationId_fkey" FOREIGN KEY ("invitationId") REFERENCES "ResponseInvitation"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- An invited respondent is an encapsulated principal, never an ordinary account.
ALTER TABLE "User" ADD CONSTRAINT invitation_principal_no_credentials CHECK
 (NOT "invitationOnly" OR ("passwordHash" IS NULL AND NOT "isOrganizationAdmin" AND NOT "mustChangePassword"));
ALTER TABLE "ResponseInvitation" ADD CONSTRAINT invitation_lifetime CHECK ("expiresAt" > "createdAt" AND "lockVersion" >= 0);
ALTER TABLE "ResponseInvitation" ADD CONSTRAINT invitation_token_hash CHECK ("tokenHash" ~ '^[0-9a-f]{64}$');
ALTER TABLE "InvitationSession" ADD CONSTRAINT invitation_session_token_hash CHECK ("tokenHash" ~ '^[0-9a-f]{64}$');
ALTER TABLE "ResponseInvitation" ADD CONSTRAINT invitation_identity CHECK
 (("nonNominal" AND "recipientName" IS NULL AND "recipientEmail" IS NULL AND "recipientOrganization" IS NULL)
 OR (NOT "nonNominal" AND (coalesce(length("recipientName"),0) > 0 OR coalesce(length("recipientEmail"),0) > 0)));
ALTER TABLE "InvitationRateBucket" ADD CONSTRAINT invitation_bucket_valid CHECK (count > 0 AND key ~ '^[0-9a-f]{64}$');

CREATE FUNCTION protect_invitation_principal() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW."invitationOnly" IS DISTINCT FROM OLD."invitationOnly" THEN
  RAISE EXCEPTION 'Identity kind is immutable' USING ERRCODE='23514';
 END IF;
 IF OLD."invitationOnly" AND (NEW."organizationId" IS DISTINCT FROM OLD."organizationId" OR NEW.username IS DISTINCT FROM OLD.username) THEN
  RAISE EXCEPTION 'Invitation identity is immutable' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER protect_invitation_principal BEFORE UPDATE ON "User" FOR EACH ROW EXECUTE FUNCTION protect_invitation_principal();

CREATE FUNCTION forbid_invitation_account_session() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF EXISTS (SELECT 1 FROM "User" WHERE id=NEW."userId" AND "invitationOnly") THEN
  RAISE EXCEPTION 'Invitation cannot have an account session' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER account_session_only BEFORE INSERT OR UPDATE ON "Session" FOR EACH ROW EXECUTE FUNCTION forbid_invitation_account_session();

CREATE TRIGGER invitation_project_scope BEFORE INSERT OR UPDATE ON "ResponseInvitation" FOR EACH ROW EXECUTE FUNCTION enforce_organization_reference('projectId','Project');
CREATE TRIGGER invitation_respondent_scope BEFORE INSERT OR UPDATE ON "ResponseInvitation" FOR EACH ROW EXECUTE FUNCTION enforce_organization_reference('respondentId','User');
CREATE TRIGGER invitation_creator_scope BEFORE INSERT OR UPDATE ON "ResponseInvitation" FOR EACH ROW EXECUTE FUNCTION enforce_organization_reference('createdById','User');
CREATE TRIGGER invitation_area_scope BEFORE INSERT OR UPDATE ON "ResponseInvitation" FOR EACH ROW EXECUTE FUNCTION enforce_organization_reference('areaId','Area');

CREATE FUNCTION protect_invitation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM "User" WHERE id=NEW."respondentId" AND "invitationOnly")
 OR EXISTS (SELECT 1 FROM "User" WHERE id=NEW."createdById" AND "invitationOnly") THEN
  RAISE EXCEPTION 'Invalid invitation identities' USING ERRCODE='23514';
 END IF;
 IF TG_OP='UPDATE' THEN
  IF (to_jsonb(NEW) - ARRAY['tokenHash','expiresAt','revokedAt','firstOpenedAt','lockVersion','scopeSealed']) IS DISTINCT FROM
     (to_jsonb(OLD) - ARRAY['tokenHash','expiresAt','revokedAt','firstOpenedAt','lockVersion','scopeSealed'])
   OR (OLD."scopeSealed" AND NOT NEW."scopeSealed")
   OR (OLD."revokedAt" IS NOT NULL AND NEW."revokedAt" IS DISTINCT FROM OLD."revokedAt")
   OR (OLD."firstOpenedAt" IS NOT NULL AND NEW."firstOpenedAt" IS DISTINCT FROM OLD."firstOpenedAt") THEN
   RAISE EXCEPTION 'Invitation scope and history are immutable' USING ERRCODE='23514';
  END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER protect_invitation BEFORE INSERT OR UPDATE ON "ResponseInvitation" FOR EACH ROW EXECUTE FUNCTION protect_invitation();

CREATE FUNCTION require_invitation_sealed() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE sealed boolean; question_count integer;
BEGIN
 SELECT "scopeSealed" INTO sealed FROM "ResponseInvitation" WHERE id=NEW.id;
 SELECT count(*) INTO question_count FROM "InvitationQuestion" WHERE "invitationId"=NEW.id;
 IF NOT sealed OR question_count < 1 OR question_count > 500 THEN
  RAISE EXCEPTION 'Invitation needs a sealed explicit scope' USING ERRCODE='23514';
 END IF;
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER invitation_sealed_at_commit AFTER INSERT OR UPDATE ON "ResponseInvitation"
 DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION require_invitation_sealed();

CREATE FUNCTION invitation_scope_creation_only() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 PERFORM id FROM "ResponseInvitation" WHERE id=NEW."invitationId" FOR UPDATE;
 IF NOT EXISTS (SELECT 1 FROM "ResponseInvitation" WHERE id=NEW."invitationId" AND NOT "scopeSealed") THEN
  RAISE EXCEPTION 'Cannot expand an invitation' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER invitation_scope_creation_only BEFORE INSERT ON "InvitationQuestion" FOR EACH ROW EXECUTE FUNCTION invitation_scope_creation_only();
CREATE TRIGGER invitation_scope_immutable BEFORE UPDATE OR DELETE ON "InvitationQuestion" FOR EACH ROW EXECUTE FUNCTION deny_historical_change();

CREATE FUNCTION invitation_membership_scope() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF EXISTS (SELECT 1 FROM "User" WHERE id=NEW."userId" AND "invitationOnly")
 AND NOT EXISTS (SELECT 1 FROM "ResponseInvitation" WHERE "respondentId"=NEW."userId" AND "projectId"=NEW."projectId" AND "areaId"=NEW."areaId" AND NEW.role='STAKEHOLDER') THEN
  RAISE EXCEPTION 'Invitation membership cannot expand scope' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER invitation_membership_scope BEFORE INSERT OR UPDATE ON "ProjectMember" FOR EACH ROW EXECUTE FUNCTION invitation_membership_scope();

CREATE FUNCTION invitation_assignment_scope() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE invited boolean; respondent uuid;
BEGIN
 SELECT u."invitationOnly",u.id INTO invited,respondent FROM "ProjectMember" m JOIN "User" u ON u.id=m."userId" WHERE m.id=NEW."projectMemberId";
 IF invited AND NOT EXISTS (SELECT 1 FROM "ResponseInvitation" i JOIN "InvitationQuestion" q ON q."invitationId"=i.id WHERE i."respondentId"=respondent AND q."questionId"=NEW."questionId" AND q."projectId"=NEW."projectId") THEN
  RAISE EXCEPTION 'Question not in invitation scope' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER invitation_assignment_scope BEFORE INSERT OR UPDATE ON "QuestionAssignment" FOR EACH ROW EXECUTE FUNCTION invitation_assignment_scope();

GRANT SELECT,INSERT,UPDATE ON "ResponseInvitation","InvitationSession","InvitationRateBucket" TO requirements_app;
GRANT SELECT,INSERT ON "InvitationQuestion" TO requirements_app;
GRANT DELETE ON "InvitationRateBucket" TO requirements_app;
