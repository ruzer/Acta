-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "ProjectRole" AS ENUM ('ADMIN', 'ANALYST', 'STAKEHOLDER', 'VIEWER');

-- CreateEnum
CREATE TYPE "Priority" AS ENUM ('P0', 'P1', 'P2', 'P3');

-- CreateEnum
CREATE TYPE "QuestionType" AS ENUM ('YES_NO', 'SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'SHORT_TEXT', 'LONG_TEXT', 'DATE', 'NUMBER', 'MATRIX');

-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('NOT_REVIEWED', 'PENDING', 'PARTIAL', 'ANSWERED', 'CLARIFICATION_REQUIRED', 'VALIDATED', 'NOT_APPLICABLE', 'CONFLICT');

-- CreateEnum
CREATE TYPE "RevisionStatus" AS ENUM ('SUBMITTED');

-- CreateEnum
CREATE TYPE "ReferenceType" AS ENUM ('QUESTION', 'BUSINESS_RULE', 'REQUIREMENT', 'CAPABILITY', 'WORKFLOW', 'DOCUMENT', 'CODE', 'OTHER');

-- CreateEnum
CREATE TYPE "ConditionOperator" AS ENUM ('EQUALS', 'NOT_EQUALS', 'CONTAINS');

-- CreateEnum
CREATE TYPE "ProjectLifecycle" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "QuestionPublication" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ThreadStatus" AS ENUM ('WAITING_STAKEHOLDER', 'WAITING_ANALYST', 'CLOSED');

-- CreateEnum
CREATE TYPE "ConflictStatus" AS ENUM ('OPEN', 'RESOLVED');

-- CreateEnum
CREATE TYPE "EvidenceStatus" AS ENUM ('STAGED', 'READY', 'QUARANTINED', 'REJECTED');

-- CreateEnum
CREATE TYPE "StorageBackend" AS ENUM ('LOCAL', 'MINIO');

-- CreateTable
CREATE TABLE "Organization" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "username" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "passwordHash" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT true,
    "isOrganizationAdmin" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "csrfSecretHash" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "revokedAt" TIMESTAMPTZ(3),

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoginAttempt" (
    "id" UUID NOT NULL,
    "accountKeyHash" TEXT NOT NULL,
    "ipKeyHash" TEXT NOT NULL,
    "occurredAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "success" BOOLEAN NOT NULL,

    CONSTRAINT "LoginAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Area" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Area_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "externalId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "lifecycle" "ProjectLifecycle" NOT NULL DEFAULT 'ACTIVE',
    "lockVersion" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectMember" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "role" "ProjectRole" NOT NULL,
    "areaId" UUID,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ProjectMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Section" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "externalId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "order" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Section_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Question" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "sectionId" UUID NOT NULL,
    "externalId" TEXT NOT NULL,
    "groupParentId" UUID,
    "supersedesQuestionId" UUID,
    "responsibleAreaId" UUID NOT NULL,
    "priority" "Priority" NOT NULL,
    "order" INTEGER NOT NULL,
    "status" "ReviewStatus" NOT NULL DEFAULT 'NOT_REVIEWED',
    "publication" "QuestionPublication" NOT NULL DEFAULT 'DRAFT',
    "publishedRevisionNumber" INTEGER,
    "currentRevisionNumber" INTEGER NOT NULL DEFAULT 1,
    "pendingReview" BOOLEAN NOT NULL DEFAULT false,
    "partialReviewReason" TEXT,
    "lockVersion" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Question_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestionRevision" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "questionId" UUID NOT NULL,
    "number" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "helpText" TEXT NOT NULL DEFAULT '',
    "type" "QuestionType" NOT NULL,
    "required" BOOLEAN NOT NULL,
    "config" JSONB,
    "sourceLocator" JSONB,
    "snapshot" JSONB NOT NULL,
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuestionRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestionOption" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "questionRevisionId" UUID NOT NULL,
    "value" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "order" INTEGER NOT NULL,

    CONSTRAINT "QuestionOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestionCondition" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "parentQuestionId" UUID NOT NULL,
    "childQuestionId" UUID NOT NULL,
    "operator" "ConditionOperator" NOT NULL,
    "value" JSONB NOT NULL,

    CONSTRAINT "QuestionCondition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestionAssignment" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "questionId" UUID NOT NULL,
    "projectMemberId" UUID NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "QuestionAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TraceabilityReference" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "type" "ReferenceType" NOT NULL,
    "externalId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "url" TEXT,
    "priority" "Priority",
    "description" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "TraceabilityReference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestionTraceability" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "questionId" UUID NOT NULL,
    "referenceId" UUID NOT NULL,
    "scopeNote" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "QuestionTraceability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Response" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "questionId" UUID NOT NULL,
    "respondentId" UUID NOT NULL,
    "lockVersion" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Response_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResponseDraft" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "responseId" UUID NOT NULL,
    "basedOnRevisionId" UUID,
    "questionRevisionId" UUID NOT NULL,
    "answer" JSONB,
    "comment" TEXT,
    "example" TEXT,
    "areaId" UUID NOT NULL,
    "conditionContext" JSONB NOT NULL,
    "consultationRequested" BOOLEAN NOT NULL DEFAULT false,
    "lockVersion" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ResponseDraft_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResponseRevision" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "responseId" UUID NOT NULL,
    "questionRevisionId" UUID NOT NULL,
    "number" INTEGER NOT NULL,
    "status" "RevisionStatus" NOT NULL DEFAULT 'SUBMITTED',
    "answer" JSONB,
    "comment" TEXT,
    "example" TEXT,
    "areaId" UUID NOT NULL,
    "respondentSnapshot" JSONB NOT NULL,
    "areaSnapshot" JSONB NOT NULL,
    "conditionContext" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResponseRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Evidence" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "responseId" UUID NOT NULL,
    "uploadedById" UUID NOT NULL,
    "originalName" TEXT NOT NULL,
    "detectedMimeType" TEXT NOT NULL,
    "byteSize" BIGINT NOT NULL,
    "sha256" CHAR(64) NOT NULL,
    "backend" "StorageBackend" NOT NULL,
    "storageKey" TEXT NOT NULL,
    "status" "EvidenceStatus" NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Evidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DraftEvidence" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "responseDraftId" UUID NOT NULL,
    "evidenceId" UUID NOT NULL,

    CONSTRAINT "DraftEvidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RevisionEvidence" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "responseRevisionId" UUID NOT NULL,
    "evidenceId" UUID NOT NULL,

    CONSTRAINT "RevisionEvidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClarificationThread" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "responseRevisionId" UUID NOT NULL,
    "requestedById" UUID NOT NULL,
    "status" "ThreadStatus" NOT NULL,
    "lockVersion" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMPTZ(3),
    "closedById" UUID,
    "closeReason" TEXT,

    CONSTRAINT "ClarificationThread_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClarificationMessage" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "threadId" UUID NOT NULL,
    "authorId" UUID NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClarificationMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Validation" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "questionId" UUID NOT NULL,
    "decisionText" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "exceptions" TEXT,
    "validationComment" TEXT NOT NULL,
    "validatedById" UUID NOT NULL,
    "validatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "invalidatedAt" TIMESTAMPTZ(3),
    "invalidatedById" UUID,
    "invalidationReason" TEXT,

    CONSTRAINT "Validation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ValidationSource" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "validationId" UUID NOT NULL,
    "responseRevisionId" UUID NOT NULL,

    CONSTRAINT "ValidationSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ValidationMessage" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "validationId" UUID NOT NULL,
    "clarificationMessageId" UUID NOT NULL,

    CONSTRAINT "ValidationMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Conflict" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "questionId" UUID NOT NULL,
    "reason" TEXT NOT NULL,
    "openedById" UUID NOT NULL,
    "openedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "ConflictStatus" NOT NULL,
    "lockVersion" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Conflict_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConflictParticipant" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "conflictId" UUID NOT NULL,
    "responseRevisionId" UUID NOT NULL,

    CONSTRAINT "ConflictParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConflictResolution" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "conflictId" UUID NOT NULL,
    "resolutionText" TEXT NOT NULL,
    "resolvedById" UUID NOT NULL,
    "resolvedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConflictResolution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConflictResolutionSource" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "resolutionId" UUID NOT NULL,
    "responseRevisionId" UUID NOT NULL,

    CONSTRAINT "ConflictResolutionSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ValidationResolution" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "validationId" UUID NOT NULL,
    "conflictResolutionId" UUID NOT NULL,

    CONSTRAINT "ValidationResolution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestionDisposition" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "questionId" UUID NOT NULL,
    "reason" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "markedById" UUID NOT NULL,
    "markedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMPTZ(3),
    "revokedById" UUID,
    "revokeReason" TEXT,

    CONSTRAINT "QuestionDisposition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "projectId" UUID,
    "actorId" UUID NOT NULL,
    "actorSnapshot" JSONB NOT NULL,
    "action" TEXT NOT NULL,
    "objectType" TEXT NOT NULL,
    "objectId" TEXT NOT NULL,
    "occurredAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "before" JSONB,
    "after" JSONB,
    "requestId" TEXT NOT NULL,
    "payloadHash" TEXT,
    "eventIndex" INTEGER NOT NULL DEFAULT 0,
    "result" JSONB,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportBatch" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "formatVersion" TEXT NOT NULL,
    "sourceSha256" TEXT NOT NULL,
    "importedById" UUID NOT NULL,
    "importedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "counts" JSONB NOT NULL,
    "requestId" TEXT NOT NULL,

    CONSTRAINT "ImportBatch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Organization_code_key" ON "Organization"("code");

-- CreateIndex
CREATE UNIQUE INDEX "User_organizationId_username_key" ON "User"("organizationId", "username");

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

-- CreateIndex
CREATE INDEX "LoginAttempt_accountKeyHash_occurredAt_idx" ON "LoginAttempt"("accountKeyHash", "occurredAt");

-- CreateIndex
CREATE INDEX "LoginAttempt_ipKeyHash_occurredAt_idx" ON "LoginAttempt"("ipKeyHash", "occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "Area_organizationId_code_key" ON "Area"("organizationId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "Project_organizationId_externalId_key" ON "Project"("organizationId", "externalId");

-- CreateIndex
CREATE INDEX "ProjectMember_projectId_idx" ON "ProjectMember"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectMember_projectId_id_key" ON "ProjectMember"("projectId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectMember_projectId_userId_key" ON "ProjectMember"("projectId", "userId");

-- CreateIndex
CREATE INDEX "Section_projectId_idx" ON "Section"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "Section_projectId_id_key" ON "Section"("projectId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Section_projectId_externalId_key" ON "Section"("projectId", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "Section_projectId_order_key" ON "Section"("projectId", "order");

-- CreateIndex
CREATE INDEX "Question_projectId_idx" ON "Question"("projectId");

-- CreateIndex
CREATE INDEX "Question_projectId_status_priority_idx" ON "Question"("projectId", "status", "priority");

-- CreateIndex
CREATE UNIQUE INDEX "Question_projectId_id_key" ON "Question"("projectId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Question_projectId_externalId_key" ON "Question"("projectId", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "Question_sectionId_order_key" ON "Question"("sectionId", "order");

-- CreateIndex
CREATE INDEX "QuestionRevision_projectId_idx" ON "QuestionRevision"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "QuestionRevision_projectId_id_key" ON "QuestionRevision"("projectId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "QuestionRevision_questionId_number_key" ON "QuestionRevision"("questionId", "number");

-- CreateIndex
CREATE INDEX "QuestionOption_projectId_idx" ON "QuestionOption"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "QuestionOption_projectId_id_key" ON "QuestionOption"("projectId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "QuestionOption_questionRevisionId_value_key" ON "QuestionOption"("questionRevisionId", "value");

-- CreateIndex
CREATE UNIQUE INDEX "QuestionOption_questionRevisionId_order_key" ON "QuestionOption"("questionRevisionId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "QuestionCondition_childQuestionId_key" ON "QuestionCondition"("childQuestionId");

-- CreateIndex
CREATE INDEX "QuestionCondition_projectId_idx" ON "QuestionCondition"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "QuestionCondition_projectId_id_key" ON "QuestionCondition"("projectId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "QuestionCondition_projectId_childQuestionId_key" ON "QuestionCondition"("projectId", "childQuestionId");

-- CreateIndex
CREATE INDEX "QuestionAssignment_projectId_idx" ON "QuestionAssignment"("projectId");

-- CreateIndex
CREATE INDEX "QuestionAssignment_projectMemberId_active_idx" ON "QuestionAssignment"("projectMemberId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "QuestionAssignment_projectId_id_key" ON "QuestionAssignment"("projectId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "QuestionAssignment_questionId_projectMemberId_key" ON "QuestionAssignment"("questionId", "projectMemberId");

-- CreateIndex
CREATE INDEX "TraceabilityReference_projectId_idx" ON "TraceabilityReference"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "TraceabilityReference_projectId_id_key" ON "TraceabilityReference"("projectId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "TraceabilityReference_projectId_type_externalId_key" ON "TraceabilityReference"("projectId", "type", "externalId");

-- CreateIndex
CREATE INDEX "QuestionTraceability_projectId_idx" ON "QuestionTraceability"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "QuestionTraceability_projectId_id_key" ON "QuestionTraceability"("projectId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "QuestionTraceability_questionId_referenceId_key" ON "QuestionTraceability"("questionId", "referenceId");

-- CreateIndex
CREATE INDEX "Response_projectId_idx" ON "Response"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "Response_projectId_id_key" ON "Response"("projectId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Response_questionId_respondentId_key" ON "Response"("questionId", "respondentId");

-- CreateIndex
CREATE UNIQUE INDEX "ResponseDraft_responseId_key" ON "ResponseDraft"("responseId");

-- CreateIndex
CREATE INDEX "ResponseDraft_projectId_idx" ON "ResponseDraft"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "ResponseDraft_projectId_id_key" ON "ResponseDraft"("projectId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "ResponseDraft_projectId_responseId_key" ON "ResponseDraft"("projectId", "responseId");

-- CreateIndex
CREATE INDEX "ResponseRevision_projectId_idx" ON "ResponseRevision"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "ResponseRevision_projectId_id_key" ON "ResponseRevision"("projectId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "ResponseRevision_responseId_number_key" ON "ResponseRevision"("responseId", "number");

-- CreateIndex
CREATE INDEX "Evidence_projectId_idx" ON "Evidence"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "Evidence_projectId_id_key" ON "Evidence"("projectId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Evidence_backend_storageKey_key" ON "Evidence"("backend", "storageKey");

-- CreateIndex
CREATE INDEX "DraftEvidence_projectId_idx" ON "DraftEvidence"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "DraftEvidence_projectId_id_key" ON "DraftEvidence"("projectId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "DraftEvidence_responseDraftId_evidenceId_key" ON "DraftEvidence"("responseDraftId", "evidenceId");

-- CreateIndex
CREATE INDEX "RevisionEvidence_projectId_idx" ON "RevisionEvidence"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "RevisionEvidence_projectId_id_key" ON "RevisionEvidence"("projectId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "RevisionEvidence_responseRevisionId_evidenceId_key" ON "RevisionEvidence"("responseRevisionId", "evidenceId");

-- CreateIndex
CREATE INDEX "ClarificationThread_projectId_idx" ON "ClarificationThread"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "ClarificationThread_projectId_id_key" ON "ClarificationThread"("projectId", "id");

-- CreateIndex
CREATE INDEX "ClarificationMessage_projectId_idx" ON "ClarificationMessage"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "ClarificationMessage_projectId_id_key" ON "ClarificationMessage"("projectId", "id");

-- CreateIndex
CREATE INDEX "Validation_projectId_idx" ON "Validation"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "Validation_projectId_id_key" ON "Validation"("projectId", "id");

-- CreateIndex
CREATE INDEX "ValidationSource_projectId_idx" ON "ValidationSource"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "ValidationSource_projectId_id_key" ON "ValidationSource"("projectId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "ValidationSource_validationId_responseRevisionId_key" ON "ValidationSource"("validationId", "responseRevisionId");

-- CreateIndex
CREATE INDEX "ValidationMessage_projectId_idx" ON "ValidationMessage"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "ValidationMessage_projectId_id_key" ON "ValidationMessage"("projectId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "ValidationMessage_validationId_clarificationMessageId_key" ON "ValidationMessage"("validationId", "clarificationMessageId");

-- CreateIndex
CREATE INDEX "Conflict_projectId_idx" ON "Conflict"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "Conflict_projectId_id_key" ON "Conflict"("projectId", "id");

-- CreateIndex
CREATE INDEX "ConflictParticipant_projectId_idx" ON "ConflictParticipant"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "ConflictParticipant_projectId_id_key" ON "ConflictParticipant"("projectId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "ConflictParticipant_conflictId_responseRevisionId_key" ON "ConflictParticipant"("conflictId", "responseRevisionId");

-- CreateIndex
CREATE UNIQUE INDEX "ConflictResolution_conflictId_key" ON "ConflictResolution"("conflictId");

-- CreateIndex
CREATE INDEX "ConflictResolution_projectId_idx" ON "ConflictResolution"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "ConflictResolution_projectId_id_key" ON "ConflictResolution"("projectId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "ConflictResolution_projectId_conflictId_key" ON "ConflictResolution"("projectId", "conflictId");

-- CreateIndex
CREATE INDEX "ConflictResolutionSource_projectId_idx" ON "ConflictResolutionSource"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "ConflictResolutionSource_projectId_id_key" ON "ConflictResolutionSource"("projectId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "ConflictResolutionSource_resolutionId_responseRevisionId_key" ON "ConflictResolutionSource"("resolutionId", "responseRevisionId");

-- CreateIndex
CREATE INDEX "ValidationResolution_projectId_idx" ON "ValidationResolution"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "ValidationResolution_projectId_id_key" ON "ValidationResolution"("projectId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "ValidationResolution_validationId_conflictResolutionId_key" ON "ValidationResolution"("validationId", "conflictResolutionId");

-- CreateIndex
CREATE INDEX "QuestionDisposition_projectId_idx" ON "QuestionDisposition"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "QuestionDisposition_projectId_id_key" ON "QuestionDisposition"("projectId", "id");

-- CreateIndex
CREATE INDEX "AuditEvent_projectId_occurredAt_id_idx" ON "AuditEvent"("projectId", "occurredAt", "id");

-- CreateIndex
CREATE UNIQUE INDEX "AuditEvent_organizationId_actorId_requestId_eventIndex_key" ON "AuditEvent"("organizationId", "actorId", "requestId", "eventIndex");

-- CreateIndex
CREATE INDEX "ImportBatch_projectId_idx" ON "ImportBatch"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "ImportBatch_projectId_id_key" ON "ImportBatch"("projectId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "ImportBatch_projectId_sourceSha256_key" ON "ImportBatch"("projectId", "sourceSha256");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "Area" ADD CONSTRAINT "Area_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "ProjectMember" ADD CONSTRAINT "ProjectMember_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "ProjectMember" ADD CONSTRAINT "ProjectMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "ProjectMember" ADD CONSTRAINT "ProjectMember_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "Area"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "Section" ADD CONSTRAINT "Section_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "Question" ADD CONSTRAINT "Question_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "Question" ADD CONSTRAINT "Question_projectId_sectionId_fkey" FOREIGN KEY ("projectId", "sectionId") REFERENCES "Section"("projectId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "Question" ADD CONSTRAINT "Question_projectId_groupParentId_fkey" FOREIGN KEY ("projectId", "groupParentId") REFERENCES "Question"("projectId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "Question" ADD CONSTRAINT "Question_projectId_supersedesQuestionId_fkey" FOREIGN KEY ("projectId", "supersedesQuestionId") REFERENCES "Question"("projectId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "Question" ADD CONSTRAINT "Question_responsibleAreaId_fkey" FOREIGN KEY ("responsibleAreaId") REFERENCES "Area"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "QuestionRevision" ADD CONSTRAINT "QuestionRevision_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "QuestionRevision" ADD CONSTRAINT "QuestionRevision_projectId_questionId_fkey" FOREIGN KEY ("projectId", "questionId") REFERENCES "Question"("projectId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "QuestionRevision" ADD CONSTRAINT "QuestionRevision_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "QuestionOption" ADD CONSTRAINT "QuestionOption_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "QuestionOption" ADD CONSTRAINT "QuestionOption_projectId_questionRevisionId_fkey" FOREIGN KEY ("projectId", "questionRevisionId") REFERENCES "QuestionRevision"("projectId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "QuestionCondition" ADD CONSTRAINT "QuestionCondition_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "QuestionCondition" ADD CONSTRAINT "QuestionCondition_projectId_parentQuestionId_fkey" FOREIGN KEY ("projectId", "parentQuestionId") REFERENCES "Question"("projectId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "QuestionCondition" ADD CONSTRAINT "QuestionCondition_projectId_childQuestionId_fkey" FOREIGN KEY ("projectId", "childQuestionId") REFERENCES "Question"("projectId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "QuestionAssignment" ADD CONSTRAINT "QuestionAssignment_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "QuestionAssignment" ADD CONSTRAINT "QuestionAssignment_projectId_questionId_fkey" FOREIGN KEY ("projectId", "questionId") REFERENCES "Question"("projectId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "QuestionAssignment" ADD CONSTRAINT "QuestionAssignment_projectId_projectMemberId_fkey" FOREIGN KEY ("projectId", "projectMemberId") REFERENCES "ProjectMember"("projectId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "TraceabilityReference" ADD CONSTRAINT "TraceabilityReference_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "QuestionTraceability" ADD CONSTRAINT "QuestionTraceability_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "QuestionTraceability" ADD CONSTRAINT "QuestionTraceability_projectId_questionId_fkey" FOREIGN KEY ("projectId", "questionId") REFERENCES "Question"("projectId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "QuestionTraceability" ADD CONSTRAINT "QuestionTraceability_projectId_referenceId_fkey" FOREIGN KEY ("projectId", "referenceId") REFERENCES "TraceabilityReference"("projectId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "Response" ADD CONSTRAINT "Response_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "Response" ADD CONSTRAINT "Response_projectId_questionId_fkey" FOREIGN KEY ("projectId", "questionId") REFERENCES "Question"("projectId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "Response" ADD CONSTRAINT "Response_respondentId_fkey" FOREIGN KEY ("respondentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "ResponseDraft" ADD CONSTRAINT "ResponseDraft_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "ResponseDraft" ADD CONSTRAINT "ResponseDraft_projectId_responseId_fkey" FOREIGN KEY ("projectId", "responseId") REFERENCES "Response"("projectId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "ResponseDraft" ADD CONSTRAINT "ResponseDraft_projectId_basedOnRevisionId_fkey" FOREIGN KEY ("projectId", "basedOnRevisionId") REFERENCES "ResponseRevision"("projectId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "ResponseDraft" ADD CONSTRAINT "ResponseDraft_projectId_questionRevisionId_fkey" FOREIGN KEY ("projectId", "questionRevisionId") REFERENCES "QuestionRevision"("projectId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "ResponseDraft" ADD CONSTRAINT "ResponseDraft_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "Area"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "ResponseRevision" ADD CONSTRAINT "ResponseRevision_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "ResponseRevision" ADD CONSTRAINT "ResponseRevision_projectId_responseId_fkey" FOREIGN KEY ("projectId", "responseId") REFERENCES "Response"("projectId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "ResponseRevision" ADD CONSTRAINT "ResponseRevision_projectId_questionRevisionId_fkey" FOREIGN KEY ("projectId", "questionRevisionId") REFERENCES "QuestionRevision"("projectId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "ResponseRevision" ADD CONSTRAINT "ResponseRevision_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "Area"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_projectId_responseId_fkey" FOREIGN KEY ("projectId", "responseId") REFERENCES "Response"("projectId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "DraftEvidence" ADD CONSTRAINT "DraftEvidence_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "DraftEvidence" ADD CONSTRAINT "DraftEvidence_projectId_responseDraftId_fkey" FOREIGN KEY ("projectId", "responseDraftId") REFERENCES "ResponseDraft"("projectId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "DraftEvidence" ADD CONSTRAINT "DraftEvidence_projectId_evidenceId_fkey" FOREIGN KEY ("projectId", "evidenceId") REFERENCES "Evidence"("projectId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "RevisionEvidence" ADD CONSTRAINT "RevisionEvidence_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "RevisionEvidence" ADD CONSTRAINT "RevisionEvidence_projectId_responseRevisionId_fkey" FOREIGN KEY ("projectId", "responseRevisionId") REFERENCES "ResponseRevision"("projectId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "RevisionEvidence" ADD CONSTRAINT "RevisionEvidence_projectId_evidenceId_fkey" FOREIGN KEY ("projectId", "evidenceId") REFERENCES "Evidence"("projectId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "ClarificationThread" ADD CONSTRAINT "ClarificationThread_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "ClarificationThread" ADD CONSTRAINT "ClarificationThread_projectId_responseRevisionId_fkey" FOREIGN KEY ("projectId", "responseRevisionId") REFERENCES "ResponseRevision"("projectId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "ClarificationThread" ADD CONSTRAINT "ClarificationThread_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "ClarificationThread" ADD CONSTRAINT "ClarificationThread_closedById_fkey" FOREIGN KEY ("closedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "ClarificationMessage" ADD CONSTRAINT "ClarificationMessage_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "ClarificationMessage" ADD CONSTRAINT "ClarificationMessage_projectId_threadId_fkey" FOREIGN KEY ("projectId", "threadId") REFERENCES "ClarificationThread"("projectId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "ClarificationMessage" ADD CONSTRAINT "ClarificationMessage_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "Validation" ADD CONSTRAINT "Validation_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "Validation" ADD CONSTRAINT "Validation_projectId_questionId_fkey" FOREIGN KEY ("projectId", "questionId") REFERENCES "Question"("projectId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "Validation" ADD CONSTRAINT "Validation_validatedById_fkey" FOREIGN KEY ("validatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "Validation" ADD CONSTRAINT "Validation_invalidatedById_fkey" FOREIGN KEY ("invalidatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "ValidationSource" ADD CONSTRAINT "ValidationSource_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "ValidationSource" ADD CONSTRAINT "ValidationSource_projectId_validationId_fkey" FOREIGN KEY ("projectId", "validationId") REFERENCES "Validation"("projectId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "ValidationSource" ADD CONSTRAINT "ValidationSource_projectId_responseRevisionId_fkey" FOREIGN KEY ("projectId", "responseRevisionId") REFERENCES "ResponseRevision"("projectId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "ValidationMessage" ADD CONSTRAINT "ValidationMessage_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "ValidationMessage" ADD CONSTRAINT "ValidationMessage_projectId_validationId_fkey" FOREIGN KEY ("projectId", "validationId") REFERENCES "Validation"("projectId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "ValidationMessage" ADD CONSTRAINT "ValidationMessage_projectId_clarificationMessageId_fkey" FOREIGN KEY ("projectId", "clarificationMessageId") REFERENCES "ClarificationMessage"("projectId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "Conflict" ADD CONSTRAINT "Conflict_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "Conflict" ADD CONSTRAINT "Conflict_projectId_questionId_fkey" FOREIGN KEY ("projectId", "questionId") REFERENCES "Question"("projectId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "Conflict" ADD CONSTRAINT "Conflict_openedById_fkey" FOREIGN KEY ("openedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "ConflictParticipant" ADD CONSTRAINT "ConflictParticipant_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "ConflictParticipant" ADD CONSTRAINT "ConflictParticipant_projectId_conflictId_fkey" FOREIGN KEY ("projectId", "conflictId") REFERENCES "Conflict"("projectId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "ConflictParticipant" ADD CONSTRAINT "ConflictParticipant_projectId_responseRevisionId_fkey" FOREIGN KEY ("projectId", "responseRevisionId") REFERENCES "ResponseRevision"("projectId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "ConflictResolution" ADD CONSTRAINT "ConflictResolution_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "ConflictResolution" ADD CONSTRAINT "ConflictResolution_projectId_conflictId_fkey" FOREIGN KEY ("projectId", "conflictId") REFERENCES "Conflict"("projectId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "ConflictResolution" ADD CONSTRAINT "ConflictResolution_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "ConflictResolutionSource" ADD CONSTRAINT "ConflictResolutionSource_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "ConflictResolutionSource" ADD CONSTRAINT "ConflictResolutionSource_projectId_resolutionId_fkey" FOREIGN KEY ("projectId", "resolutionId") REFERENCES "ConflictResolution"("projectId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "ConflictResolutionSource" ADD CONSTRAINT "ConflictResolutionSource_projectId_responseRevisionId_fkey" FOREIGN KEY ("projectId", "responseRevisionId") REFERENCES "ResponseRevision"("projectId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "ValidationResolution" ADD CONSTRAINT "ValidationResolution_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "ValidationResolution" ADD CONSTRAINT "ValidationResolution_projectId_validationId_fkey" FOREIGN KEY ("projectId", "validationId") REFERENCES "Validation"("projectId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "ValidationResolution" ADD CONSTRAINT "ValidationResolution_projectId_conflictResolutionId_fkey" FOREIGN KEY ("projectId", "conflictResolutionId") REFERENCES "ConflictResolution"("projectId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "QuestionDisposition" ADD CONSTRAINT "QuestionDisposition_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "QuestionDisposition" ADD CONSTRAINT "QuestionDisposition_projectId_questionId_fkey" FOREIGN KEY ("projectId", "questionId") REFERENCES "Question"("projectId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "QuestionDisposition" ADD CONSTRAINT "QuestionDisposition_markedById_fkey" FOREIGN KEY ("markedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "QuestionDisposition" ADD CONSTRAINT "QuestionDisposition_revokedById_fkey" FOREIGN KEY ("revokedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "ImportBatch" ADD CONSTRAINT "ImportBatch_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "ImportBatch" ADD CONSTRAINT "ImportBatch_importedById_fkey" FOREIGN KEY ("importedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;
