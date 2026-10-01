import {
  Injectable,
  ForbiddenException,
  PayloadTooLargeException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import {
  exportInput,
  projectExportDocument,
  validatedDecisionsExportDocument,
} from "@requirements/contracts";
import { Database } from "../database/database.module.js";
import { AccessService } from "../administration/access.service.js";
import { Tx, CommandContext, audit } from "../common/http.js";
import {
  VisibilityService,
  auditSelect,
  safeAudit,
} from "../visibility/visibility.service.js";
import { ReviewReadService } from "../review/review-read.service.js";
import { csvDocument, markdownText as md } from "./renderers.js";
// Static allowlist: never includes User, Session, ResponseDraft or DraftEvidence.
const tables = [
  "Section",
  "Question",
  "QuestionRevision",
  "QuestionOption",
  "QuestionCondition",
  "TraceabilityReference",
  "QuestionTraceability",
  "QuestionAssignment",
  "Response",
  "ResponseRevision",
  "Evidence",
  "RevisionEvidence",
  "ClarificationThread",
  "ClarificationMessage",
  "Validation",
  "ValidationSource",
  "ValidationMessage",
  "ValidationResolution",
  "Conflict",
  "ConflictParticipant",
  "ConflictResolution",
  "ConflictResolutionSource",
  "QuestionDisposition",
  "ImportBatch",
  "AuditEvent",
] as const;
@Injectable()
export class ExportService {
  private active = 0;
  constructor(
    private readonly db: Database,
    private readonly access: AccessService,
    private readonly visibility: VisibilityService,
    private readonly review: ReviewReadService,
  ) {}
  private async budget(tx: Tx, p: string) {
    let bytes = 0,
      rows = 0;
    for (const table of tables) {
      const totals = await tx.$queryRaw<{ bytes: bigint; rows: bigint }[]>(
        Prisma.sql`SELECT COALESCE(sum(octet_length(to_jsonb(t)::text)),0)::bigint AS bytes,count(*)::bigint AS rows FROM ${Prisma.raw('"' + table + '"')} t WHERE "projectId"=${p}::uuid`,
      );
      bytes += Number(totals[0]!.bytes);
      rows += Number(totals[0]!.rows);
      if (bytes > 32 * 1024 * 1024 || rows > 100000)
        throw new PayloadTooLargeException(
          "El proyecto supera el límite de exportación síncrona (32 MiB o 100,000 registros). Contacta a administración.",
        );
    }
  }
  async create(req: CommandContext, p: string, d: z.infer<typeof exportInput>) {
    if (this.active >= 2)
      throw new ServiceUnavailableException(
        "Hay otras exportaciones en proceso. Inténtalo de nuevo.",
      );
    this.active++;
    try {
      return await this.db.$transaction(
        async (tx) => {
          const { project, member } = await this.access.project(
            tx,
            req.actor,
            p,
            ["ADMIN", "ANALYST", "VIEWER"],
          );
          if (
            (member.role === "VIEWER" &&
              (d.scope !== "validated-decisions" || d.format !== "JSON")) ||
            (d.scope === "validated-decisions" && d.format !== "JSON")
          )
            throw new ForbiddenException(
              "Este perfil solo permite JSON de decisiones vigentes.",
            );
          await this.budget(tx, p);
          const exportedAt = new Date().toISOString();
          const exportScope = {
            role: member.role,
            scope: d.scope,
            exclusions: [
              "private-drafts",
              "credentials",
              "sessions",
              "storage-paths",
              "binary-files",
              ...(d.scope === "validated-decisions"
                ? [
                    "invalidated-decisions",
                    "unselected-sources",
                    "internal-comments",
                    "audit-history",
                  ]
                : []),
            ],
          };
          const projectView = {
            id: project.id,
            externalId: project.externalId,
            name: project.name,
            description: project.description,
            lifecycle: project.lifecycle,
          };
          let content: string;
          if (d.scope === "validated-decisions") {
            const ids = await tx.question.findMany({
              where: {
                projectId: p,
                publication: "PUBLISHED",
                Validation_question: { some: { invalidatedAt: null } },
              },
              select: { id: true, externalId: true },
              orderBy: { order: "asc" },
            });
            const decisions = [];
            for (const q of ids) {
              const detail = await this.review.detailTx(
                tx,
                req.actor,
                p,
                q.id,
                true,
              );
              decisions.push({
                externalId: q.externalId,
                ...detail,
                evidenceDownloads: detail.submissions.flatMap((s) =>
                  s.evidence.map((link) => ({
                    evidenceId: link.evidence.id,
                    downloadUrl: `/api/v1/projects/${p}/evidence/${link.evidence.id}/download`,
                  })),
                ),
              });
            }
            content = JSON.stringify(
              validatedDecisionsExportDocument.parse({
                formatVersion: "1.0",
                kind: "validated-decisions-export",
                exportedAt,
                exportScope,
                project: projectView,
                decisions,
              }),
              null,
              2,
            );
          } else {
            const where = { projectId: p };
            const sections = await tx.section.findMany({
                where,
                orderBy: { order: "asc" },
              }),
              questions = await tx.question.findMany({
                where,
                orderBy: [{ sectionId: "asc" }, { order: "asc" }],
              }),
              questionRevisions = await tx.questionRevision.findMany({
                where,
                orderBy: { number: "asc" },
              });
            const validations = await tx.validation.findMany({
              where,
              orderBy: { validatedAt: "asc" },
              include: {
                validatedBy: { select: { id: true, displayName: true } },
              },
            });
            const references = await tx.traceabilityReference.findMany({
                where,
              }),
              links = await tx.questionTraceability.findMany({ where }),
              responses = await tx.response.findMany({
                where: {
                  ...where,
                  ResponseRevision_response: { some: { status: "SUBMITTED" } },
                },
              }),
              responseRevisions = await tx.responseRevision.findMany({
                where: { ...where, status: "SUBMITTED" },
                orderBy: { createdAt: "asc" },
              });
            const evidence = await tx.evidence.findMany({
              where: { ...where, RevisionEvidence_evidence: { some: {} } },
              select: {
                id: true,
                responseId: true,
                originalName: true,
                detectedMimeType: true,
                byteSize: true,
                sha256: true,
                uploadedById: true,
                createdAt: true,
                status: true,
              },
            });
            const evidenceView = evidence.map((e) => ({
              ...e,
              byteSize: e.byteSize.toString(),
              downloadUrl: `/api/v1/projects/${p}/evidence/${e.id}/download`,
            }));
            const revisionEvidence = await tx.revisionEvidence.findMany({
                where,
              }),
              clarifications = await tx.clarificationThread.findMany({ where }),
              messages = await tx.clarificationMessage.findMany({ where }),
              validationSources = await tx.validationSource.findMany({ where }),
              validationMessages = await tx.validationMessage.findMany({
                where,
              }),
              validationResolutions = await tx.validationResolution.findMany({
                where,
              }),
              conflicts = await tx.conflict.findMany({ where }),
              resolutions = await tx.conflictResolution.findMany({ where }),
              resolutionSources = await tx.conflictResolutionSource.findMany({
                where,
              });
            if (d.format === "JSON") {
              const document = {
                formatVersion: "1.0",
                kind: "project-export",
                exportedAt,
                exportScope,
                project: projectView,
                sections,
                questions,
                questionRevisions,
                questionOptions: await tx.questionOption.findMany({ where }),
                conditions: await tx.questionCondition.findMany({ where }),
                traceabilityReferences: references,
                questionTraceability: links,
                assignments: await tx.questionAssignment.findMany({ where }),
                responses,
                responseRevisions,
                evidence: evidenceView,
                revisionEvidence,
                clarifications,
                clarificationMessages: messages,
                validations,
                validationSources,
                validationMessages,
                validationResolutions,
                conflicts,
                conflictParticipants: await tx.conflictParticipant.findMany({
                  where,
                }),
                conflictResolutions: resolutions,
                conflictResolutionSources: resolutionSources,
                dispositions: await tx.questionDisposition.findMany({ where }),
                auditEvents: (
                  await tx.auditEvent.findMany({
                    where,
                    select: auditSelect,
                    orderBy: [{ occurredAt: "asc" }, { id: "asc" }],
                  })
                ).map(safeAudit),
                importBatches: await tx.importBatch.findMany({ where }),
              };
              content = JSON.stringify(
                projectExportDocument.parse(
                  JSON.parse(JSON.stringify(document)),
                ),
                null,
                2,
              );
            } else if (d.format === "CSV") {
              const coverage = await this.visibility.items(tx, p),
                areas = await tx.area.findMany({
                  where: { organizationId: req.actor.organizationId },
                  select: { id: true, name: true },
                });
              content = csvDocument(
                questions.map((q) => {
                  const v = validations.find(
                      (v) => v.questionId === q.id && !v.invalidatedAt,
                    ),
                    c = coverage.find((x) => x.id === q.id);
                  return {
                    projectExternalId: project.externalId,
                    sectionExternalId: sections.find(
                      (s) => s.id === q.sectionId,
                    )?.externalId,
                    questionExternalId: q.externalId,
                    title: questionRevisions.find(
                      (r) =>
                        r.questionId === q.id &&
                        r.number === q.currentRevisionNumber,
                    )?.title,
                    priority: q.priority,
                    responsibleArea: areas.find(
                      (a) => a.id === q.responsibleAreaId,
                    )?.name,
                    status: q.status,
                    published: q.publication === "PUBLISHED",
                    archived: q.publication === "ARCHIVED",
                    submittedRespondents: c?.submittedRespondents ?? 0,
                    requiredRespondents: c?.requiredRespondents ?? 0,
                    validatedBy: v?.validatedBy.displayName,
                    validatedAt: v?.validatedAt.toISOString(),
                    validationId: v?.id,
                    traceabilityIds: JSON.stringify(
                      links
                        .filter((l) => l.questionId === q.id)
                        .map(
                          (l) =>
                            references.find((r) => r.id === l.referenceId)!
                              .externalId,
                        ),
                    ),
                    exportedAt,
                  };
                }),
              );
            } else {
              const out = [
                `# ${md(project.name)}`,
                `Exportado: ${md(exportedAt)}`,
                "Documento funcional; no es un backup. Los binarios se descargan con autorización.",
              ];
              for (const q of questions) {
                const def = questionRevisions.find(
                    (r) =>
                      r.questionId === q.id &&
                      r.number === q.currentRevisionNumber,
                  )!,
                  v = validations.find(
                    (v) => v.questionId === q.id && !v.invalidatedAt,
                  );
                out.push(
                  `## ${md(q.externalId)}`,
                  `Estado: ${md(q.status)}`,
                  md(def.question),
                  `Versión de pregunta: ${def.number}`,
                );
                const responseIds = new Set(
                  responses
                    .filter((r) => r.questionId === q.id)
                    .map((r) => r.id),
                );
                for (const r of responseRevisions.filter((r) =>
                  responseIds.has(r.responseId),
                )) {
                  out.push(
                    `### Envío ${r.number}`,
                    `Autor: ${md(r.respondentSnapshot)} · Área: ${md(r.areaSnapshot)} · Fecha: ${md(r.createdAt.toISOString())}`,
                    md(r.answer),
                    md(r.comment),
                    md(r.example),
                  );
                  for (const link of revisionEvidence.filter(
                    (l) => l.responseRevisionId === r.id,
                  )) {
                    const e = evidenceView.find(
                      (e) => e.id === link.evidenceId,
                    )!;
                    out.push(
                      `Evidencia: [${md(e.originalName)}](${e.downloadUrl}) · SHA256: ${e.sha256}`,
                    );
                  }
                }
                if (!v) out.push("Sin decisión validada vigente.");
                else {
                  out.push(
                    "### Decisión validada vigente",
                    md(v.decisionText),
                    `Alcance: ${md(v.scope)}`,
                    `Comentario: ${md(v.validationComment)}`,
                    `Excepciones: ${md(v.exceptions)}`,
                    `Analista: ${md(v.validatedBy.displayName)} · Fecha: ${md(v.validatedAt.toISOString())}`,
                    `Validación: ${v.id}`,
                    `Fuentes: ${validationSources
                      .filter((s) => s.validationId === v.id)
                      .map((s) => s.responseRevisionId)
                      .join(", ")}`,
                  );
                  for (const link of validationMessages.filter(
                    (m) => m.validationId === v.id,
                  )) {
                    const m = messages.find(
                      (m) => m.id === link.clarificationMessageId,
                    )!;
                    out.push(
                      `Aclaración utilizada (${m.id}, ${md(m.createdAt.toISOString())}): ${md(m.body)}`,
                    );
                  }
                  for (const link of validationResolutions.filter(
                    (r) => r.validationId === v.id,
                  )) {
                    const r = resolutions.find(
                      (r) => r.id === link.conflictResolutionId,
                    )!;
                    out.push(
                      `Resolución utilizada (${r.id}): ${md(r.resolutionText)}`,
                      `Fuentes de resolución: ${resolutionSources
                        .filter((s) => s.resolutionId === r.id)
                        .map((s) => s.responseRevisionId)
                        .join(", ")}`,
                    );
                  }
                }
                out.push("### Referencias");
                for (const l of links.filter((l) => l.questionId === q.id)) {
                  const r = references.find((r) => r.id === l.referenceId)!;
                  out.push(
                    `${md(r.type)} · ${md(r.externalId)} · ${md(r.label)}${r.url?.startsWith("https://") ? " · " + md(r.url) : ""}`,
                    md(l.scopeNote),
                  );
                }
              }
              content = out.join("\n\n") + "\n";
            }
          }
          if (Buffer.byteLength(content) > 64 * 1024 * 1024)
            throw new PayloadTooLargeException(
              "La exportación excede el límite de 64 MiB.",
            );
          await audit(
            tx,
            req.actor,
            "EXPORT_CREATED",
            "Project",
            p,
            p,
            null,
            {
              format: d.format,
              scope: d.scope,
              exportedAt,
              requestId: d.requestId,
            },
            d.requestId,
          );
          return {
            content,
            mime:
              d.format === "JSON"
                ? "application/json"
                : d.format === "CSV"
                  ? "text/csv"
                  : "text/markdown",
            filename: `project-${p}.${d.format === "JSON" ? "json" : d.format === "CSV" ? "csv" : "md"}`,
          };
        },
        { isolationLevel: "RepeatableRead", timeout: 60000 },
      );
    } finally {
      this.active--;
    }
  }
}
