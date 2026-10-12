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
const EXCERPT_CHARS = 240,
  SCOPE_CHARS = 120,
  REASON_CHARS = 200;
/** A readable start of a text: one line, cut at a word, never the whole document. */
export function excerpt(text: string, max: number) {
  const flat = text.replace(/\s+/g, " ").trim();
  if (flat.length <= max) return { text: flat, truncated: false };
  const cut = flat.slice(0, max),
    space = cut.lastIndexOf(" ");
  return {
    text: (space > max * 0.6 ? cut.slice(0, space) : cut).trimEnd() + "…",
    truncated: true,
  };
}
type Subject = z.infer<typeof C.auditSubject>;
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
  /**
   * The decisions register as excerpts: one read of the project's decisions,
   * grouped in memory. Only people who can already read decisions in the review
   * (admins and analysts) get it; a question that was closed as "no aplica" is
   * not a reopened decision and is left out.
   */
  async decisions(actor: User, p: string) {
    return this.db.$transaction(
      async (tx) => {
        await this.access.project(tx, actor, p, ["ADMIN", "ANALYST"]);
        const rows = await tx.validation.findMany({
          where: { projectId: p, question: { publication: "PUBLISHED" } },
          select: {
            questionId: true,
            decisionText: true,
            scope: true,
            exceptions: true,
            validatedAt: true,
            invalidatedAt: true,
            invalidationReason: true,
            validatedBy: { select: { displayName: true } },
            question: { select: { status: true } },
          },
          orderBy: [{ validatedAt: "desc" }],
        });
        const byQuestion = new Map<string, typeof rows>();
        for (const row of rows)
          byQuestion.set(row.questionId, [
            ...(byQuestion.get(row.questionId) ?? []),
            row,
          ]);
        const entries: z.infer<typeof C.decisionRegisterEntry>[] = [];
        for (const [questionId, list] of byQuestion) {
          const current = list.find((v) => !v.invalidatedAt),
            shown = current ?? list[0]!;
          if (!current && shown.question.status === "NOT_APPLICABLE") continue;
          const text = excerpt(shown.decisionText, EXCERPT_CHARS);
          entries.push({
            questionId,
            state: current ? "CURRENT" : "REOPENED",
            excerpt: text.text,
            truncated: text.truncated,
            scope: excerpt(shown.scope, SCOPE_CHARS).text,
            hasExceptions: !!shown.exceptions?.trim(),
            decidedAt: shown.validatedAt.toISOString(),
            decidedBy: shown.validatedBy.displayName,
            endedAt: current
              ? null
              : (shown.invalidatedAt?.toISOString() ?? null),
            endedReason:
              !current && shown.invalidationReason
                ? excerpt(shown.invalidationReason, REASON_CHARS).text
                : null,
            previous: list.length - 1,
          });
        }
        return serialize(C.decisionRegisterView, { entries });
      },
      { isolationLevel: "RepeatableRead" },
    );
  }
  /**
   * Names what a page of events is about with a fixed number of reads (one per
   * kind of object), never one per event. Anything that cannot be resolved in
   * this project stays unnamed: nothing is invented.
   */
  private async subjects(
    tx: Tx,
    p: string,
    items: { objectType: string; objectId: string }[],
  ) {
    const ids = (type: string) => [
      ...new Set(
        items
          .filter(
            (e) =>
              e.objectType === type && z.uuid().safeParse(e.objectId).success,
          )
          .map((e) => e.objectId),
      ),
    ];
    const [responses, validations, dispositions, invitations] =
      await Promise.all([
        tx.response.findMany({
          where: { projectId: p, id: { in: ids("Response") } },
          select: { id: true, questionId: true },
        }),
        tx.validation.findMany({
          where: { projectId: p, id: { in: ids("Validation") } },
          select: { id: true, questionId: true },
        }),
        tx.questionDisposition.findMany({
          where: { projectId: p, id: { in: ids("QuestionDisposition") } },
          select: { id: true, questionId: true },
        }),
        tx.responseInvitation.findMany({
          where: { projectId: p, id: { in: ids("ResponseInvitation") } },
          select: { id: true, label: true },
        }),
      ]);
    const questionOf = new Map<string, string>();
    for (const row of [...responses, ...validations, ...dispositions])
      questionOf.set(row.id, row.questionId);
    const questions = await tx.question.findMany({
      where: {
        projectId: p,
        id: {
          in: [
            ...new Set([
              ...ids("Question"),
              // A response's first draft is recorded under its question's identifier.
              ...ids("Response"),
              ...questionOf.values(),
            ]),
          ],
        },
      },
      select: {
        id: true,
        externalId: true,
        QuestionRevision_questionRecord: {
          orderBy: { number: "desc" },
          take: 1,
          select: { title: true },
        },
      },
    });
    const named = new Map<string, Subject>(
      questions.map((q) => [
        q.id,
        {
          kind: "QUESTION",
          id: q.id,
          reference: q.externalId,
          label: q.QuestionRevision_questionRecord[0]?.title ?? q.externalId,
        },
      ]),
    );
    const invited = new Map<string, Subject>(
      invitations.map((i) => [
        i.id,
        { kind: "INVITATION", id: i.id, reference: null, label: i.label },
      ]),
    );
    return (e: { objectType: string; objectId: string }) => {
      if (e.objectType === "ResponseInvitation")
        return invited.get(e.objectId) ?? null;
      const own = e.objectType === "Question" || e.objectType === "Response";
      return (
        named.get(questionOf.get(e.objectId) ?? (own ? e.objectId : "")) ?? null
      );
    };
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
          ...(d.actorKind
            ? { actor: { invitationOnly: d.actorKind === "INVITATION" } }
            : {}),
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
        // The actor filter lists the accounts; the many external invitations are
        // one choice (their number says how many), plus the one being filtered.
        const withEvents = {
          organizationId: actor.organizationId,
          AuditEvent_actor: { some: { projectId: p } },
        };
        const [actors, invitationActors, subject] = await Promise.all([
          tx.user.findMany({
            where: {
              OR: [
                { ...withEvents, invitationOnly: false },
                ...(d.actorId ? [{ ...withEvents, id: d.actorId }] : []),
              ],
            },
            select: { id: true, displayName: true },
            orderBy: { displayName: "asc" },
          }),
          tx.user.count({ where: { ...withEvents, invitationOnly: true } }),
          this.subjects(tx, p, items),
        ]);
        return serialize(C.historyView, {
          items: items.map((e) => ({ ...safeAudit(e), subject: subject(e) })),
          total,
          page: d.page,
          pageSize: d.pageSize,
          actors,
          invitationActors,
        });
      },
      { isolationLevel: "RepeatableRead" },
    );
  }
}
