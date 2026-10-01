import { importLimits } from "./limits.js";
import { createHash } from "node:crypto";
import {
  templateInput,
  type TemplateInput,
  type QuestionInput,
} from "@requirements/contracts";
import { z } from "zod";
import { parseExactJson, FileIssue } from "./strict-json.js";
import { validateQuestion, assertAcyclic } from "../questionnaire/rules.js";
export type Issue = { path: string; message: string };
export const referenceKey = (r: { type: string; externalId: string }) =>
  `${r.type}\u0000${r.externalId}`;
export const emptyCounts = () => ({
  projects: 0,
  sections: 0,
  questions: 0,
  options: 0,
  conditions: 0,
  references: 0,
  links: 0,
  areas: 0,
});
export function inspectTemplate(bytes: Buffer) {
  const payloadHash = createHash("sha256").update(bytes).digest("hex");
  const errors: Issue[] = [];
  let data: TemplateInput | undefined;
  try {
    const limits = importLimits();
    data = templateInput.parse(
      parseExactJson(bytes, limits.IMPORT_MAX_BYTES, limits.IMPORT_MAX_DEPTH),
    );
  } catch (e) {
    if (e instanceof FileIssue)
      errors.push({ path: e.path, message: e.message });
    else if (e instanceof z.ZodError)
      for (const issue of e.issues.slice(0, 100))
        errors.push({
          path: "/" + issue.path.map(String).join("/"),
          message:
            issue.code === "unrecognized_keys"
              ? "El archivo contiene propiedades no permitidas."
              : "Revisa este dato: tipo, formato o límite no válido.",
        });
    else throw e;
  }
  if (!data) return { payloadHash, errors, counts: emptyCounts(), data };
  const d = data;
  const error = (path: string, message: string) => {
    if (errors.length < 100) errors.push({ path, message });
  };
  const unique = <T>(
    items: readonly T[],
    key: (x: T) => string,
    path: string,
    field: string,
  ) => {
    const seen = new Set<string>();
    items.forEach((x, i) => {
      const k = key(x);
      if (seen.has(k))
        error(
          `${path}/${i}/${field}`,
          "Este identificador o posición está repetido.",
        );
      seen.add(k);
    });
  };
  unique(d.areas, (x) => x.code, "/areas", "code");
  unique(d.sections, (x) => x.externalId, "/sections", "externalId");
  unique(d.sections, (x) => String(x.order), "/sections", "order");
  unique(d.questions, (x) => x.externalId, "/questions", "externalId");
  unique(
    d.questions,
    (x) => `${x.sectionExternalId}\u0000${x.order}`,
    "/questions",
    "order",
  );
  unique(
    d.traceabilityReferences,
    referenceKey,
    "/traceabilityReferences",
    "externalId",
  );
  unique(
    d.conditions,
    (x) => x.childQuestionExternalId,
    "/conditions",
    "childQuestionExternalId",
  );
  const sections = new Set(d.sections.map((s) => s.externalId)),
    areas = new Set(d.areas.map((a) => a.code)),
    refs = new Set(d.traceabilityReferences.map(referenceKey)),
    questions = new Map(d.questions.map((q) => [q.externalId, q]));
  d.questions.forEach((q, i) => {
    const p = `/questions/${i}`;
    if (q.type === "NUMBER" && q.config)
      for (const key of ["min", "max"]) {
        const value = q.config[key];
        if (
          typeof value === "number" &&
          (Math.abs(value) > Number.MAX_SAFE_INTEGER ||
            Math.abs(value * 1e6 - Math.round(value * 1e6)) > 1e-6)
        )
          error(
            p + "/config/" + key,
            "Usa un número seguro con máximo seis decimales.",
          );
      }
    if (!sections.has(q.sectionExternalId))
      error(
        p + "/sectionExternalId",
        "Esta pregunta hace referencia a un tema que no existe.",
      );
    if (!areas.has(q.responsibleAreaCode))
      error(
        p + "/responsibleAreaCode",
        "Incluye el área responsable en el catálogo de áreas del archivo.",
      );
    unique(q.references, referenceKey, p + "/references", "externalId");
    q.references.forEach((r, j) => {
      if (!refs.has(referenceKey(r)))
        error(
          `${p}/references/${j}/externalId`,
          "Esta referencia no existe en el catálogo del archivo.",
        );
    });
    if (
      q.groupParentExternalId &&
      questions.get(q.groupParentExternalId)?.sectionExternalId !==
        q.sectionExternalId
    )
      error(
        p + "/groupParentExternalId",
        "La pregunta principal debe existir en el mismo tema.",
      );
    try {
      validateQuestion({
        ...q,
        sectionId: q.sectionExternalId,
        responsibleAreaId: q.responsibleAreaCode,
        helpText: q.helpText ?? "",
        config: q.config ?? null,
        groupParentId: null,
        supersedesQuestionId: null,
        condition: null,
        references: q.references.map((r) => ({
          referenceId: referenceKey(r),
          scopeNote: r.scopeNote ?? null,
        })),
      } as QuestionInput);
    } catch {
      error(
        p + "/options",
        "Revisa las opciones y configuración: deben corresponder al tipo de respuesta.",
      );
    }
  });
  d.conditions.forEach((c, i) => {
    const p = `/conditions/${i}`,
      q = questions.get(c.parentQuestionExternalId);
    if (!questions.has(c.childQuestionExternalId))
      error(
        p + "/childQuestionExternalId",
        "La pregunta dependiente no existe.",
      );
    if (!q) {
      error(
        p + "/parentQuestionExternalId",
        "La pregunta que activa la condición no existe.",
      );
      return;
    }
    const valid =
      q.type === "YES_NO"
        ? c.operator !== "CONTAINS" && typeof c.value === "boolean"
        : q.type === "SINGLE_CHOICE"
          ? c.operator !== "CONTAINS" &&
            q.options.some((o) => o.value === c.value)
          : q.type === "MULTIPLE_CHOICE"
            ? c.operator === "CONTAINS" &&
              q.options.some((o) => o.value === c.value)
            : false;
    if (!valid)
      error(
        p + "/value",
        "La condición no coincide con el tipo u opciones de su pregunta.",
      );
  });
  try {
    assertAcyclic(
      d.questions
        .filter((q) => q.groupParentExternalId)
        .map((q) => ({
          child: q.externalId,
          parent: q.groupParentExternalId!,
        })),
    );
  } catch {
    error("/questions", "La agrupación contiene un ciclo.");
  }
  try {
    assertAcyclic(
      d.conditions.map((c) => ({
        child: c.childQuestionExternalId,
        parent: c.parentQuestionExternalId,
      })),
    );
  } catch {
    error("/conditions", "Las condiciones contienen un ciclo.");
  }
  const counts = {
    projects: 1,
    sections: d.sections.length,
    questions: d.questions.length,
    options: d.questions.reduce((n, q) => n + q.options.length, 0),
    conditions: d.conditions.length,
    references: d.traceabilityReferences.length,
    links: d.questions.reduce((n, q) => n + q.references.length, 0),
    areas: d.areas.length,
  };
  const limits = importLimits();
  for (const [key, max] of [
    ["sections", limits.IMPORT_MAX_SECTIONS],
    ["questions", limits.IMPORT_MAX_QUESTIONS],
    ["references", limits.IMPORT_MAX_REFERENCES],
  ] as const)
    if (counts[key] > max)
      error("/" + key, "El archivo supera el límite configurado.");
  if (counts.links > limits.IMPORT_MAX_LINKS)
    error("/questions", "El archivo supera 20,000 enlaces.");
  if (!counts.sections || !counts.questions)
    error(
      "/questions",
      "Incluye al menos un tema y una pregunta para importar.",
    );
  return { payloadHash, errors, counts, data: d };
}
