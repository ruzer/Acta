import { useEffect, useState } from "react";
import { ParticipantIcon } from "./ParticipantIcon";

export function SaveStatus({
  saving,
  startedAt,
  busy,
  error,
  dirty,
  message,
  savedMessage,
}: {
  saving: boolean;
  startedAt: number | null;
  busy: boolean;
  error: string;
  dirty: boolean;
  message: string;
  savedMessage: string;
}) {
  const [elapsedStart, setElapsedStart] = useState<number | null>(null);
  useEffect(() => {
    if (startedAt === null) return;
    // Solo sostiene el anuncio visual; no demora ni inicia peticiones.
    const timer = window.setTimeout(
      () => setElapsedStart(startedAt),
      Math.max(0, startedAt + 500 - Date.now()),
    );
    return () => window.clearTimeout(timer);
  }, [startedAt]);
  const showingSave =
    saving || (startedAt !== null && elapsedStart !== startedAt);
  const cause = error
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[.!?]+$/, "");
  const shortCause =
    cause.length > 60 ? cause.slice(0, 57).trimEnd() + "…" : cause;
  const state =
    showingSave || busy
      ? "saving"
      : error
        ? "error"
        : dirty
          ? "unsaved"
          : "saved";
  const text = showingSave
    ? "Guardando…"
    : busy
      ? message || "Procesando…"
      : error
        ? `No se pudo guardar: ${shortCause}. Tu texto sigue aquí`
        : dirty
          ? "Cambios sin guardar"
          : message || savedMessage;
  const icon = {
    saving: "clock",
    error: "info",
    unsaved: "edit",
    saved: "check",
  }[state];
  return (
    <p
      className={`save-status save-status-${state}`}
      data-save-state={state}
      role="status"
      aria-live="polite"
    >
      {text && <ParticipantIcon name={icon} />}
      <span title={error || undefined}>{text}</span>
    </p>
  );
}
