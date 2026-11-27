import { useId } from "react";
import { Button } from "../../ui";
export function QuestionInspectorNavigation({
  questionId,
  visibleIds,
  onNavigate,
  onClose,
}: {
  questionId: string;
  visibleIds: readonly string[];
  onNavigate: (id: string) => void;
  onClose?: () => void;
}) {
  const reasonId = useId();
  const index = visibleIds.indexOf(questionId);
  const outside = index < 0;
  const first = index === 0;
  const last = index === visibleIds.length - 1;
  const reason = outside
    ? "La pregunta abierta está fuera de los resultados actuales."
    : first && last
      ? "Esta es la única pregunta de los resultados."
      : first
        ? "Estás en la primera pregunta de los resultados."
        : last
          ? "Estás en la última pregunta de los resultados."
          : undefined;
  const unavailable = reason ? { reason, describedBy: reasonId } : undefined;
  return (
    <nav aria-label="Recorrer preguntas" className="qe-inspector-navigation">
      <Button
        tone="secondary"
        aria-label="Pregunta anterior"
        unavailable={outside || first ? unavailable : undefined}
        onClick={() => onNavigate(visibleIds[index - 1]!)}
      >
        ‹
      </Button>
      <p role="status">
        {outside
          ? "Fuera de los resultados actuales"
          : `${index + 1} de ${visibleIds.length} resultados`}
      </p>
      <Button
        tone="secondary"
        aria-label="Pregunta siguiente"
        unavailable={outside || last ? unavailable : undefined}
        onClick={() => onNavigate(visibleIds[index + 1]!)}
      >
        ›
      </Button>
      {onClose && (
        <Button tone="secondary" onClick={onClose}>
          Cerrar detalle
        </Button>
      )}
      {reason && (
        <p id={reasonId} className="hint qe-inspector-navigation-reason">
          {reason}
        </p>
      )}
    </nav>
  );
}
