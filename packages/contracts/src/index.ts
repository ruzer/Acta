import { z } from "zod";
export const roles = ["ADMIN", "ANALYST", "STAKEHOLDER", "VIEWER"] as const;
export const priorities = ["P0", "P1", "P2", "P3"] as const;
export const questionTypes = [
  "YES_NO",
  "SINGLE_CHOICE",
  "MULTIPLE_CHOICE",
  "SHORT_TEXT",
  "LONG_TEXT",
  "DATE",
  "NUMBER",
  "MATRIX",
] as const;
export const referenceTypes = [
  "QUESTION",
  "BUSINESS_RULE",
  "REQUIREMENT",
  "CAPABILITY",
  "WORKFLOW",
  "DOCUMENT",
  "CODE",
  "OTHER",
] as const;
export const reviewStates = [
  "NOT_REVIEWED",
  "PENDING",
  "PARTIAL",
  "ANSWERED",
  "CLARIFICATION_REQUIRED",
  "VALIDATED",
  "NOT_APPLICABLE",
  "CONFLICT",
] as const;
export const statusLabels = {
  NOT_REVIEWED: "Sin revisar",
  PENDING: "Pendiente",
  PARTIAL: "Respuesta parcial",
  ANSWERED: "Respondida",
  CLARIFICATION_REQUIRED: "Requiere aclaración",
  VALIDATED: "Validada",
  NOT_APPLICABLE: "No aplica",
  CONFLICT: "Requiere resolver diferencias",
} as const;
export const typeLabels = {
  YES_NO: "Sí o no",
  SINGLE_CHOICE: "Una opción",
  MULTIPLE_CHOICE: "Varias opciones",
  SHORT_TEXT: "Texto breve",
  LONG_TEXT: "Texto amplio",
  DATE: "Fecha",
  NUMBER: "Número",
  MATRIX: "Matriz",
} as const;
export const roleLabels = {
  ADMIN: "Administración",
  ANALYST: "Analista",
  STAKEHOLDER: "Área participante",
  VIEWER: "Consulta",
} as const;
const id = z.uuid();
export const externalId = z
  .string()
  .min(1)
  .max(128)
  .regex(
    /^[A-Za-z0-9][A-Za-z0-9._:/-]*$/,
    "Usa letras, números, punto, guion, dos puntos o diagonal, sin espacios.",
  );
const name = z.string().trim().min(1).max(200);
const short = z.string().max(4000);
const text = z.string().max(10000);
export const versionCommand = z.strictObject({
  expectedVersion: z.number().int().nonnegative(),
});
export const publicBrandingView = z.strictObject({
  appName: z.string().min(1).max(100),
  shortName: z.string().min(1).max(40),
  organizationName: z.string().min(1).max(200),
  logo: z.string(),
  favicon: z.string(),
  accent: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  locale: z.string(),
  timezone: z.string(),
});
export type PublicBranding = z.infer<typeof publicBrandingView>;
export const loginContextView = z.strictObject({
  mode: z.literal("single-organization"),
  institutionName: z.string().min(1),
});
export const loginInput = z.strictObject({
  username: z.string().min(1).max(254),
  password: z.string().min(1).max(128),
});
export const passwordInput = z.strictObject({
  currentPassword: z.string().min(1).max(128),
  newPassword: z.string().min(12).max(128),
});
export const createUserInput = z.strictObject({
  username: z.string().regex(/^[a-zA-Z0-9._-]{3,64}$/),
  displayName: name,
  temporaryPassword: z.string().min(12).max(128),
  isOrganizationAdmin: z.boolean().default(false),
});
export const userStateInput = z.strictObject({ active: z.boolean() });
export const resetPasswordInput = z.strictObject({
  temporaryPassword: z.string().min(12).max(128),
});
export const areaInput = z.strictObject({ code: externalId, name });
export const projectInput = z.strictObject({
  externalId,
  name,
  description: short.default(""),
});
export const memberInput = z
  .strictObject({
    userId: id,
    role: z.enum(roles),
    areaId: id.nullable(),
    active: z.boolean().default(true),
  })
  .refine((v) => !v.active || v.role !== "STAKEHOLDER" || v.areaId !== null, {
    path: ["areaId"],
    message: "Selecciona un área para el participante.",
  });
export const sectionInput = z.strictObject({
  externalId,
  title: name,
  description: short.default(""),
  order: z.number().int().nonnegative(),
});
// Structural commands use the existing Project lockVersion, plus exact scoped snapshots.
export const editSectionInput = z.strictObject({
  title: name,
  description: short,
  expectedVersion: z.number().int().nonnegative(),
});
export const reorderSectionsInput = z.strictObject({
  expectedVersion: z.number().int().nonnegative(),
  expected: z
    .array(z.strictObject({ id, order: z.number().int().nonnegative() }))
    .max(100),
  orderedIds: z.array(id).max(100),
});
export const reorderQuestionsInput = z
  .strictObject({
    expectedVersion: z.number().int().nonnegative(),
    sections: z
      .array(
        z.strictObject({
          sectionId: id,
          expected: z
            .array(
              z.strictObject({
                id,
                order: z.number().int().nonnegative(),
                lockVersion: z.number().int().nonnegative(),
              }),
            )
            .max(2000),
          // Active questions only. Archived records retain their exact persisted order.
          orderedIds: z.array(id).max(2000),
        }),
      )
      .min(1)
      .max(2),
  })
  .refine(
    (d) => d.sections.reduce((n, s) => n + s.expected.length, 0) <= 2000,
    "El alcance máximo es de 2.000 preguntas.",
  );
export const structureResult = z.strictObject({
  structureVersion: z.number().int().nonnegative(),
});
export const optionInput = z.strictObject({
  value: z.string().regex(/^[A-Za-z0-9_-]{1,64}$/),
  label: z.string().trim().min(1).max(500),
  order: z.number().int().nonnegative(),
});
export const referenceInput = z.strictObject({
  type: z.enum(referenceTypes),
  externalId,
  label: z.string().min(1).max(500),
  url: z
    .url()
    .refine((v) => v.startsWith("https://"), "Usa una dirección HTTPS.")
    .nullable()
    .default(null),
  priority: z.enum(priorities).nullable().default(null),
  description: short.default(""),
});
export const conditionInput = z.strictObject({
  parentQuestionId: id,
  operator: z.enum(["EQUALS", "NOT_EQUALS", "CONTAINS"]),
  value: z.union([z.string().min(1).max(64), z.boolean()]),
});
export const questionInput = z.strictObject({
  externalId,
  sectionId: id,
  title: name,
  question: text.min(1),
  helpText: text.default(""),
  type: z.enum(questionTypes),
  required: z.boolean(),
  priority: z.enum(priorities),
  responsibleAreaId: id,
  order: z.number().int().nonnegative(),
  groupParentId: id.nullable().default(null),
  supersedesQuestionId: id.nullable().default(null),
  config: z.record(z.string(), z.unknown()).nullable().default(null),
  options: z.array(optionInput).max(50).default([]),
  condition: conditionInput.nullable().default(null),
  references: z
    .array(z.strictObject({ referenceId: id, scopeNote: short.default("") }))
    .max(100)
    .default([]),
});
export const editQuestionInput = questionInput.extend({
  expectedVersion: z.number().int().nonnegative(),
});
export const assignmentInput = z.strictObject({
  projectMemberId: id,
  required: z.boolean().default(true),
  active: z.boolean().default(true),
  expectedVersion: z.number().int().nonnegative(),
});
export const metadataInput = z.strictObject({
  priority: z.enum(priorities),
  responsibleAreaId: id,
  order: z.number().int().nonnegative(),
  expectedVersion: z.number().int().nonnegative(),
});
// Bulk commands are additive; individual questionnaire contracts remain available.
export const bulkQuestions = z
  .array(
    z.strictObject({
      id,
      expectedVersion: z.number().int().nonnegative(),
    }),
  )
  .min(1)
  .max(2000)
  .refine(
    (xs) => new Set(xs.map((x) => x.id)).size === xs.length,
    "No repitas preguntas en la selección.",
  );
const bulkBase = { requestId: id, questions: bulkQuestions };
export const bulkAreaInput = z.strictObject({
  ...bulkBase,
  targetAreaId: id,
  sourceAreaId: id.nullable(), // null explicitly means every selected question.
});
export const bulkParticipantsInput = z
  .strictObject({
    ...bulkBase,
    participants: z
      .array(z.strictObject({ projectMemberId: id, required: z.boolean() }))
      .min(1)
      .max(20)
      .refine(
        (xs) => new Set(xs.map((x) => x.projectMemberId)).size === xs.length,
        "No repitas participantes.",
      ),
  })
  .refine(
    (d) => d.questions.length * d.participants.length <= 10000,
    "El lote excede 10.000 asignaciones. Reduce la selección.",
  );
export const bulkPublishInput = z.strictObject(bulkBase);
const bulkHash = z.string().regex(/^[a-f0-9]{64}$/);
export const bulkAreaConfirm = bulkAreaInput.extend({ previewHash: bulkHash });
export const bulkParticipantsConfirm = bulkParticipantsInput.safeExtend({
  previewHash: bulkHash,
});
export const bulkPublishConfirm = bulkPublishInput.extend({
  previewHash: bulkHash,
});
export const bulkOperation = z.enum([
  "ASSIGN_AREA",
  "ADD_PARTICIPANTS",
  "PUBLISH",
]);
export const bulkIssue = z.strictObject({
  message: z.string(),
  field: z.string(),
  targetId: id.nullable(),
});
export const bulkPreview = z.strictObject({
  operation: bulkOperation,
  requestId: id,
  previewHash: bulkHash,
  canConfirm: z.boolean(),
  counts: z.strictObject({
    selected: z.number().int().nonnegative(),
    applicable: z.number().int().nonnegative(),
    ignored: z.number().int().nonnegative(),
    blocked: z.number().int().nonnegative(),
    warnings: z.number().int().nonnegative(),
    newAssignments: z.number().int().nonnegative(),
    reactivatedAssignments: z.number().int().nonnegative(),
    existingAssignments: z.number().int().nonnegative(),
  }),
  items: z.array(
    z.strictObject({
      questionId: id,
      title: z.string(),
      state: z.enum([
        "READY",
        "ALREADY_PUBLISHED",
        "WARNING",
        "BLOCKED",
        "UNCHANGED",
      ]),
      errors: z.array(bulkIssue),
      warnings: z.array(bulkIssue),
    }),
  ),
  dependencies: z.array(
    z.strictObject({
      questionId: id,
      dependsOnId: id,
      title: z.string(),
      kind: z.enum(["GROUP", "CONDITION"]),
      inSelection: z.boolean(),
      publication: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]),
    }),
  ),
});
export const bulkResult = z.strictObject({
  operation: bulkOperation,
  requestId: id,
  changedIds: z.array(id),
  ignoredIds: z.array(id),
  newAssignments: z.number().int().nonnegative(),
  reactivatedAssignments: z.number().int().nonnegative(),
});
export type BulkAreaInput = z.infer<typeof bulkAreaInput>;
export type BulkParticipantsInput = z.infer<typeof bulkParticipantsInput>;
export type BulkPublishInput = z.infer<typeof bulkPublishInput>;
export type BulkOperation = z.infer<typeof bulkOperation>;
export type BulkPreview = z.infer<typeof bulkPreview>;
export type BulkResult = z.infer<typeof bulkResult>;

export const userView = z.strictObject({
  id,
  username: z.string(),
  displayName: z.string(),
  active: z.boolean(),
  isOrganizationAdmin: z.boolean(),
  mustChangePassword: z.boolean(),
});
export const organizationView = z.strictObject({
  id,
  code: z.string(),
  name: z.string(),
});
export const meView = z.strictObject({
  user: userView,
  organization: organizationView,
  csrfToken: z.string(),
});
export const areaView = z.strictObject({
  id,
  code: z.string(),
  name: z.string(),
  active: z.boolean(),
});
export const memberView = z.strictObject({
  id,
  userId: id,
  displayName: z.string(),
  username: z.string(),
  role: z.enum(roles),
  areaId: id.nullable(),
  areaName: z.string().nullable(),
  active: z.boolean(),
});
export const projectView = z.strictObject({
  id,
  externalId: z.string(),
  name: z.string(),
  description: z.string(),
  lifecycle: z.enum(["ACTIVE", "ARCHIVED"]),
  role: z.enum(roles),
  lockVersion: z.number().int(),
  questionCount: z.number().int(),
});
export const sectionView = sectionInput.extend({ id });
export const referenceView = referenceInput.extend({ id });
export const questionView = questionInput.extend({
  id,
  publication: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]),
  status: z.enum(reviewStates),
  lockVersion: z.number().int(),
  revisionNumber: z.number().int(),
  assignments: z.array(
    z.strictObject({
      id,
      projectMemberId: id,
      required: z.boolean(),
      active: z.boolean(),
    }),
  ),
});
export const questionnaireView = z.strictObject({
  structureVersion: z.number().int().nonnegative(),
  sections: z.array(sectionView),
  questions: z.array(questionView),
  references: z.array(referenceView),
  areas: z.array(areaView),
  members: z.array(memberView),
});
// Presentation DTO omits external IDs, references, revisions and internal enum names.
export const participantView = z.strictObject({
  projectName: z.string(),
  roleLabel: z.string(),
  phaseNotice: z.string(),
  sections: z.array(
    z.strictObject({
      key: z.string(),
      title: z.string(),
      questions: z.array(
        z.strictObject({
          key: z.string(),
          title: z.string(),
          question: z.string(),
          helpText: z.string(),
          typeLabel: z.string(),
          statusLabel: z.string(),
          reviewQuestionId: id.nullable().default(null),
          conditional: z.boolean(),
          groupTitle: z.string().nullable(),
          options: z.array(z.string()),
        }),
      ),
    }),
  ),
});
export const okView = z.strictObject({ ok: z.literal(true) });
export const errorView = z.strictObject({
  code: z.string(),
  message: z.string(),
  fieldErrors: z.record(z.string(), z.string()).optional(),
  requestId: z.string(),
});
export type Role = (typeof roles)[number];
export type QuestionInput = z.infer<typeof questionInput>;
export type QuestionView = z.infer<typeof questionView>;
export type QuestionnaireView = z.infer<typeof questionnaireView>;
export type Me = z.infer<typeof meView>;
export type ProjectView = z.infer<typeof projectView>;
export type MemberView = z.infer<typeof memberView>;
export type ParticipantView = z.infer<typeof participantView>;
export type ApiError = z.infer<typeof errorView>;
// Phase 2C canonical boundary. IDs are opaque transport values, never display labels.
export const answerValue = z
  .union([
    z.boolean(),
    z.number().finite(),
    z.string().max(10000),
    z.array(z.string().max(64)).max(50),
    z.record(z.string().max(64), z.string().max(64)),
  ])
  .nullable();
export const responseContent = z.strictObject({
  answer: answerValue,
  comment: z.string().max(10000),
  example: z.string().max(10000),
  consultationRequested: z.boolean(),
});
export const responseCommand = z.strictObject({
  requestId: id,
  expectedVersion: z.number().int().nonnegative(),
});
export const saveDraftInput = responseContent.extend(responseCommand.shape);
export const evidenceCommand = responseCommand.extend({ evidenceId: id });
export const stageEvidenceInput = z.strictObject({
  requestId: id,
  originalName: z.string().min(1).max(180),
});
export const evidenceView = z.strictObject({
  id,
  originalName: z.string(),
  detectedMimeType: z.string(),
  byteSize: z.number().int().positive(),
  sha256: z.string().length(64),
  status: z.enum(["STAGED", "READY", "QUARANTINED", "REJECTED"]),
  createdAt: z.iso.datetime(),
});
export const draftEvidenceView = z.strictObject({ id, evidence: evidenceView });
export const revisionEvidenceView = z.strictObject({
  id,
  evidence: evidenceView,
});
export const responseDraftView = responseContent.extend({
  id,
  basedOnRevisionId: id.nullable(),
  lockVersion: z.number().int(),
  updatedAt: z.iso.datetime(),
  evidence: z.array(draftEvidenceView),
});
export const responseRevisionView = z.strictObject({
  id,
  number: z.number().int().positive(),
  status: z.literal("SUBMITTED"),
  answer: answerValue,
  comment: z.string(),
  example: z.string(),
  createdAt: z.iso.datetime(),
  current: z.boolean(),
  evidence: z.array(revisionEvidenceView),
});
export const responseQuestionView = z.strictObject({
  id,
  sectionId: id,
  sectionTitle: z.string(),
  title: z.string(),
  question: z.string(),
  helpText: z.string(),
  type: z.enum(questionTypes),
  required: z.boolean(),
  config: z.record(z.string(), z.unknown()).nullable(),
  options: z.array(optionInput),
  position: z.number().int(),
  total: z.number().int(),
  applicability: z.enum(["ENABLED", "DISABLED", "UNDETERMINED"]),
});
export const responseView = z.strictObject({
  reviewStatus: z.enum(reviewStates).default("NOT_REVIEWED"),
  evidencePolicy: z.strictObject({
    maxBytes: z.number().int().positive(),
    maxAttachments: z.number().int().positive(),
  }),
  id: id.nullable(),
  lockVersion: z.number().int(),
  question: responseQuestionView,
  draft: responseDraftView.nullable(),
  revisions: z.array(responseRevisionView),
  nextQuestionId: id.nullable(),
});
export const personalQuestionView = z.strictObject({
  currentSubmission: z.boolean(),
  hasSubmission: z.boolean().default(false),
  question: z.string().default(""),
  id,
  title: z.string(),
  applicability: z.enum(["ENABLED", "DISABLED", "UNDETERMINED"]),
  state: z.enum(["PENDING", "DRAFT", "SENT", "CONSULTATION"]),
  updatedAt: z.iso.datetime().nullable(),
  reviewStatus: z.enum(reviewStates).default("NOT_REVIEWED"),
  clarificationWaiting: z.number().int().nonnegative().default(0),
  clarificationCount: z.number().int().nonnegative().default(0),
});
export const personalProgressView = z.strictObject({
  total: z.number().int(),
  enabled: z.number().int(),
  sent: z.number().int(),
  drafts: z.number().int(),
  pending: z.number().int(),
  excluded: z.number().int(),
  undetermined: z.number().int(),
});
export const personalProjectView = z.strictObject({
  projectName: z.string(),
  progress: personalProgressView,
  continueQuestionId: id.nullable(),
  sections: z.array(
    z.strictObject({
      id,
      title: z.string(),
      questions: z.array(personalQuestionView),
    }),
  ),
});
export type ResponseContent = z.infer<typeof responseContent>;
export type ResponseView = z.infer<typeof responseView>;
export type PersonalProjectView = z.infer<typeof personalProjectView>;
export type EvidenceView = z.infer<typeof evidenceView>;
export type ResponseQuestionView = z.infer<typeof responseQuestionView>;

// Phase 2D: exact submitted sources and explicit human review.
export const reviewCommand = responseCommand;
const reviewReason = z.string().trim().min(1).max(10000);
const sourceIds = z
  .array(id)
  .max(200)
  .refine((v) => new Set(v).size === v.length, "No repitas fuentes.");
export const requestClarificationInput = reviewCommand.extend({
  responseRevisionId: id,
  body: reviewReason,
  threadId: id.nullable().default(null),
  expectedThreadVersion: z
    .number()
    .int()
    .nonnegative()
    .nullable()
    .default(null),
});
export const replyClarificationInput = reviewCommand.extend({
  threadId: id,
  expectedThreadVersion: z.number().int().nonnegative(),
  body: reviewReason,
});
export const closeClarificationInput = reviewCommand.extend({
  threadId: id,
  expectedThreadVersion: z.number().int().nonnegative(),
  reason: reviewReason,
});
export const reviewReasonInput = reviewCommand.extend({ reason: reviewReason });
export const notApplicableInput = reviewReasonInput.extend({
  scope: reviewReason,
});
export const validateQuestionInput = reviewCommand.extend({
  decisionText: reviewReason,
  scope: reviewReason,
  exceptions: z.string().max(10000).default(""),
  validationComment: reviewReason,
  coverageExplanation: z.string().max(10000).default(""),
  responseRevisionIds: sourceIds.refine(
    (v) => v.length > 0,
    "Selecciona una respuesta enviada.",
  ),
  clarificationMessageIds: sourceIds.default([]),
  conflictResolutionIds: sourceIds.default([]),
});
export const markConflictInput = reviewReasonInput.extend({
  responseRevisionIds: sourceIds.refine(
    (v) => v.length >= 2,
    "Selecciona al menos dos respuestas.",
  ),
});
export const resolveConflictInput = reviewCommand.extend({
  conflictId: id,
  expectedConflictVersion: z.number().int().nonnegative(),
  resolutionText: reviewReason,
  responseRevisionIds: sourceIds.refine(
    (v) => v.length > 0,
    "Selecciona las fuentes de la resolución.",
  ),
});
export const reviewResult = z.strictObject({
  questionId: id,
  status: z.enum(reviewStates),
  lockVersion: z.number().int(),
  threadId: id.nullable().default(null),
});
export const reviewPerson = z.strictObject({ id, displayName: z.string() });
export const reviewSubmission = responseRevisionView.extend({
  respondent: reviewPerson,
  area: z.strictObject({ id, name: z.string() }),
});
export const clarificationMessageView = z.strictObject({
  id,
  threadId: id,
  author: reviewPerson,
  body: z.string(),
  createdAt: z.iso.datetime(),
});
export const clarificationThreadView = z.strictObject({
  id,
  responseRevisionId: id,
  respondentId: id,
  status: z.enum(["WAITING_STAKEHOLDER", "WAITING_ANALYST", "CLOSED"]),
  lockVersion: z.number().int(),
  createdAt: z.iso.datetime(),
  closedAt: z.iso.datetime().nullable(),
  closedBy: reviewPerson.nullable(),
  closeReason: z.string().nullable(),
  messages: z.array(clarificationMessageView),
});
export const validationSourceView = z.strictObject({
  id,
  responseRevisionId: id,
});
export const validationMessageView = z.strictObject({
  id,
  clarificationMessageId: id,
});
export const validationResolutionView = z.strictObject({
  id,
  conflictResolutionId: id,
});
export const validationView = z.strictObject({
  id,
  decisionText: z.string(),
  scope: z.string(),
  exceptions: z.string().nullable(),
  validationComment: z.string(),
  validatedBy: reviewPerson,
  validatedAt: z.iso.datetime(),
  invalidatedAt: z.iso.datetime().nullable(),
  invalidatedBy: reviewPerson.nullable(),
  invalidationReason: z.string().nullable(),
  sources: z.array(validationSourceView),
  messages: z.array(validationMessageView),
  resolutions: z.array(validationResolutionView),
});
export const conflictParticipantView = z.strictObject({
  id,
  responseRevisionId: id,
});
export const conflictResolutionSourceView = z.strictObject({
  id,
  responseRevisionId: id,
});
export const conflictResolutionView = z.strictObject({
  id,
  resolutionText: z.string(),
  resolvedAt: z.iso.datetime(),
  resolvedBy: reviewPerson,
  sources: z.array(conflictResolutionSourceView),
});
export const conflictView = z.strictObject({
  id,
  reason: z.string(),
  openedBy: reviewPerson,
  openedAt: z.iso.datetime(),
  status: z.enum(["OPEN", "RESOLVED"]),
  lockVersion: z.number().int(),
  participants: z.array(conflictParticipantView),
  resolution: conflictResolutionView.nullable(),
});
export const questionDispositionView = z.strictObject({
  id,
  reason: z.string(),
  scope: z.string(),
  markedBy: reviewPerson,
  markedAt: z.iso.datetime(),
  revokedAt: z.iso.datetime().nullable(),
  revokedBy: reviewPerson.nullable(),
  revokeReason: z.string().nullable(),
});
export const reviewParticipantView = z.strictObject({
  memberId: id,
  person: reviewPerson,
  area: z.string(),
  required: z.boolean(),
  applicability: z.enum(["ENABLED", "DISABLED", "UNDETERMINED"]),
  currentRevisionId: id.nullable(),
});
export const reviewDetailView = z.strictObject({
  projectId: id,
  projectName: z.string(),
  question: responseQuestionView,
  status: z.enum(reviewStates),
  priority: z.enum(priorities),
  lockVersion: z.number().int(),
  canReview: z.boolean(),
  partialReviewReason: z.string().nullable(),
  pendingReview: z.boolean(),
  pendingReviewReason: z.string().nullable().default(null),
  participants: z.array(reviewParticipantView),
  submissions: z.array(reviewSubmission),
  threads: z.array(clarificationThreadView),
  validations: z.array(validationView),
  conflicts: z.array(conflictView),
  dispositions: z.array(questionDispositionView),
  references: z.array(referenceView.extend({ scopeNote: z.string() })),
});
export const reviewInboxQuery = z.strictObject({
  status: z.enum(reviewStates).optional(),
  projectId: id.optional(),
  sectionId: id.optional(),
  priority: z.enum(priorities).optional(),
  areaId: id.optional(),
  participantId: id.optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});
export const reviewInboxItem = z.strictObject({
  questionId: id,
  projectId: id,
  projectName: z.string(),
  sectionId: id,
  sectionTitle: z.string(),
  question: z.string(),
  status: z.enum(reviewStates),
  priority: z.enum(priorities),
  areaId: id,
  areaName: z.string(),
  respondents: z.array(reviewPerson.extend({ areaName: z.string() })),
  lastContributionAt: z.iso.datetime().nullable(),
  hasEvidence: z.boolean(),
  openClarifications: z.number().int(),
});
const filterOption = z.strictObject({ id, name: z.string() });
export const reviewInboxView = z.strictObject({
  items: z.array(reviewInboxItem),
  total: z.number().int(),
  page: z.number().int(),
  pageSize: z.number().int(),
  filters: z.strictObject({
    projects: z.array(filterOption),
    sections: z.array(filterOption),
    areas: z.array(filterOption),
    participants: z.array(filterOption),
  }),
});
export const myClarificationsView = z.strictObject({
  questionId: id,
  lockVersion: z.number().int(),
  question: responseQuestionView,
  submissions: z.array(responseRevisionView),
  threads: z.array(clarificationThreadView),
});
export type ReviewDetail = z.infer<typeof reviewDetailView>;
export type ReviewInbox = z.infer<typeof reviewInboxView>;
export type ClarificationThreadView = z.infer<typeof clarificationThreadView>;
export type MyClarifications = z.infer<typeof myClarificationsView>;

// Canonical observable boundaries; Nest validates inputs/outputs and the client parses outputs.
// External invitations are capabilities, never regular account sessions.
export const invitationIdentityRequirement = z.enum([
  "NONE",
  "NAME",
  "EMAIL",
  "BOTH",
]);
export const invitationIdentity = z.strictObject({
  name: z.string().trim().min(1).max(200).optional(),
  email: z.email().max(254).optional(),
  organization: z.string().trim().min(1).max(200).optional(),
});
export const invitationCreateInput = z
  .strictObject({
    requestId: id,
    label: z.string().trim().min(1).max(200),
    questionIds: z
      .array(id)
      .min(1)
      .max(500)
      .refine((v) => new Set(v).size === v.length, "No repitas preguntas."),
    areaId: id,
    identity: invitationIdentity,
    nonNominal: z.boolean().default(false),
    expiresAt: z.iso.datetime().optional(),
    allowEvidence: z.boolean().default(false),
  })
  .superRefine((v, ctx) => {
    if (v.nonNominal && Object.keys(v.identity).length)
      ctx.addIssue({
        code: "custom",
        path: ["identity"],
        message: "Una invitación no nominal no registra datos personales.",
      });
    if (!v.nonNominal && !v.identity.name && !v.identity.email)
      ctx.addIssue({
        code: "custom",
        path: ["identity"],
        message: "Indica nombre o correo del destinatario.",
      });
  });
export const invitationCommand = z.strictObject({
  expectedVersion: z.number().int().nonnegative(),
});
export const invitationRenewInput = invitationCommand.extend({
  expiresAt: z.iso.datetime().optional(),
});
export const invitationPolicyInput = invitationCommand.extend({
  allowNonNominal: z.boolean(),
});
export const invitationPolicyView = z.strictObject({
  allowNonNominal: z.boolean(),
  expectedVersion: z.number().int().nonnegative(),
  identityRequirement: invitationIdentityRequirement,
  defaultDays: z.number().int().positive(),
  maxDays: z.number().int().positive(),
});
export const invitationView = z.strictObject({
  id,
  label: z.string(),
  identity: invitationIdentity,
  nonNominal: z.boolean(),
  questionIds: z.array(id),
  areaId: id,
  allowEvidence: z.boolean(),
  createdAt: z.iso.datetime(),
  expiresAt: z.iso.datetime(),
  revokedAt: z.iso.datetime().nullable(),
  firstOpenedAt: z.iso.datetime().nullable(),
  lockVersion: z.number().int().nonnegative(),
  status: z.enum([
    "PENDING",
    "OPENED",
    "DRAFT",
    "PARTIALLY_SUBMITTED",
    "SUBMITTED",
    "EXPIRED",
    "REVOKED",
  ]),
  submitted: z.number().int().nonnegative(),
  total: z.number().int().nonnegative(),
});
export const invitationLinkView = z.strictObject({
  invitation: invitationView,
  url: z.url(),
});
export const invitationListQuery = z.strictObject({
  page: z.coerce.number().int().min(1).default(1),
});
export const invitationListView = z.strictObject({
  items: z.array(invitationView),
  page: z.number().int().positive(),
  total: z.number().int().nonnegative(),
});
export const invitationExchangeInput = z.strictObject({
  token: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
});
export const invitationAccessView = z.strictObject({
  invitationId: id,
  csrfToken: z.string().length(64),
  expiresAt: z.iso.datetime(),
  allowEvidence: z.boolean(),
  work: personalProjectView,
});
export type InvitationView = z.infer<typeof invitationView>;
export type InvitationAccessView = z.infer<typeof invitationAccessView>;
export type InvitationCreateInput = z.infer<typeof invitationCreateInput>;

export const contracts = {
  invitationPolicy: {
    method: "GET",
    path: "/projects/:projectId/invitations/policy",
    output: invitationPolicyView,
  },
  setInvitationPolicy: {
    method: "PUT",
    path: "/projects/:projectId/invitations/policy",
    input: invitationPolicyInput,
    output: invitationPolicyView,
  },
  invitations: {
    method: "GET",
    path: "/projects/:projectId/invitations",
    input: invitationListQuery,
    output: invitationListView,
  },
  createInvitation: {
    method: "POST",
    path: "/projects/:projectId/invitations",
    input: invitationCreateInput,
    output: invitationLinkView,
  },
  revokeInvitation: {
    method: "POST",
    path: "/projects/:projectId/invitations/:id/revoke",
    input: invitationCommand,
    output: invitationView,
  },
  renewInvitation: {
    method: "POST",
    path: "/projects/:projectId/invitations/:id/renew",
    input: invitationRenewInput,
    output: invitationLinkView,
  },
  invitationExchange: {
    method: "POST",
    path: "/invitations/access/exchange",
    input: invitationExchangeInput,
    output: invitationAccessView,
  },
  invitationAccess: {
    method: "GET",
    path: "/invitations/access",
    output: invitationAccessView,
  },
  invitationLogout: {
    method: "POST",
    path: "/invitations/access/logout",
    output: okView,
  },
  invitationResponse: {
    method: "GET",
    path: "/invitations/access/questions/:id",
    output: responseView,
  },
  invitationSave: {
    method: "PUT",
    path: "/invitations/access/questions/:id/draft",
    input: saveDraftInput,
    output: responseView,
  },
  invitationSubmit: {
    method: "POST",
    path: "/invitations/access/questions/:id/submit",
    input: responseCommand,
    output: responseView,
  },
  invitationAttach: {
    method: "POST",
    path: "/invitations/access/questions/:id/evidence/attach",
    input: evidenceCommand,
    output: responseView,
  },
  invitationRemove: {
    method: "POST",
    path: "/invitations/access/questions/:id/evidence/remove",
    input: evidenceCommand,
    output: responseView,
  },
  invitationStage: {
    transport: "binary" as const,
    method: "POST",
    path: "/invitations/access/questions/:id/evidence",
    input: stageEvidenceInput,
    output: evidenceView,
  },
  invitationDownload: {
    transport: "binary" as const,
    method: "GET",
    path: "/invitations/access/evidence/:id/download",
    output: evidenceView,
  },
  invitationClarifications: {
    method: "GET",
    path: "/invitations/access/questions/:id/clarifications",
    output: myClarificationsView,
  },
  invitationReply: {
    method: "POST",
    path: "/invitations/access/questions/:id/clarifications/reply",
    input: replyClarificationInput,
    output: reviewResult,
  },

  branding: {
    method: "GET",
    path: "/configuration/public",
    output: publicBrandingView,
  },
  listReviewInbox: {
    method: "GET",
    path: "/review",
    input: reviewInboxQuery,
    output: reviewInboxView,
  },
  getReviewDetail: {
    method: "GET",
    path: "/projects/:projectId/questions/:id/review",
    output: reviewDetailView,
  },
  myClarifications: {
    method: "GET",
    path: "/projects/:projectId/questions/:id/clarifications",
    output: myClarificationsView,
  },
  requestClarification: {
    method: "POST",
    path: "/projects/:projectId/questions/:id/review/clarifications/request",
    input: requestClarificationInput,
    output: reviewResult,
  },
  replyClarification: {
    method: "POST",
    path: "/projects/:projectId/questions/:id/review/clarifications/reply",
    input: replyClarificationInput,
    output: reviewResult,
  },
  closeClarification: {
    method: "POST",
    path: "/projects/:projectId/questions/:id/review/clarifications/close",
    input: closeClarificationInput,
    output: reviewResult,
  },
  markPartial: {
    method: "POST",
    path: "/projects/:projectId/questions/:id/review/partial",
    input: reviewReasonInput,
    output: reviewResult,
  },
  markPending: {
    method: "POST",
    path: "/projects/:projectId/questions/:id/review/pending",
    input: reviewReasonInput,
    output: reviewResult,
  },
  validateQuestion: {
    method: "POST",
    path: "/projects/:projectId/questions/:id/review/validate",
    input: validateQuestionInput,
    output: reviewResult,
  },
  markNotApplicable: {
    method: "POST",
    path: "/projects/:projectId/questions/:id/review/not-applicable",
    input: notApplicableInput,
    output: reviewResult,
  },
  reopenQuestion: {
    method: "POST",
    path: "/projects/:projectId/questions/:id/review/reopen",
    input: reviewReasonInput,
    output: reviewResult,
  },
  markConflict: {
    method: "POST",
    path: "/projects/:projectId/questions/:id/review/conflicts",
    input: markConflictInput,
    output: reviewResult,
  },
  resolveConflict: {
    method: "POST",
    path: "/projects/:projectId/questions/:id/review/conflicts/resolve",
    input: resolveConflictInput,
    output: reviewResult,
  },

  personalProject: {
    method: "GET",
    path: "/projects/:projectId/my-work",
    output: personalProjectView,
  },
  getResponse: {
    method: "GET",
    path: "/projects/:projectId/questions/:id/response",
    output: responseView,
  },
  getDraft: {
    method: "GET",
    path: "/projects/:projectId/questions/:id/response/draft",
    output: responseView,
  },
  saveDraft: {
    method: "PUT",
    path: "/projects/:projectId/questions/:id/response/draft",
    input: saveDraftInput,
    output: responseView,
  },
  submitResponse: {
    method: "POST",
    path: "/projects/:projectId/questions/:id/response/submit",
    input: responseCommand,
    output: responseView,
  },
  stageEvidence: {
    transport: "binary" as const,
    method: "POST",
    path: "/projects/:projectId/questions/:id/evidence",
    input: stageEvidenceInput,
    output: evidenceView,
  },
  attachEvidenceToDraft: {
    method: "POST",
    path: "/projects/:projectId/questions/:id/response/evidence/attach",
    input: evidenceCommand,
    output: responseView,
  },
  removeDraftEvidence: {
    method: "POST",
    path: "/projects/:projectId/questions/:id/response/evidence/remove",
    input: evidenceCommand,
    output: responseView,
  },
  downloadEvidence: {
    transport: "binary" as const,
    method: "GET",
    path: "/projects/:projectId/evidence/:id/download",
    output: evidenceView,
  },
  loginContext: {
    method: "GET",
    path: "/auth/context",
    output: loginContextView,
  },
  login: {
    method: "POST",
    path: "/auth/login",
    input: loginInput,
    output: meView,
  },
  me: { method: "GET", path: "/auth/me", output: meView },
  logout: { method: "POST", path: "/auth/logout", output: okView },
  password: {
    method: "POST",
    path: "/auth/change-password",
    input: passwordInput,
    output: okView,
  },
  organization: {
    method: "GET",
    path: "/organization",
    output: organizationView,
  },
  users: { method: "GET", path: "/users", output: z.array(userView) },
  createUser: {
    method: "POST",
    path: "/users",
    input: createUserInput,
    output: userView,
  },
  userState: {
    method: "POST",
    path: "/users/:id/set-active",
    input: userStateInput,
    output: okView,
  },
  resetPassword: {
    method: "POST",
    path: "/users/:id/reset-password",
    input: resetPasswordInput,
    output: okView,
  },
  areas: { method: "GET", path: "/areas", output: z.array(areaView) },
  createArea: {
    method: "POST",
    path: "/areas",
    input: areaInput,
    output: areaView,
  },
  projects: { method: "GET", path: "/projects", output: z.array(projectView) },
  createProject: {
    method: "POST",
    path: "/projects",
    input: projectInput,
    output: projectView,
  },
  members: {
    method: "GET",
    path: "/projects/:projectId/members",
    output: z.array(memberView),
  },
  setMember: {
    method: "POST",
    path: "/projects/:projectId/members",
    input: memberInput,
    output: memberView,
  },
  questionnaire: {
    method: "GET",
    path: "/projects/:projectId/questionnaire",
    output: questionnaireView,
  },
  participant: {
    method: "GET",
    path: "/projects/:projectId/participant",
    output: participantView,
  },
  createSection: {
    method: "POST",
    path: "/projects/:projectId/sections",
    input: sectionInput,
    output: sectionView,
  },
  editSection: {
    method: "PUT",
    path: "/projects/:projectId/sections/:id/draft",
    input: editSectionInput,
    output: sectionView,
  },
  reorderSections: {
    method: "POST",
    path: "/projects/:projectId/sections/reorder",
    input: reorderSectionsInput,
    output: structureResult,
  },
  reorderQuestions: {
    method: "POST",
    path: "/projects/:projectId/questions/reorder",
    input: reorderQuestionsInput,
    output: structureResult,
  },
  bulkAreaPreview: {
    method: "POST",
    path: "/projects/:projectId/questions/bulk/area/preview",
    input: bulkAreaInput,
    output: bulkPreview,
  },
  bulkAreaConfirm: {
    method: "POST",
    path: "/projects/:projectId/questions/bulk/area/confirm",
    input: bulkAreaConfirm,
    output: bulkResult,
  },
  bulkParticipantsPreview: {
    method: "POST",
    path: "/projects/:projectId/questions/bulk/participants/preview",
    input: bulkParticipantsInput,
    output: bulkPreview,
  },
  bulkParticipantsConfirm: {
    method: "POST",
    path: "/projects/:projectId/questions/bulk/participants/confirm",
    input: bulkParticipantsConfirm,
    output: bulkResult,
  },
  bulkPublishPreview: {
    method: "POST",
    path: "/projects/:projectId/questions/bulk/publish/preview",
    input: bulkPublishInput,
    output: bulkPreview,
  },
  bulkPublishConfirm: {
    method: "POST",
    path: "/projects/:projectId/questions/bulk/publish/confirm",
    input: bulkPublishConfirm,
    output: bulkResult,
  },
  createReference: {
    method: "POST",
    path: "/projects/:projectId/references",
    input: referenceInput,
    output: referenceView,
  },
  createQuestion: {
    method: "POST",
    path: "/projects/:projectId/questions",
    input: questionInput,
    output: questionView,
  },
  editQuestion: {
    method: "PUT",
    path: "/projects/:projectId/questions/:id/draft",
    input: editQuestionInput,
    output: questionView,
  },
  metadata: {
    method: "POST",
    path: "/projects/:projectId/questions/:id/metadata",
    input: metadataInput,
    output: questionView,
  },
  assign: {
    method: "POST",
    path: "/projects/:projectId/questions/:id/assign",
    input: assignmentInput,
    output: questionView,
  },
  publish: {
    method: "POST",
    path: "/projects/:projectId/questions/:id/publish",
    input: versionCommand,
    output: questionView,
  },
  archive: {
    method: "POST",
    path: "/projects/:projectId/questions/:id/archive",
    input: versionCommand,
    output: questionView,
  },
} as const;

// Phase 2E: observable visibility and exchange contracts.
const importName = z.string().min(1).max(200);
const importOption = z.strictObject({
  value: externalId.max(64),
  label: z.string().min(1).max(500),
  order: z.number().int().nonnegative(),
});
const importReferenceKey = z.strictObject({
  type: z.enum(referenceTypes),
  externalId,
  scopeNote: z.string().max(4000).optional(),
});
export const templateInput = z.strictObject({
  formatVersion: z.literal("1.0"),
  kind: z.literal("questionnaire-template"),
  project: z.strictObject({
    externalId,
    name: importName,
    description: z.string().max(4000).optional(),
  }),
  areas: z
    .array(z.strictObject({ code: externalId, name: importName }))
    .max(2000),
  sections: z
    .array(
      z.strictObject({
        externalId,
        title: importName,
        description: z.string().max(4000).optional(),
        order: z.number().int().nonnegative(),
      }),
    )
    .max(100),
  questions: z
    .array(
      z.strictObject({
        externalId,
        sectionExternalId: externalId,
        title: importName,
        question: z.string().min(1).max(10000),
        helpText: z.string().max(10000).optional(),
        priority: z.enum(priorities),
        type: z.enum(questionTypes),
        required: z.boolean(),
        responsibleAreaCode: externalId,
        order: z.number().int().nonnegative(),
        options: z.array(importOption).max(50),
        references: z.array(importReferenceKey).max(10000),
        groupParentExternalId: externalId.optional(),
        sourceLocator: z
          .strictObject({
            document: z.string().min(1).max(500),
            anchor: z.string().min(1).max(500),
            part: z.string().max(64).optional(),
          })
          .optional(),
        config: z.record(z.string(), z.unknown()).optional(),
      }),
    )
    .max(2000),
  conditions: z
    .array(
      z.strictObject({
        parentQuestionExternalId: externalId,
        childQuestionExternalId: externalId,
        operator: z.enum(["EQUALS", "NOT_EQUALS", "CONTAINS"]),
        value: z.union([z.boolean(), z.string().max(64)]),
      }),
    )
    .max(2000),
  traceabilityReferences: z
    .array(
      z.strictObject({
        type: z.enum(referenceTypes),
        externalId,
        label: z.string().min(1).max(500),
        url: z
          .url()
          .max(2000)
          .refine(
            (v) => new URL(v).protocol === "https:",
            "Solo enlaces HTTPS.",
          )
          .optional(),
        priority: z.enum(priorities).optional(),
        description: z.string().max(4000).optional(),
      }),
    )
    .max(10000),
});
export type TemplateInput = z.infer<typeof templateInput>;
export const importCounts = z.strictObject({
  projects: z.number().int(),
  sections: z.number().int(),
  questions: z.number().int(),
  options: z.number().int(),
  conditions: z.number().int(),
  references: z.number().int(),
  links: z.number().int(),
  areas: z.number().int(),
});
export const importIssue = z.strictObject({
  path: z.string(),
  message: z.string(),
});
export const importPreviewView = z.strictObject({
  payloadHash: z.string().length(64),
  expectedProjectVersion: z.number().int(),
  projectName: z.string(),
  counts: importCounts,
  missingAreas: z.array(z.strictObject({ code: z.string(), name: z.string() })),
  warnings: z.array(importIssue),
  errors: z.array(importIssue),
  canConfirm: z.boolean(),
});
export const importConfirmInput = z.strictObject({
  payloadHash: z.string().regex(/^[a-f0-9]{64}$/),
  expectedProjectVersion: z.number().int().nonnegative(),
  requestId: z.uuid(),
  createMissingAreas: z.boolean(),
});
export const importResultView = z.strictObject({
  batchId: z.uuid(),
  projectId: z.uuid(),
  payloadHash: z.string().length(64),
  counts: importCounts,
  projectVersion: z.number().int(),
});
export const metricView = z.strictObject({
  numerator: z.number().int().nonnegative(),
  denominator: z.number().int().nonnegative(),
  percentage: z.number().min(0).max(100).nullable(),
});
export const metricsView = z.strictObject({
  validation: metricView,
  closure: metricView,
  submission: metricView,
});
export const visibilityQuestion = z.strictObject({
  id: z.uuid(),
  externalId: z.string(),
  title: z.string(),
  sectionId: z.uuid(),
  sectionTitle: z.string(),
  priority: z.enum(priorities),
  areaId: z.uuid(),
  areaName: z.string(),
  status: z.enum(reviewStates),
  submittedRespondents: z.number().int(),
  requiredRespondents: z.number().int(),
  conditionalWithoutCase: z.boolean(),
  referenceIds: z.array(z.uuid()),
});
export const dashboardView = z.strictObject({
  projectName: z.string(),
  role: z.enum(["ADMIN", "ANALYST"]),
  metrics: metricsView,
  states: z.array(
    z.strictObject({ status: z.enum(reviewStates), count: z.number().int() }),
  ),
  breakdowns: z.array(
    z.strictObject({
      dimension: z.enum(["section", "priority", "area", "status"]),
      key: z.string(),
      label: z.string(),
      metrics: metricsView,
    }),
  ),
  questions: z.array(visibilityQuestion),
});
export const traceabilityView = z.strictObject({
  references: z.array(
    referenceView.extend({
      questions: z.array(
        z.strictObject({
          id: z.uuid(),
          externalId: z.string(),
          title: z.string(),
          publication: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]),
          status: z.enum(reviewStates),
        }),
      ),
    }),
  ),
  questionsWithReferences: z.number().int(),
  questionsWithoutReferences: z.number().int(),
});
export const historyQuery = z.strictObject({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(25),
  objectType: z.string().max(100).optional(),
  actorId: z.uuid().optional(),
  action: z.string().max(100).optional(),
  from: z.iso.datetime().optional(),
  to: z.iso.datetime().optional(),
});
export const auditSummary = z.strictObject({
  id: z.uuid(),
  actorId: z.uuid(),
  actorName: z.string(),
  action: z.string(),
  objectType: z.string(),
  objectId: z.string(),
  occurredAt: z.iso.datetime(),
  requestId: z.string(),
  exportType: z.string().nullable(),
  scope: z.string().nullable(),
});
export const historyView = z.strictObject({
  items: z.array(auditSummary),
  total: z.number().int(),
  page: z.number().int(),
  pageSize: z.number().int(),
  actors: z.array(z.strictObject({ id: z.uuid(), displayName: z.string() })),
});
export const exportInput = z.strictObject({
  format: z.enum(["JSON", "CSV", "MARKDOWN"]),
  scope: z.enum(["full", "validated-decisions"]),
  requestId: z.uuid(),
});

// Versioned export allowlists. Unknown persistence fields cannot silently enter a file.
const exportRow = (keys: string) =>
  z.object(Object.fromEntries(keys.split(" ").map((key) => [key, z.json()])));
export const exportScopeView = z.strictObject({
  role: z.enum(["ADMIN", "ANALYST", "VIEWER"]),
  scope: z.enum(["full", "validated-decisions"]),
  exclusions: z.array(z.string()),
});
export const projectExportDocument = z.strictObject({
  formatVersion: z.literal("1.0"),
  kind: z.literal("project-export"),
  exportedAt: z.iso.datetime(),
  exportScope: exportScopeView,
  project: exportRow("id externalId name description lifecycle"),
  sections: z.array(
    exportRow(
      "id projectId externalId title description order createdAt updatedAt",
    ),
  ),
  questions: z.array(
    exportRow(
      "id projectId sectionId externalId groupParentId supersedesQuestionId responsibleAreaId priority order status publication publishedRevisionNumber currentRevisionNumber pendingReview partialReviewReason lockVersion createdAt updatedAt",
    ),
  ),
  questionRevisions: z.array(
    exportRow(
      "id projectId questionId number title question helpText type required config sourceLocator snapshot createdById createdAt",
    ),
  ),
  questionOptions: z.array(
    exportRow("id projectId questionRevisionId value label order"),
  ),
  conditions: z.array(
    exportRow("id projectId parentQuestionId childQuestionId operator value"),
  ),
  traceabilityReferences: z.array(
    exportRow(
      "id projectId type externalId label url priority description createdAt updatedAt",
    ),
  ),
  questionTraceability: z.array(
    exportRow("id projectId questionId referenceId scopeNote"),
  ),
  assignments: z.array(
    exportRow(
      "id projectId questionId projectMemberId required active createdAt updatedAt",
    ),
  ),
  responses: z.array(
    exportRow(
      "id projectId questionId respondentId lockVersion createdAt updatedAt",
    ),
  ),
  responseRevisions: z.array(
    exportRow(
      "id projectId responseId questionRevisionId number status answer comment example areaId respondentSnapshot areaSnapshot conditionContext createdAt",
    ),
  ),
  evidence: z.array(
    exportRow(
      "id responseId originalName detectedMimeType byteSize sha256 uploadedById createdAt status downloadUrl",
    ),
  ),
  revisionEvidence: z.array(
    exportRow("id projectId responseRevisionId evidenceId"),
  ),
  clarifications: z.array(
    exportRow(
      "id projectId responseRevisionId requestedById status lockVersion createdAt closedAt closedById closeReason",
    ),
  ),
  clarificationMessages: z.array(
    exportRow("id projectId threadId authorId body createdAt"),
  ),
  validations: z.array(
    exportRow(
      "id projectId questionId decisionText scope exceptions validationComment validatedById validatedAt invalidatedAt invalidatedById invalidationReason validatedBy",
    ).extend({ validatedBy: reviewPerson }),
  ),
  validationSources: z.array(
    exportRow("id projectId validationId responseRevisionId"),
  ),
  validationMessages: z.array(
    exportRow("id projectId validationId clarificationMessageId"),
  ),
  validationResolutions: z.array(
    exportRow("id projectId validationId conflictResolutionId"),
  ),
  conflicts: z.array(
    exportRow(
      "id projectId questionId reason openedById openedAt status lockVersion",
    ),
  ),
  conflictParticipants: z.array(
    exportRow("id projectId conflictId responseRevisionId"),
  ),
  conflictResolutions: z.array(
    exportRow("id projectId conflictId resolutionText resolvedById resolvedAt"),
  ),
  conflictResolutionSources: z.array(
    exportRow("id projectId resolutionId responseRevisionId"),
  ),
  dispositions: z.array(
    exportRow(
      "id projectId questionId reason scope markedById markedAt revokedAt revokedById revokeReason",
    ),
  ),
  auditEvents: z.array(auditSummary),
  importBatches: z.array(
    exportRow(
      "id projectId formatVersion sourceSha256 importedById importedAt counts requestId",
    ),
  ),
});
export const validatedDecisionsExportDocument = z.strictObject({
  formatVersion: z.literal("1.0"),
  kind: z.literal("validated-decisions-export"),
  exportedAt: z.iso.datetime(),
  exportScope: exportScopeView,
  project: exportRow("id externalId name description lifecycle"),
  decisions: z.array(
    reviewDetailView.extend({
      externalId: z.string(),
      evidenceDownloads: z.array(
        z.strictObject({
          evidenceId: z.uuid(),
          downloadUrl: z.string().regex(/^\/api\/v1\/projects\//),
        }),
      ),
    }),
  ),
});

export * from "./participant.js";
