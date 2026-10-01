import { Injectable } from "@nestjs/common";
import { User, Prisma } from "@prisma/client";
import { z } from "zod";
import * as C from "@requirements/contracts";
import { Database } from "../database/database.module.js";
import { AccessService } from "../administration/access.service.js";
import { Tx, serialize } from "../common/http.js";
import { coverage, questionCoverage } from "../review/review-state.js";
export const auditSelect = {
  id: true,
  actorId: true,
  actorSnapshot: true,
  action: true,
  objectType: true,
  objectId: true,
  occurredAt: true,
  requestId: true,
  after: true,
} as const;
export function safeAudit(
  a: Prisma.AuditEventGetPayload<{ select: typeof auditSelect }>,
) {
  const actor = a.actorSnapshot as Record<string, unknown> | null,
    meta =
      a.action === "EXPORT_CREATED"
        ? (a.after as Record<string, unknown> | null)
        : null;
  return {
    id: a.id,
    actorId: a.actorId,
    actorName:
      typeof actor?.displayName === "string" ? actor.displayName : "Cuenta",
    action: a.action,
    objectType: a.objectType,
    objectId: a.objectId,
    occurredAt: a.occurredAt.toISOString(),
    requestId: a.requestId,
    exportType: typeof meta?.format === "string" ? meta.format : null,
    scope: typeof meta?.scope === "string" ? meta.scope : null,
  };
}
type Item = z.infer<typeof C.visibilityQuestion>;
export function metrics(
  items: Pick<Item, "status" | "submittedRespondents">[],
) {
  const n = items.length,
    v = items.filter((q) => q.status === "VALIDATED").length,
    a = items.filter((q) => q.status === "NOT_APPLICABLE").length;
  const metric = (count: number) => ({
    numerator: count,
    denominator: n,
    percentage: n ? Math.round((count / n) * 10000) / 100 : null,
  });
  return {
    validation: metric(v),
    closure: metric(v + a),
    submission: metric(items.filter((q) => q.submittedRespondents > 0).length),
  };
}
@Injectable()
export class VisibilityService {
  constructor(
    private readonly db: Database,
    private readonly access: AccessService,
  ) {}
  async items(tx: Tx, p: string) {
    const cv = await coverage(tx, this.access, p);
    const rows = await tx.question.findMany({
      where: { projectId: p, publication: "PUBLISHED" },
      include: {
        section: true,
        responsibleArea: true,
        QuestionRevision_questionRecord: {
          orderBy: { number: "desc" },
          take: 1,
        },
        QuestionCondition_child: true,
        QuestionTraceability_question: true,
      },
      orderBy: [{ section: { order: "asc" } }, { order: "asc" }],
    });
    return rows.map((q) => {
      const c = questionCoverage(cv, q.id);
      return {
        id: q.id,
        externalId: q.externalId,
        title: q.QuestionRevision_questionRecord[0]!.title,
        sectionId: q.sectionId,
        sectionTitle: q.section.title,
        priority: q.priority,
        areaId: q.responsibleAreaId,
        areaName: q.responsibleArea.name,
        status: q.status,
        submittedRespondents: c.currentIds.size,
        requiredRespondents: c.participants.filter(
          (a) => a.required && a.applicability === "ENABLED",
        ).length,
        conditionalWithoutCase:
          !!q.QuestionCondition_child &&
          !c.participants.some((a) => a.applicability === "ENABLED"),
        referenceIds: q.QuestionTraceability_question.map((r) => r.referenceId),
      };
    });
  }
  async dashboard(actor: User, p: string) {
    return this.db.$transaction(
      async (tx) => {
        const { project, member } = await this.access.project(tx, actor, p, [
            "ADMIN",
            "ANALYST",
          ]),
          questions = await this.items(tx, p);
        const breakdowns: z.infer<typeof C.dashboardView>["breakdowns"] = [];
        for (const dimension of [
          "section",
          "priority",
          "area",
          "status",
        ] as const) {
          const groups = new Map<string, { label: string; items: Item[] }>();
          for (const q of questions) {
            const key =
              dimension === "section"
                ? q.sectionId
                : dimension === "area"
                  ? q.areaId
                  : q[dimension];
            const label =
              dimension === "section"
                ? q.sectionTitle
                : dimension === "area"
                  ? q.areaName
                  : dimension === "status"
                    ? C.statusLabels[q.status]
                    : key;
            const group = groups.get(key) ?? { label, items: [] };
            group.items.push(q);
            groups.set(key, group);
          }
          for (const [key, g] of groups)
            breakdowns.push({
              dimension,
              key,
              label: g.label,
              metrics: metrics(g.items),
            });
        }
        return serialize(C.dashboardView, {
          projectName: project.name,
          role: member.role,
          metrics: metrics(questions),
          states: C.reviewStates.map((status) => ({
            status,
            count: questions.filter((q) => q.status === status).length,
          })),
          breakdowns,
          questions,
        });
      },
      { isolationLevel: "RepeatableRead", timeout: 30000 },
    );
  }
  async traceability(actor: User, p: string) {
    return this.db.$transaction(
      async (tx) => {
        await this.access.project(tx, actor, p, ["ADMIN", "ANALYST"]);
        const refs = await tx.traceabilityReference.findMany({
          where: { projectId: p },
          include: {
            QuestionTraceability_reference: {
              include: {
                question: {
                  include: {
                    QuestionRevision_questionRecord: {
                      orderBy: { number: "desc" },
                      take: 1,
                    },
                  },
                },
              },
            },
          },
          orderBy: [{ type: "asc" }, { externalId: "asc" }],
        });
        const questions = await tx.question.findMany({
          where: { projectId: p, publication: "PUBLISHED" },
          select: { QuestionTraceability_question: { select: { id: true } } },
        });
        return serialize(C.traceabilityView, {
          references: refs.map((r) => ({
            id: r.id,
            type: r.type,
            externalId: r.externalId,
            label: r.label,
            url: r.url,
            priority: r.priority,
            description: r.description,
            questions: r.QuestionTraceability_reference.map((l) => ({
              id: l.question.id,
              externalId: l.question.externalId,
              title: l.question.QuestionRevision_questionRecord[0]!.title,
              publication: l.question.publication,
              status: l.question.status,
            })),
          })),
          questionsWithReferences: questions.filter(
            (q) => q.QuestionTraceability_question.length,
          ).length,
          questionsWithoutReferences: questions.filter(
            (q) => !q.QuestionTraceability_question.length,
          ).length,
        });
      },
      { isolationLevel: "RepeatableRead" },
    );
  }
  async history(actor: User, p: string, d: z.infer<typeof C.historyQuery>) {
    return this.db.$transaction(
      async (tx) => {
        await this.access.project(tx, actor, p, ["ADMIN", "ANALYST"]);
        const where: Prisma.AuditEventWhereInput = {
          projectId: p,
          organizationId: actor.organizationId,
          ...(d.objectType ? { objectType: d.objectType } : {}),
          ...(d.actorId ? { actorId: d.actorId } : {}),
          ...(d.action ? { action: d.action } : {}),
          occurredAt: {
            ...(d.from ? { gte: new Date(d.from) } : {}),
            ...(d.to ? { lte: new Date(d.to) } : {}),
          },
        };
        const total = await tx.auditEvent.count({ where }),
          items = await tx.auditEvent.findMany({
            where,
            select: auditSelect,
            orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
            skip: (d.page - 1) * d.pageSize,
            take: d.pageSize,
          });
        const actors = await tx.user.findMany({
          where: {
            organizationId: actor.organizationId,
            AuditEvent_actor: { some: { projectId: p } },
          },
          select: { id: true, displayName: true },
          orderBy: { displayName: "asc" },
        });
        return serialize(C.historyView, {
          items: items.map(safeAudit),
          total,
          page: d.page,
          pageSize: d.pageSize,
          actors,
        });
      },
      { isolationLevel: "RepeatableRead" },
    );
  }
}
