import { invitationAccess } from "../common/invitation-access.js";
import {
  recomputeReview,
  invalidateValidation,
} from "../review/review-state.js";
import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from "@nestjs/common";
import { Prisma, User } from "@prisma/client";
import { z } from "zod";
import {
  participantStart,
  evidenceCommand,
  responseCommand,
  saveDraftInput,
  stageEvidenceInput,
  responseView,
  evidenceView,
} from "@requirements/contracts";
import { Database } from "../database/database.module.js";
import { AccessService } from "../administration/access.service.js";
import {
  audit,
  CommandContext,
  jsonValue,
  serialize,
  Tx,
} from "../common/http.js";
import { canonical, loadGraph, presentEvidence } from "./response-graph.js";
import { validateAnswer } from "./answer-rules.js";
import { STORAGE, StorageProvider, sha256, verifiedBytes } from "./storage.js";
import { evidenceLimits, validateFile } from "./file-validation.js";
const conflict = () =>
  new ConflictException(
    "El borrador fue actualizado desde otra sesión o pestaña.",
  );
@Injectable()
export class ResponsesService {
  constructor(
    private readonly db: Database,
    private readonly access: AccessService,
    @Inject(STORAGE) private readonly storage: StorageProvider,
  ) {}
  async personal(actor: User, p: string) {
    return this.db.$transaction(
      async (tx) => {
        const { graph, project } = await loadGraph(tx, this.access, actor, p);
        const result = graph.personal(project.name);
        const threads = await tx.clarificationThread.findMany({
          where: {
            projectId: p,
            revision: { response: { respondentId: actor.id } },
          },
          include: { revision: { include: { response: true } } },
        });
        for (const section of result.sections)
          for (const q of section.questions) {
            q.reviewStatus = graph.question(q.id).status;
            q.clarificationCount = threads.filter(
              (t) => t.revision.response.questionId === q.id,
            ).length;
            q.clarificationWaiting = threads.filter(
              (t) =>
                t.revision.response.questionId === q.id &&
                t.status === "WAITING_STAKEHOLDER",
            ).length;
          }
        result.continueQuestionId =
          participantStart(result.sections.flatMap((s) => s.questions))?.id ??
          null;
        return result;
      },
      { isolationLevel: "RepeatableRead" },
    );
  }
  async get(actor: User, p: string, q: string) {
    return this.db.$transaction(
      async (tx) => (await loadGraph(tx, this.access, actor, p)).graph.view(q),
      { isolationLevel: "RepeatableRead" },
    );
  }
  async authorizeUpload(actor: User, p: string, q: string) {
    if (
      actor.invitationOnly &&
      !(await invitationAccess(this.db, actor, p)).allowEvidence
    )
      throw new NotFoundException("No se encontró la evidencia.");
    (await loadGraph(this.db, this.access, actor, p)).graph.question(q);
    if (
      await this.db.questionDisposition.findFirst({
        where: { projectId: p, questionId: q, revokedAt: null },
      })
    )
      throw new ConflictException(
        "La pregunta está marcada como no aplica. El analista debe reabrirla antes de aportar.",
      );
  }
  private async execute<T>(
    r: CommandContext,
    p: string,
    q: string,
    requestId: string,
    operation: string,
    payload: unknown,
    schema: z.ZodType<T>,
    work: (tx: Tx) => Promise<T>,
  ) {
    return this.access.mutate(r.actor, p, ["STAKEHOLDER"], async (tx) => {
      if (
        r.actor.invitationOnly &&
        (operation.startsWith("EVIDENCE_") ||
          operation === "DRAFT_EVIDENCE_REMOVED") &&
        !(await invitationAccess(tx, r.actor, p)).allowEvidence
      )
        throw new NotFoundException("No se encontró la evidencia.");
      const { graph } = await loadGraph(tx, this.access, r.actor, p);
      graph.question(q);
      const payloadHash = sha256(canonical({ p, q, operation, payload }));
      const previous = await tx.auditEvent.findFirst({
        where: {
          organizationId: r.actor.organizationId,
          actorId: r.actor.id,
          requestId,
          eventIndex: 0,
        },
      });
      if (previous) {
        if (previous.payloadHash !== payloadHash)
          throw new ConflictException(
            "Esta solicitud ya se utilizó con contenido diferente.",
          );
        return serialize(schema, previous.result);
      }
      if (
        await tx.questionDisposition.findFirst({
          where: { projectId: p, questionId: q, revokedAt: null },
        })
      )
        throw new ConflictException(
          "La pregunta está marcada como no aplica. El analista debe reabrirla antes de aportar.",
        );
      const result = await work(tx);
      await tx.auditEvent.create({
        data: {
          organizationId: r.actor.organizationId,
          projectId: p,
          actorId: r.actor.id,
          actorSnapshot: {
            displayName: r.actor.displayName,
            username: r.actor.username,
            identityKind: r.actor.invitationOnly ? "INVITATION" : "ACCOUNT",
          },
          action: operation,
          objectType: "Response",
          objectId: graph.response(q)?.id ?? q,
          requestId,
          payloadHash,
          result: jsonValue(result),
          before: jsonValue(graph.view(q)),
          after: jsonValue(result),
        },
      });
      return result;
    });
  }
  async save(
    r: CommandContext,
    p: string,
    q: string,
    d: z.infer<typeof saveDraftInput>,
  ) {
    return this.execute(
      r,
      p,
      q,
      d.requestId,
      "RESPONSE_DRAFTED",
      d,
      responseView,
      async (tx) => {
        const { graph, member } = await loadGraph(tx, this.access, r.actor, p);
        const v = graph.view(q);
        if (v.lockVersion !== d.expectedVersion) throw conflict();
        validateAnswer(v.question, d, false);
        const response = await tx.response.upsert({
          where: {
            questionId_respondentId: {
              questionId: q,
              respondentId: r.actor.id,
            },
          },
          create: {
            projectId: p,
            questionId: q,
            respondentId: r.actor.id,
            lockVersion: 1,
          },
          update: { lockVersion: { increment: 1 } },
        });
        const latest = graph.response(q)?.ResponseRevision_response[0];
        const content = {
          answer: d.answer === null ? Prisma.JsonNull : jsonValue(d.answer),
          comment: d.comment,
          example: d.example,
          consultationRequested: d.consultationRequested,
          areaId: member.areaId!,
          questionRevisionId:
            graph.question(q).QuestionRevision_questionRecord[0]!.id,
          conditionContext: graph.context(q).context,
          lockVersion: response.lockVersion,
        };
        const draft = await tx.responseDraft.upsert({
          where: { responseId: response.id },
          create: {
            projectId: p,
            responseId: response.id,
            basedOnRevisionId: latest?.id ?? null,
            ...content,
          },
          update: content,
        });
        if (!v.draft && latest) {
          for (const link of latest.RevisionEvidence_revision) {
            if (link.evidence.status !== "READY")
              throw new ConflictException(
                "Una evidencia anterior no está disponible.",
              );
            await verifiedBytes(this.storage, link.evidence);
            await tx.draftEvidence.create({
              data: {
                projectId: p,
                responseDraftId: draft.id,
                evidenceId: link.evidenceId,
              },
            });
          }
        }
        await this.recompute(tx, r.actor, p);
        return (await loadGraph(tx, this.access, r.actor, p)).graph.view(q);
      },
    );
  }
  async submit(
    r: CommandContext,
    p: string,
    q: string,
    d: z.infer<typeof responseCommand>,
  ) {
    return this.execute(
      r,
      p,
      q,
      d.requestId,
      "RESPONSE_SUBMITTED",
      d,
      responseView,
      async (tx) => {
        const { graph, member } = await loadGraph(tx, this.access, r.actor, p),
          view = graph.view(q),
          response = graph.response(q),
          draft = response?.ResponseDraft_response;
        if (view.lockVersion !== d.expectedVersion) throw conflict();
        if (!response || !draft)
          throw new ConflictException("Guarda un borrador antes de enviar.");
        if (view.question.applicability !== "ENABLED")
          throw new ConflictException(
            "Esta pregunta depende de una respuesta anterior enviada.",
          );
        if (
          canonical(draft.conditionContext) !==
            canonical(graph.context(q).context) ||
          draft.questionRevisionId !==
            graph.question(q).QuestionRevision_questionRecord[0]!.id
        )
          throw new ConflictException(
            "Cambió la pregunta o su contexto. Revisa y guarda de nuevo antes de enviar.",
          );
        validateAnswer(view.question, view.draft!, true);
        if (draft.DraftEvidence_draft.length > evidenceLimits().attachments)
          throw new UnprocessableEntityException("Hay demasiados adjuntos.");
        for (const link of draft.DraftEvidence_draft) {
          if (link.evidence.status !== "READY")
            throw new ConflictException("Un adjunto no está disponible.");
          await verifiedBytes(this.storage, link.evidence);
        }
        const area = await tx.area.findFirstOrThrow({
          where: {
            id: member.areaId!,
            organizationId: r.actor.organizationId,
            active: true,
          },
        });
        const rev = await tx.responseRevision.create({
          data: {
            projectId: p,
            responseId: response.id,
            questionRevisionId: draft.questionRevisionId,
            number: (response.ResponseRevision_response[0]?.number ?? 0) + 1,
            answer:
              draft.answer === null ? Prisma.JsonNull : jsonValue(draft.answer),
            comment: draft.comment,
            example: draft.example,
            areaId: area.id,
            respondentSnapshot: {
              id: r.actor.id,
              displayName: r.actor.displayName,
              username: r.actor.username,
              identityKind: r.actor.invitationOnly ? "INVITATION" : "ACCOUNT",
            },
            areaSnapshot: { id: area.id, code: area.code, name: area.name },
            conditionContext: jsonValue(draft.conditionContext),
          },
        });
        for (const link of draft.DraftEvidence_draft)
          await tx.revisionEvidence.create({
            data: {
              projectId: p,
              responseRevisionId: rev.id,
              evidenceId: link.evidenceId,
            },
          });
        await tx.draftEvidence.deleteMany({
          where: { projectId: p, responseDraftId: draft.id },
        });
        await tx.responseDraft.delete({ where: { id: draft.id } });
        await tx.response.update({
          where: { id: response.id },
          data: { lockVersion: { increment: 1 } },
        });
        await invalidateValidation(
          tx,
          r.actor,
          p,
          q,
          "Se recibió una nueva respuesta enviada.",
        );
        await tx.question.update({
          where: { id: q },
          data: {
            lockVersion: { increment: 1 },
            partialReviewReason: null,
            pendingReview: false,
          },
        });
        await this.recompute(tx, r.actor, p);
        return (await loadGraph(tx, this.access, r.actor, p)).graph.view(q);
      },
    );
  }
  async stage(
    r: CommandContext,
    p: string,
    q: string,
    d: z.infer<typeof stageEvidenceInput>,
    bytes: Buffer,
  ) {
    await this.authorizeUpload(r.actor, p, q);
    const detectedMimeType = await validateFile(bytes, d.originalName),
      hash = sha256(bytes);
    // Finalize first. Ambiguous DB outcomes never trigger destructive file deletion.
    const previous = await this.db.auditEvent.findFirst({
      where: {
        organizationId: r.actor.organizationId,
        actorId: r.actor.id,
        requestId: d.requestId,
        eventIndex: 0,
      },
    });
    const hashInput = sha256(
      canonical({
        p,
        q,
        operation: "EVIDENCE_STAGED",
        payload: { ...d, sha256: hash },
      }),
    );
    if (previous) {
      if (previous.payloadHash !== hashInput)
        throw new ConflictException(
          "Esta solicitud ya se utilizó con contenido diferente.",
        );
      return serialize(evidenceView, previous.result);
    }
    await this.uploadQuota(this.db, p, q, r.actor.id, bytes.length);
    const storageKey = await this.storage.put(bytes);
    return this.execute(
      r,
      p,
      q,
      d.requestId,
      "EVIDENCE_STAGED",
      { ...d, sha256: hash },
      evidenceView,
      async (tx) => {
        await this.uploadQuota(tx, p, q, r.actor.id, bytes.length);
        const response = await tx.response.upsert({
          where: {
            questionId_respondentId: {
              questionId: q,
              respondentId: r.actor.id,
            },
          },
          create: { projectId: p, questionId: q, respondentId: r.actor.id },
          update: {},
        });
        const evidence = await tx.evidence.create({
          data: {
            projectId: p,
            responseId: response.id,
            uploadedById: r.actor.id,
            originalName: d.originalName,
            detectedMimeType,
            byteSize: bytes.length,
            sha256: hash,
            backend: this.storage.backend,
            storageKey,
            status: "STAGED",
          },
        });
        return presentEvidence(evidence);
      },
    );
  }
  async attachment(
    r: CommandContext,
    p: string,
    q: string,
    d: z.infer<typeof evidenceCommand>,
    remove: boolean,
  ) {
    return this.execute(
      r,
      p,
      q,
      d.requestId,
      remove ? "DRAFT_EVIDENCE_REMOVED" : "EVIDENCE_ATTACHED",
      d,
      responseView,
      async (tx) => {
        const { graph } = await loadGraph(tx, this.access, r.actor, p),
          response = graph.response(q),
          draft = response?.ResponseDraft_response;
        if ((response?.lockVersion ?? 0) !== d.expectedVersion)
          throw conflict();
        if (!draft || !response)
          throw new ConflictException(
            "Guarda el borrador antes de vincular un archivo.",
          );
        const evidence = await tx.evidence.findFirst({
          where: {
            id: d.evidenceId,
            projectId: p,
            responseId: response.id,
            uploadedById: r.actor.id,
          },
        });
        if (!evidence)
          throw new NotFoundException("No se encontró la evidencia.");
        if (remove) {
          await tx.draftEvidence.deleteMany({
            where: {
              projectId: p,
              responseDraftId: draft.id,
              evidenceId: evidence.id,
            },
          });
        } else {
          if (!["STAGED", "READY"].includes(evidence.status))
            throw new ConflictException("El archivo no está disponible.");
          if (draft.DraftEvidence_draft.length >= evidenceLimits().attachments)
            throw new UnprocessableEntityException(
              "Se alcanzó el límite de adjuntos del borrador.",
            );
          await verifiedBytes(this.storage, evidence);
          await tx.evidence.update({
            where: { id: evidence.id },
            data: { status: "READY" },
          });
          await tx.draftEvidence.upsert({
            where: {
              responseDraftId_evidenceId: {
                responseDraftId: draft.id,
                evidenceId: evidence.id,
              },
            },
            create: {
              projectId: p,
              responseDraftId: draft.id,
              evidenceId: evidence.id,
            },
            update: {},
          });
        }
        const updated = await tx.response.update({
          where: { id: response.id },
          data: { lockVersion: { increment: 1 } },
        });
        await tx.responseDraft.update({
          where: { id: draft.id },
          data: { lockVersion: updated.lockVersion },
        });
        return (await loadGraph(tx, this.access, r.actor, p)).graph.view(q);
      },
    );
  }
  async download(r: CommandContext, p: string, id: string) {
    return this.db.$transaction(
      async (tx) => {
        const { member, invitation } = await this.access.project(
          tx,
          r.actor,
          p,
        );
        const e = await tx.evidence.findFirst({
          where: { id, projectId: p },
          include: { response: true, RevisionEvidence_evidence: true },
        });
        if (!e || !["READY", "STAGED"].includes(e.status))
          throw new NotFoundException("No se encontró la evidencia.");
        if (
          invitation &&
          (!invitation.allowEvidence ||
            !invitation.questions.some(
              (q) => q.questionId === e.response.questionId,
            ))
        )
          throw new NotFoundException("No se encontró la evidencia.");
        let allowed = false;
        if (
          member.role === "STAKEHOLDER" &&
          e.uploadedById === r.actor.id &&
          e.response.respondentId === r.actor.id
        ) {
          allowed = !!(await tx.questionAssignment.findFirst({
            where: {
              projectId: p,
              questionId: e.response.questionId,
              projectMemberId: member.id,
              active: true,
              question: { publication: "PUBLISHED" },
            },
          }));
        } else if (
          ["ADMIN", "ANALYST"].includes(member.role) &&
          e.RevisionEvidence_evidence.length > 0
        )
          allowed = true;
        if (member.role === "VIEWER" && e.status === "READY") {
          const ids = e.RevisionEvidence_evidence.map(
            (link) => link.responseRevisionId,
          );
          allowed = !!(await tx.validation.findFirst({
            where: {
              projectId: p,
              questionId: e.response.questionId,
              invalidatedAt: null,
              question: { publication: "PUBLISHED" },
              OR: [
                {
                  ValidationSource_validation: {
                    some: { responseRevisionId: { in: ids } },
                  },
                },
                {
                  ValidationMessage_validation: {
                    some: {
                      message: { thread: { responseRevisionId: { in: ids } } },
                    },
                  },
                },
                {
                  ValidationResolution_validation: {
                    some: {
                      resolution: {
                        ConflictResolutionSource_resolution: {
                          some: { responseRevisionId: { in: ids } },
                        },
                      },
                    },
                  },
                },
              ],
            },
          }));
        }
        if (!allowed)
          throw new NotFoundException("No se encontró la evidencia.");
        const bytes = await verifiedBytes(this.storage, e);
        await audit(
          tx,
          r.actor,
          "EVIDENCE_DOWNLOADED",
          "Evidence",
          id,
          p,
          null,
          { sha256: e.sha256 },
          r.requestId,
        );
        return { bytes, evidence: presentEvidence(e) };
      },
      { timeout: 15000 },
    );
  }
  async recompute(tx: Tx, actor: User, p: string) {
    return recomputeReview(tx, this.access, actor, p);
  }
  private async uploadQuota(
    tx: Tx,
    p: string,
    q: string,
    userId: string,
    size: number,
  ) {
    const usage = await tx.evidence.aggregate({
      where: {
        projectId: p,
        status: { in: ["READY", "STAGED", "QUARANTINED"] },
      },
      _sum: { byteSize: true },
    });
    if (Number(usage._sum.byteSize ?? 0) + size > evidenceLimits().projectBytes)
      throw new UnprocessableEntityException(
        "El proyecto alcanzó su límite de almacenamiento.",
      );
    const staged = await tx.evidence.count({
      where: {
        projectId: p,
        status: "STAGED",
        response: { questionId: q, respondentId: userId },
      },
    });
    if (staged >= evidenceLimits().attachments)
      throw new UnprocessableEntityException(
        "Vincula los archivos pendientes antes de subir más. Las cargas sin vincular caducan en 24 horas.",
      );
  }
  async reconcile(now = new Date()) {
    const before = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const abandoned = await this.db.evidence.findMany({
      where: {
        backend: this.storage.backend,
        status: "STAGED",
        createdAt: { lt: before },
      },
      include: { uploadedBy: true },
    });
    let expired = 0;
    for (const candidate of abandoned) {
      await this.db.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM "Project" WHERE id=${candidate.projectId}::uuid FOR UPDATE`;
        const e = await tx.evidence.findFirst({
          where: {
            id: candidate.id,
            status: "STAGED",
            DraftEvidence_evidence: { none: {} },
            RevisionEvidence_evidence: { none: {} },
          },
        });
        if (!e) return;
        await tx.evidence.update({
          where: { id: e.id },
          data: { status: "REJECTED" },
        });
        await audit(
          tx,
          candidate.uploadedBy,
          "EVIDENCE_STAGE_EXPIRED",
          "Evidence",
          e.id,
          e.projectId,
          { status: "STAGED" },
          { status: "REJECTED", reason: "Unattached staging expired" },
        );
        expired++;
      });
    }
    let removed = 0;
    for (const key of await this.storage.candidates(before)) {
      const e = await this.db.evidence.findFirst({
        where: { backend: this.storage.backend, storageKey: key },
        include: {
          DraftEvidence_evidence: true,
          RevisionEvidence_evidence: true,
        },
      });
      if (
        !e ||
        (e.status === "REJECTED" &&
          !e.DraftEvidence_evidence.length &&
          !e.RevisionEvidence_evidence.length)
      ) {
        await this.storage.remove(key);
        removed++;
      }
    }
    return { removed, expired };
  }
}
