import { Button } from "../../ui";
export function QuestionInspectorNavigation({
  questionId,
  visibleIds,
  onNavigate,
}: {
  questionId: string;
  visibleIds: readonly string[];
  onNavigate: (id: string) => void;
}) {
  const index = visibleIds.indexOf(questionId);
  const outside = index < 0;
  return (
    <nav aria-label="Recorrer preguntas" className="qe-inspector-navigation">
      <Button
        tone="secondary"
        aria-label="Pregunta anterior"
        unavailable={
          outside || index === 0
            ? {
                reason: outside
                  ? "La pregunta abierta está fuera de los resultados actuales."
                  : "Estás en la primera pregunta de los resultados.",
              }
            : undefined
        }
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
        unavailable={
          outside || index === visibleIds.length - 1
            ? {
                reason: outside
                  ? "La pregunta abierta está fuera de los resultados actuales."
                  : "Estás en la última pregunta de los resultados.",
              }
            : undefined
        }
        onClick={() => onNavigate(visibleIds[index + 1]!)}
      >
        ›
      </Button>
    </nav>
  );
}
