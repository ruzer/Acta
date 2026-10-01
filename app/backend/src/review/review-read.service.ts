import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, User } from "@prisma/client";
import { z } from "zod";
import * as C from "@requirements/contracts";
import { Database } from "../database/database.module.js";
import { AccessService } from "../administration/access.service.js";
import { serialize, Tx } from "../common/http.js";
import { coverage, questionCoverage } from "./review-state.js";
import { presentEvidence, loadGraph } from "../responses/response-graph.js";
import { ReviewService } from "./review.service.js";
const person = (u: { id: string; displayName: string } | null) =>
  u ? { id: u.id, displayName: u.displayName } : null;
const threadInclude = {
  revision: { include: { response: true } },
  closedBy: true,
  ClarificationMessage_thread: {
    orderBy: [{ createdAt: "asc" as const }, { id: "asc" as const }],
    include: { author: true },
  },
};
function threadView(
  t: Prisma.ClarificationThreadGetPayload<{ include: typeof threadInclude }>,
) {
  return {
    id: t.id,
    responseRevisionId: t.responseRevisionId,
    respondentId: t.revision.response.respondentId,
    status: t.status,
    lockVersion: t.lockVersion,
    createdAt: t.createdAt.toISOString(),
    closedAt: t.closedAt?.toISOString() ?? null,
    closedBy: person(t.closedBy),
    closeReason: t.closeReason,
    messages: t.ClarificationMessage_thread.map((m) => ({
      id: m.id,
      threadId: t.id,
      author: person(m.author),
      body: m.body,
      createdAt: m.createdAt.toISOString(),
    })),
  };
}
@Injectable()
export class ReviewReadService {
  constructor(
    private readonly db: Database,
    private readonly access: AccessService,
    private readonly commands: ReviewService,
  ) {}
  async personal(actor: User, p: string, q: string) {
    return this.db.$transaction(
      async (tx) => {
        await this.commands.ownerAssignment(tx, actor, p, q);
        const { graph } = await loadGraph(tx, this.access, actor, p);
        const v = graph.view(q);
        const question = await tx.question.findFirstOrThrow({
          where: { id: q, projectId: p },
        });
        const threads = await tx.clarificationThread.findMany({
          where: {
            projectId: p,
            revision: { response: { questionId: q, respondentId: actor.id } },
          },
          include: threadInclude,
          orderBy: { createdAt: "asc" },
        });
        return serialize(C.myClarificationsView, {
          questionId: q,
          lockVersion: question.lockVersion,
          question: v.question,
          submissions: v.revisions,
          threads: threads.map(threadView),
        });
      },
      { isolationLevel: "RepeatableRead" },
    );
  }
  async detail(actor: User, p: string, q: string) {
    return this.db.$transaction((tx) => this.detailTx(tx, actor, p, q), {
      isolationLevel: "RepeatableRead",
      timeout: 15000,
    });
  }
  async detailTx(
    tx: Tx,
    actor: User,
    p: string,
    q: string,
    decisionsOnly = false,
  ) {
    const { project, member } = await this.access.project(tx, actor, p, [
      "ANALYST",
      "ADMIN",
      "VIEWER",
    ]);
    const question = await tx.question.findFirst({
      where: { id: q, projectId: p, publication: "PUBLISHED" },
      include: {
        section: true,
        QuestionRevision_questionRecord: {
          orderBy: { number: "desc" },
          take: 1,
          include: { QuestionOption_revision: { orderBy: { order: "asc" } } },
        },
        QuestionTraceability_question: { include: { reference: true } },
      },
    });
    if (!question) throw new NotFoundException("No se encontró la pregunta.");
    const validations = await tx.validation.findMany({
      where: {
        projectId: p,
        questionId: q,
        ...(member.role === "VIEWER" || decisionsOnly
          ? { invalidatedAt: null }
          : {}),
      },
      include: {
        validatedBy: true,
        invalidatedBy: true,
        ValidationSource_validation: true,
        ValidationMessage_validation: true,
        ValidationResolution_validation: true,
      },
      orderBy: { validatedAt: "desc" },
    });
    if ((member.role === "VIEWER" || decisionsOnly) && !validations.length)
      throw new NotFoundException("No hay una decisión vigente disponible.");
    const [threads, conflicts, dispositions, revisions] = await Promise.all([
      tx.clarificationThread.findMany({
        where: { projectId: p, revision: { response: { questionId: q } } },
        include: threadInclude,
        orderBy: { createdAt: "asc" },
      }),
      tx.conflict.findMany({
        where: { projectId: p, questionId: q },
        include: {
          openedBy: true,
          ConflictParticipant_conflict: true,
          ConflictResolution_conflict: {
            include: {
              resolvedBy: true,
              ConflictResolutionSource_resolution: true,
            },
          },
        },
        orderBy: { openedAt: "desc" },
      }),
      tx.questionDisposition.findMany({
        where: { projectId: p, questionId: q },
        include: { markedBy: true, revokedBy: true },
        orderBy: { markedAt: "desc" },
      }),
      tx.responseRevision.findMany({
        where: {
          projectId: p,
          status: "SUBMITTED",
          response: { questionId: q },
        },
        include: {
          response: { include: { respondent: true } },
          area: true,
          RevisionEvidence_revision: { include: { evidence: true } },
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      }),
    ]);
    const cv = questionCoverage(await coverage(tx, this.access, p), q);
    const messageIds = new Set(
      validations.flatMap((v) =>
        v.ValidationMessage_validation.map((m) => m.clarificationMessageId),
      ),
    );
    const resolutionIds = new Set(
      validations.flatMap((v) =>
        v.ValidationResolution_validation.map((s) => s.conflictResolutionId),
      ),
    );
    const visibleIds = new Set(
      validations.flatMap((v) =>
        v.ValidationSource_validation.map((s) => s.responseRevisionId),
      ),
    );
    for (const t of threads)
      if (t.ClarificationMessage_thread.some((m) => messageIds.has(m.id)))
        visibleIds.add(t.responseRevisionId);
    for (const c of conflicts)
      if (
        c.ConflictResolution_conflict &&
        resolutionIds.has(c.ConflictResolution_conflict.id)
      )
        for (const s of c.ConflictResolution_conflict
          .ConflictResolutionSource_resolution)
          visibleIds.add(s.responseRevisionId);
    const viewer = member.role === "VIEWER" || decisionsOnly,
      v = question.QuestionRevision_questionRecord[0]!;
    const snapshotName = (
      snapshot: Prisma.JsonValue,
      key: string,
      fallback: string,
    ) =>
      snapshot &&
      typeof snapshot === "object" &&
      !Array.isArray(snapshot) &&
      typeof snapshot[key] === "string"
        ? snapshot[key]
        : fallback;
    const pendingEvent =
      !viewer && question.pendingReview
        ? await tx.auditEvent.findFirst({
            where: { projectId: p, objectId: q, action: "QUESTION_PENDING" },
            orderBy: { occurredAt: "desc" },
            select: { after: true },
          })
        : null;
    const pendingPayload = pendingEvent?.after;
    const pendingReviewReason =
      pendingPayload &&
      typeof pendingPayload === "object" &&
      !Array.isArray(pendingPayload) &&
      typeof pendingPayload.reason === "string"
        ? pendingPayload.reason
        : null;
    return serialize(C.reviewDetailView, {
      projectId: p,
      projectName: project.name,
      question: {
        id: q,
        sectionId: question.sectionId,
        sectionTitle: question.section.title,
        title: v.title,
        question: v.question,
        helpText: v.helpText,
        type: v.type,
        required: v.required,
        config: v.config,
        options: v.QuestionOption_revision.map((o) => ({
          value: o.value,
          label: o.label,
          order: o.order,
        })),
        position: 1,
        total: 1,
        applicability: "ENABLED",
      },
      status: question.status,
      priority: question.priority,
      lockVersion: question.lockVersion,
      canReview:
        !viewer && member.role === "ANALYST" && project.lifecycle === "ACTIVE",
      partialReviewReason: viewer ? null : question.partialReviewReason,
      pendingReview: viewer ? false : question.pendingReview,
      pendingReviewReason,
      participants: viewer ? [] : cv.participants,
      submissions: revisions
        .filter((r) => !viewer || visibleIds.has(r.id))
        .map((r) => ({
          id: r.id,
          number: r.number,
          status: r.status,
          answer: r.answer,
          comment: r.comment ?? "",
          example: r.example ?? "",
          createdAt: r.createdAt.toISOString(),
          current: cv.currentIds.has(r.id),
          respondent: {
            id: r.response.respondentId,
            displayName: snapshotName(
              r.respondentSnapshot,
              "displayName",
              r.response.respondent.displayName,
            ),
          },
          area: {
            id: r.areaId,
            name: snapshotName(r.areaSnapshot, "name", r.area.name),
          },
          evidence: r.RevisionEvidence_revision.map((l) => ({
            id: l.id,
            evidence: presentEvidence(l.evidence),
          })),
        })),
      threads: threads
        .filter(
          (t) =>
            !viewer ||
            t.ClarificationMessage_thread.some((m) => messageIds.has(m.id)),
        )
        .map((t) => {
          const view = threadView(t);
          return {
            ...view,
            ...(viewer ? { closeReason: null } : {}),
            messages: viewer
              ? view.messages.filter((m) => messageIds.has(m.id))
              : view.messages,
          };
        }),
      validations: validations.map((v) => ({
        id: v.id,
        decisionText: v.decisionText,
        scope: v.scope,
        exceptions: v.exceptions,
        validationComment: viewer ? "" : v.validationComment,
        validatedBy: person(v.validatedBy),
        validatedAt: v.validatedAt.toISOString(),
        invalidatedAt: v.invalidatedAt?.toISOString() ?? null,
        invalidatedBy: person(v.invalidatedBy),
        invalidationReason: v.invalidationReason,
        sources: v.ValidationSource_validation.map((s) => ({
          id: s.id,
          responseRevisionId: s.responseRevisionId,
        })),
        messages: v.ValidationMessage_validation.map((s) => ({
          id: s.id,
          clarificationMessageId: s.clarificationMessageId,
        })),
        resolutions: v.ValidationResolution_validation.map((s) => ({
          id: s.id,
          conflictResolutionId: s.conflictResolutionId,
        })),
      })),
      conflicts: conflicts
        .filter(
          (c) =>
            !viewer ||
            (c.ConflictResolution_conflict &&
              resolutionIds.has(c.ConflictResolution_conflict.id)),
        )
        .map((c) => ({
          id: c.id,
          reason: viewer ? "" : c.reason,
          openedBy: person(c.openedBy),
          openedAt: c.openedAt.toISOString(),
          status: c.status,
          lockVersion: c.lockVersion,
          participants: c.ConflictParticipant_conflict.filter(
            (s) => !viewer || visibleIds.has(s.responseRevisionId),
          ).map((s) => ({
            id: s.id,
            responseRevisionId: s.responseRevisionId,
          })),
          resolution: c.ConflictResolution_conflict
            ? {
                id: c.ConflictResolution_conflict.id,
                resolutionText: c.ConflictResolution_conflict.resolutionText,
                resolvedAt:
                  c.ConflictResolution_conflict.resolvedAt.toISOString(),
                resolvedBy: person(c.ConflictResolution_conflict.resolvedBy),
                sources:
                  c.ConflictResolution_conflict.ConflictResolutionSource_resolution.map(
                    (s) => ({
                      id: s.id,
                      responseRevisionId: s.responseRevisionId,
                    }),
                  ),
              }
            : null,
        })),
      dispositions: viewer
        ? []
        : dispositions.map((d) => ({
            id: d.id,
            reason: d.reason,
            scope: d.scope,
            markedBy: person(d.markedBy),
            markedAt: d.markedAt.toISOString(),
            revokedAt: d.revokedAt?.toISOString() ?? null,
            revokedBy: person(d.revokedBy),
            revokeReason: d.revokeReason,
          })),
      references: question.QuestionTraceability_question.map((l) => ({
        id: l.reference.id,
        type: l.reference.type,
        externalId: l.reference.externalId,
        label: l.reference.label,
        url: l.reference.url,
        priority: l.reference.priority,
        description: l.reference.description,
        scopeNote: l.scopeNote ?? "",
      })),
    });
  }
  async inbox(actor: User, d: z.infer<typeof C.reviewInboxQuery>) {
    return this.db.$transaction(
      async (tx) => {
        const projects = await tx.project.findMany({
          where: {
            organizationId: actor.organizationId,
            lifecycle: "ACTIVE",
            ProjectMember_project: {
              some: {
                userId: actor.id,
                active: true,
                role: "ANALYST",
                user: { active: true },
              },
            },
          },
        });
        const projectIds = projects.map((p) => p.id);
        const where: Prisma.QuestionWhereInput = {
          projectId: { in: projectIds },
          publication: "PUBLISHED",
          ...(d.projectId ? { AND: [{ projectId: d.projectId }] } : {}),
          ...(d.status ? { status: d.status } : {}),
          ...(d.sectionId ? { sectionId: d.sectionId } : {}),
          ...(d.priority ? { priority: d.priority } : {}),
          ...(d.areaId ? { responsibleAreaId: d.areaId } : {}),
          ...(d.participantId
            ? {
                QuestionAssignment_question: {
                  some: {
                    active: true,
                    member: { userId: d.participantId, active: true },
                  },
                },
              }
            : {}),
        };
        const [total, questions, sections, areas, participants] =
          await Promise.all([
            tx.question.count({ where }),
            tx.question.findMany({
              where,
              orderBy: [
                { priority: "asc" },
                { updatedAt: "desc" },
                { id: "asc" },
              ],
              skip: (d.page - 1) * d.pageSize,
              take: d.pageSize,
              include: {
                project: true,
                section: true,
                responsibleArea: true,
                QuestionRevision_questionRecord: {
                  take: 1,
                  orderBy: { number: "desc" },
                },
                Response_question: {
                  include: {
                    respondent: true,
                    ResponseRevision_response: {
                      orderBy: { number: "desc" },
                      take: 1,
                      include: {
                        area: true,
                        RevisionEvidence_revision: true,
                        ClarificationThread_revision: {
                          include: {
                            ClarificationMessage_thread: {
                              orderBy: { createdAt: "desc" },
                              take: 1,
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            }),
            tx.section.findMany({
              where: { projectId: { in: projectIds } },
              orderBy: { order: "asc" },
            }),
            tx.area.findMany({
              where: {
                organizationId: actor.organizationId,
                Question_responsibleArea: {
                  some: { projectId: { in: projectIds } },
                },
              },
            }),
            tx.projectMember.findMany({
              where: {
                projectId: { in: projectIds },
                active: true,
                role: "STAKEHOLDER",
              },
              include: { user: true },
            }),
          ]);
        const items = await Promise.all(
          questions.map(async (q) => {
            const revisions = q.Response_question.flatMap((r) =>
              r.ResponseRevision_response.map((v) => ({ r, v })),
            );
            const openClarifications = await tx.clarificationThread.count({
              where: {
                projectId: q.projectId,
                status: { not: "CLOSED" },
                revision: { response: { questionId: q.id } },
              },
            });
            const lastMessage = await tx.clarificationMessage.findFirst({
              where: {
                projectId: q.projectId,
                thread: { revision: { response: { questionId: q.id } } },
              },
              orderBy: { createdAt: "desc" },
            });
            const times = [
              ...revisions.map((x) => x.v.createdAt.toISOString()),
              ...(lastMessage ? [lastMessage.createdAt.toISOString()] : []),
            ]
              .sort()
              .reverse();
            return {
              questionId: q.id,
              projectId: q.projectId,
              projectName: q.project.name,
              sectionId: q.sectionId,
              sectionTitle: q.section.title,
              question: q.QuestionRevision_questionRecord[0]!.question,
              status: q.status,
              priority: q.priority,
              areaId: q.responsibleAreaId,
              areaName: q.responsibleArea.name,
              respondents: revisions.map(({ r, v }) => ({
                id: r.respondentId,
                displayName: r.respondent.displayName,
                areaName: v.area.name,
              })),
              lastContributionAt: times[0] ?? null,
              hasEvidence: revisions.some(
                (x) => x.v.RevisionEvidence_revision.length > 0,
              ),
              openClarifications,
            };
          }),
        );
        return serialize(C.reviewInboxView, {
          items,
          total,
          page: d.page,
          pageSize: d.pageSize,
          filters: {
            projects: projects.map((p) => ({ id: p.id, name: p.name })),
            sections: sections.map((s) => ({ id: s.id, name: s.title })),
            areas: areas.map((a) => ({ id: a.id, name: a.name })),
            participants: [
              ...new Map(
                participants.map((m) => [
                  m.userId,
                  { id: m.userId, name: m.user.displayName },
                ]),
              ).values(),
            ],
          },
        });
      },
      { isolationLevel: "RepeatableRead", timeout: 15000 },
    );
  }
}
