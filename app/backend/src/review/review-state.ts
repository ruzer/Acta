import { User, ReviewStatus } from "@prisma/client";
import { AccessService } from "../administration/access.service.js";
import { Tx, audit } from "../common/http.js";
import { loadGraph } from "../responses/response-graph.js";

export async function coverage(tx: Tx, access: AccessService, p: string) {
  const assignments = await tx.questionAssignment.findMany({
    where: {
      projectId: p,
      active: true,
      member: {
        active: true,
        role: "STAKEHOLDER",
        user: { active: true },
        area: { active: true },
      },
    },
    include: { member: { include: { user: true, area: true } } },
  });
  const graphs = new Map<
    string,
    Awaited<ReturnType<typeof loadGraph>>["graph"]
  >();
  for (const a of assignments)
    if (!graphs.has(a.member.userId))
      graphs.set(
        a.member.userId,
        (await loadGraph(tx, access, a.member.user, p)).graph,
      );
  return { assignments, graphs };
}
export function questionCoverage(
  c: Awaited<ReturnType<typeof coverage>>,
  id: string,
) {
  const currentIds = new Set<string>();
  let missing = 0,
    consult = false;
  const participants = c.assignments
    .filter((a) => a.questionId === id)
    .map((a) => {
      const g = c.graphs.get(a.member.userId)!;
      // Archived questions are deliberately absent from the participant graph.
      const present = g.questions.some((q) => q.id === id);
      const applicability = present
        ? g.context(id).state
        : ("DISABLED" as const);
      const rev =
        present && g.current(id)
          ? g.response(id)?.ResponseRevision_response[0]
          : undefined;
      if (rev) currentIds.add(rev.id);
      if (a.required && applicability === "ENABLED" && !rev) missing++;
      if (
        present &&
        g.response(id)?.ResponseDraft_response?.consultationRequested
      )
        consult = true;
      return {
        memberId: a.projectMemberId,
        person: { id: a.member.userId, displayName: a.member.user.displayName },
        area: a.member.area!.name,
        required: a.required,
        applicability,
        currentRevisionId: rev?.id ?? null,
      };
    });
  return { currentIds, missing, consult, participants };
}
export function projectedStatus(v: {
  conflict: boolean;
  clarification: boolean;
  validated: boolean;
  notApplicable: boolean;
  partial: boolean;
  submitted: number;
  missing: number;
  consult: boolean;
  pending: boolean;
}): ReviewStatus {
  if (v.conflict) return "CONFLICT";
  if (v.clarification) return "CLARIFICATION_REQUIRED";
  if (v.validated) return "VALIDATED";
  if (v.notApplicable) return "NOT_APPLICABLE";
  if (v.partial || (v.submitted > 0 && (v.missing > 0 || v.consult)))
    return "PARTIAL";
  if (v.submitted > 0) return "ANSWERED";
  return v.pending || v.consult ? "PENDING" : "NOT_REVIEWED";
}
export async function invalidateValidation(
  tx: Tx,
  actor: User,
  p: string,
  q: string,
  reason: string,
) {
  const current = await tx.validation.findMany({
    where: { projectId: p, questionId: q, invalidatedAt: null },
  });
  for (const v of current) {
    await tx.validation.update({
      where: { id: v.id },
      data: {
        invalidatedAt: new Date(),
        invalidatedById: actor.id,
        invalidationReason: reason,
      },
    });
    await audit(
      tx,
      actor,
      "VALIDATION_INVALIDATED",
      "Validation",
      v.id,
      p,
      { invalidatedAt: null },
      { reason },
      undefined,
    );
  }
}
export async function revokeDisposition(
  tx: Tx,
  actor: User,
  p: string,
  q: string,
  reason: string,
) {
  const values = await tx.questionDisposition.findMany({
    where: { projectId: p, questionId: q, revokedAt: null },
  });
  for (const d of values) {
    await tx.questionDisposition.update({
      where: { id: d.id },
      data: {
        revokedAt: new Date(),
        revokedById: actor.id,
        revokeReason: reason,
      },
    });
    await audit(
      tx,
      actor,
      "QUESTION_DISPOSITION_REVOKED",
      "QuestionDisposition",
      d.id,
      p,
      null,
      { reason },
    );
  }
}
export async function recomputeReview(
  tx: Tx,
  access: AccessService,
  actor: User,
  p: string,
) {
  const c = await coverage(tx, access, p);
  const questions = await tx.question.findMany({ where: { projectId: p } });
  for (const q of questions) {
    const cv = questionCoverage(c, q.id);
    const validations = await tx.validation.findMany({
      where: { projectId: p, questionId: q.id, invalidatedAt: null },
      include: {
        ValidationSource_validation: true,
        ValidationMessage_validation: {
          include: { message: { include: { thread: true } } },
        },
        ValidationResolution_validation: {
          include: {
            resolution: {
              include: { ConflictResolutionSource_resolution: true },
            },
          },
        },
      },
    });
    for (const v of validations) {
      const ids = [
        ...v.ValidationSource_validation.map((s) => s.responseRevisionId),
        ...v.ValidationMessage_validation.map(
          (m) => m.message.thread.responseRevisionId,
        ),
        ...v.ValidationResolution_validation.flatMap((r) =>
          r.resolution.ConflictResolutionSource_resolution.map(
            (s) => s.responseRevisionId,
          ),
        ),
      ];
      if (
        q.publication !== "PUBLISHED" ||
        cv.missing > 0 ||
        ids.length === 0 ||
        ids.some((id) => !cv.currentIds.has(id)) ||
        cv.participants.some(
          (a) =>
            a.required &&
            a.applicability === "ENABLED" &&
            a.currentRevisionId &&
            !ids.includes(a.currentRevisionId),
        )
      )
        await invalidateValidation(
          tx,
          actor,
          p,
          q.id,
          "Cambió una fuente, su contexto o la cobertura de participantes.",
        );
    }
    if (q.publication !== "PUBLISHED") continue;
    const status = projectedStatus({
      conflict: !!(await tx.conflict.findFirst({
        where: { projectId: p, questionId: q.id, status: "OPEN" },
      })),
      clarification: !!(await tx.clarificationThread.findFirst({
        where: {
          projectId: p,
          status: { not: "CLOSED" },
          revision: { response: { questionId: q.id } },
        },
      })),
      validated: !!(await tx.validation.findFirst({
        where: { projectId: p, questionId: q.id, invalidatedAt: null },
      })),
      notApplicable: !!(await tx.questionDisposition.findFirst({
        where: { projectId: p, questionId: q.id, revokedAt: null },
      })),
      partial: !!q.partialReviewReason,
      submitted: cv.currentIds.size,
      missing: cv.missing,
      consult: cv.consult,
      pending: q.pendingReview,
    });
    if (q.status !== status)
      await tx.question.update({
        where: { id: q.id },
        data: { status, lockVersion: { increment: 1 } },
      });
  }
}
