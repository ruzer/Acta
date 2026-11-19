import type { ParticipationPerson } from "@requirements/contracts";
import type { Tx } from "../common/http.js";
import {
  ResponseApplicability,
  type ApplicabilityQuestion,
  type ApplicabilityResponse,
} from "../responses/response-graph.js";
export type ParticipationQuestion = ApplicabilityQuestion & {
  required: boolean;
  status: string;
  draftAt: string | null;
  submittedAt: string | null;
  response: ApplicabilityResponse;
};
export type ParticipationRow = {
  memberId: string;
  name: string;
  area: string | null;
  questions: ParticipationQuestion[];
};
export function summarizeParticipation(
  row: ParticipationRow,
): ParticipationPerson {
  const graph = new ResponseApplicability(
    row.questions,
    row.questions.map((q) => q.response),
  );
  const active = row.questions.filter(
    (q) =>
      q.status !== "NOT_APPLICABLE" && graph.context(q.id).state === "ENABLED",
  );
  const required = active.filter((q) => q.required);
  const pending = required.filter((q) => !graph.current(q.id)).length;
  const sent = active.filter((q) => graph.current(q.id)).length;
  const drafts = active.filter((q) => q.draftAt).length;
  const dates = row.questions
    .flatMap((q) => [q.draftAt, q.submittedAt])
    .filter((v): v is string => !!v)
    .map((v) => new Date(v).getTime());
  return {
    memberId: row.memberId,
    name: row.name,
    area: row.area,
    assigned: active.length,
    required: required.length,
    drafts,
    sent,
    pending,
    lastActivity: dates.length
      ? new Date(Math.max(...dates)).toISOString()
      : null,
    state:
      active.length &&
      !pending &&
      (required.length > 0 || sent === active.length)
        ? "Completo"
        : sent
          ? "Envió parte"
          : drafts
            ? "En borrador"
            : "Sin iniciar",
  };
}
export async function readParticipation(tx: Tx, projectId: string) {
  // Una lectura agrupada para todo el proyecto; nunca consultas por persona o pregunta.
  const rows = await tx.$queryRaw<ParticipationRow[]>`
    WITH latest AS (
      SELECT DISTINCT ON ("responseId") "responseId", id, answer, "questionRevisionId", "conditionContext", "createdAt"
      FROM "ResponseRevision" WHERE "projectId" = ${projectId}::uuid ORDER BY "responseId", number DESC
    ), assigned AS (
      SELECT a."projectMemberId", q.id, q.status, a.required, c AS condition,
        qr.id AS "revisionId", r."respondentId", d."updatedAt" AS "draftAt", s."createdAt" AS "submittedAt",
        CASE WHEN s.id IS NULL THEN '[]'::jsonb ELSE jsonb_build_array(jsonb_build_object(
          'id', s.id, 'answer', s.answer, 'questionRevisionId', s."questionRevisionId", 'conditionContext', s."conditionContext")) END AS revisions
      FROM "QuestionAssignment" a
      JOIN "Question" q ON q.id = a."questionId" AND q."projectId" = a."projectId" AND q.publication = 'PUBLISHED'
      JOIN "QuestionRevision" qr ON qr."questionId" = q.id AND qr.number = q."currentRevisionNumber"
      JOIN "ProjectMember" m ON m.id = a."projectMemberId" AND m."projectId" = a."projectId"
      LEFT JOIN "QuestionCondition" c ON c."childQuestionId" = q.id
      LEFT JOIN "Response" r ON r."questionId" = q.id AND r."respondentId" = m."userId"
      LEFT JOIN "ResponseDraft" d ON d."responseId" = r.id
      LEFT JOIN latest s ON s."responseId" = r.id
      WHERE a."projectId" = ${projectId}::uuid AND a.active
    )
    SELECT m.id AS "memberId", u."displayName" AS name, area.name AS area,
      COALESCE(jsonb_agg(jsonb_build_object(
        'id', q.id, 'status', q.status, 'required', q.required,
        'QuestionCondition_child', to_jsonb(q.condition),
        'QuestionRevision_questionRecord', jsonb_build_array(jsonb_build_object('id', q."revisionId")),
        'draftAt', q."draftAt", 'submittedAt', q."submittedAt",
        'response', jsonb_build_object('questionId', q.id, 'ResponseRevision_response', q.revisions)
      )) FILTER (WHERE q.id IS NOT NULL), '[]'::jsonb) AS questions
    FROM "ProjectMember" m JOIN "User" u ON u.id = m."userId"
    LEFT JOIN "Area" area ON area.id = m."areaId"
    LEFT JOIN "ResponseInvitation" invitation ON invitation."respondentId" = u.id AND invitation."projectId" = m."projectId"
    LEFT JOIN assigned q ON q."projectMemberId" = m.id AND (NOT u."invitationOnly" OR EXISTS (
      SELECT 1 FROM "InvitationQuestion" iq WHERE iq."invitationId" = invitation.id AND iq."questionId" = q.id
    ))
    WHERE m."projectId" = ${projectId}::uuid AND m.active AND m.role = 'STAKEHOLDER' AND u.active
      AND (NOT u."invitationOnly" OR (invitation."scopeSealed" AND invitation."revokedAt" IS NULL AND invitation."expiresAt" > CURRENT_TIMESTAMP))
    GROUP BY m.id, u."displayName", area.name ORDER BY u."displayName", m.id
  `;
  return rows.map(summarizeParticipation);
}
