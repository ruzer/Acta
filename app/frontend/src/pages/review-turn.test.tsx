import { expect, it } from "vitest";
import { reviewDetailView, type ReviewDetail } from "@requirements/contracts";
import fixture from "../../../../tests/fixtures/analyst-visual.json";
import { deriveTurn } from "./review-turn";
const original = reviewDetailView.parse(fixture.conflict);
const decision = reviewDetailView.parse(fixture.decision);
const plain = (): ReviewDetail => ({
  ...original,
  status: "ANSWERED",
  conflicts: [],
  threads: [],
  validations: [],
});
function thread(
  status: "WAITING_ANALYST" | "WAITING_STAKEHOLDER",
  id = "thread",
): ReviewDetail["threads"][number] {
  return {
    id,
    responseRevisionId: original.submissions[0]!.id,
    respondentId: original.submissions[0]!.respondent.id,
    status,
    lockVersion: 0,
    createdAt: "2026-10-01T00:00:00.000Z",
    closedAt: null,
    closedBy: null,
    closeReason: null,
    messages: [],
  };
}
const cases: {
  name: string;
  detail: ReviewDetail;
  title: string;
  action?: string;
  label: string;
}[] = [
  {
    name: "conflicto",
    detail: { ...plain(), conflicts: original.conflicts },
    title: "Hay diferencias por resolver",
    action: "resolveConflict",
    label: "Te toca a ti",
  },
  {
    name: "aclaración contestada",
    detail: { ...plain(), threads: [thread("WAITING_ANALYST")] },
    title: "Llegó una respuesta a la aclaración",
    action: "closeClarification",
    label: "Te toca a ti",
  },
  {
    name: "espera participante",
    detail: { ...plain(), threads: [thread("WAITING_STAKEHOLDER")] },
    title: `Esperando la aclaración de ${original.submissions[0]!.respondent.displayName}`,
    label: "En espera de aclaración",
  },
  {
    name: "respondida",
    detail: plain(),
    title: "Lista para decidir",
    action: "validateQuestion",
    label: "Te toca a ti",
  },
  {
    name: "parcial",
    detail: {
      ...plain(),
      status: "PARTIAL",
      participants: [{ ...original.participants[0]!, currentRevisionId: null }],
    },
    title: "Falta 1 de 1 persona asignada",
    label: "En espera de aportaciones",
  },
  {
    name: "pendiente",
    detail: {
      ...plain(),
      status: "PENDING",
      participants: [{ ...original.participants[0]!, currentRevisionId: null }],
    },
    title: "Falta 1 de 1 persona asignada",
    label: "En espera de aportaciones",
  },
  {
    name: "sin asignación",
    detail: {
      ...plain(),
      status: "NOT_REVIEWED",
      participants: [],
      submissions: [],
    },
    title: "Sin participantes asignados",
    label: "",
  },
  {
    name: "validada",
    detail: { ...decision, threads: [], conflicts: [] },
    title: "Decisión vigente",
    label: "",
  },
  {
    name: "no aplica",
    detail: { ...plain(), status: "NOT_APPLICABLE" },
    title: "Marcada como No aplica",
    label: "",
  },
];
it.each(cases)(
  "$name conserva la acción real y su turno",
  ({ detail, title, action, label }) => {
    expect(deriveTurn(detail)).toMatchObject({ title, label });
    expect(deriveTurn(detail).action).toBe(action);
  },
);
it.each(cases)(
  "$name en ADMIN/VIEWER/proyecto archivado nunca reclama turno ni acción",
  ({ detail }) => {
    const turn = deriveTurn({ ...detail, canReview: false });
    expect(turn.label).toBe("Consulta de solo lectura.");
    expect(turn.action).toBeUndefined();
    expect(turn.threadId).toBeUndefined();
    expect(turn.conflictId).toBeUndefined();
    expect(turn.title).not.toMatch(
      /Te toca|Lista para decidir|Llegó una respuesta/,
    );
  },
);
it("prioriza conflicto y después cualquier hilo contestado, aunque otro espere al participante", () => {
  const mixed = {
    ...plain(),
    threads: [
      thread("WAITING_STAKEHOLDER", "waiting"),
      thread("WAITING_ANALYST", "answered"),
    ],
    conflicts: original.conflicts,
  };
  expect(deriveTurn(mixed)).toMatchObject({
    action: "resolveConflict",
    conflictId: original.conflicts[0]!.id,
  });
  expect(deriveTurn({ ...mixed, conflicts: [] })).toMatchObject({
    action: "closeClarification",
    threadId: "answered",
  });
});
it("los participantes fuera de recorrido no inflan la espera", () => {
  const detail = {
    ...plain(),
    status: "PENDING" as const,
    participants: [
      {
        ...original.participants[0]!,
        applicability: "DISABLED" as const,
        currentRevisionId: null,
      },
      { ...original.participants[0]!, currentRevisionId: null },
    ],
  };
  expect(deriveTurn(detail).title).toBe("Falta 1 de 1 persona asignada");
});
it("una decisión vigente impide presentar Respondida como acción pendiente", () => {
  expect(
    deriveTurn({ ...decision, status: "ANSWERED", threads: [], conflicts: [] })
      .action,
  ).toBeUndefined();
});

it.each([0, 1, 2])(
  "describe %i aclaraciones abiertas sin cambiar el estado ni la acción",
  (count) => {
    const detail = {
      ...plain(),
      conflicts: original.conflicts,
      threads: Array.from({ length: count }, (_, i) =>
        thread("WAITING_ANALYST", `thread-${i}`),
      ),
    };
    expect(deriveTurn(detail).detail).toContain(
      `${count} ${count === 1 ? "aclaración abierta" : "aclaraciones abiertas"}.`,
    );
    expect(deriveTurn(detail).action).toBe("resolveConflict");
  },
);

it.each([
  [1, 2, "Falta 1 de 2 personas asignadas"],
  [2, 3, "Faltan 2 de 3 personas asignadas"],
] as const)(
  "describe %i respuestas pendientes de %i sin modificar el estado parcial",
  (missing, total, title) => {
    const detail: ReviewDetail = {
      ...plain(),
      status: "PARTIAL",
      participants: Array.from({ length: total }, (_, index) => ({
        ...original.participants[0]!,
        memberId: `member-${index}`,
        currentRevisionId: index < missing ? null : original.submissions[0]!.id,
      })),
    };
    expect(deriveTurn(detail)).toMatchObject({
      label: "En espera de aportaciones",
      title,
    });
    expect(deriveTurn(detail).action).toBeUndefined();
    expect(detail.status).toBe("PARTIAL");
  },
);
