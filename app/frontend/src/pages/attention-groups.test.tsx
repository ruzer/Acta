import { expect, it } from "vitest";
import { dashboardView } from "@requirements/contracts";
import fixture from "../../../../tests/fixtures/analyst-visual.json";
import { attentionGroups } from "./attention-groups";
import type { AttentionDashboard } from "./attention-data";

const base = dashboardView.parse(fixture.dashboard).questions[0]!;
function question(
  id: string,
  status: typeof base.status,
  required = 2,
  submitted = 1,
) {
  return {
    ...base,
    id,
    status,
    requiredRespondents: required,
    submittedRespondents: submitted,
  };
}
const questions = [
  question("answer-1", "ANSWERED"),
  question("conflict-1", "CONFLICT"),
  question("answer-2", "ANSWERED"),
  question("conflict-2", "CONFLICT"),
  question("clarification", "CLARIFICATION_REQUIRED"),
  question("partial", "PARTIAL", 4, 2),
  question("pending", "PENDING", 3, 0),
  question("unassigned", "PENDING", 0, 0),
  question("unreviewed", "NOT_REVIEWED", 0, 0),
  question("valid", "VALIDATED"),
  question("na", "NOT_APPLICABLE"),
  question("covered-partial", "PARTIAL", 2, 2),
];

it.each(["ADMIN", "ANALYST"] as const)(
  "agrupación %s respeta permisos en ACTIVE y ARCHIVED",
  (role) => {
    for (const lifecycle of ["ACTIVE", "ARCHIVED"] as const) {
      const canReview = role === "ANALYST" && lifecycle === "ACTIVE";
      const groups = attentionGroups(
        questions,
        ["conflict-1", "clarification"],
        canReview,
      );
      expect(groups.some((group) => group.label === "Te toca a ti")).toBe(
        canReview,
      );
      expect(
        groups.flatMap((group) => group.questions.map((q) => q.id)),
      ).not.toEqual(expect.arrayContaining(["valid", "na", "unreviewed"]));
      for (const excluded of ["valid", "na", "unreviewed", "covered-partial"])
        expect(
          groups
            .flatMap((group) => group.questions)
            .some((q) => q.id === excluded),
        ).toBe(false);
      if (canReview) {
        expect(groups[0]!.questions.map((q) => q.id)).toEqual([
          "conflict-1",
          "conflict-2",
          "answer-1",
          "answer-2",
        ]);
        expect(groups[0]!.action(groups[0]!.questions[0]!)).toBe(
          "Resolver conflicto",
        );
        expect(groups[0]!.action(groups[0]!.questions[2]!)).toBe(
          "Revisar y decidir",
        );
      } else {
        expect(groups.slice(0, 2).map((group) => group.label)).toEqual([
          "Conflictos abiertos",
          "Listas para decidir",
        ]);
        expect(groups.every((group) => !group.turn)).toBe(true);
      }
      const threads = groups.find((group) => group.id === "clarifications")!;
      expect(threads.questions.map((q) => q.id)).toEqual([
        "conflict-1",
        "clarification",
      ]);
      expect(threads.explanation).toContain(
        "Consulta el hilo para saber a quién corresponde continuar",
      );
      const waiting = groups.find((group) => group.id === "waiting")!;
      expect(waiting.questions.map((q) => q.id)).toEqual([
        "partial",
        "pending",
      ]);
      expect(waiting.reason(waiting.questions[0]!)).toBe(
        "Faltan 2 de 4 aportaciones",
      );
      const unassigned = groups.find((group) => group.id === "unassigned")!;
      expect(unassigned.questions.map((q) => q.id)).toEqual(["unassigned"]);
      expect(unassigned.turn).toBeUndefined();
      expect(unassigned.reason(unassigned.questions[0]!)).toBe(
        "Sin participantes asignados",
      );
    }
  },
);

it("no fabrica grupos de tareas cuando no hay preguntas", () => {
  expect(attentionGroups([], [], true)).toEqual([]);
});

it("la agrupación no modifica el orden o los datos del dashboard", () => {
  const source: AttentionDashboard["questions"] = structuredClone(questions);
  attentionGroups(source, ["conflict-1"], true);
  expect(source).toEqual(questions);
});
