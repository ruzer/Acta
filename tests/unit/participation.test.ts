// @vitest-environment node
import { expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import {
  readParticipation,
  summarizeParticipation,
  type ParticipationQuestion,
} from "../../app/backend/src/visibility/participation.js";
import type { Tx } from "../../app/backend/src/common/http.js";
const question = (id: string, required = true): ParticipationQuestion => ({
  id,
  status: "NOT_REVIEWED",
  required,
  QuestionCondition_child: null,
  QuestionRevision_questionRecord: [{ id: `${id}-version` }],
  draftAt: null,
  submittedAt: null,
  response: { questionId: id, ResponseRevision_response: [] },
});
function send(q: ParticipationQuestion) {
  q.submittedAt = "2026-11-18T10:00:00Z";
  q.response.ResponseRevision_response = [
    {
      id: `${q.id}-submission`,
      questionRevisionId: `${q.id}-version`,
      answer: true,
      conditionContext: {},
    },
  ];
}
const row = (questions: ParticipationQuestion[]) => ({
  memberId: randomUUID(),
  name: "Persona ficticia",
  area: null,
  questions,
});
it("distingue no iniciado, borrador, envío parcial y todas las obligatorias enviadas", () => {
  const a = question("a"),
    b = question("b"),
    optional = question("c", false);
  expect(summarizeParticipation(row([a, b, optional]))).toMatchObject({
    state: "Sin iniciar",
    pending: 2,
    assigned: 3,
    lastActivity: null,
  });
  a.draftAt = "2026-11-18T09:00:00Z";
  expect(summarizeParticipation(row([a, b, optional]))).toMatchObject({
    state: "En borrador",
    drafts: 1,
  });
  send(a);
  expect(summarizeParticipation(row([a, b, optional]))).toMatchObject({
    state: "Envió parte",
    pending: 1,
    sent: 1,
  });
  send(b);
  expect(summarizeParticipation(row([a, b, optional]))).toMatchObject({
    state: "Completo",
    pending: 0,
    sent: 2,
    lastActivity: "2026-11-18T10:00:00.000Z",
  });
  a.response.ResponseRevision_response[0]!.questionRevisionId = "previous";
  expect(summarizeParticipation(row([a, b]))).toMatchObject({
    state: "Envió parte",
    pending: 1,
  });
});
it("reutiliza la aplicabilidad: no cuenta seguimientos pendientes, desactivados ni envíos de otra condición", () => {
  const a = question("a"),
    b = question("b");
  b.QuestionCondition_child = {
    id: "c",
    projectId: "p",
    parentQuestionId: "a",
    childQuestionId: "b",
    operator: "EQUALS",
    value: true,
  };
  expect(summarizeParticipation(row([a, b])).assigned).toBe(1);
  send(a);
  expect(summarizeParticipation(row([a, b]))).toMatchObject({
    assigned: 2,
    pending: 1,
  });
  send(b);
  expect(summarizeParticipation(row([a, b])).pending).toBe(1);
  b.response.ResponseRevision_response[0]!.conditionContext = {
    a: "a-submission",
  };
  expect(summarizeParticipation(row([a, b])).state).toBe("Completo");
  a.response.ResponseRevision_response[0]!.answer = false;
  expect(summarizeParticipation(row([a, b]))).toMatchObject({
    assigned: 1,
    sent: 1,
    pending: 0,
  });
});
it("sin asignaciones no afirma completado y solo opcionales requiere enviarlas para completado", () => {
  expect(summarizeParticipation(row([])).state).toBe("Sin iniciar");
  const a = question("a", false);
  expect(summarizeParticipation(row([a])).state).toBe("Sin iniciar");
  send(a);
  expect(summarizeParticipation(row([a])).state).toBe("Completo");
});
it("300 preguntas por 50 personas requieren una sola lectura agrupada y no devuelven respuestas", async () => {
  const rows = Array.from({ length: 50 }, () =>
    row(Array.from({ length: 300 }, (_, i) => question(String(i)))),
  );
  const query = vi.fn().mockResolvedValue(rows);
  const result = await readParticipation(
    { $queryRaw: query } as unknown as Tx,
    randomUUID(),
  );
  expect(query).toHaveBeenCalledTimes(1);
  expect(result).toHaveLength(50);
  expect(result.every((p) => p.assigned === 300 && p.pending === 300)).toBe(
    true,
  );
  expect(JSON.stringify(result)).not.toMatch(
    /questionRevision|conditionContext|answer|response/,
  );
});
