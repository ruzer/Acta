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
  /** Not actionable now: folded until asked for, but its count stays visible. */
  collapsed?: boolean;
};

/**
 * Presentation only: projected states and coverage remain authoritative.
 * Every question appears in exactly one group, the first that applies
 * (conflict or answered, then open clarification, then waiting on others).
 * Overlapping signals stay visible in the row and in the summary counts.
 */
export function attentionGroups(
  questions: Question[],
  clarificationIds: readonly string[],
  canReview: boolean,
): AttentionGroup[] {
  const taken = new Set<string>();
  const claim = (list: Question[]) =>
    list.filter((q) => !taken.has(q.id) && !!taken.add(q.id));
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
  // The state chip and the contribution count already say this; a fixed
  // sentence repeated in every row only added noise (UX-04).
  const reason = () => "";
  const groups: AttentionGroup[] = canReview
    ? [
        {
          id: "action",
          label: "Te toca a ti",
          turn: "Te toca a ti",
          questions: claim([...conflicts, ...answered]),
          action,
          reason,
        },
      ]
    : [
        {
          id: "conflicts",
          label: "Conflictos abiertos",
          questions: claim(conflicts),
          action,
          reason,
        },
        {
          id: "answered",
          label: "Listas para decidir",
          questions: claim(answered),
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
      questions: claim(
        questions.filter((q) => clarificationIds.includes(q.id)),
      ),
      action: () => "Ver aclaración",
      reason: () => "",
    },
    {
      id: "waiting",
      label: canReview
        ? "En espera de otras personas"
        : "Aportaciones pendientes",
      ...(canReview ? { turn: "En espera de otras personas" as const } : {}),
      collapsed: true,
      questions: claim(
        pending.filter((q) => q.requiredRespondents > q.submittedRespondents),
      ),
      action: () => "Ver aportaciones",
      reason: (q) =>
        `Faltan ${q.requiredRespondents - q.submittedRespondents} de ${q.requiredRespondents} aportaciones`,
    },
    {
      id: "unassigned",
      label: "Sin participantes asignados",
      collapsed: true,
      questions: claim(pending.filter((q) => q.requiredRespondents === 0)),
      action: () => "Ver aportaciones",
      reason: () => "Sin participantes asignados",
    },
  );
  return groups.filter((group) => group.questions.length > 0);
}
