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
const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
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
      if (cells.length > columns.length)
        invalid(start, cells.length, "Hay más columnas de las admitidas.");
    } else if (char === "\n" || char === "\r") {
      cells.push(cell);
      result.push({ line: start, cells });
      if (result.length > 2001)
        invalid(start, 1, "El archivo supera 2000 preguntas.");
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
  if (cell || cells.length || closed)
    result.push({ line: start, cells: [...cells, cell] });
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
    if (!columns.some((column) => normalize(column) === key))
      invalid(1, i + 1, `La columna «${value}» no está admitida.`);
    if (seen.has(key))
      invalid(1, i + 1, `La columna «${value}» está repetida.`);
    seen.add(key);
  });
  indexes.forEach((index, i) => {
    if (index === -1) invalid(1, columns[i]!, "Falta esta columna.");
  });
  if (!data.length) invalid(2, "Pregunta", "Añade al menos una pregunta.");
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
    if (row.cells.length !== columns.length)
      invalid(
        row.line,
        Math.min(row.cells.length + 1, columns.length + 1),
        `Se requieren exactamente ${columns.length} columnas.`,
      );
    const [theme, code, question, helpText, kind, mandatory, areaName] =
      indexes.map((index) => row.cells[index]!) as [
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
    let section = template.sections.find((item) => item.title === theme);
    if (!section) {
      if (template.sections.length === 100)
        invalid(row.line, "Tema", "El archivo supera 100 temas.");
      section = {
        externalId: `CSV-TEMA-${template.sections.length + 1}`,
        title: theme,
        order: template.sections.length,
      };
      template.sections.push(section);
      sectionLines.push(row.line);
    }
    let area = template.areas.find((item) => item.name === areaName);
    if (!area) {
      const matches = catalog.filter((item) => item.name === areaName);
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
      area = { code: matches[0]?.code ?? `CSV-AREA-${number}`, name: areaName };
      template.areas.push(area);
      areaLines.push(row.line);
    }
    template.questions.push({
      externalId: code,
      sectionExternalId: section.externalId,
      title: code,
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
      title: "Código",
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
