import type { AttentionDashboard } from "./attention-data";

type Question = AttentionDashboard["questions"][number];
export type AttentionGroup = {
  id: string;
  label: string;
  turn?: "Te toca a ti" | "En espera de otras personas";
  explanation?: string;
  questions: Question[];
  action: (question: Question) => string;
  reason: (question: Question) => string;
};

/** Presentation only: projected states and coverage remain authoritative. */
export function attentionGroups(
  questions: Question[],
  clarificationIds: readonly string[],
  canReview: boolean,
): AttentionGroup[] {
  const conflicts = questions.filter((q) => q.status === "CONFLICT");
  const answered = questions.filter((q) => q.status === "ANSWERED");
  const pending = questions.filter(
    (q) => q.status === "PARTIAL" || q.status === "PENDING",
  );
  const action = (q: Question) =>
    canReview
      ? q.status === "CONFLICT"
        ? "Resolver conflicto"
        : "Revisar y decidir"
      : q.status === "CONFLICT"
        ? "Revisar conflicto"
        : "Revisar respuestas";
  const reason = (q: Question) =>
    q.status === "CONFLICT"
      ? "Hay un conflicto registrado entre aportaciones que necesita revisión."
      : "Se recibieron respuestas; todavía no hay una decisión validada vigente.";
  const groups: AttentionGroup[] = canReview
    ? [
        {
          id: "action",
          label: "Te toca a ti",
          turn: "Te toca a ti",
          questions: [...conflicts, ...answered],
          action,
          reason,
        },
      ]
    : [
        {
          id: "conflicts",
          label: "Conflictos abiertos",
          questions: conflicts,
          action,
          reason,
        },
        {
          id: "answered",
          label: "Listas para decidir",
          questions: answered,
          action,
          reason,
        },
      ];
  groups.push(
    {
      id: "clarifications",
      label: "Aclaraciones abiertas",
      explanation:
        "Hay aclaraciones abiertas. Consulta el hilo para saber a quién corresponde continuar.",
      questions: questions.filter((q) => clarificationIds.includes(q.id)),
      action: () => "Ver aclaración",
      reason: () => "",
    },
    {
      id: "waiting",
      label: canReview
        ? "En espera de otras personas"
        : "Aportaciones pendientes",
      ...(canReview ? { turn: "En espera de otras personas" as const } : {}),
      questions: pending.filter(
        (q) => q.requiredRespondents > q.submittedRespondents,
      ),
      action: () => "Ver aportaciones",
      reason: (q) =>
        `Faltan ${q.requiredRespondents - q.submittedRespondents} de ${q.requiredRespondents} aportaciones`,
    },
    {
      id: "unassigned",
      label: "Sin participantes asignados",
      questions: pending.filter((q) => q.requiredRespondents === 0),
      action: () => "Ver aportaciones",
      reason: () => "Sin participantes asignados",
    },
  );
  return groups.filter((group) => group.questions.length > 0);
}
