import { ParticipantIcon } from "../ParticipantIcon";
import { CreateInvitation } from "../Invitations";
import {
  Fragment,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  type QuestionView,
  type BulkOperation,
  typeLabels,
} from "@requirements/contracts";
import { Button, Input, Select, EmptyState } from "../../ui";
import { QuestionRow, SelectionBar } from "../../ui/semantic";
import {
  Publication,
  QuestionActions,
  TopicActions,
  publications,
  type EditorProps,
} from "./EditorWorkspace";
import { BulkDialog } from "./BulkDialog";
import { questionGroup } from "./bulk-selection";
import { AnalystStatus } from "../AnalystVisual";
import {
  questionAncestors,
  unfoldedQuestions,
} from "./questionnaire-presentation";
import "../../next-questionnaire.css";
function InspectorFrame({
  children,
  onClose,
}: {
  children: ReactNode;
  onClose: () => void;
}) {
  const [wide, setWide] = useState(
    () =>
      typeof matchMedia === "function" &&
      matchMedia("(min-width:1280px)").matches,
  );
  const ref = useRef<HTMLDialogElement>(null),
    heading = useRef<HTMLHeadingElement>(null);
  const openingTrigger = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const m = window.matchMedia?.("(min-width:1280px)");
    if (!m) return;
    const update = () => setWide(m.matches);
    m.addEventListener("change", update);
    return () => m.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    // Keep the original opener across Strict Mode effect replay and resize.
    openingTrigger.current ??= document.activeElement as HTMLElement;
    const trigger = openingTrigger.current;
    const dialog = ref.current;
    if (!wide) dialog?.showModal();
    else heading.current?.focus();
    return () => {
      dialog?.close();
      requestAnimationFrame(() => {
        // A deferred return must not steal focus from a newer user action.
        const active = document.activeElement;
        if (
          trigger?.isConnected &&
          (active === document.body || active === trigger) &&
          !document.querySelector("dialog[open]")
        )
          trigger.focus();
      });
    };
  }, [wide]);
  const content = (
    <>
      <header className="qe-inspector-head">
        <h3 ref={heading} tabIndex={-1}>
          Detalle de pregunta
        </h3>
        <Button tone="secondary" onClick={onClose}>
          Cerrar detalle
        </Button>
      </header>
      {children}
    </>
  );
  return wide ? (
    <aside className="qe-inspector" aria-label="Detalle de pregunta">
      {content}
    </aside>
  ) : (
    <dialog
      className="qe-inspector qe-inspector-dialog av-scope"
      aria-label="Detalle de pregunta"
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      {content}
    </dialog>
  );
}
export function QuestionInspector({
  question: q,
  onClose,
  onSelectGroup,
  ...props
}: EditorProps & {
  question: QuestionView;
  onClose: () => void;
  onSelectGroup?: () => void;
}) {
  const { data } = props;
  const area = data.areas.find((a) => a.id === q.responsibleAreaId);
  const parent = data.questions.find(
    (p) => p.id === q.condition?.parentQuestionId,
  );
  return (
    <InspectorFrame onClose={onClose}>
      <p className="hint">
        {data.sections.find((s) => s.id === q.sectionId)?.title}
      </p>
      <h4>{q.question}</h4>
      <div className="qe-row-meta">
        <span>{typeLabels[q.type]}</span>
        <Publication question={q} />
      </div>
      {q.helpText && <p>{q.helpText}</p>}
      <p>{q.required ? "Pregunta obligatoria" : "Pregunta opcional"}</p>
      {onSelectGroup && q.publication !== "ARCHIVED" && (
        <div className="qe-group-select">
          <p>
            Se seleccionarán {questionGroup(data.questions, q.id).length}{" "}
            preguntas: esta pregunta y sus seguimientos, incluso fuera de la
            página o los filtros actuales.
          </p>
          <Button tone="secondary" onClick={onSelectGroup}>
            Seleccionar grupo completo
          </Button>
        </div>
      )}
      <QuestionActions
        {...props}
        question={q}
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
          <dt>Área responsable</dt>
          <dd>{area?.name ?? "Área no disponible"}</dd>
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
        </dl>
        <p className="hint">
          El área responsable no asigna participantes automáticamente.
        </p>
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
export function Organize(
  props: EditorProps & {
    initialSelected?: string;
    initialSelectionExpanded?: boolean;
  },
) {
  const { data } = props;
  const [topicsExpanded, setTopicsExpanded] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selectionExpanded, setSelectionExpanded] = useState(
    props.initialSelectionExpanded ?? false,
  );
  const [wideFilters, setWideFilters] = useState(
    () =>
      typeof matchMedia !== "function" ||
      matchMedia("(min-width:900px)").matches,
  );
  const filterTrigger = useRef<HTMLButtonElement>(null);
  const topicTrigger = useRef<HTMLElement>(null);
  useEffect(() => {
    const query = window.matchMedia?.("(min-width:900px)");
    if (!query) return;
    const update = () => setWideFilters(query.matches);
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  const [topic, setTopic] = useState(props.organizeContext?.topic ?? "");
  const [search, setSearch] = useState(props.organizeContext?.search ?? "");
  const [publication, setPublication] = useState(
    props.organizeContext?.publication ?? "",
  );
  const [area, setArea] = useState(props.organizeContext?.area ?? "");
  const [approach, setApproach] = useState<"prepare" | "analyze">(
    props.organizeContext?.approach ?? "prepare",
  );
  const [collapsed, setCollapsed] = useState(
    new Set(props.organizeContext?.collapsed ?? []),
  );
  const byId = useMemo(
    () => new Map(data.questions.map((q) => [q.id, q])),
    [data.questions],
  );
  const contributionById = useMemo(
    () => new Map(props.contributionQuestions?.map((q) => [q.id, q])),
    [props.contributionQuestions],
  );
  const [inviting, setInviting] = useState(false);
  const [bulkIds, setBulkIds] = useState<Set<string>>(
    new Set(
      props.organizeContext?.selectedIds.filter(
        (id) => byId.get(id)?.publication !== "ARCHIVED" && byId.has(id),
      ) ?? [],
    ),
  );
  const [bulkOperation, setBulkOperation] = useState<BulkOperation | null>(
    null,
  );
  const [selectionNotice, setSelectionNotice] = useState("");
  const bulkTrigger = useRef<HTMLElement | null>(null);
  const selectionStatus = useRef<HTMLParagraphElement>(null);
  const [page, setPage] = useState(props.organizeContext?.page ?? 0);
  const rememberContext = props.onOrganizeContextChange;
  useEffect(() => {
    rememberContext?.({
      topic,
      search,
      publication,
      area,
      approach,
      page,
      collapsed: [...collapsed],
      selectedIds: [...bulkIds],
    });
  }, [
    rememberContext,
    topic,
    search,
    publication,
    area,
    approach,
    page,
    collapsed,
    bulkIds,
  ]);
  const [selected, setSelected] = useState<string | null>(
    props.initialSelected ?? null,
  );
  const questions = data.questions
    .filter(
      (q) =>
        (!topic || q.sectionId === topic) &&
        (!publication || q.publication === publication) &&
        (!area || q.responsibleAreaId === area) &&
        `${q.question} ${q.title} ${q.externalId}`
          .toLocaleLowerCase()
          .includes(search.toLocaleLowerCase()),
    )
    .sort(
      (a, b) =>
        (data.sections.find((s) => s.id === a.sectionId)?.order ?? 0) -
          (data.sections.find((s) => s.id === b.sectionId)?.order ?? 0) ||
        a.order - b.order,
    );
  const unfolded = unfoldedQuestions(
    questions,
    byId,
    collapsed,
    !!search.trim(),
  );
  const pages = Math.ceil(unfolded.length / 40);
  const currentPage = Math.min(page, Math.max(0, pages - 1));
  const selection = data.questions.find((q) => q.id === selected);
  const change = () => {
    if (bulkIds.size)
      setSelectionNotice(
        "Se limpió la selección al cambiar los filtros. Selecciona las preguntas que deseas modificar.",
      );
    setBulkIds(new Set());
    setPage(0);
    setSelected(null);
  };
  const eligible = (rows: QuestionView[]) =>
    rows.filter((q) => q.publication !== "ARCHIVED");
  const pageRows = unfolded.slice(currentPage * 40, (currentPage + 1) * 40);
  const pageIds = new Set(pageRows.map((q) => q.id));
  // A row group follows the existing page order; it never reorders questions.
  const pageGroups: { sectionId: string; rows: QuestionView[] }[] = [];
  for (const question of pageRows) {
    const previous = pageGroups.at(-1);
    if (previous?.sectionId === question.sectionId)
      previous.rows.push(question);
    else pageGroups.push({ sectionId: question.sectionId, rows: [question] });
  }
  const selectedQuestions = data.questions.filter((q) => bulkIds.has(q.id));
  function addSelection(rows: QuestionView[]) {
    setBulkIds(
      (previous) => new Set([...previous, ...eligible(rows).map((q) => q.id)]),
    );
    setSelectionNotice("");
  }
  function closeBulk() {
    setBulkOperation(null);
    requestAnimationFrame(() => {
      if (bulkTrigger.current?.isConnected) bulkTrigger.current.focus();
      else selectionStatus.current?.focus();
    });
  }
  function openBulk(operation: BulkOperation) {
    bulkTrigger.current = document.activeElement as HTMLElement;
    setBulkOperation(operation);
  }
  return (
    <div
      className={
        "qe-organize an-questionnaire" + (selection ? " qe-has-inspector" : "")
      }
    >
      <section className="qe-compact" aria-label="Preguntas del cuestionario">
        <div className="an-approach">
          <div role="group" aria-label="Enfoque del cuestionario">
            <Button
              tone="secondary"
              aria-pressed={approach === "prepare"}
              onClick={() => setApproach("prepare")}
            >
              Preparar
            </Button>
            <Button
              tone="secondary"
              aria-pressed={approach === "analyze"}
              onClick={() => setApproach("analyze")}
            >
              Analizar
            </Button>
          </div>
          <Input
            label="Buscar preguntas"
            placeholder="Buscar por texto o código…"
            type="search"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              change();
            }}
          />
          <Button
            ref={filterTrigger}
            tone="secondary"
            className="button secondary ac-filter-toggle"
            aria-expanded={filtersOpen}
            aria-controls={`questionnaire-filters-${props.projectId}`}
            onClick={() => setFiltersOpen((open) => !open)}
          >
            Filtros
          </Button>
          <Button
            tone={bulkIds.size ? "secondary" : "primary"}
            disabled={
              !data.sections.length || !data.areas.some((a) => a.active)
            }
            onClick={() => props.onEdit(undefined, topic || undefined)}
          >
            Nueva pregunta
          </Button>
        </div>
        <p className="hint an-approach-hint">
          {approach === "prepare"
            ? "Contenido, áreas, participantes y publicación."
            : "Aportaciones enviadas, aclaraciones, conflictos y decisiones. El número de aportaciones no indica consenso."}
        </p>
        <div
          className="qe-filters ac-questionnaire-filters"
          id={`questionnaire-filters-${props.projectId}`}
          hidden={!wideFilters && !filtersOpen}
          onKeyDown={(event) => {
            if (
              event.key === "Escape" &&
              !wideFilters &&
              !event.defaultPrevented
            ) {
              event.preventDefault();
              setFiltersOpen(false);
              filterTrigger.current?.focus();
            }
          }}
        >
          <nav className="qe-outline" aria-label="Temas del cuestionario">
            <details
              open={topicsExpanded}
              onToggle={(event) => setTopicsExpanded(event.currentTarget.open)}
              onKeyDown={(event) => {
                if (event.key === "Escape" && !event.defaultPrevented) {
                  event.preventDefault();
                  event.stopPropagation();
                  setTopicsExpanded(false);
                  topicTrigger.current?.focus();
                }
              }}
            >
              <summary ref={topicTrigger}>
                <span>Temas</span>
                <strong>
                  {data.sections.find((section) => section.id === topic)
                    ?.title ?? "Todos los temas"}
                </strong>
              </summary>
              <div className="ac-topic-options">
                <button
                  aria-current={!topic ? "true" : undefined}
                  onClick={() => {
                    setTopic("");
                    setTopicsExpanded(false);
                    topicTrigger.current?.focus();
                    change();
                  }}
                >
                  Todos los temas <span>{data.questions.length}</span>
                </button>
                {[...data.sections]
                  .sort((a, b) => a.order - b.order)
                  .map((s) => (
                    <button
                      key={s.id}
                      aria-current={topic === s.id ? "true" : undefined}
                      onClick={() => {
                        setTopic(s.id);
                        setTopicsExpanded(false);
                        topicTrigger.current?.focus();
                        change();
                      }}
                    >
                      {s.title}
                      <span>
                        {
                          data.questions.filter((q) => q.sectionId === s.id)
                            .length
                        }
                      </span>
                    </button>
                  ))}
                {topic && <TopicActions {...props} id={topic} />}
                {data.sections.length > 0 && (
                  <Button tone="secondary" onClick={props.onCreateTopic}>
                    + Agregar tema
                  </Button>
                )}
              </div>
            </details>
          </nav>

          <Select
            label="Área responsable"
            value={area}
            onChange={(e) => {
              setArea(e.target.value);
              change();
            }}
          >
            <option value="">Todas las áreas</option>
            {data.areas.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
                {!a.active ? " (inactiva)" : ""}
              </option>
            ))}
          </Select>
          <Select
            label="Estado de publicación"
            value={publication}
            onChange={(e) => {
              setPublication(e.target.value);
              change();
            }}
          >
            <option value="">Todos los estados</option>
            {Object.entries(publications).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
        </div>
        {collapsed.size > 0 && (
          <p className="hint">
            {search.trim()
              ? "La búsqueda muestra también seguimientos de grupos plegados."
              : `${questions.length - unfolded.length} preguntas en grupos plegados.`}{" "}
            <Button tone="secondary" onClick={() => setCollapsed(new Set())}>
              Expandir todos los grupos
            </Button>
          </p>
        )}
        {props.contributionsError && (
          <p role="alert">
            No se pudieron cargar las aportaciones.{" "}
            <Button tone="secondary" onClick={props.onRetryContributions}>
              Reintentar aportaciones
            </Button>
          </p>
        )}
        <div className="ac-questionnaire-results">
          <p role="status" className="hint">
            {questions.length} preguntas encontradas
            {unfolded.length > 40
              ? ` · Página ${currentPage + 1} de ${pages}`
              : ""}
          </p>
          <details
            className="ac-selection-scope"
            open={selectionExpanded}
            onToggle={(event) => {
              setSelectionExpanded(event.currentTarget.open);
            }}
          >
            <summary>Seleccionar preguntas</summary>
            <div
              className="qe-selection-controls"
              role="group"
              aria-label="Alcance de selección"
            >
              <Button
                tone="secondary"
                disabled={!eligible(pageRows).length}
                onClick={() => addSelection(pageRows)}
              >
                Seleccionar esta página ({eligible(pageRows).length})
              </Button>
              <Button
                tone="secondary"
                aria-describedby="an-selection-scope"
                disabled={!eligible(questions).length}
                onClick={() => addSelection(questions)}
              >
                Seleccionar todos los resultados ({eligible(questions).length})
              </Button>
              {topic && (
                <Button
                  tone="secondary"
                  aria-describedby="an-selection-scope"
                  onClick={() => {
                    const rows = eligible(
                      data.questions.filter((q) => q.sectionId === topic),
                    );
                    addSelection(rows);
                    setSelectionNotice(
                      `Se seleccionó el tema completo: ${rows.length} preguntas, incluidas las que quedan fuera de los filtros.`,
                    );
                  }}
                >
                  Seleccionar tema completo (
                  {
                    eligible(
                      data.questions.filter((q) => q.sectionId === topic),
                    ).length
                  }
                  )
                </Button>
              )}
            </div>
            <p className="hint an-scope-note" id="an-selection-scope">
              Todos los resultados incluye otras páginas y grupos plegados. Tema
              completo incluye además las preguntas fuera de los filtros.
            </p>
          </details>
          {!bulkIds.size && (
            <p
              ref={selectionStatus}
              tabIndex={-1}
              role="status"
              className="qe-selection-status"
            >
              0 preguntas seleccionadas
            </p>
          )}
        </div>
        {selectionNotice && (
          <p role="status" className="hint">
            {selectionNotice}
          </p>
        )}
        <div className="an-question-list">
          <table className="ac-questionnaire-table" data-approach={approach}>
            <caption className="sr-only">
              Preguntas del cuestionario ·{" "}
              {approach === "prepare" ? "Preparar" : "Analizar"}
            </caption>
            <colgroup>
              <col className="ac-col-select" />
              <col />
              <col className="ac-col-area" />
              <col className="ac-col-count" />
              <col className="ac-col-state" />
              <col className="ac-col-action" />
            </colgroup>
            <thead>
              <tr>
                <th scope="col">
                  <span className="sr-only">Seleccionar</span>
                </th>
                <th scope="col">Pregunta</th>
                <th scope="col">Área responsable</th>
                <th scope="col">
                  {approach === "prepare" ? "Participantes" : "Aportaciones"}
                </th>
                <th scope="col">
                  {approach === "prepare" ? "Publicación" : "Estado"}
                </th>
                <th scope="col">
                  <span className="sr-only">Acciones</span>
                </th>
              </tr>
            </thead>
            {pageGroups.map((group) => (
              <tbody key={group.rows[0]!.id}>
                <tr className="an-topic-band">
                  <th scope="rowgroup" colSpan={6}>
                    <h2>
                      {
                        data.sections.find((s) => s.id === group.sectionId)
                          ?.title
                      }
                    </h2>
                    <span>
                      {
                        questions.filter(
                          (row) => row.sectionId === group.sectionId,
                        ).length
                      }{" "}
                      preguntas
                    </span>
                  </th>
                </tr>
                {group.rows.map((q) => {
                  const parents = questionAncestors(q, byId);
                  const children = data.questions.some(
                    (child) => child.groupParentId === q.id,
                  );
                  const contribution = contributionById.get(q.id);
                  const count =
                    q.publication === "DRAFT"
                      ? 0
                      : contribution?.submittedRespondents;
                  const groupCollapsed = collapsed.has(q.id);
                  const assigned = q.assignments.filter((a) => a.active).length;
                  return (
                    <Fragment key={q.id}>
                      {parents
                        .filter((p) => !pageIds.has(p.id))
                        .map((parent) => (
                          <tr className="an-parent-context" key={parent.id}>
                            <td colSpan={6}>
                              Seguimiento de{" "}
                              <button onClick={() => setSelected(parent.id)}>
                                {parent.question}
                              </button>
                              <span>
                                Contexto · fuera de esta página o filtro
                              </span>
                            </td>
                          </tr>
                        ))}
                      <QuestionRow
                        className={
                          "an-question-row" +
                          (parents.length ? " an-followup" : "")
                        }
                        data-approach={approach}
                      >
                        <td className="ac-select-cell">
                          <label className="qe-row-checkbox">
                            <input
                              type="checkbox"
                              aria-label={`Seleccionar pregunta: ${q.question}`}
                              checked={bulkIds.has(q.id)}
                              disabled={q.publication === "ARCHIVED"}
                              onChange={(e) => {
                                setBulkIds((previous) => {
                                  const next = new Set(previous);
                                  if (e.target.checked) next.add(q.id);
                                  else next.delete(q.id);
                                  return next;
                                });
                                setSelectionNotice("");
                              }}
                            />
                          </label>
                        </td>
                        <td className="an-question-content">
                          <div className="an-question-heading">
                            {children && (
                              <button
                                className={`an-collapse${groupCollapsed && !search.trim() ? "" : " an-collapse-open"}`}
                                aria-expanded={
                                  !groupCollapsed || !!search.trim()
                                }
                                title={`${groupCollapsed && !search.trim() ? "Expandir" : "Contraer"} seguimientos`}
                                aria-label={`${groupCollapsed && !search.trim() ? "Expandir" : "Contraer"} seguimientos de ${q.title}`}
                                disabled={!!search.trim()}
                                onClick={() => {
                                  setCollapsed((previous) => {
                                    const next = new Set(previous);
                                    if (next.has(q.id)) next.delete(q.id);
                                    else next.add(q.id);
                                    return next;
                                  });
                                }}
                              >
                                <ParticipantIcon name="chevron" />
                              </button>
                            )}
                            <button
                              className="qe-compact-row"
                              data-question-id={q.id}
                              aria-pressed={selected === q.id}
                              onClick={() => setSelected(q.id)}
                            >
                              <strong>{q.question}</strong>
                            </button>
                          </div>
                          <div className="an-question-meta">
                            <span>{q.externalId}</span>
                            <span>{typeLabels[q.type]}</span>
                            {parents.length > 0 && (
                              <span>
                                ↳ Seguimiento de{" "}
                                {parents[parents.length - 1]?.title}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="an-row-area">
                          <span className="an-cell-label">Área</span>
                          {data.areas.find((a) => a.id === q.responsibleAreaId)
                            ?.name ?? "Área no disponible"}
                        </td>
                        <td className="an-row-contributions">
                          {approach === "prepare" ? (
                            <>
                              <span className="an-cell-label">
                                Participantes
                              </span>
                              <span>{assigned} participantes asignados</span>
                            </>
                          ) : (
                            <>
                              <span className="an-cell-label">
                                Aportaciones
                              </span>
                              {count === undefined ? (
                                <span className="hint">
                                  {props.contributionsLoading
                                    ? "Cargando…"
                                    : "No disponible"}
                                </span>
                              ) : count === 0 ? (
                                <span className="hint">
                                  Sin aportaciones enviadas
                                </span>
                              ) : (
                                <button
                                  className="an-text-action"
                                  disabled={!props.onOpenContributions}
                                  onClick={() =>
                                    props.onOpenContributions?.(q.id)
                                  }
                                  aria-label={`${count === 1 ? "1 aportación" : `${count} aportaciones`} de ${q.title}`}
                                >
                                  {count === 1
                                    ? "1 aportación"
                                    : `${count} aportaciones`}{" "}
                                  <span aria-hidden="true">→</span>
                                </button>
                              )}
                            </>
                          )}
                        </td>
                        <td className="an-row-state">
                          <span className="an-cell-label">
                            {approach === "prepare" ? "Publicación" : "Estado"}
                          </span>
                          {approach === "analyze" &&
                          q.publication === "PUBLISHED" ? (
                            <>
                              <AnalystStatus
                                status={contribution?.status ?? q.status}
                              />
                            </>
                          ) : (
                            <Publication question={q} />
                          )}
                        </td>
                        <td className="an-row-action">
                          {q.publication === "DRAFT" ? (
                            <Button
                              tone="secondary"
                              aria-label={`Editar borrador: ${q.title}`}
                              onClick={() => props.onEdit(q, q.sectionId)}
                            >
                              Editar
                            </Button>
                          ) : q.publication === "PUBLISHED" &&
                            props.onOpenContributions ? (
                            <Button
                              tone="secondary"
                              aria-label={`Revisar respuestas de ${q.title}`}
                              onClick={() => props.onOpenContributions?.(q.id)}
                            >
                              Revisar respuestas
                            </Button>
                          ) : (
                            <Button
                              tone="secondary"
                              aria-label={`Ver detalle de ${q.title}`}
                              onClick={() => setSelected(q.id)}
                            >
                              Ver detalle
                            </Button>
                          )}
                        </td>
                      </QuestionRow>
                    </Fragment>
                  );
                })}
              </tbody>
            ))}
          </table>
        </div>
        {bulkIds.size > 0 && (
          <SelectionBar
            summary={
              bulkIds.size === 1
                ? "1 pregunta seleccionada"
                : `${bulkIds.size} preguntas seleccionadas`
            }
            summaryRef={selectionStatus}
          >
            <p className="hint an-selection-scope">
              {selectedQuestions.filter((q) => pageIds.has(q.id)).length} en
              esta página ·{" "}
              {selectedQuestions.filter((q) => !pageIds.has(q.id)).length} fuera
              de esta página
            </p>
            <div
              className="qe-bulk-bar"
              role="group"
              aria-label="Acciones para las preguntas seleccionadas"
            >
              <Button tone="secondary" onClick={() => openBulk("ASSIGN_AREA")}>
                Asignar área
              </Button>
              <Button
                tone="secondary"
                onClick={() => openBulk("ADD_PARTICIPANTS")}
              >
                Agregar participantes
              </Button>
              <Button
                tone="secondary"
                onClick={() => {
                  bulkTrigger.current = document.activeElement as HTMLElement;
                  setInviting(true);
                }}
              >
                Invitar mediante enlace
              </Button>
              <Button onClick={() => openBulk("PUBLISH")}>
                Publicar seleccionadas
              </Button>
              <Button
                tone="secondary"
                onClick={() => {
                  setBulkIds(new Set());
                  setSelectionNotice("");
                  requestAnimationFrame(() => selectionStatus.current?.focus());
                }}
              >
                Limpiar selección
              </Button>
            </div>
          </SelectionBar>
        )}
        {!questions.length && (
          <EmptyState
            title={
              data.questions.length
                ? "No encontramos preguntas con estos filtros."
                : "Todavía no hay preguntas."
            }
          >
            {data.questions.length
              ? "Cambia el tema o elimina los filtros."
              : data.sections.length
                ? "Crea la primera con Nueva pregunta o importa una estructura."
                : "Agrega un tema para crear la primera pregunta o importa una estructura."}
            {!data.sections.length && (
              <Button tone="secondary" onClick={props.onCreateTopic}>
                + Agregar tema
              </Button>
            )}
          </EmptyState>
        )}
        {pages > 1 && (
          <div className="qe-pagination">
            <Button
              tone="secondary"
              disabled={currentPage === 0}
              onClick={() => setPage(currentPage - 1)}
            >
              Página anterior
            </Button>
            <Button
              tone="secondary"
              disabled={currentPage + 1 >= pages}
              onClick={() => setPage(currentPage + 1)}
            >
              Página siguiente
            </Button>
          </div>
        )}
        {topic && (
          <Button
            tone="secondary"
            disabled={!data.areas.some((a) => a.active)}
            onClick={() => props.onEdit(undefined, topic)}
          >
            + Agregar pregunta
          </Button>
        )}
      </section>
      {inviting && (
        <CreateInvitation
          projectId={props.projectId}
          questions={selectedQuestions}
          areas={data.areas}
          onClose={() => {
            setInviting(false);
            requestAnimationFrame(() => bulkTrigger.current?.focus());
          }}
        />
      )}
      {bulkOperation && (
        <BulkDialog
          data={data}
          projectId={props.projectId}
          operation={bulkOperation}
          onRefresh={props.onRefresh}
          questions={selectedQuestions}
          onClose={closeBulk}
          onAddDependency={(id) =>
            setBulkIds((previous) => new Set([...previous, id]))
          }
          onCorrect={(id, field) => {
            const question = data.questions.find((q) => q.id === id);
            setBulkOperation(null);
            if (question && field === "assignments")
              props.onAction("assign", question);
            else if (question?.publication === "DRAFT")
              props.onEdit(question, question.sectionId, field);
            else setSelected(id);
          }}
          onComplete={(result) => {
            closeBulk();
            setBulkIds(new Set());
            const message = `Operación aplicada: ${result.changedIds.length} preguntas actualizadas; ${result.ignoredIds.length} sin cambios.`;
            setSelectionNotice(message);
            props.onBulkComplete?.(message);
          }}
        />
      )}
      {selection && (
        <QuestionInspector
          {...props}
          question={selection}
          onSelectGroup={() => {
            const group = questionGroup(data.questions, selection.id);
            addSelection(group);
            setSelectionNotice(
              `Grupo seleccionado: ${group.length} preguntas. La selección incluye seguimientos fuera de la página o los filtros actuales.`,
            );
            setSelected(null);
          }}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
