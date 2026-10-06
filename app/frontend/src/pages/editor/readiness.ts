import {
  questionInput,
  type QuestionnaireView,
  type QuestionView,
} from "@requirements/contracts";
export type ReadinessIssue = {
  questionId: string;
  field: string;
  level: "ERROR" | "ADVERTENCIA" | "INFORMACIÓN";
  message: string;
  targetId?: string;
};
export function readiness(data: QuestionnaireView): ReadinessIssue[] {
  const issues: ReadinessIssue[] = [];
  const byId = new Map(data.questions.map((q) => [q.id, q]));
  for (const q of data.questions.filter((q) => q.publication !== "ARCHIVED")) {
    const add = (
      field: string,
      message: string,
      level: ReadinessIssue["level"] = "ERROR",
      targetId?: string,
    ) => issues.push({ questionId: q.id, field, message, level, targetId });
    const input = Object.fromEntries(
      Object.keys(questionInput.shape).map((key) => [
        key,
        q[key as keyof QuestionView],
      ]),
    );
    const parsed = questionInput.safeParse(input);
    if (!parsed.success)
      for (const error of parsed.error.issues)
        add(
          error.path.join("."),
          `Revisa la configuración de ${String(error.path[0] ?? "pregunta")}.`,
        );
    if (!data.areas.some((a) => a.id === q.responsibleAreaId && a.active))
      add("responsibleAreaId", "Selecciona un área responsable activa.");
    const choices = ["SINGLE_CHOICE", "MULTIPLE_CHOICE"].includes(q.type);
    if (choices && q.options.length < 2)
      add("options", "Agrega al menos dos opciones.");
    if (!choices && q.options.length)
      add("type", "Este tipo de pregunta no admite opciones.");
    if (new Set(q.options.map((o) => o.value)).size !== q.options.length)
      add("options", "Los códigos de las opciones deben ser únicos.");
    if (q.type === "MATRIX") {
      const cfg = q.config as {
        rows?: { key: string; label: string }[];
        columns?: { key: string; label: string }[];
      } | null;
      for (const axis of ["rows", "columns"] as const) {
        const xs = cfg?.[axis];
        if (
          !Array.isArray(xs) ||
          xs.length < (axis === "rows" ? 1 : 2) ||
          xs.length > 20 ||
          xs.some((x) => !x.label || !/^[A-Za-z0-9_-]{1,64}$/.test(x.key)) ||
          new Set(xs.map((x) => x.key)).size !== xs.length
        )
          add(
            `config.${axis}`,
            `Revisa las ${axis === "rows" ? "filas" : "columnas"} de la matriz.`,
          );
      }
    }
    for (const field of ["groupParentId", "condition"] as const) {
      const parentId =
        field === "condition" ? q.condition?.parentQuestionId : q.groupParentId;
      if (!parentId) continue;
      const parent = byId.get(parentId);
      if (
        !parent ||
        parent.publication === "ARCHIVED" ||
        (field === "groupParentId" && parent.sectionId !== q.sectionId)
      )
        add(
          field,
          "La pregunta principal no está disponible en el contexto permitido.",
        );
      else if (q.publication === "DRAFT" && parent.publication !== "PUBLISHED")
        add(
          field,
          "Para publicarla por separado, publica primero la principal. También puedes seleccionar ambas en Organizar y revisar su publicación conjunta.",
          "ADVERTENCIA",
          parent.id,
        );
      let node: QuestionView | undefined = q;
      const seen = new Set<string>();
      while (node) {
        if (seen.has(node.id)) {
          add(
            field,
            "La relación contiene un ciclo. Corrige la pregunta principal.",
          );
          break;
        }
        seen.add(node.id);
        const next: string | null | undefined =
          field === "condition"
            ? node.condition?.parentQuestionId
            : node.groupParentId;
        node = next ? byId.get(next) : undefined;
      }
    }
    if (q.condition) {
      const c = q.condition,
        p = byId.get(c.parentQuestionId);
      const valid =
        p?.type === "YES_NO"
          ? c.operator !== "CONTAINS" && typeof c.value === "boolean"
          : p?.type === "SINGLE_CHOICE"
            ? c.operator !== "CONTAINS" &&
              p.options.some((o) => o.value === c.value)
            : p?.type === "MULTIPLE_CHOICE"
              ? c.operator === "CONTAINS" &&
                p.options.some((o) => o.value === c.value)
              : false;
      if (!valid)
        add(
          "condition",
          "La condición no coincide con el tipo u opciones de la pregunta principal.",
        );
      if (
        p &&
        q.assignments.some(
          (a) =>
            a.active &&
            !p.assignments.some(
              (pa) => pa.active && pa.projectMemberId === a.projectMemberId,
            ),
        )
      )
        add(
          "assignments",
          "Un participante no tiene asignada la pregunta principal.",
          "ERROR",
          p.id,
        );
    }
    if (
      q.references.some(
        (r) => !data.references.some((x) => x.id === r.referenceId),
      )
    )
      add("references", "Una referencia no está disponible en este proyecto.");
    if (!q.assignments.some((a) => a.active))
      add(
        "assignments",
        "Sin participantes asignados: nadie podrá responder todavía. Esto no impide publicar.",
        "ADVERTENCIA",
      );
    if (q.publication === "PUBLISHED")
      add(
        "publication",
        "Contenido publicado y protegido. Los metadatos permitidos siguen disponibles.",
        "INFORMACIÓN",
      );
  }
  return issues;
}
