import { Prisma, User } from "@prisma/client";
import { NotFoundException } from "@nestjs/common";
import {
  personalProjectView,
  responseView,
  evidenceView,
  ResponseQuestionView,
} from "@requirements/contracts";
import { Tx, serialize } from "../common/http.js";
import { AccessService } from "../administration/access.service.js";
import { evidenceLimits } from "./file-validation.js";
export const responseInclude = {
  ResponseDraft_response: {
    include: { DraftEvidence_draft: { include: { evidence: true } } },
  },
  ResponseRevision_response: {
    orderBy: { number: "desc" as const },
    include: { RevisionEvidence_revision: { include: { evidence: true } } },
  },
};
const questionInclude = {
  section: true,
  QuestionCondition_child: true,
  QuestionRevision_questionRecord: {
    orderBy: { number: "desc" as const },
    take: 1,
    include: {
      QuestionOption_revision: { orderBy: { order: "asc" as const } },
    },
  },
};
export type FullResponse = Prisma.ResponseGetPayload<{
  include: typeof responseInclude;
}>;
export type FullQuestion = Prisma.QuestionGetPayload<{
  include: typeof questionInclude;
}>;
export type Applicability = ResponseQuestionView["applicability"];
export function canonical(value: unknown): string {
  if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
  if (value !== null && typeof value === "object")
    return (
      "{" +
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => JSON.stringify(k) + ":" + canonical(v))
        .join(",") +
      "}"
    );
  return JSON.stringify(value);
}
export const presentEvidence = (e: Prisma.EvidenceGetPayload<object>) =>
  serialize(evidenceView, {
    id: e.id,
    originalName: e.originalName,
    detectedMimeType: e.detectedMimeType,
    byteSize: Number(e.byteSize),
    sha256: e.sha256,
    status: e.status,
    createdAt: e.createdAt.toISOString(),
  });
export class ResponseGraph {
  private readonly contexts = new Map<
    string,
    { state: Applicability; context: Record<string, string> }
  >();
  constructor(
    readonly questions: FullQuestion[],
    readonly responses: FullResponse[],
  ) {}
  question(id: string) {
    const q = this.questions.find((x) => x.id === id);
    if (!q)
      throw new NotFoundException(
        "No se encontró la pregunta o ya no está asignada.",
      );
    return q;
  }
  response(id: string) {
    return this.responses.find((x) => x.questionId === id);
  }
  context(id: string): {
    state: Applicability;
    context: Record<string, string>;
  } {
    const prior = this.contexts.get(id);
    if (prior) return prior;
    const q = this.question(id),
      c = q.QuestionCondition_child;
    let result: { state: Applicability; context: Record<string, string> } = {
      state: "ENABLED",
      context: {},
    };
    if (c) {
      const p = this.questions.find((x) => x.id === c.parentQuestionId);
      if (!p) result = { state: "UNDETERMINED", context: {} };
      else {
        const parent = this.context(p.id),
          rev = this.response(p.id)?.ResponseRevision_response[0];
        if (parent.state !== "ENABLED" || !rev || !this.current(p.id))
          result = {
            state: parent.state === "DISABLED" ? "DISABLED" : "UNDETERMINED",
            context: parent.context,
          };
        else {
          const matches =
            c.operator === "CONTAINS"
              ? Array.isArray(rev.answer) &&
                rev.answer.includes(c.value as string)
              : canonical(rev.answer) === canonical(c.value);
          const enabled = c.operator === "NOT_EQUALS" ? !matches : matches;
          result = {
            state: enabled ? "ENABLED" : "DISABLED",
            context: { ...parent.context, [p.id]: rev.id },
          };
        }
      }
    }
    this.contexts.set(id, result);
    return result;
  }
  current(id: string) {
    const rev = this.response(id)?.ResponseRevision_response[0];
    const ctx = this.context(id);
    return (
      !!rev &&
      ctx.state === "ENABLED" &&
      rev.questionRevisionId ===
        this.question(id).QuestionRevision_questionRecord[0]!.id &&
      canonical(rev.conditionContext) === canonical(ctx.context)
    );
  }
  personal(projectName: string) {
    const items = this.questions.map((q) => {
      const r = this.response(q.id),
        d = r?.ResponseDraft_response;
      return {
        id: q.id,
        currentSubmission: this.current(q.id),
        hasSubmission: !!r?.ResponseRevision_response.length,
        question: q.QuestionRevision_questionRecord[0]!.question,
        title: q.QuestionRevision_questionRecord[0]!.title,
        applicability: this.context(q.id).state,
        state: d?.consultationRequested
          ? ("CONSULTATION" as const)
          : d
            ? ("DRAFT" as const)
            : this.current(q.id)
              ? ("SENT" as const)
              : ("PENDING" as const),
        updatedAt: d?.updatedAt.toISOString() ?? null,
      };
    });
    const enabled = items.filter((q) => q.applicability === "ENABLED");
    const drafts = enabled
      .filter(
        (q) => q.updatedAt && this.question(q.id).status !== "NOT_APPLICABLE",
      )
      .sort((a, b) => b.updatedAt!.localeCompare(a.updatedAt!));
    const continueQuestionId =
      drafts[0]?.id ??
      enabled.find(
        (q) =>
          !this.current(q.id) &&
          this.question(q.id).status !== "NOT_APPLICABLE",
      )?.id ??
      null;
    const sections = [
      ...new Map(this.questions.map((q) => [q.sectionId, q.section])).values(),
    ].map((s) => ({
      id: s.id,
      title: s.title,
      questions: items.filter((q) => this.question(q.id).sectionId === s.id),
    }));
    const sent = enabled.filter((q) => this.current(q.id)).length;
    return serialize(personalProjectView, {
      projectName,
      continueQuestionId,
      sections,
      progress: {
        total: items.length,
        enabled: enabled.length,
        sent,
        drafts: drafts.length,
        pending: enabled.length - sent,
        excluded: items.filter((q) => q.applicability === "DISABLED").length,
        undetermined: items.filter((q) => q.applicability === "UNDETERMINED")
          .length,
      },
    });
  }
  view(id: string) {
    const q = this.question(id),
      v = q.QuestionRevision_questionRecord[0]!,
      r = this.response(id),
      d = r?.ResponseDraft_response,
      ctx = this.context(id);
    const enabled = this.questions.filter(
      (q) => this.context(q.id).state === "ENABLED",
    );
    const index = enabled.findIndex((q) => q.id === id);
    return serialize(responseView, {
      reviewStatus: q.status,
      evidencePolicy: {
        maxBytes: evidenceLimits().fileBytes,
        maxAttachments: evidenceLimits().attachments,
      },
      id: r?.id ?? null,
      lockVersion: r?.lockVersion ?? 0,
      question: {
        id: q.id,
        sectionId: q.sectionId,
        sectionTitle: q.section.title,
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
        position: index < 0 ? 0 : index + 1,
        total: enabled.length,
        applicability: ctx.state,
      },
      draft: d
        ? {
            id: d.id,
            basedOnRevisionId: d.basedOnRevisionId,
            lockVersion: d.lockVersion,
            answer: d.answer,
            comment: d.comment ?? "",
            example: d.example ?? "",
            consultationRequested: d.consultationRequested,
            updatedAt: d.updatedAt.toISOString(),
            evidence: d.DraftEvidence_draft.map((l) => ({
              id: l.id,
              evidence: presentEvidence(l.evidence),
            })),
          }
        : null,
      revisions: (r?.ResponseRevision_response ?? []).map((rev, i) => ({
        id: rev.id,
        number: rev.number,
        status: rev.status,
        answer: rev.answer,
        comment: rev.comment ?? "",
        example: rev.example ?? "",
        createdAt: rev.createdAt.toISOString(),
        current: i === 0 && this.current(id),
        evidence: rev.RevisionEvidence_revision.map((l) => ({
          id: l.id,
          evidence: presentEvidence(l.evidence),
        })),
      })),
      nextQuestionId:
        enabled
          .slice(index + 1)
          .find((q) => !this.current(q.id) && q.status !== "NOT_APPLICABLE")
          ?.id ?? null,
    });
  }
}
export async function loadGraph(
  tx: Tx,
  access: AccessService,
  actor: User,
  projectId: string,
) {
  const { project, member } = await access.project(tx, actor, projectId, [
    "STAKEHOLDER",
  ]);
  return {
    graph: await loadAssignedResponseGraph(tx, actor, projectId, member.id),
    project,
    member,
  };
}
// Internal projection for authorized review/recomputation, including retained
// submissions after invitation expiry. Never use this as endpoint authorization.
export async function loadAssignedResponseGraph(
  tx: Tx,
  actor: User,
  projectId: string,
  memberId: string,
) {
  const invitation = actor.invitationOnly
    ? await tx.responseInvitation.findFirst({
        where: {
          respondentId: actor.id,
          projectId,
          organizationId: actor.organizationId,
          scopeSealed: true,
        },
        include: { questions: true },
      })
    : null;
  if (actor.invitationOnly && !invitation)
    throw new Error("Missing invitation scope");
  const questions = await tx.question.findMany({
    where: {
      projectId,
      publication: "PUBLISHED",
      ...(invitation
        ? { id: { in: invitation.questions.map((q) => q.questionId) } }
        : {}),
      QuestionAssignment_question: {
        some: { projectMemberId: memberId, active: true },
      },
    },
    include: questionInclude,
    orderBy: [{ section: { order: "asc" } }, { order: "asc" }, { id: "asc" }],
  });
  const responses = await tx.response.findMany({
    where: {
      projectId,
      respondentId: actor.id,
      questionId: { in: questions.map((q) => q.id) },
    },
    include: responseInclude,
  });
  return new ResponseGraph(questions, responses);
}
