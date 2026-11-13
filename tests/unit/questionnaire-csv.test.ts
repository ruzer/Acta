// @vitest-environment node
import { describe, expect, it, vi, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { csvQuestionnaire } from "../../app/frontend/src/questionnaire-csv";
import { inspectTemplate } from "../../app/backend/src/exchange/template";
import { csvCell } from "../../app/backend/src/exchange/renderers";
const project = {
  externalId: "CSV-DEMO",
  name: "Proyecto ficticio",
  description: "Se conserva",
};
const header =
  "Tema;Código;Pregunta;Texto de ayuda;Tipo;Obligatoria;Área responsable";
const row = "Tema;REQ-001;¿Cómo funciona?;;Texto corto;Sí;Servicios";
const convert = (
  text: string,
  catalog: { code: string; name: string }[] = [],
) => csvQuestionnaire(Buffer.from(text), project, catalog);
afterEach(() => vi.unstubAllEnvs());
describe("CSV sencillo usa el importador autoritativo", () => {
  it.each([",", ";"])(
    "lee UTF-8, BOM, encabezados normalizados y separador %s",
    (delimiter) => {
      const result = convert(
        "\ufeff" +
          (
            header
              .toUpperCase()
              .normalize("NFD")
              .replace(/[\u0300-\u036f]/g, "") +
            "\r\n" +
            row
          ).replaceAll(";", delimiter),
      );
      const inspected = inspectTemplate(Buffer.from(result.json));
      expect(inspected.errors).toEqual([]);
      expect(inspected.data?.project).toEqual(project);
      expect(inspected.data?.questions[0]).toMatchObject({
        externalId: "REQ-001",
        type: "SHORT_TEXT",
        required: true,
        title: "REQ-001",
        priority: "P2",
      });
    },
  );
  it("la plantilla descargable es válida y conserva los códigos distintos", () => {
    const { json } = csvQuestionnaire(
      readFileSync("examples/questionnaire-template.csv"),
      project,
      [],
    );
    const parsed = inspectTemplate(Buffer.from(json));
    expect(parsed.errors).toEqual([]);
    expect(parsed.data?.questions.map((q) => q.externalId)).toEqual([
      "REQ-001",
      "REQ-01",
      "REQ-003",
    ]);
  });
  it("conserva comillas, separadores, saltos y tipos sin coerción", () => {
    const { json, location } = convert(
      header +
        '\nTema;Q1;"Una; pregunta, con ""comillas""\ny otra línea";001;Número;No;Servicios\nOtro;Q2;2026-01-02;;Fecha;Sí;Servicios\nTema;Q3;¿Sí?;;Sí/No;No;Servicios\nOtro;Q4;Texto;;Texto largo;No;Servicios',
      [{ code: "SERV", name: "Servicios" }],
    );
    const parsed = inspectTemplate(Buffer.from(json));
    expect(parsed.errors).toEqual([]);
    expect(parsed.data?.sections.map((s) => s.title)).toEqual(["Tema", "Otro"]);
    expect(parsed.data?.questions.map((q) => q.order)).toEqual([0, 1, 2, 3]);
    expect(parsed.data?.questions[0]).toMatchObject({
      question: 'Una; pregunta, con "comillas"\ny otra línea',
      helpText: "001",
      responsibleAreaCode: "SERV",
      type: "NUMBER",
    });
    expect(parsed.data?.questions[1].question).toBe("2026-01-02");
    expect(location("/questions/1/question")).toBe("Fila 4, columna Pregunta");
  });
  it.each([
    "=1+1",
    "+SUM(1)",
    "-1+2",
    "@SUM(1)",
    "  =1+1",
    "\t=1+1",
    "\u0001=1+1",
  ])("no ejecuta ni altera %j; el exporte lo neutraliza", (value) => {
    const { json } = convert(
      header + `\nTema;Q1;${value};;Texto corto;No;Servicios`,
    );
    const parsed = inspectTemplate(Buffer.from(json));
    expect(parsed.errors).toEqual([]);
    expect(parsed.data?.questions[0].question).toBe(value);
    expect(csvCell(parsed.data?.questions[0].question)).toBe(`"'${value}"`);
  });
  it.each([
    [header + ";Estado\n" + row, /Fila 1, columna 8/],
    [header.replace("Tipo", "Código") + "\n" + row, /repetida/],
    [header.replace(";Tipo", "") + "\n" + row, /columna Tipo/],
    [
      header + "\n" + row.replace("Texto corto", "Matriz"),
      /Fila 2, columna Tipo/,
    ],
    [
      header + "\n" + row.replace(";Sí;", ";Quizá;"),
      /Fila 2, columna Obligatoria/,
    ],
    [header + "\n" + row.replace("REQ-001", "1,2"), /columna Código/],
    [header + "\n" + row + "\n" + row, /Fila 3, columna Código/],
    [header + "\n" + row + "\n\n" + row.replace("REQ-001", "Q2"), /Fila 3/],
    [header + "\n" + row + ";dato", /columnas/],
    [header + '\nTema;Q1;"sin cierre', /comillas/],
    [
      header + '\nTema;Q1;"cerrado"basura;;Texto corto;No;Servicios',
      /comillas/,
    ],
    [header, /Añade al menos/],
  ])("rechaza sin descartar datos", (text, message) =>
    expect(() => convert(text)).toThrow(message),
  );
  it("no elige áreas ambiguas ni colisiona con códigos existentes", () => {
    expect(() =>
      convert(header + "\n" + row, [
        { code: "A", name: "Servicios" },
        { code: "B", name: "Servicios" },
      ]),
    ).toThrow(/Área responsable/);
    const { json } = convert(header + "\n" + row, [
      { code: "CSV-AREA-1", name: "Otro" },
    ]);
    expect(JSON.parse(json).areas[0].code).toBe("CSV-AREA-2");
  });
  it("rechaza UTF-8 inválido y tamaños excesivos", () => {
    expect(() => csvQuestionnaire(Buffer.from([0xff]), project, [])).toThrow(
      /UTF-8/,
    );
    expect(() =>
      csvQuestionnaire(Buffer.alloc(5 * 1024 * 1024 + 1), project, []),
    ).toThrow(/5 MiB/);
    expect(() =>
      convert(
        header + "\n" + row.replace("¿Cómo funciona?", "x".repeat(10001)),
      ),
    ).toThrow(/Fila 2, columna Pregunta/);
  });
  it("mantiene los límites menores configurados en el parser del servidor", () => {
    vi.stubEnv("IMPORT_MAX_QUESTIONS", "1");
    const { json } = convert(
      header + "\n" + row + "\n" + row.replace("REQ-001", "REQ-01"),
    );
    expect(inspectTemplate(Buffer.from(json)).errors.length).toBeGreaterThan(0);
  });
});
