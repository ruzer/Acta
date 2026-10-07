import { useCallback, useRef, useState, type KeyboardEvent } from "react";
import {
  type QuestionnaireView,
  type QuestionView,
  typeLabels,
  type dashboardView,
} from "@requirements/contracts";
import type { z } from "zod";
import type { OrganizeContext } from "./questionnaire-presentation";
import { Button, EmptyState } from "../../ui";
import { Preview } from "./Preview";
import { ReadinessPanel } from "./ReadinessPanel";
import { Organize } from "./Organize";
import { ParticipantIcon } from "../ParticipantIcon";
export type EditorAction =
  "assign" | "publish" | "archive" | "metadata" | "up" | "down" | "move";
export type EditorProps = {
  data: QuestionnaireView;
  projectId: string;
  contributionQuestions?: z.infer<typeof dashboardView>["questions"];
  contributionsLoading?: boolean;
  contributionsError?: boolean;
  onRetryContributions?: () => void;
  onOpenContributions?: (questionId: string) => void;
  organizeContext?: OrganizeContext;
  onOrganizeContextChange?: (context: OrganizeContext) => void;
  initialMode?: number;
  onModeChange?: (mode: number) => void;
  onCreateTopic: () => void;
  onBulkComplete?: (message: string) => void;
  onRefresh?: () => Promise<QuestionnaireView>;
  onTopicAction?: (kind: "edit" | "up" | "down", id: string) => void;
  onCreateReference: () => void;
  onEdit: (question?: QuestionView, sectionId?: string, field?: string) => void;
  onAction: (kind: EditorAction, question: QuestionView) => void;
};
export const publications = {
  DRAFT: "Borrador",
  PUBLISHED: "Publicada",
  ARCHIVED: "Archivada",
};
export function Publication({ question }: { question: QuestionView }) {
  return (
    <span className="av-status av-neutral">
      <ParticipantIcon
        name={question.publication === "PUBLISHED" ? "check" : "edit"}
      />
      {publications[question.publication]}
    </span>
  );
}
export function QuestionActions({
  question: q,
  onEdit,
  onAction,
  data,
}: Pick<EditorProps, "onEdit" | "onAction"> & { data?: QuestionnaireView } & {
  question: QuestionView;
}) {
  const menu = useRef<HTMLDetailsElement>(null);
  function closeMenu() {
    if (menu.current) {
      menu.current.open = false;
      menu.current.querySelector("summary")?.focus();
    }
  }
  if (q.publication === "ARCHIVED") return null;
  return (
    <details
      className="qe-menu"
      ref={menu}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest("button")) closeMenu();
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          closeMenu();
        }
      }}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget))
          e.currentTarget.open = false;
      }}
    >
      <summary aria-label={"Acciones de " + q.title}>
        ⋯ <span className="sr-only">Acciones</span>
      </summary>
      <div className="qe-menu-items">
        {(["up", "down"] as const).map((kind) => {
          const rows =
            data?.questions
              .filter(
                (x) =>
                  x.sectionId === q.sectionId && x.publication !== "ARCHIVED",
              )
              .sort((a, b) => a.order - b.order) ?? [];
          const index = rows.findIndex((x) => x.id === q.id);
          return (
            <Button
              key={kind}
              tone="secondary"
              disabled={
                index < 0 ||
                (kind === "up" ? index === 0 : index === rows.length - 1)
              }
              onClick={() => onAction(kind, q)}
            >
              {kind === "up" ? "Mover arriba" : "Mover abajo"}
            </Button>
          );
        })}

        {q.publication === "DRAFT" && (
          <>
            <Button tone="secondary" onClick={() => onEdit(q)}>
              Editar pregunta
            </Button>
            <Button tone="secondary" onClick={() => onAction("move", q)}>
              Mover a otro tema
            </Button>
            <Button onClick={() => onAction("publish", q)}>Publicar</Button>
          </>
        )}
        {
          <>
            <Button tone="secondary" onClick={() => onAction("assign", q)}>
              Asignar participantes
            </Button>
            <Button tone="secondary" onClick={() => onAction("metadata", q)}>
              Configurar
            </Button>
            <Button tone="danger" onClick={() => onAction("archive", q)}>
              Archivar
            </Button>
          </>
        }
      </div>
    </details>
  );
}
export function TopicActions({
  data,
  id,
  onTopicAction,
}: Pick<EditorProps, "data" | "onTopicAction"> & { id: string }) {
  const ref = useRef<HTMLDetailsElement>(null);
  const rows = [...data.sections].sort((a, b) => a.order - b.order);
  const index = rows.findIndex((s) => s.id === id);
  if (!onTopicAction) return null;
  function close() {
    if (ref.current) {
      ref.current.open = false;
      ref.current.querySelector("summary")?.focus();
    }
  }
  return (
    <details
      className="qe-menu"
      ref={ref}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          close();
        }
      }}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget))
          e.currentTarget.open = false;
      }}
    >
      <summary aria-label={"Acciones del tema " + rows[index]?.title}>
        ⋯
      </summary>
      <div className="qe-menu-items">
        <Button
          tone="secondary"
          disabled={data.questions.some(
            (q) => q.sectionId === id && q.publication !== "DRAFT",
          )}
          onClick={() => {
            close();
            onTopicAction!("edit", id);
          }}
        >
          Editar tema
        </Button>
        <Button
          tone="secondary"
          disabled={index === 0}
          onClick={() => {
            close();
            onTopicAction!("up", id);
          }}
        >
          Mover arriba
        </Button>
        <Button
          tone="secondary"
          disabled={index === rows.length - 1}
          onClick={() => {
            close();
            onTopicAction!("down", id);
          }}
        >
          Mover abajo
        </Button>
      </div>
    </details>
  );
}
const modes = ["Escribir", "Organizar", "Revisar publicación"] as const;
export function EditorModeSwitcher({
  value,
  onChange,
}: {
  value: number;
  onChange: (value: number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  function key(e: KeyboardEvent) {
    const next =
      e.key === "ArrowRight"
        ? (value + 1) % 3
        : e.key === "ArrowLeft"
          ? (value + 2) % 3
          : e.key === "Home"
            ? 0
            : e.key === "End"
              ? 2
              : -1;
    if (next < 0) return;
    e.preventDefault();
    onChange(next);
    const tabs =
      ref.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]');
    tabs?.[next]?.focus();
  }
  return (
    <div
      ref={ref}
      className="qe-modes"
      role="tablist"
      aria-label="Modo del editor"
      onKeyDown={key}
    >
      {modes.map((name, i) => (
        <button
          key={name}
          id={"qe-tab-" + i}
          role="tab"
          aria-selected={i === value}
          aria-controls={"qe-panel-" + i}
          tabIndex={i === value ? 0 : -1}
          onClick={() => onChange(i)}
        >
          {name}
        </button>
      ))}
    </div>
  );
}
export function EditorWorkspace(props: EditorProps) {
  const organizeContext = useRef(props.organizeContext);
  const onRemember = props.onOrganizeContextChange;
  const rememberOrganize = useCallback(
    (context: OrganizeContext) => {
      organizeContext.current = context;
      onRemember?.(context);
    },
    [onRemember],
  );
  const [mode, updateMode] = useState(props.initialMode ?? 0);
  const setMode = (value: number) => {
    updateMode(value);
    props.onModeChange?.(value);
  };
  const [preview, setPreview] = useState(false);
  const [inspectId, setInspectId] = useState<string>();
  const { data, onEdit, onCreateTopic } = props;
  if (preview) return <Preview data={data} onClose={() => setPreview(false)} />;
  return (
    <>
      <div className="qe-heading">
        <div>
          <h2>Cuestionario</h2>
        </div>
        <div className="actions">
          <Button tone="secondary" onClick={() => setPreview(true)}>
            Vista previa
          </Button>
          <EditorModeSwitcher value={mode} onChange={setMode} />
        </div>
      </div>
      {modes.map((name, i) => (
        <div
          key={name}
          role="tabpanel"
          id={"qe-panel-" + i}
          aria-labelledby={"qe-tab-" + i}
          hidden={mode !== i}
          tabIndex={0}
        >
          {mode === i && i === 1 && (
            <Organize
              {...props}
              initialSelected={inspectId}
              organizeContext={organizeContext.current}
              onOrganizeContextChange={rememberOrganize}
            />
          )}
          {mode === i && i === 2 && (
            <ReadinessPanel
              {...props}
              onOrganize={() => {
                setMode(1);
                requestAnimationFrame(() =>
                  document.getElementById("qe-tab-1")?.focus(),
                );
              }}
              onInspect={(id) => {
                setInspectId(id);
                setMode(1);
              }}
            />
          )}
          {mode === i && i === 0 && (
            <>
              {data.questions.length > 1 && (
                <p className="hint">
                  Para asignar participantes o publicar varias preguntas juntas,
                  usa{" "}
                  <Button
                    tone="secondary"
                    onClick={() => {
                      setMode(1);
                      requestAnimationFrame(() =>
                        document.getElementById("qe-tab-1")?.focus(),
                      );
                    }}
                  >
                    Organizar preguntas
                  </Button>
                  .
                </p>
              )}
              {!data.sections.length && (
                <EmptyState title="Todavía no hay preguntas.">
                  Agrega el primer tema para comenzar.
                </EmptyState>
              )}
              {[...data.sections]
                .sort((a, b) => a.order - b.order)
                .map((s) => {
                  const questions = data.questions
                    .filter((q) => q.sectionId === s.id)
                    .sort((a, b) => a.order - b.order);
                  return (
                    <section
                      className="qe-topic"
                      key={s.id}
                      aria-label={s.title}
                    >
                      <header>
                        <h3>{s.title}</h3>
                        <TopicActions {...props} id={s.id} />
                        <span className="hint">
                          {questions.length} preguntas
                        </span>
                      </header>
                      {s.description && <p className="hint">{s.description}</p>}
                      {!questions.length && (
                        <p className="hint">
                          Este tema todavía no tiene preguntas.
                        </p>
                      )}
                      {questions.map((q) => (
                        <article
                          className={
                            "qe-editorial-row" +
                            (q.groupParentId ? " qe-followup" : "")
                          }
                          key={q.id}
                          aria-label={q.title}
                        >
                          <div>
                            {q.groupParentId && (
                              <p className="hint">
                                ↳ Seguimiento de{" "}
                                {data.questions.find(
                                  (p) => p.id === q.groupParentId,
                                )?.title ?? "pregunta no disponible"}
                              </p>
                            )}
                            <h4>{q.question}</h4>
                            <div className="qe-row-meta">
                              <span>{typeLabels[q.type]}</span>
                              <Publication question={q} />
                            </div>
                          </div>
                          <QuestionActions {...props} question={q} />
                        </article>
                      ))}
                      <Button
                        tone="secondary"
                        disabled={!data.areas.some((a) => a.active)}
                        onClick={() => onEdit(undefined, s.id)}
                      >
                        + Agregar pregunta
                      </Button>
                    </section>
                  );
                })}
              <Button tone="secondary" onClick={onCreateTopic}>
                + Agregar tema
              </Button>
            </>
          )}
        </div>
      ))}
    </>
  );
}
