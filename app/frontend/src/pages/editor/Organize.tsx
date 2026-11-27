import { ParticipantIcon } from "../ParticipantIcon";
import { CreateInvitation } from "../Invitations";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import {
  type QuestionView,
  type BulkOperation,
  typeLabels,
} from "@requirements/contracts";
import { Button, Input, Select, EmptyState } from "../../ui";
import { QuestionRow, SelectionBar } from "../../ui/semantic";
import {
  Publication,
  TopicActions,
  publications,
  type EditorProps,
} from "./EditorWorkspace";
import { QuestionOpenButton } from "./QuestionOpenButton";
import { BulkDialog } from "./BulkDialog";
import { questionGroup } from "./bulk-selection";
import { AnalystStatus } from "../AnalystVisual";
import {
  questionAncestors,
  unfoldedQuestions,
} from "./questionnaire-presentation";
import "../../next-questionnaire.css";
import { plural } from "../../ui/plural";
import {
  inactiveAreasReason,
  missingTopicReason,
  searchedGroupsReason,
} from "./unavailable-reasons";
export function Organize(
  props: EditorProps & {
    highlightedQuestionId?: string | null;
    onInspectorRowsChange: (
      ids: string[],
      selectGroup: (id: string) => void,
    ) => void;
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
  const groupIds = useMemo(
    () =>
      new Set(
        data.questions.flatMap((q) =>
          q.groupParentId && byId.has(q.groupParentId) ? [q.groupParentId] : [],
        ),
      ),
    [data.questions, byId],
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
  const synchronizedLocation = useRef(props.organizeLocation);
  useEffect(() => {
    // A browser Back/Forward change restores filters without remounting the
    // editor, losing focus, or serializing the selection into the URL.
    if (props.organizeLocation !== synchronizedLocation.current) {
      synchronizedLocation.current = props.organizeLocation;
      const incoming = props.organizeContext;
      if (
        bulkIds.size &&
        (topic !== (incoming?.topic ?? "") ||
          search !== (incoming?.search ?? "") ||
          publication !== (incoming?.publication ?? "") ||
          area !== (incoming?.area ?? ""))
      ) {
        setBulkIds(new Set());
        setSelectionNotice(
          "Se limpió la selección al cambiar los filtros. Selecciona las preguntas que deseas modificar.",
        );
      }
      setTopic(incoming?.topic ?? "");
      setSearch(incoming?.search ?? "");
      setPublication(incoming?.publication ?? "");
      setArea(incoming?.area ?? "");
      setApproach(incoming?.approach ?? "prepare");
      setPage(incoming?.page ?? 0);
      return;
    }
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
    props.organizeLocation,
    props.organizeContext,
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
  const selected = props.openedQuestionId;
  const setSelected = (id: string) => props.onOpenQuestion?.(id);
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
  const change = () => {
    if (bulkIds.size)
      setSelectionNotice(
        "Se limpió la selección al cambiar los filtros. Selecciona las preguntas que deseas modificar.",
      );
    setBulkIds(new Set());
    setPage(0);
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
  const inspectorRowsChange = props.onInspectorRowsChange;
  const visibleKey = unfolded.map((q) => q.id).join("|");
  useEffect(() => {
    inspectorRowsChange(visibleKey ? visibleKey.split("|") : [], (id) => {
      const group = questionGroup(data.questions, id);
      setBulkIds(
        (previous) =>
          new Set([
            ...previous,
            ...group
              .filter((q) => q.publication !== "ARCHIVED")
              .map((q) => q.id),
          ]),
      );
      setSelectionNotice(
        `Grupo seleccionado: ${plural(group.length, "pregunta")}. La selección incluye seguimientos fuera de la página o los filtros actuales.`,
      );
    });
  }, [visibleKey, inspectorRowsChange, data.questions]);
  useEffect(() => {
    if (!selected) return;
    const current = byId.get(selected);
    if (!current) return;
    const ancestors = questionAncestors(current, byId);
    setCollapsed((previous) => {
      if (!ancestors.some((parent) => previous.has(parent.id))) return previous;
      const next = new Set(previous);
      ancestors.forEach((parent) => next.delete(parent.id));
      return next;
    });
  }, [selected, byId]);
  useEffect(() => {
    if (!selected) return;
    const index = visibleKey.split("|").indexOf(selected);
    if (index >= 0) setPage(Math.floor(index / 40));
  }, [selected, visibleKey]);
  // A questionnaire without questions has nothing to search, filter, fold or
  // select: say how to begin and offer the one action that applies.
  if (!data.questions.length) {
    const hasArea = data.areas.some((a) => a.active);
    return (
      <div className="qe-organize an-questionnaire">
        <EmptyState
          title="Todavía no hay preguntas."
          action={
            <>
              <Button
                tone={data.sections.length ? "secondary" : "primary"}
                onClick={props.onCreateTopic}
              >
                + Agregar tema
              </Button>
              {data.sections.length > 0 && (
                <Button
                  unavailable={!hasArea && { reason: inactiveAreasReason }}
                  onClick={() => props.onEdit(undefined, undefined)}
                >
                  Nueva pregunta
                </Button>
              )}
            </>
          }
        >
          {data.sections.length
            ? "Crea la primera con Nueva pregunta o importa una estructura."
            : "Agrega un tema para crear la primera pregunta o importa una estructura."}
        </EmptyState>
        {!hasArea && !data.sections.length && (
          <p className="hint">{inactiveAreasReason}</p>
        )}
      </div>
    );
  }
  return (
    <div className="qe-organize an-questionnaire">
      <section className="qe-compact" aria-label="Preguntas del cuestionario">
        <div className="an-approach">
          <div role="group" aria-label="Enfoque del cuestionario">
            <Button
              tone="secondary"
              aria-pressed={approach === "prepare"}
              onClick={() => setApproach("prepare")}
            >
              Contenido
            </Button>
            <Button
              tone="secondary"
              aria-pressed={approach === "analyze"}
              onClick={() => setApproach("analyze")}
            >
              Respuestas
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
          <Button tone="secondary" onClick={props.onCreateTopic}>
            + Agregar tema
          </Button>
          <Button
            tone={bulkIds.size ? "secondary" : "primary"}
            unavailable={
              !data.sections.length
                ? { reason: missingTopicReason }
                : !data.areas.some((a) => a.active) && {
                    reason: inactiveAreasReason,
                  }
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
                {!a.active ? " (desactivada)" : ""}
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
        {groupIds.size > 0 && (
          <>
            <div
              className="actions"
              role="group"
              aria-label="Presentación de grupos"
              aria-describedby={`group-scope-${props.projectId}`}
            >
              <Button
                tone="secondary"
                unavailable={
                  !!search.trim() && {
                    reason: searchedGroupsReason,
                    describedBy: `group-search-${props.projectId}`,
                  }
                }
                onClick={() => setCollapsed(new Set())}
              >
                Expandir todos los grupos
              </Button>
              <Button
                tone="secondary"
                unavailable={
                  !!search.trim() && {
                    reason: searchedGroupsReason,
                    describedBy: `group-search-${props.projectId}`,
                  }
                }
                onClick={() => setCollapsed(new Set(groupIds))}
              >
                Contraer todos los grupos
              </Button>
            </div>
            {!!search.trim() && (
              <p className="hint" id={`group-search-${props.projectId}`}>
                {searchedGroupsReason}
              </p>
            )}
            {/* The scope is worth saying only when it reaches beyond what is on
                screen; otherwise it stays available to assistive technology. */}
            <p
              className={
                questions.length < data.questions.length || pages > 1
                  ? "hint"
                  : "sr-only"
              }
              id={`group-scope-${props.projectId}`}
            >
              Todos los grupos, incluso fuera de los filtros y de esta página.
              Se conserva la selección.
            </p>
          </>
        )}
        {(collapsed.size > 0 || (groupIds.size > 0 && search.trim())) && (
          <p className="hint" role="status">
            {search.trim()
              ? "La búsqueda muestra también seguimientos de grupos plegados."
              : `${plural(questions.length - unfolded.length, "pregunta")} en grupos plegados.`}
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
            {plural(
              questions.length,
              "pregunta encontrada",
              "preguntas encontradas",
            )}
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
                unavailable={
                  !eligible(pageRows).length && {
                    reason:
                      "Esta página no tiene preguntas que se puedan seleccionar.",
                  }
                }
                onClick={() => addSelection(pageRows)}
              >
                Seleccionar esta página ({eligible(pageRows).length})
              </Button>
              <Button
                tone="secondary"
                aria-describedby="an-selection-scope"
                unavailable={
                  !eligible(questions).length && {
                    reason:
                      "No hay preguntas que se puedan seleccionar en estos resultados.",
                  }
                }
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
                      `Se seleccionó el tema completo: ${plural(rows.length, "pregunta")}, incluidas las que quedan fuera de los filtros.`,
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
              {approach === "prepare" ? "Contenido" : "Respuestas"}
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
                      {plural(
                        questions.filter(
                          (row) => row.sectionId === group.sectionId,
                        ).length,
                        "pregunta",
                      )}
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
                              <QuestionOpenButton
                                question={parent}
                                current={selected === parent.id}
                                onOpen={setSelected}
                              />
                              <span>
                                Contexto · fuera de esta página o filtro
                              </span>
                            </td>
                          </tr>
                        ))}
                      <QuestionRow
                        className={
                          "an-question-row" +
                          (parents.length ? " an-followup" : "") +
                          (props.highlightedQuestionId === q.id
                            ? " qe-topic-moved"
                            : "")
                        }
                        data-approach={approach}
                      >
                        <td className="ac-select-cell">
                          {q.publication !== "ARCHIVED" && (
                            <label className="qe-row-checkbox">
                              <input
                                type="checkbox"
                                aria-label={`Seleccionar pregunta: ${q.question}`}
                                checked={bulkIds.has(q.id)}
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
                          )}
                        </td>
                        <td className="an-question-content">
                          <div className="an-question-heading">
                            {children && (
                              <Button
                                className={`an-collapse${groupCollapsed && !search.trim() ? "" : " an-collapse-open"}`}
                                aria-expanded={
                                  !groupCollapsed || !!search.trim()
                                }
                                title={`${groupCollapsed && !search.trim() ? "Expandir" : "Contraer"} seguimientos`}
                                aria-label={`${groupCollapsed && !search.trim() ? "Expandir" : "Contraer"} seguimientos de ${q.title}`}
                                unavailable={
                                  !!search.trim() && {
                                    reason: searchedGroupsReason,
                                    describedBy: `group-search-${props.projectId}`,
                                  }
                                }
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
                              </Button>
                            )}
                            <QuestionOpenButton
                              compact
                              question={q}
                              current={selected === q.id}
                              onOpen={setSelected}
                            />
                          </div>
                          {q.publication === "ARCHIVED" && (
                            <p className="hint">
                              No se puede seleccionar una pregunta archivada.
                            </p>
                          )}
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
                              <span>
                                {plural(
                                  assigned,
                                  "participante asignado",
                                  "participantes asignados",
                                )}
                              </span>
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
                              ) : !props.onOpenContributions ? (
                                <span>
                                  {count === 1
                                    ? "1 aportación"
                                    : `${count} aportaciones`}{" "}
                                  · Consulta las respuestas en Revisar
                                  respuestas.
                                </span>
                              ) : (
                                <button
                                  className="an-text-action"
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
                              onClick={() => props.onEdit(q, q.sectionId)}
                            >
                              Editar pregunta
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
          <>
            <div className="qe-pagination">
              <Button
                tone="secondary"
                unavailable={
                  currentPage === 0 && {
                    reason: "Ya estás en la primera página.",
                    describedBy: `pagination-reason-${props.projectId}`,
                  }
                }
                onClick={() => setPage(currentPage - 1)}
              >
                Página anterior
              </Button>
              <Button
                tone="secondary"
                unavailable={
                  currentPage + 1 >= pages && {
                    reason: "Ya estás en la última página.",
                    describedBy: `pagination-reason-${props.projectId}`,
                  }
                }
                onClick={() => setPage(currentPage + 1)}
              >
                Página siguiente
              </Button>
            </div>
            {(currentPage === 0 || currentPage + 1 >= pages) && (
              <p className="hint" id={`pagination-reason-${props.projectId}`}>
                {currentPage === 0
                  ? "Ya estás en la primera página."
                  : "Ya estás en la última página."}
              </p>
            )}
          </>
        )}
        {topic && (
          <Button
            tone="secondary"
            unavailable={
              !data.areas.some((a) => a.active) && {
                reason: inactiveAreasReason,
              }
            }
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
            const message = `Operación aplicada: ${plural(result.changedIds.length, "pregunta actualizada", "preguntas actualizadas")}; ${result.ignoredIds.length} sin cambios.`;
            // The page already says it in its own notice; repeating it beside
            // the selection only adds a second copy of the same sentence.
            if (props.onBulkComplete) props.onBulkComplete(message);
            else setSelectionNotice(message);
          }}
        />
      )}
    </div>
  );
}
