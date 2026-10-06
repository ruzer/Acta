import {
  Injectable,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import { User } from "@prisma/client";
import { z } from "zod";
import * as C from "@requirements/contracts";
import { Database } from "../database/database.module.js";
import { AccessService } from "../administration/access.service.js";
import { Tx, CommandContext, serialize, jsonValue } from "../common/http.js";
import { canonical } from "../responses/response-graph.js";
import { sha256 } from "../responses/storage.js";
import {
  coverage,
  questionCoverage,
  invalidateValidation,
  revokeDisposition,
  recomputeReview,
} from "./review-state.js";

@Injectable()
export class ReviewService {
  constructor(
    private readonly db: Database,
    private readonly access: AccessService,
  ) {}
  private async question(tx: Tx, p: string, q: string) {
    const v = await tx.question.findFirst({
      where: { id: q, projectId: p, publication: "PUBLISHED" },
    });
    if (!v)
      throw new NotFoundException(
        "No se encontró una pregunta publicada para revisar.",
      );
    return v;
  }
  private async execute(
    r: CommandContext,
    p: string,
    q: string,
    d: z.infer<typeof C.reviewCommand>,
    operation: string,
    payload: unknown,
    work: (tx: Tx) => Promise<string | null>,
    stakeholder = false,
  ) {
    return this.access.mutate(
      r.actor,
      p,
      [stakeholder ? "STAKEHOLDER" : "ANALYST"],
      async (tx) => {
        const question = await this.question(tx, p, q);
        if (stakeholder) await this.ownerAssignment(tx, r.actor, p, q);
        const hash = sha256(canonical({ p, q, operation, payload }));
        const prev = await tx.auditEvent.findFirst({
          where: {
            organizationId: r.actor.organizationId,
            actorId: r.actor.id,
            requestId: d.requestId,
            eventIndex: 0,
          },
        });
        if (prev) {
          if (prev.payloadHash !== hash)
            throw new ConflictException(
              "La solicitud ya se utilizó con otros datos.",
            );
          return serialize(C.reviewResult, prev.result);
        }
        if (question.lockVersion !== d.expectedVersion)
          throw new ConflictException(
            "La revisión cambió. Conserva tu texto y actualiza la información.",
          );
        const threadId = await work(tx);
        await tx.question.update({
          where: { id: q },
          data: { lockVersion: { increment: 1 } },
        });
        await recomputeReview(tx, this.access, r.actor, p);
        const latest = await this.question(tx, p, q);
        const result = serialize(C.reviewResult, {
          questionId: q,
          status: latest.status,
          lockVersion: latest.lockVersion,
          threadId,
        });
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
            objectType: "Question",
            objectId: q,
            requestId: d.requestId,
            payloadHash: hash,
            before: jsonValue({
              status: question.status,
              partialReviewReason: question.partialReviewReason,
              pendingReview: question.pendingReview,
            }),
            after: jsonValue(payload),
            result: jsonValue(result),
          },
        });
        return result;
      },
    );
  }
  async ownerAssignment(tx: Tx, actor: User, p: string, q: string) {
    const { member } = await this.access.project(tx, actor, p, ["STAKEHOLDER"]);
    const a = await tx.questionAssignment.findFirst({
      where: {
        projectId: p,
        questionId: q,
        projectMemberId: member.id,
        active: true,
        member: { area: { active: true } },
      },
    });
    if (!a) throw new NotFoundException("No se encontró la pregunta asignada.");
    return a;
  }
  private async sources(
    tx: Tx,
    p: string,
    q: string,
    ids: string[],
    current = false,
  ) {
    const rows = await tx.responseRevision.findMany({
      where: {
        id: { in: ids },
        projectId: p,
        status: "SUBMITTED",
        response: { questionId: q },
      },
      include: { response: true },
    });
    if (rows.length !== ids.length)
      throw new NotFoundException("Una fuente no pertenece a esta pregunta.");
    if (current) {
      const cv = questionCoverage(await coverage(tx, this.access, p), q);
      if (ids.some((id) => !cv.currentIds.has(id)))
        throw new ConflictException(
          "Una fuente ya no es vigente. Revisa los últimos envíos y su contexto.",
        );
    }
    return rows;
  }
  private async noBlocks(tx: Tx, p: string, q: string) {
    if (
      await tx.conflict.findFirst({
        where: { projectId: p, questionId: q, status: "OPEN" },
      })
    )
      throw new ConflictException(
        "Resuelve los conflictos abiertos antes de continuar.",
      );
    if (
      await tx.clarificationThread.findFirst({
        where: {
          projectId: p,
          status: { not: "CLOSED" },
          revision: { response: { questionId: q } },
        },
      })
    )
      throw new ConflictException(
        "Cierra las aclaraciones abiertas antes de continuar.",
      );
  }
  private async revoke(
    tx: Tx,
    r: CommandContext,
    p: string,
    q: string,
    reason: string,
  ) {
    await invalidateValidation(tx, r.actor, p, q, reason);
    await revokeDisposition(tx, r.actor, p, q, reason);
  }
  private async thread(
    tx: Tx,
    p: string,
    q: string,
    id: string,
    expected: number | null,
    owner?: string,
  ) {
    const t = await tx.clarificationThread.findFirst({
      where: {
        id,
        projectId: p,
        revision: {
          response: {
            questionId: q,
            ...(owner ? { respondentId: owner } : {}),
          },
        },
      },
      include: { revision: { include: { response: true } } },
    });
    if (!t) throw new NotFoundException("No se encontró la aclaración.");
    if (t.lockVersion !== expected)
      throw new ConflictException("El hilo cambió. Actualiza antes de enviar.");
    return t;
  }
  request(
    r: CommandContext,
    p: string,
    q: string,
    d: z.infer<typeof C.requestClarificationInput>,
  ) {
    return this.execute(
      r,
      p,
      q,
      d,
      "CLARIFICATION_REQUESTED",
      d,
      async (tx) => {
        let threadId: string;
        if (d.threadId) {
          const t = await this.thread(
            tx,
            p,
            q,
            d.threadId,
            d.expectedThreadVersion,
          );
          if (
            t.responseRevisionId !== d.responseRevisionId ||
            t.status !== "WAITING_ANALYST"
          )
            throw new ConflictException(
              "Solo puedes continuar un hilo que espera tu revisión, sobre su respuesta original.",
            );
          threadId = t.id;
          await tx.clarificationThread.update({
            where: { id: t.id },
            data: {
              status: "WAITING_STAKEHOLDER",
              lockVersion: { increment: 1 },
            },
          });
        } else {
          await this.sources(tx, p, q, [d.responseRevisionId], true);
          const t = await tx.clarificationThread.create({
            data: {
              projectId: p,
              responseRevisionId: d.responseRevisionId,
              requestedById: r.actor.id,
              status: "WAITING_STAKEHOLDER",
            },
          });
          threadId = t.id;
        }
        await tx.clarificationMessage.create({
          data: { projectId: p, threadId, authorId: r.actor.id, body: d.body },
        });
        await this.revoke(tx, r, p, q, "Se solicitó una aclaración.");
        return threadId;
      },
    );
  }
  reply(
    r: CommandContext,
    p: string,
    q: string,
    d: z.infer<typeof C.replyClarificationInput>,
  ) {
    return this.execute(
      r,
      p,
      q,
      d,
      "CLARIFICATION_RESPONDED",
      d,
      async (tx) => {
        const t = await this.thread(
          tx,
          p,
          q,
          d.threadId,
          d.expectedThreadVersion,
          r.actor.id,
        );
        if (t.revision.response.respondentId !== r.actor.id)
          throw new NotFoundException("No se encontró la aclaración.");
        if (t.status !== "WAITING_STAKEHOLDER")
          throw new ConflictException(
            "La aclaración no está esperando una respuesta.",
          );
        await tx.clarificationMessage.create({
          data: {
            projectId: p,
            threadId: t.id,
            authorId: r.actor.id,
            body: d.body,
          },
        });
        await tx.clarificationThread.update({
          where: { id: t.id },
          data: { status: "WAITING_ANALYST", lockVersion: { increment: 1 } },
        });
        return t.id;
      },
      true,
    );
  }
  close(
    r: CommandContext,
    p: string,
    q: string,
    d: z.infer<typeof C.closeClarificationInput>,
  ) {
    return this.execute(r, p, q, d, "CLARIFICATION_CLOSED", d, async (tx) => {
      const t = await this.thread(
        tx,
        p,
        q,
        d.threadId,
        d.expectedThreadVersion,
      );
      if (t.status !== "WAITING_ANALYST")
        throw new ConflictException(
          "Solo puedes cerrar un hilo después de recibir la aclaración.",
        );
      await tx.clarificationThread.update({
        where: { id: t.id },
        data: {
          status: "CLOSED",
          closedAt: new Date(),
          closedById: r.actor.id,
          closeReason: d.reason,
          lockVersion: { increment: 1 },
        },
      });
      return t.id;
    });
  }
  mark(
    r: CommandContext,
    p: string,
    q: string,
    d: z.infer<typeof C.reviewReasonInput>,
    partial: boolean,
  ) {
    return this.execute(
      r,
      p,
      q,
      d,
      partial ? "QUESTION_PARTIAL" : "QUESTION_PENDING",
      d,
      async (tx) => {
        await this.noBlocks(tx, p, q);
        await this.revoke(tx, r, p, q, d.reason);
        await tx.question.update({
          where: { id: q },
          data: {
            partialReviewReason: partial ? d.reason : null,
            pendingReview: !partial,
          },
        });
        return null;
      },
    );
  }
  notApplicable(
    r: CommandContext,
    p: string,
    q: string,
    d: z.infer<typeof C.notApplicableInput>,
  ) {
    return this.execute(
      r,
      p,
      q,
      d,
      "QUESTION_NOT_APPLICABLE",
      d,
      async (tx) => {
        await this.noBlocks(tx, p, q);
        await this.revoke(tx, r, p, q, d.reason);
        await tx.questionDisposition.create({
          data: {
            projectId: p,
            questionId: q,
            reason: d.reason,
            scope: d.scope,
            markedById: r.actor.id,
          },
        });
        return null;
      },
    );
  }
  reopen(
    r: CommandContext,
    p: string,
    q: string,
    d: z.infer<typeof C.reviewReasonInput>,
  ) {
    return this.execute(r, p, q, d, "QUESTION_REOPENED", d, async (tx) => {
      const v = await tx.validation.findFirst({
        where: { projectId: p, questionId: q, invalidatedAt: null },
      });
      const n = await tx.questionDisposition.findFirst({
        where: { projectId: p, questionId: q, revokedAt: null },
      });
      if (!v && !n)
        throw new ConflictException(
          "Solo puedes reabrir una decisión vigente validada o no aplicable.",
        );
      await this.revoke(tx, r, p, q, d.reason);
      await tx.question.update({
        where: { id: q },
        data: { partialReviewReason: null, pendingReview: true },
      });
      return null;
    });
  }
  conflict(
    r: CommandContext,
    p: string,
    q: string,
    d: z.infer<typeof C.markConflictInput>,
  ) {
    return this.execute(r, p, q, d, "CONFLICT_MARKED", d, async (tx) => {
      const rows = await this.sources(tx, p, q, d.responseRevisionIds);
      if (new Set(rows.map((v) => v.response.respondentId)).size < 2)
        throw new ConflictException(
          "Selecciona respuestas de al menos dos participantes distintos.",
        );
      const c = await tx.conflict.create({
        data: {
          projectId: p,
          questionId: q,
          reason: d.reason,
          openedById: r.actor.id,
          status: "OPEN",
        },
      });
      await tx.conflictParticipant.createMany({
        data: d.responseRevisionIds.map((responseRevisionId) => ({
          projectId: p,
          conflictId: c.id,
          responseRevisionId,
        })),
      });
      await this.revoke(tx, r, p, q, d.reason);
      return null;
    });
  }
  resolve(
    r: CommandContext,
    p: string,
    q: string,
    d: z.infer<typeof C.resolveConflictInput>,
  ) {
    return this.execute(r, p, q, d, "CONFLICT_RESOLVED", d, async (tx) => {
      const c = await tx.conflict.findFirst({
        where: { id: d.conflictId, projectId: p, questionId: q },
      });
      if (!c) throw new NotFoundException("No se encontró el conflicto.");
      if (c.status !== "OPEN" || c.lockVersion !== d.expectedConflictVersion)
        throw new ConflictException("El conflicto cambió o ya se resolvió.");
      await this.sources(tx, p, q, d.responseRevisionIds, true);
      const res = await tx.conflictResolution.create({
        data: {
          projectId: p,
          conflictId: c.id,
          resolutionText: d.resolutionText,
          resolvedById: r.actor.id,
        },
      });
      await tx.conflictResolutionSource.createMany({
        data: d.responseRevisionIds.map((responseRevisionId) => ({
          projectId: p,
          resolutionId: res.id,
          responseRevisionId,
        })),
      });
      await tx.conflict.update({
        where: { id: c.id },
        data: { status: "RESOLVED", lockVersion: { increment: 1 } },
      });
      return null;
    });
  }
  validate(
    r: CommandContext,
    p: string,
    q: string,
    d: z.infer<typeof C.validateQuestionInput>,
  ) {
    return this.execute(r, p, q, d, "RESPONSE_VALIDATED", d, async (tx) => {
      await this.noBlocks(tx, p, q);
      const question = await this.question(tx, p, q);
      if (!["ANSWERED", "PARTIAL"].includes(question.status))
        throw new ConflictException(
          "La pregunta debe contar con aportaciones revisables.",
        );
      if (question.partialReviewReason && !d.coverageExplanation.trim())
        throw new ConflictException(
          "Explica cómo se atendió el vacío señalado en la respuesta parcial.",
        );
      const messages = await tx.clarificationMessage.findMany({
        where: {
          id: { in: d.clarificationMessageIds },
          projectId: p,
          thread: {
            status: "CLOSED",
            revision: { response: { questionId: q } },
          },
        },
        include: { thread: true },
      });
      const resolutions = await tx.conflictResolution.findMany({
        where: {
          id: { in: d.conflictResolutionIds },
          projectId: p,
          conflict: { questionId: q, status: "RESOLVED" },
        },
        include: { ConflictResolutionSource_resolution: true },
      });
      if (
        messages.length !== d.clarificationMessageIds.length ||
        resolutions.length !== d.conflictResolutionIds.length
      )
        throw new ConflictException(
          "Selecciona fuentes cerradas de esta pregunta.",
        );
      const ids = [
        ...new Set([
          ...d.responseRevisionIds,
          ...messages.map((m) => m.thread.responseRevisionId),
          ...resolutions.flatMap((v) =>
            v.ConflictResolutionSource_resolution.map(
              (s) => s.responseRevisionId,
            ),
          ),
        ]),
      ];
      const rows = await this.sources(tx, p, q, ids);
      if (rows.some((v) => v.response.respondentId === r.actor.id))
        throw new ForbiddenException(
          "No puedes validar una decisión sustentada en tu propia respuesta.",
        );
      await this.sources(tx, p, q, ids, true);
      const cv = questionCoverage(await coverage(tx, this.access, p), q);
      if (cv.missing > 0 || cv.currentIds.size === 0)
        throw new ConflictException(
          "Faltan aportaciones vigentes de participantes requeridos.",
        );
      const required = cv.participants
        .filter((v) => v.required && v.applicability === "ENABLED")
        .map((v) => v.currentRevisionId!);
      if (required.some((id) => !ids.includes(id)))
        throw new ConflictException(
          "Incluye las fuentes de los participantes requeridos en la decisión.",
        );
      await this.revoke(tx, r, p, q, "Se registró una nueva decisión.");
      const v = await tx.validation.create({
        data: {
          projectId: p,
          questionId: q,
          decisionText: d.decisionText,
          scope: d.scope,
          exceptions: d.exceptions || null,
          validationComment: d.validationComment,
          validatedById: r.actor.id,
        },
      });
      await tx.validationSource.createMany({
        data: d.responseRevisionIds.map((responseRevisionId) => ({
          projectId: p,
          validationId: v.id,
          responseRevisionId,
        })),
      });
      if (messages.length)
        await tx.validationMessage.createMany({
          data: messages.map((m) => ({
            projectId: p,
            validationId: v.id,
            clarificationMessageId: m.id,
          })),
        });
      if (resolutions.length)
        await tx.validationResolution.createMany({
          data: resolutions.map((c) => ({
            projectId: p,
            validationId: v.id,
            conflictResolutionId: c.id,
          })),
        });
      await tx.question.update({
        where: { id: q },
        data: { partialReviewReason: null, pendingReview: false },
      });
      return null;
    });
  }
}
