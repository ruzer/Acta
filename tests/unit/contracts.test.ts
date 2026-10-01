import { describe, it, expect } from "vitest";
import {
  externalId,
  loginInput,
  questionInput,
  createUserInput,
  memberInput,
  statusLabels,
  reviewStates,
  participantView,
} from "@requirements/contracts";
import {
  assertAcyclic,
  validateQuestion,
} from "../../app/backend/src/questionnaire/rules";
const id = "ab295cc2-9caa-4cd8-bd68-2a18e2d93190";
const base = {
  externalId: "TEST-1",
  sectionId: id,
  title: "Pregunta",
  question: "¿Cómo funciona?",
  type: "SHORT_TEXT",
  required: true,
  priority: "P1",
  responsibleAreaId: id,
  order: 1,
};
describe("Contratos e invariantes de 2B", () => {
  it("login solo acepta usuario y contraseña, nunca institución enviada por cliente", () => {
    const credentials = { username: "stakeholder", password: "example-only" };
    expect(loginInput.parse(credentials)).toEqual(credentials);
    for (const key of ["organization", "organizationCode", "organizationId"])
      expect(() =>
        loginInput.parse({ ...credentials, [key]: "OTHER" }),
      ).toThrow();
  });
  it("preserva IDs exactos y distingue ceros, sin importar fuentes RH", () => {
    expect(externalId.parse("FORM-14")).not.toBe(externalId.parse("FORM-014"));
    expect(() => externalId.parse(" FORM-14")).toThrow();
  });
  it("rechaza mass assignment y estados impuestos por cliente", () => {
    expect(() =>
      questionInput.parse({ ...base, status: "VALIDATED" }),
    ).toThrow();
    expect(() =>
      createUserInput.parse({
        username: "test",
        displayName: "Test",
        temporaryPassword: "testPassword123",
        organizationId: id,
      }),
    ).toThrow();
  });
  it("exige área a un stakeholder activo", () => {
    expect(() =>
      memberInput.parse({ userId: id, role: "STAKEHOLDER", areaId: null }),
    ).toThrow();
  });
  it("rechaza ciclos transitivos y acepta un árbol", () => {
    expect(() =>
      assertAcyclic([
        { child: "a", parent: "b" },
        { child: "b", parent: "c" },
        { child: "c", parent: "a" },
      ]),
    ).toThrow();
    expect(() =>
      assertAcyclic([
        { child: "b", parent: "a" },
        { child: "c", parent: "a" },
      ]),
    ).not.toThrow();
  });
  it("rechaza opciones repetidas y configuración incoherente", () => {
    expect(() =>
      validateQuestion(
        questionInput.parse({
          ...base,
          type: "SINGLE_CHOICE",
          options: [
            { value: "X", label: "Uno", order: 1 },
            { value: "X", label: "Dos", order: 2 },
          ],
        }),
      ),
    ).toThrow();
    expect(() =>
      validateQuestion(
        questionInput.parse({
          ...base,
          type: "NUMBER",
          config: { min: 10, max: 2 },
        }),
      ),
    ).toThrow();
  });
  it("valida matriz de claves únicas", () => {
    expect(() =>
      validateQuestion(
        questionInput.parse({
          ...base,
          type: "MATRIX",
          config: {
            rows: [{ key: "R", label: "Fila" }],
            columns: [
              { key: "A", label: "Uno" },
              { key: "B", label: "Dos" },
            ],
          },
        }),
      ),
    ).not.toThrow();
  });
  it("tiene etiquetas humanas para los ocho estados", () => {
    expect(Object.keys(statusLabels)).toEqual([...reviewStates]);
  });
  it("la vista participante no admite trazabilidad técnica", () => {
    expect(() =>
      participantView.parse({
        projectName: "Proyecto",
        roleLabel: "Consulta",
        phaseNotice: "Consulta",
        sections: [],
        references: [],
      }),
    ).toThrow();
  });
});
