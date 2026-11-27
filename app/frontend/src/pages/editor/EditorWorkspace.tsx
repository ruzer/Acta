import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
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
import { QuestionInspector } from "./QuestionInspector";
import { QuestionOpenButton } from "./QuestionOpenButton";
import { StatusChip } from "../../ui/semantic";
import { plural } from "../../ui/plural";
import { ParticipantIcon } from "../ParticipantIcon";
import {
  inactiveAreasReason,
  protectedTopicReason,
} from "./unavailable-reasons";
export type EditorAction =
  "assign" | "publish" | "archive" | "metadata" | "up" | "down" | "move";
export type EditorProps = {
  data: QuestionnaireView;
  openedQuestionId?: string | null;
  onOpenQuestion?: (id: string) => void;
  onCloseQuestion?: () => void;
  movedQuestion?: { id: string; sectionId: string } | null;
  revealMove?: { id: string; sequence: number } | null;
  projectId: string;
  contributionQuestions?: z.infer<typeof dashboardView>["questions"];
  contributionsLoading?: boolean;
  contributionsError?: boolean;
  onRetryContributions?: () => void;
  onOpenContributions?: (questionId: string) => void;
  organizeContext?: OrganizeContext;
  onOrganizeContextChange?: (context: OrganizeContext) => void;
  initialMode?: number;
  mode?: number;
  organizeLocation?: string;
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
    <StatusChip icon={question.publication === "PUBLISHED" ? "check" : "edit"}>
      {publications[question.publication]}
    </StatusChip>
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
          unavailable={
            data.questions.some(
              (q) => q.sectionId === id && q.publication !== "DRAFT",
            ) && { reason: protectedTopicReason }
          }
          onClick={() => {
            close();
            onTopicAction!("edit", id);
          }}
        >
          Editar tema
        </Button>
        <Button
          tone="secondary"
          unavailable={
            index === 0 && {
              reason: "Este tema ya está al principio del cuestionario.",
            }
          }
          onClick={() => {
            close();
            onTopicAction!("up", id);
          }}
        >
          Mover arriba
        </Button>
        <Button
          tone="secondary"
          unavailable={
            index === rows.length - 1 && {
              reason: "Este tema ya está al final del cuestionario.",
            }
          }
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
  const [localMode, updateMode] = useState(props.initialMode ?? 0);
  const mode = props.mode ?? localMode;
  const setMode = (value: number) => {
    updateMode(value);
    props.onModeChange?.(value);
  };
  const [preview, setPreview] = useState(false);
  const [selectionExpanded, setSelectionExpanded] = useState(false);
  const [localQuestionId, setLocalQuestionId] = useState<string | null>(null);
  const openedQuestionId =
    props.openedQuestionId === undefined
      ? localQuestionId
      : props.openedQuestionId;
  const openQuestion = (id: string) => {
    setLocalQuestionId(id);
    props.onOpenQuestion?.(id);
  };
  const closeQuestion = () => {
    setLocalQuestionId(null);
    props.onCloseQuestion?.();
  };
  const [organizeIds, setOrganizeIds] = useState<string[]>([]);
  const selectGroup = useRef<((id: string) => void) | null>(null);
  const receiveInspectorRows = useCallback(
    (ids: string[], select: (id: string) => void) => {
      setOrganizeIds((previous) =>
        previous.length === ids.length &&
        previous.every((id, index) => id === ids[index])
          ? previous
          : ids,
      );
      selectGroup.current = select;
    },
    [],
  );
  // A long questionnaire would otherwise be one very long page: from 40
  // questions on, topics start folded (the first stays open), as in "Mi trabajo".
  const [topicOpen, setTopicOpen] = useState<Record<string, boolean>>({});
  const { data, onEdit, onCreateTopic } = props;
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const highlightTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const highlightedMove = useRef<{
    moved: EditorProps["movedQuestion"];
    reveal: EditorProps["revealMove"];
  } | null>(null);
  useEffect(
    () => () => {
      if (highlightTimer.current) clearTimeout(highlightTimer.current);
    },
    [],
  );
  const movedQuestion = props.movedQuestion;
  const revealMove = props.revealMove;
  useEffect(() => {
    if (revealMove) setPreview(false);
  }, [revealMove]);
  useEffect(() => {
    if (!revealMove) return;
    const question = data.questions.find((q) => q.id === revealMove.id);
    if (!question || question.sectionId !== movedQuestion?.sectionId) return;
    setTopicOpen((previous) =>
      previous[question.sectionId]
        ? previous
        : { ...previous, [question.sectionId]: true },
    );
  }, [revealMove, movedQuestion, data]);
  useEffect(() => {
    if (
      !movedQuestion ||
      !data.questions.some(
        (q) =>
          q.id === movedQuestion.id && q.sectionId === movedQuestion.sectionId,
      )
    )
      return;
    const frame = requestAnimationFrame(() => {
      const row = Array.from(
        document.querySelectorAll<HTMLElement>("[data-question-id]"),
      ).find(
        (el) =>
          el.dataset.questionId === movedQuestion.id &&
          el.getClientRects().length,
      );
      if (
        !row ||
        (highlightedMove.current?.moved === movedQuestion &&
          highlightedMove.current?.reveal === revealMove)
      )
        return;
      highlightedMove.current = { moved: movedQuestion, reveal: revealMove };
      setHighlightId(movedQuestion.id);
      if (highlightTimer.current) clearTimeout(highlightTimer.current);
      highlightTimer.current = setTimeout(() => setHighlightId(null), 1200);
      if (revealMove?.id === movedQuestion.id) {
        row.scrollIntoView({ block: "center", behavior: "instant" });
        row.focus({ preventScroll: true });
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [movedQuestion, revealMove, data, mode, topicOpen, preview]);
  const foldTopics = data.questions.length > 40;
  // The topic that was first when this opened stays open by id, so moving a
  // topic never folds the one being handled.
  const [firstTopic] = useState(
    () => [...data.sections].sort((a, b) => a.order - b.order)[0]?.id,
  );
  const openedQuestion = data.questions.find((q) => q.id === openedQuestionId);
  useEffect(() => {
    if (mode === 0 && openedQuestion)
      setTopicOpen((previous) =>
        previous[openedQuestion.sectionId]
          ? previous
          : { ...previous, [openedQuestion.sectionId]: true },
      );
  }, [openedQuestion, mode]);
  useEffect(() => {
    if (!openedQuestionId) return;
    const frame = requestAnimationFrame(() => {
      const opener = Array.from(
        document.querySelectorAll<HTMLElement>("[data-question-opener]"),
      ).find((element) => element.dataset.questionOpener === openedQuestionId);
      opener?.scrollIntoView?.({ block: "nearest", behavior: "instant" });
    });
    return () => cancelAnimationFrame(frame);
  }, [openedQuestionId, mode, topicOpen, organizeIds]);
  const writeIds = [...data.sections]
    .sort((a, b) => a.order - b.order)
    .flatMap((section) =>
      (topicOpen[section.id] ?? (!foldTopics || section.id === firstTopic))
        ? data.questions
            .filter((q) => q.sectionId === section.id)
            .sort((a, b) => a.order - b.order)
            .map((q) => q.id)
        : [],
    );
  if (preview) return <Preview data={data} onClose={() => setPreview(false)} />;
  return (
    <>
      <div className="qe-heading">
        <div>
          <p className="ac-questionnaire-total">
            {plural(data.questions.length, "pregunta")} ·{" "}
            {plural(
              data.questions.filter((q) => q.publication === "PUBLISHED")
                .length,
              "publicada",
            )}
          </p>
        </div>
        <div className="actions">
          <Button tone="secondary" onClick={() => setPreview(true)}>
            Vista previa
          </Button>
          <EditorModeSwitcher value={mode} onChange={setMode} />
        </div>
      </div>
      <div
        className={
          "qe-workspace" + (openedQuestion ? " qe-workspace-inspecting" : "")
        }
      >
        <div className="qe-workspace-content">
          {modes.map((name, i) => (
            <div
              key={name}
              role="tabpanel"
              id={"qe-panel-" + i}
              aria-labelledby={"qe-tab-" + i}
              hidden={mode !== i}
              tabIndex={0}
            >
              {mode === i && (
                <p className="hint qe-mode-description">
                  {
                    [
                      "Redacta las preguntas y consulta su contenido por tema.",
                      "Busca, ordena y selecciona preguntas para trabajar con ellas.",
                      "Comprueba los pendientes antes de publicar las preguntas.",
                    ][i]
                  }
                </p>
              )}
              {mode === i && i === 1 && (
                <Organize
                  {...props}
                  openedQuestionId={openedQuestionId}
                  onOpenQuestion={openQuestion}
                  onInspectorRowsChange={receiveInspectorRows}
                  highlightedQuestionId={highlightId}
                  initialSelectionExpanded={selectionExpanded}
                  organizeContext={
                    props.organizeLocation === undefined
                      ? organizeContext.current
                      : props.organizeContext
                  }
                  onOrganizeContextChange={rememberOrganize}
                />
              )}
              {mode === i && i === 2 && (
                <ReadinessPanel
                  {...props}
                  onOrganize={() => {
                    setSelectionExpanded(true);
                    setMode(1);
                    requestAnimationFrame(() =>
                      document.getElementById("qe-tab-1")?.focus(),
                    );
                  }}
                  onInspect={(id) => {
                    openQuestion(id);
                    setMode(1);
                  }}
                />
              )}
              {mode === i && i === 0 && (
                <>
                  {data.sections.length > 0 && (
                    <div className="qe-topic-add">
                      <Button tone="secondary" onClick={onCreateTopic}>
                        + Agregar tema
                      </Button>
                    </div>
                  )}
                  {data.questions.length > 1 && (
                    <p className="hint qe-inline-hint">
                      Para asignar participantes o publicar varias preguntas
                      juntas, usa{" "}
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
                    <EmptyState
                      title="Todavía no hay preguntas."
                      action={
                        <Button onClick={onCreateTopic}>+ Agregar tema</Button>
                      }
                    >
                      Agrega el primer tema para comenzar.
                    </EmptyState>
                  )}
                  {[...data.sections]
                    .sort((a, b) => a.order - b.order)
                    .map((s) => {
                      const questions = data.questions
                        .filter((q) => q.sectionId === s.id)
                        .sort((a, b) => a.order - b.order);
                      const open =
                        topicOpen[s.id] ??
                        (!foldTopics ||
                          s.id === firstTopic ||
                          !questions.length);
                      return (
                        <section
                          className="qe-topic"
                          key={s.id}
                          aria-label={s.title}
                        >
                          <header>
                            <h3 aria-level={2}>
                              {foldTopics ? (
                                <button
                                  className="qe-topic-toggle"
                                  aria-expanded={open}
                                  aria-controls={`qe-topic-${s.id}`}
                                  onClick={() =>
                                    setTopicOpen({
                                      ...topicOpen,
                                      [s.id]: !open,
                                    })
                                  }
                                >
                                  <span
                                    className={
                                      open ? "qe-chevron open" : "qe-chevron"
                                    }
                                  >
                                    <ParticipantIcon name="chevron" />
                                  </span>
                                  {s.title}
                                </button>
                              ) : (
                                s.title
                              )}
                            </h3>
                            <TopicActions {...props} id={s.id} />
                            <span className="hint">
                              {plural(questions.length, "pregunta")}
                            </span>
                          </header>
                          {open && (
                            <div id={`qe-topic-${s.id}`}>
                              {s.description && (
                                <p className="hint">{s.description}</p>
                              )}
                              {!questions.length && (
                                <p className="hint">
                                  Este tema todavía no tiene preguntas.
                                </p>
                              )}
                              {questions.map((q) => (
                                <article
                                  className={
                                    "qe-editorial-row" +
                                    (q.groupParentId ? " qe-followup" : "") +
                                    (highlightId === q.id
                                      ? " qe-topic-moved"
                                      : "")
                                  }
                                  key={q.id}
                                  aria-label={q.title}
                                  data-question-id={q.id}
                                  tabIndex={-1}
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
                                    <h4 aria-level={3}>
                                      <QuestionOpenButton
                                        question={q}
                                        current={openedQuestionId === q.id}
                                        onOpen={openQuestion}
                                      />
                                    </h4>
                                    <div className="qe-row-meta">
                                      <span>{typeLabels[q.type]}</span>
                                      <Publication question={q} />
                                    </div>
                                  </div>
                                  {q.publication === "DRAFT" && (
                                    <Button
                                      tone="secondary"
                                      onClick={() => onEdit(q)}
                                    >
                                      Editar pregunta
                                    </Button>
                                  )}
                                </article>
                              ))}
                              <Button
                                tone="secondary"
                                unavailable={
                                  !data.areas.some((a) => a.active) && {
                                    reason: inactiveAreasReason,
                                  }
                                }
                                onClick={() => onEdit(undefined, s.id)}
                              >
                                + Agregar pregunta
                              </Button>
                            </div>
                          )}
                        </section>
                      );
                    })}
                </>
              )}
            </div>
          ))}
        </div>
        <QuestionInspector
          {...props}
          question={openedQuestion ?? null}
          visibleIds={mode === 1 ? organizeIds : writeIds}
          onNavigate={openQuestion}
          onClose={closeQuestion}
          onSelectGroup={
            mode === 1
              ? (id) => {
                  selectGroup.current?.(id);
                }
              : undefined
          }
        />
      </div>
    </>
  );
}
