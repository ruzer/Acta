import type { ReviewDetail } from "@requirements/contracts";
import type { ReviewAction } from "./ReviewActions";

/** Presentation only. Server status and canReview remain authoritative. */
export function deriveTurn(data: ReviewDetail): {
  label: string;
  title: string;
  detail: string;
  action?: ReviewAction;
  threadId?: string;
  conflictId?: string;
} {
  const conflict = data.conflicts.find((item) => item.status === "OPEN");
  const answeredThread = data.threads.find(
    (item) => item.status === "WAITING_ANALYST",
  );
  const waiting = data.threads.filter(
    (item) => item.status === "WAITING_STAKEHOLDER",
  );
  const expected = data.participants.filter(
    (item) => item.applicability === "ENABLED",
  );
  const missing = expected.filter((item) => !item.currentRevisionId);
  const decided = data.validations.some((item) => !item.invalidatedAt);
  if (!data.canReview)
    return {
      label: "Consulta de solo lectura.",
      title: conflict
        ? "Hay diferencias por resolver"
        : decided
          ? "Decisión vigente"
          : "Consulta de la pregunta",
      detail: conflict
        ? "Hay un conflicto abierto entre aportaciones."
        : "La información disponible corresponde a los permisos de esta consulta.",
    };
  if (conflict) {
    const openThreads = data.threads.filter(
      (thread) => thread.status !== "CLOSED",
    ).length;
    return {
      label: "Te toca a ti",
      title: "Hay diferencias por resolver",
      detail: `${conflict.participants.length} aportaciones están vinculadas al conflicto. ${openThreads} ${openThreads === 1 ? "aclaración abierta" : "aclaraciones abiertas"}.`,
      action: "resolveConflict",
      conflictId: conflict.id,
    };
  }
  if (answeredThread)
    return {
      label: "Te toca a ti",
      title: "Llegó una respuesta a la aclaración",
      detail:
        "Revisa la respuesta y cierra la aclaración o pide más precisión.",
      action: "closeClarification",
      threadId: answeredThread.id,
    };
  if (waiting.length) {
    const names = [
      ...new Set(
        waiting
          .map(
            (item) =>
              data.submissions.find(
                (submission) => submission.id === item.responseRevisionId,
              )?.respondent.displayName,
          )
          .filter((name): name is string => !!name),
      ),
    ];
    return {
      label: "En espera de aclaración",
      title:
        names.length === 1
          ? `Esperando la aclaración de ${names[0]}`
          : "Esperando las aclaraciones de los participantes",
      detail: "Hay solicitudes de aclaración pendientes de respuesta.",
    };
  }
  if (data.status === "ANSWERED" && !decided)
    return {
      label: "Te toca a ti",
      title: "Lista para decidir",
      detail: "Revisa las aportaciones antes de registrar la decisión.",
      action: "validateQuestion",
    };
  if (
    decided ||
    data.status === "VALIDATED" ||
    data.status === "NOT_APPLICABLE"
  )
    return {
      label: "",
      title:
        data.status === "NOT_APPLICABLE"
          ? "Marcada como No aplica"
          : "Decisión vigente",
      detail: "El historial y las fuentes se conservan.",
    };
  if (
    (data.status === "PARTIAL" || data.status === "PENDING") &&
    missing.length
  )
    return {
      label: "En espera de aportaciones",
      title: `${missing.length === 1 ? "Falta" : "Faltan"} ${missing.length} de ${expected.length} ${expected.length === 1 ? "persona asignada" : "personas asignadas"}`,
      detail: "Las respuestas aparecerán cuando los participantes las envíen.",
    };
  if (!data.participants.length)
    return {
      label: "",
      title: "Sin participantes asignados",
      detail:
        "Esta pregunta no tiene participantes asignados en el contexto actual.",
    };
  return {
    label: "",
    title: "Revisión de la pregunta",
    detail: "Consulta las aportaciones y el estado actual.",
  };
}
