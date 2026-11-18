import { expect, it } from "vitest";
import { template } from "../fixtures-template.mjs";
import { templateFile } from "../../app/backend/src/exchange/questionnaire-template.js";
import { csvQuestionnaire } from "../../app/frontend/src/questionnaire-csv";
import { templateInput } from "@requirements/contracts";
it("elige JSON si existen condiciones, opciones, referencias, prioridad o texto que CSV cambiaría", () => {
  const full = templateInput.parse(template());
  const result = templateFile(full, "csv", full.areas);
  expect(result.mime).toBe("application/json");
  expect(JSON.parse(result.content)).toEqual(full);
});
it("CSV lleva BOM y encabezados en español; conserva preguntas y temas al volver a importar", () => {
  const full = templateInput.parse(template());
  full.conditions = [];
  full.traceabilityReferences = [];
  full.sections[0].description = "";
  for (const question of full.questions) {
    question.priority = "P2";
    question.references = [];
    delete question.groupParentExternalId;
    delete question.sourceLocator;
  }
  const result = templateFile(full, "csv", full.areas);
  expect(result.mime).toBe("text/csv");
  expect(result.content.startsWith("\uFEFFTema,Código,Pregunta")).toBe(true);
  const copy = templateInput.parse(
    JSON.parse(
      csvQuestionnaire(
        new TextEncoder().encode(result.content),
        full.project,
        full.areas,
      ).json,
    ),
  );
  expect(copy.sections).toHaveLength(full.sections.length);
  expect(
    copy.questions.map((q) => [
      q.externalId,
      q.title,
      q.question,
      q.type,
      q.required,
      q.responsibleAreaCode,
    ]),
  ).toEqual(
    full.questions.map((q) => [
      q.externalId,
      q.title,
      q.question,
      q.type,
      q.required,
      q.responsibleAreaCode,
    ]),
  );
  for (const question of ["=1+1", " +1", "línea\ndos", " texto "]) {
    full.questions[0].question = question;
    expect(
      JSON.parse(templateFile(full, "csv", full.areas).content).questions[0]
        .question,
    ).toBe(question);
  }
});
it("no pierde temas vacíos ni combina nombres equivalentes; catálogo ambiguo requiere JSON", () => {
  const full = templateInput.parse(template());
  full.conditions = [];
  full.traceabilityReferences = [];
  full.sections[0].description = "";
  for (const q of full.questions) {
    q.priority = "P2";
    q.references = [];
    delete q.groupParentExternalId;
    delete q.sourceLocator;
  }
  expect(
    templateFile(full, "csv", [
      ...full.areas,
      { code: "OTHER", name: full.areas[0].name.toUpperCase() },
    ]).mime,
  ).toBe("application/json");
  full.sections.push({ ...full.sections[0], externalId: "EMPTY", order: 1 });
  expect(templateFile(full, "csv", full.areas).mime).toBe("application/json");
});
