import { useRef } from "react";
import { Button } from "../../ui";
import type { QuestionView } from "@requirements/contracts";
import type { EditorProps } from "./EditorWorkspace";
import { questionGroup } from "./bulk-selection";
import { inspectorActions, type InspectorAction } from "./inspector-actions";

export function QuestionInspectorActions({
  question,
  onSelectGroup,
  part = "all",
  ...props
}: EditorProps & {
  question: QuestionView;
  onSelectGroup?: () => void;
  part?: "all" | "footer" | "secondary";
}) {
  const menu = useRef<HTMLDetailsElement>(null);
  const actions = inspectorActions(props.data, question);
  if (!actions.primary) return null;
  const labels = {
    edit: "Editar pregunta",
    publish: "Publicar",
    assign: "Asignar participantes",
    responses: "Revisar respuestas",
  };
  function invoke(action: InspectorAction) {
    if (action === "edit") props.onEdit(question);
    else if (action === "responses") props.onOpenContributions?.(question.id);
    else props.onAction(action, question);
  }
  function closeMenu() {
    if (menu.current) {
      menu.current.open = false;
      menu.current.querySelector("summary")?.focus();
    }
  }
  const rows = props.data.questions
    .filter(
      (q) => q.sectionId === question.sectionId && q.publication !== "ARCHIVED",
    )
    .sort((a, b) => a.order - b.order);
  const index = rows.findIndex((q) => q.id === question.id);
  return (
    <div className={`qe-inspector-actions qe-inspector-actions-${part}`}>
      {part !== "footer" && (
        <>
          <div className="actions qe-inspector-secondary">
            {actions.secondary.map((action) => (
              <Button
                key={action}
                tone="secondary"
                onClick={() => invoke(action)}
              >
                {labels[action]}
              </Button>
            ))}
          </div>
          {actions.pending.length > 0 && (
            <p className="hint">
              Antes de publicar:{" "}
              {actions.pending.map((issue) => issue.message).join(" ")}
            </p>
          )}
        </>
      )}
      {part !== "secondary" && (
        <>
          <details
            className="qe-inspector-more"
            ref={menu}
            onKeyDown={(event) => {
              if (event.key === "Escape" && menu.current?.open) {
                event.preventDefault();
                event.stopPropagation();
                closeMenu();
              }
            }}
            onClick={(event) => {
              if ((event.target as HTMLElement).closest("button")) closeMenu();
            }}
          >
            <summary>Más acciones</summary>
            <div className="qe-inspector-more-items">
              {(["up", "down"] as const).map((kind) => (
                <Button
                  key={kind}
                  tone="secondary"
                  unavailable={
                    index < 0 ||
                    (kind === "up" ? index === 0 : index === rows.length - 1)
                      ? {
                          reason:
                            index < 0
                              ? "Esta pregunta no está en la lista que se puede ordenar."
                              : kind === "up"
                                ? "Esta pregunta ya está al principio del tema."
                                : "Esta pregunta ya está al final del tema.",
                        }
                      : undefined
                  }
                  onClick={() => props.onAction(kind, question)}
                >
                  {kind === "up" ? "Mover arriba" : "Mover abajo"}
                </Button>
              ))}
              <Button
                tone="secondary"
                onClick={() => props.onAction("metadata", question)}
              >
                Configurar
              </Button>
              {onSelectGroup && (
                <div>
                  <p className="hint">
                    Se seleccionarán{" "}
                    {questionGroup(props.data.questions, question.id).length}{" "}
                    preguntas: esta pregunta y sus seguimientos, incluso fuera
                    de la página o los filtros actuales.
                  </p>
                  <Button tone="secondary" onClick={onSelectGroup}>
                    Seleccionar grupo completo
                  </Button>
                </div>
              )}
              <Button
                tone="danger"
                onClick={() => props.onAction("archive", question)}
              >
                Archivar
              </Button>
            </div>
          </details>
          <div className="qe-inspector-primary">
            <Button
              unavailable={
                actions.primary === "responses" && !props.onOpenContributions
                  ? {
                      reason:
                        "Las respuestas no están disponibles en esta vista.",
                    }
                  : undefined
              }
              onClick={() => invoke(actions.primary!)}
            >
              {labels[actions.primary]}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
