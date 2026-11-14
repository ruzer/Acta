import { templateInput, type TemplateInput } from "@requirements/contracts";

const columns = [
  "Tema",
  "Código",
  "Pregunta",
  "Texto de ayuda",
  "Tipo",
  "Obligatoria",
  "Área responsable",
] as const;
const compact = (value: string) => value.trim().replace(/\s+/g, " ");
const normalize = (value: string) =>
  compact(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es");
const types = {
  "si/no": "YES_NO",
  "texto corto": "SHORT_TEXT",
  "texto largo": "LONG_TEXT",
  fecha: "DATE",
  numero: "NUMBER",
} as const;
const maxBytes = 5 * 1024 * 1024;
type Row = { line: number; cells: string[] };
function invalid(
  line: number,
  column: string | number,
  message: string,
): never {
  throw new Error(`Fila ${line}, columna ${column}: ${message}`);
}

function questionTitle(question: string, line: number) {
  const text = compact(question);
  const sentence = text.match(/^.*?[.!?](?=\s|$)/u)?.[0] ?? text;
  if (sentence.length <= 80 && sentence === text) return sentence;
  let title = sentence;
  if (title.length > 79) {
    const end = text.slice(0, 80).lastIndexOf(" ");
    if (end < 1)
      invalid(
        line,
        "Título",
        "Añade un título breve: la primera palabra no cabe sin cortarse.",
      );
    title = text.slice(0, end);
  }
  return title + "…";
}

// Las comillas, separadores y saltos dentro de una celda se leen literalmente; nunca se evalúan fórmulas.
function rows(text: string): Row[] {
  const result: Row[] = [];
  let delimiter = "",
    line = 1,
    start = 1,
    cell = "",
    cells: string[] = [],
    quoted = false,
    closed = false;
  const addRow = () => {
    if (cells.some((value) => value.trim())) {
      result.push({ line: start, cells });
      if (result.length > 2001)
        invalid(start, "Pregunta", "El archivo supera 2000 preguntas.");
    } else if (!result.length) delimiter = "";
  };
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          quoted = false;
          closed = true;
        }
      } else {
        cell += char;
        if (char === "\n" || (char === "\r" && text[i + 1] !== "\n")) line++;
      }
      continue;
    }
    if (!delimiter && result.length === 0 && (char === "," || char === ";"))
      delimiter = char;
    if (char === delimiter) {
      cells.push(cell);
      cell = "";
      closed = false;
    } else if (char === "\n" || char === "\r") {
      cells.push(cell);
      addRow();
      if (char === "\r" && text[i + 1] === "\n") i++;
      line++;
      start = line;
      cells = [];
      cell = "";
      closed = false;
    } else if (char === '"' && !cell && !closed) quoted = true;
    else {
      if (closed || char === '"')
        invalid(
          line,
          cells.length + 1,
          "Las comillas deben encerrar toda la celda y duplicarse dentro de ella.",
        );
      cell += char;
    }
  }
  if (quoted)
    invalid(start, cells.length + 1, "Falta cerrar las comillas de la celda.");
  if (cell || cells.length || closed) {
    cells.push(cell);
    addRow();
  }
  if (!result.length) invalid(1, 1, "El archivo está vacío.");
  return result;
}

export function csvQuestionnaire(
  bytes: Uint8Array,
  project: TemplateInput["project"],
  catalog: { code: string; name: string }[],
) {
  if (bytes.byteLength > maxBytes) throw new Error("El archivo supera 5 MiB.");
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    invalid(1, 1, "Guarda el archivo con codificación UTF-8.");
  }
  const [header, ...data] = rows(text);
  if (!header) invalid(1, 1, "El archivo está vacío.");
  const indexes = columns.map((column) =>
    header.cells.findIndex((value) => normalize(value) === normalize(column)),
  );
  const seen = new Set<string>();
  header.cells.forEach((value, i) => {
    const key = normalize(value);
    if (![...columns, "Título"].some((column) => normalize(column) === key))
      invalid(header.line, i + 1, `La columna «${value}» no está admitida.`);
    if (seen.has(key))
      invalid(header.line, i + 1, `La columna «${value}» está repetida.`);
    seen.add(key);
  });
  indexes.forEach((index, i) => {
    if (index === -1) invalid(header.line, columns[i]!, "Falta esta columna.");
  });
  const titleIndex = header.cells.findIndex(
    (value) => normalize(value) === "titulo",
  );
  if (!data.length)
    invalid(header.line + 1, "Pregunta", "Añade al menos una pregunta.");
  if (data.length > 2000)
    invalid(data[2000]!.line, "Pregunta", "El archivo supera 2000 preguntas.");
  const template: TemplateInput = {
    formatVersion: "1.0",
    kind: "questionnaire-template",
    project,
    areas: [],
    sections: [],
    questions: [],
    conditions: [],
    traceabilityReferences: [],
  };
  const questionLines: number[] = [],
    sectionLines: number[] = [],
    areaLines: number[] = [];
  const identifiers = new Set<string>();
  for (const row of data) {
    if (row.cells.length > header.cells.length)
      invalid(
        row.line,
        header.cells.length + 1,
        "Hay más columnas que encabezados. Revisa los separadores y las comillas.",
      );
    const [theme, code, question, helpText, kind, mandatory, areaName] =
      indexes.map((index) => (row.cells[index] ?? "").trim()) as [
        string,
        string,
        string,
        string,
        string,
        string,
        string,
      ];
    [theme, code, question, kind, mandatory, areaName].forEach((value, i) => {
      if (!value.trim())
        invalid(
          row.line,
          columns[[0, 1, 2, 4, 5, 6][i]!]!,
          "Este dato es obligatorio.",
        );
    });
    const key = normalize(kind);
    const type = Object.hasOwn(types, key)
      ? types[key as keyof typeof types]
      : undefined;
    if (!type)
      invalid(
        row.line,
        "Tipo",
        "Usa Sí/No, Texto corto, Texto largo, Fecha o Número.",
      );
    const required = normalize(mandatory);
    if (required !== "si" && required !== "no")
      invalid(row.line, "Obligatoria", "Usa Sí o No.");
    if (identifiers.has(code))
      invalid(row.line, "Código", "Este código está repetido.");
    identifiers.add(code);
    let section = template.sections.find(
      (item) => normalize(item.title) === normalize(theme),
    );
    if (!section) {
      if (template.sections.length === 100)
        invalid(row.line, "Tema", "El archivo supera 100 temas.");
      section = {
        externalId: `CSV-TEMA-${template.sections.length + 1}`,
        title: compact(theme),
        order: template.sections.length,
      };
      template.sections.push(section);
      sectionLines.push(row.line);
    }
    let area = template.areas.find(
      (item) => normalize(item.name) === normalize(areaName),
    );
    if (!area) {
      const matches = catalog.filter(
        (item) => normalize(item.name) === normalize(areaName),
      );
      if (matches.length > 1)
        invalid(
          row.line,
          "Área responsable",
          "Hay varias áreas con este nombre. Usa la plantilla JSON con el código del área.",
        );
      let number = template.areas.length + 1;
      while (
        [...catalog, ...template.areas].some(
          (item) => item.code === `CSV-AREA-${number}`,
        )
      )
        number++;
      area = {
        code: matches[0]?.code ?? `CSV-AREA-${number}`,
        name: matches[0]?.name ?? compact(areaName),
      };
      template.areas.push(area);
      areaLines.push(row.line);
    }
    if (
      !templateInput.shape.questions.element.shape.question.safeParse(question)
        .success
    )
      invalid(
        row.line,
        "Pregunta",
        "Revisa el formato o la longitud de este dato.",
      );
    const title = compact(row.cells[titleIndex] ?? "");
    template.questions.push({
      externalId: code,
      sectionExternalId: section.externalId,
      title: title || questionTitle(question, row.line),
      question,
      helpText,
      priority: "P2",
      type,
      required: required === "si",
      responsibleAreaCode: area.code,
      order: template.questions.length,
      options: [],
      references: [],
    });
    questionLines.push(row.line);
  }
  const location = (path: string) => {
    const [, collection, index, field] = path.split("/");
    const fields: Record<string, string> = {
      externalId: "Código",
      title: "Título",
      question: "Pregunta",
      helpText: "Texto de ayuda",
      type: "Tipo",
      required: "Obligatoria",
      responsibleAreaCode: "Área responsable",
      sectionExternalId: "Tema",
    };
    if (collection === "questions" && questionLines[Number(index)])
      return `Fila ${questionLines[Number(index)]}, columna ${fields[field ?? ""] ?? "Pregunta"}`;
    if (collection === "sections" && sectionLines[Number(index)])
      return `Fila ${sectionLines[Number(index)]}, columna Tema`;
    if (collection === "areas" && areaLines[Number(index)])
      return `Fila ${areaLines[Number(index)]}, columna Área responsable`;
    return "Archivo CSV";
  };
  const parsed = templateInput.safeParse(template);
  if (!parsed.success) {
    const issue = parsed.error.issues[0]!;
    throw new Error(
      `${location("/" + issue.path.join("/"))}: revisa el formato o la longitud de este dato. No se ha importado nada.`,
    );
  }
  const json = JSON.stringify(parsed.data);
  if (new TextEncoder().encode(json).byteLength > maxBytes)
    throw new Error(
      "La plantilla convertida supera 5 MiB. Divide el cuestionario en proyectos distintos.",
    );
  return { json, location };
}
