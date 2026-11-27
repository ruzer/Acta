import type { QuestionView } from "@requirements/contracts";
import { useEffect, useState } from "react";
import { Button } from "../../ui";
import type { EditorProps } from "./EditorWorkspace";
import { InspectorFrame } from "./InspectorFrame";
import { QuestionInspectorContent } from "./QuestionInspectorContent";
import { QuestionInspectorActions } from "./QuestionInspectorActions";
import { QuestionInspectorNavigation } from "./QuestionInspectorNavigation";
import { useInspectorPresence } from "./useInspectorPresence";
import { questionTopicMove } from "./topic-move";
import "./question-inspector.css";

export function QuestionInspector({
  question,
  onClose,
  onSelectGroup,
  visibleIds,
  onNavigate,
  ...props
}: EditorProps & {
  question: QuestionView | null;
  onClose: () => void;
  onSelectGroup?: (id: string) => void;
  visibleIds: readonly string[];
  onNavigate: (id: string) => void;
}) {
  const [exitImmediately, setExitImmediately] = useState(false);
  useEffect(() => {
    if (question) setExitImmediately(false);
  }, [question]);
  const presence = useInspectorPresence(question, {
    animateExit: !exitImmediately,
  });
  const q = presence.question;
  if (!q) return null;
  const { data } = props;
  const moveReason = questionTopicMove(data, q).reason;
  const closeForAction = () => {
    setExitImmediately(true);
    onClose();
  };
  const actionProps = {
    ...props,
    question: q,
    onSelectGroup: onSelectGroup
      ? () => {
          closeForAction();
          onSelectGroup(q.id);
        }
      : undefined,
    onEdit: ((...args) => {
      closeForAction();
      props.onEdit(...args);
    }) as EditorProps["onEdit"],
    onAction: ((...args) => {
      closeForAction();
      props.onAction(...args);
    }) as EditorProps["onAction"],
  };
  const parent = data.questions.find(
    (p) => p.id === q.condition?.parentQuestionId,
  );
  return (
    <InspectorFrame
      onClose={onClose}
      questionId={q.id}
      open={presence.open}
      phase={presence.phase}
      elementRef={presence.elementRef}
      navigation={
        <QuestionInspectorNavigation
          questionId={q.id}
          visibleIds={visibleIds}
          onNavigate={onNavigate}
          onClose={onClose}
        />
      }
      footer={<QuestionInspectorActions {...actionProps} part="footer" />}
    >
      <QuestionInspectorContent
        data={data}
        question={q}
        moveReason={moveReason}
        onChangeTopic={() => {
          closeForAction();
          props.onAction("move", q);
        }}
      />
      <QuestionInspectorActions {...actionProps} part="secondary" />
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
              closeForAction();
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
