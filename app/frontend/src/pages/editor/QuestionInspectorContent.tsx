import {
  typeLabels,
  type QuestionnaireView,
  type QuestionView,
} from "@requirements/contracts";
import { Button } from "../../ui";
import { Publication } from "./EditorWorkspace";

export function QuestionInspectorContent({
  data,
  question: q,
  moveReason,
  onChangeTopic,
}: {
  data: QuestionnaireView;
  question: QuestionView;
  moveReason?: string;
  onChangeTopic: () => void;
}) {
  const matrix =
    q.type === "MATRIX"
      ? (q.config as {
          rows?: { key: string; label: string }[];
          columns?: { key: string; label: string }[];
        } | null)
      : null;
  return (
    <>
      <h3 className="qe-question-text">{q.question}</h3>
      {q.helpText && <p className="qe-question-help">{q.helpText}</p>}
      <div className="qe-row-meta">
        <span>{typeLabels[q.type]}</span>
        <Publication question={q} />
      </div>
      {q.options.length > 0 && (
        <section aria-label="Opciones de respuesta">
          <h4>Opciones de respuesta</h4>
          <ol>
            {[...q.options]
              .sort((a, b) => a.order - b.order)
              .map((option) => (
                <li key={option.value}>{option.label}</li>
              ))}
          </ol>
        </section>
      )}
      {matrix &&
        (["rows", "columns"] as const).map((axis) => (
          <section
            key={axis}
            aria-label={axis === "rows" ? "Filas" : "Columnas"}
          >
            <h4>{axis === "rows" ? "Filas" : "Columnas"}</h4>
            <ul>
              {matrix[axis]?.map((item) => (
                <li key={item.key}>{item.label}</li>
              ))}
            </ul>
          </section>
        ))}
      <dl className="qe-question-facts">
        <dt>Tema</dt>
        <dd>
          {data.sections.find((s) => s.id === q.sectionId)?.title ??
            "Tema no disponible"}
          {q.publication === "DRAFT" && (
            <Button
              tone="secondary"
              onClick={onChangeTopic}
              unavailable={moveReason ? { reason: moveReason } : undefined}
            >
              Cambiar de tema
            </Button>
          )}
        </dd>
        <dt>Área responsable</dt>
        <dd>
          {data.areas.find((a) => a.id === q.responsibleAreaId)?.name ??
            "Área no disponible"}
        </dd>
        <dt>Participantes asignados</dt>
        <dd>
          {q.assignments
            .filter((a) => a.active)
            .map(
              (a) =>
                data.members.find((m) => m.id === a.projectMemberId)
                  ?.displayName ?? "Participante no disponible",
            )
            .join(", ") || "Sin participantes asignados"}
        </dd>
        <dt>Obligatoria</dt>
        <dd>{q.required ? "Sí" : "No"}</dd>
      </dl>
      <p className="hint">
        El área responsable no asigna participantes automáticamente.
      </p>
    </>
  );
}
