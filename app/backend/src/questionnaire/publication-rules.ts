import { type QuestionView, type BulkPreview } from "@requirements/contracts";
import { validateQuestion } from "./rules.js";
export type PublicationContext = {
  questions: Map<string, QuestionView>;
  sections: Set<string>;
  areas: Map<string, { active: boolean }>;
  references: Set<string>;
};
type Issue = BulkPreview["items"][number]["errors"][number];
/** Shared by individual and bulk publication; reads a transaction-scoped snapshot. */
export function publicationIssues(
  q: QuestionView,
  context: PublicationContext,
  publishing: Set<string>,
): Issue[] {
  const issues: Issue[] = [];
  const add = (
    message: string,
    field: string,
    targetId: string | null = null,
  ) => issues.push({ message, field, targetId });
  try {
    validateQuestion(q);
  } catch (error) {
    add(
      error instanceof Error && error.name !== "ZodError"
        ? error.message
        : "Revisa la configuración del tipo de respuesta.",
      "config",
    );
  }
  if (!context.sections.has(q.sectionId))
    add("No se encontró el tema.", "sectionId");
  if (!context.areas.get(q.responsibleAreaId)?.active)
    add("No se encontró el área responsable activa.", "responsibleAreaId");
  if (q.references.some((r) => !context.references.has(r.referenceId)))
    add("Una referencia no pertenece al proyecto.", "references");
  if (
    q.supersedesQuestionId &&
    (q.supersedesQuestionId === q.id ||
      !context.questions.has(q.supersedesQuestionId))
  )
    add(
      "La pregunta anterior debe pertenecer a este proyecto.",
      "supersedesQuestionId",
    );
  for (const kind of ["groupParentId", "condition"] as const) {
    const parentId =
      kind === "groupParentId"
        ? q.groupParentId
        : q.condition?.parentQuestionId;
    if (!parentId) continue;
    const parent = context.questions.get(parentId);
    if (
      !parent ||
      parent.publication === "ARCHIVED" ||
      (kind === "groupParentId" && parent.sectionId !== q.sectionId)
    ) {
      add(
        "La pregunta principal no está disponible en el contexto permitido.",
        kind,
        parent?.id ?? null,
      );
      continue;
    }
    if (parent.publication !== "PUBLISHED" && !publishing.has(parent.id))
      add(
        kind === "groupParentId"
          ? "Publica primero la pregunta principal."
          : "Publica primero la pregunta de la condición.",
        kind,
        parent.id,
      );
    const visited = new Set<string>();
    let node: QuestionView | undefined = q;
    while (node) {
      if (visited.has(node.id)) {
        add("La relación contiene un ciclo de preguntas.", kind);
        break;
      }
      visited.add(node.id);
      const next: string | null | undefined =
        kind === "groupParentId"
          ? node.groupParentId
          : node.condition?.parentQuestionId;
      node = next ? context.questions.get(next) : undefined;
    }
  }
  if (q.condition) {
    const c = q.condition,
      parent = context.questions.get(c.parentQuestionId);
    const valid =
      parent?.type === "YES_NO"
        ? c.operator !== "CONTAINS" && typeof c.value === "boolean"
        : parent?.type === "SINGLE_CHOICE"
          ? c.operator !== "CONTAINS" &&
            parent.options.some((o) => o.value === c.value)
          : parent?.type === "MULTIPLE_CHOICE"
            ? c.operator === "CONTAINS" &&
              parent.options.some((o) => o.value === c.value)
            : false;
    if (!valid)
      add(
        "La condición no coincide con el tipo u opciones de la pregunta principal.",
        "condition",
      );
    if (
      parent &&
      q.assignments.some(
        (a) =>
          a.active &&
          !parent.assignments.some(
            (pa) => pa.active && pa.projectMemberId === a.projectMemberId,
          ),
      )
    )
      add(
        "Un participante no tiene asignada la pregunta principal.",
        "assignments",
        parent.id,
      );
  }
  return issues;
}
