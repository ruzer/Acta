import { expect, it } from "vitest";
import { questionnaireView } from "@requirements/contracts";
import fixture from "../../../../../tests/fixtures/analyst-visual.json";
import { readiness } from "./readiness";
import { applicability, applySimulation } from "./simulation";
const data = questionnaireView.parse(fixture.questionnaire);
const base = {
  ...data.questions[0]!,
  publication: "DRAFT" as const,
  type: "YES_NO" as const,
  options: [],
  config: null,
  condition: null,
  groupParentId: null,
  references: [],
  assignments: [],
};
it("sin incidencias con pregunta válida y asignada; sin preguntas no inventa bloqueos", () => {
  expect(readiness({ ...data, questions: [] })).toEqual([]);
  expect(
    readiness({
      ...data,
      questions: [
        {
          ...base,
          assignments: [
            { id: "a", projectMemberId: "m", active: true, required: true },
          ],
        },
      ],
    }),
  ).toEqual([]);
});
it("distingue advertencia de asignación de información publicada", () => {
  const issues = readiness({
    ...data,
    questions: [{ ...base, publication: "PUBLISHED" }],
  });
  expect(issues.map((i) => i.level)).toEqual(["ADVERTENCIA", "INFORMACIÓN"]);
});
it("opciones y matriz inválidas producen destinos de campo precisos", () => {
  expect(
    readiness({ ...data, questions: [{ ...base, type: "SINGLE_CHOICE" }] }),
  ).toContainEqual(
    expect.objectContaining({ field: "options", level: "ERROR" }),
  );
  expect(
    readiness({
      ...data,
      questions: [
        { ...base, type: "MATRIX", config: { rows: [], columns: [] } },
      ],
    }),
  ).toContainEqual(
    expect.objectContaining({ field: "config.rows", level: "ERROR" }),
  );
});
it("un seguimiento sin condición es válido; principal sin publicar se corrige en principal", () => {
  const child = { ...base, id: "child", groupParentId: base.id };
  const issues = readiness({ ...data, questions: [base, child] });
  expect(issues).toContainEqual(
    expect.objectContaining({
      questionId: "child",
      targetId: base.id,
      field: "groupParentId",
      level: "ADVERTENCIA",
      message: expect.stringContaining("seleccionar ambas"),
    }),
  );
  expect(
    readiness({
      ...data,
      questions: [{ ...base, publication: "PUBLISHED" }, child],
    }).filter((i) => i.level === "ERROR"),
  ).toEqual([]);
});
it("detecta ciclos de agrupación y condición sin colgarse", () => {
  const a = {
    ...base,
    id: "a",
    groupParentId: "b",
    condition: {
      parentQuestionId: "b",
      operator: "EQUALS" as const,
      value: true,
    },
  };
  const b = {
    ...base,
    id: "b",
    groupParentId: "a",
    condition: {
      parentQuestionId: "a",
      operator: "EQUALS" as const,
      value: true,
    },
  };
  const issues = readiness({ ...data, questions: [a, b] });
  expect(issues.filter((i) => i.message.includes("ciclo"))).toHaveLength(4);
  expect(applicability("a", [a, b], {})).toBe("UNDETERMINED");
});
it("simulación separa agrupación, condiciones, aplicación y descendientes vigentes", () => {
  const a = { ...base, id: "a" },
    b = {
      ...base,
      id: "b",
      condition: {
        parentQuestionId: "a",
        operator: "EQUALS" as const,
        value: true,
      },
    },
    c = {
      ...base,
      id: "c",
      condition: {
        parentQuestionId: "b",
        operator: "NOT_EQUALS" as const,
        value: false,
      },
    };
  const qs = [a, b, c];
  expect(applicability("b", qs, {})).toBe("UNDETERMINED");
  const first = applySimulation("a", true, qs, {});
  expect(applicability("b", qs, first)).toBe("ENABLED");
  const second = applySimulation("b", true, qs, first);
  expect(applicability("c", qs, second)).toBe("ENABLED");
  const changed = applySimulation("a", false, qs, second);
  expect(changed).not.toHaveProperty("b");
  expect(applicability("c", qs, changed)).toBe("DISABLED");
  expect(
    applicability("group", [{ ...base, id: "group", groupParentId: "a" }], {}),
  ).toBe("ENABLED");
});
it("simula selección múltiple por valor exacto y padres ausentes", () => {
  const a = { ...base, id: "a" },
    b = {
      ...base,
      id: "b",
      condition: {
        parentQuestionId: "a",
        operator: "CONTAINS" as const,
        value: "F-014",
      },
    };
  expect(applicability("b", [a, b], { a: ["F-14"] })).toBe("DISABLED");
  expect(applicability("b", [a, b], { a: ["F-014"] })).toBe("ENABLED");
  expect(applicability("b", [b], { a: ["F-014"] })).toBe("UNDETERMINED");
});

it("la orientación conjunta no oculta un padre ausente o archivado", () => {
  for (const questions of [
    [{ ...base, id: "child", groupParentId: "missing" }],
    [
      { ...base, publication: "ARCHIVED" as const },
      { ...base, id: "child", groupParentId: base.id },
    ],
  ])
    expect(readiness({ ...data, questions })).toContainEqual(
      expect.objectContaining({ field: "groupParentId", level: "ERROR" }),
    );
});
