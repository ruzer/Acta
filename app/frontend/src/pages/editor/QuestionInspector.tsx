import type { QuestionView } from "@requirements/contracts";
import { Button } from "../../ui";
import type { EditorProps } from "./EditorWorkspace";
import { InspectorFrame } from "./InspectorFrame";
import { QuestionInspectorContent } from "./QuestionInspectorContent";
import { QuestionInspectorActions } from "./QuestionInspectorActions";
import { QuestionInspectorNavigation } from "./QuestionInspectorNavigation";
import "./question-inspector.css";

export function QuestionInspector({
  question: q,
  onClose,
  onSelectGroup,
  visibleIds,
  onNavigate,
  moveReason,
  ...props
}: EditorProps & {
  question: QuestionView;
  onClose: () => void;
  onSelectGroup?: () => void;
  visibleIds: readonly string[];
  onNavigate: (id: string) => void;
  moveReason?: string;
}) {
  const { data } = props;
  const parent = data.questions.find(
    (p) => p.id === q.condition?.parentQuestionId,
  );
  return (
    <InspectorFrame onClose={onClose} questionId={q.id}>
      <QuestionInspectorNavigation
        questionId={q.id}
        visibleIds={visibleIds}
        onNavigate={onNavigate}
      />
      <QuestionInspectorContent
        data={data}
        question={q}
        moveReason={moveReason}
        onChangeTopic={() => {
          onClose();
          props.onAction("move", q);
        }}
      />
      <QuestionInspectorActions
        {...props}
        question={q}
        onSelectGroup={onSelectGroup}
        onEdit={(...args) => {
          onClose();
          props.onEdit(...args);
        }}
        onAction={(...args) => {
          onClose();
          props.onAction(...args);
        }}
      />
      <details className="qe-inspector-advanced">
        <summary>Configuración avanzada</summary>
        <dl>
          <dt>Identificador externo</dt>
          <dd>{q.externalId}</dd>
          <dt>Prioridad</dt>
          <dd>{q.priority}</dd>
        </dl>
        {q.groupParentId && (
          <p>
            Seguimiento de:{" "}
            {data.questions.find((p) => p.id === q.groupParentId)?.title ??
              "Pregunta no disponible"}
            . La agrupación no implica una condición.
          </p>
        )}
        {q.condition && (
          <p>
            Mostrar si «{parent?.question ?? "Pregunta no disponible"}»{" "}
            {
              {
                EQUALS: "es igual a",
                NOT_EQUALS: "es diferente de",
                CONTAINS: "incluye",
              }[q.condition.operator]
            }{" "}
            «
            {typeof q.condition.value === "boolean"
              ? q.condition.value
                ? "Sí"
                : "No"
              : (parent?.options.find((o) => o.value === q.condition?.value)
                  ?.label ?? q.condition.value)}
            ».
          </p>
        )}
        <details>
          <summary>Trazabilidad</summary>
          <ul>
            {q.references.map((r) => {
              const reference = data.references.find(
                (x) => x.id === r.referenceId,
              );
              return (
                <li key={r.referenceId}>
                  {reference?.externalId} · {reference?.label}
                  {r.scopeNote && <p>{r.scopeNote}</p>}
                </li>
              );
            })}
          </ul>
          {!q.references.length && <p>Sin referencias relacionadas.</p>}
          <p className="hint">
            Relacionar una referencia no la convierte en validada.
          </p>
          <Button
            tone="secondary"
            onClick={() => {
              onClose();
              props.onCreateReference();
            }}
          >
            Crear referencia
          </Button>
        </details>
      </details>
    </InspectorFrame>
  );
}
