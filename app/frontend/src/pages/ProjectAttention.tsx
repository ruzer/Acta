import { useEffect, useRef, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { reviewStates } from "@requirements/contracts";
import { Alert, Button, EmptyState, LoadingState, Select } from "../ui";
import { MetaLine, QueueRow, StatusChip } from "../ui/semantic";
import { attentionGroups } from "./attention-groups";
import { dateText, reviewLabels } from "./ReviewShared";
import {
  attentionQuestions,
  attentionTask,
  useAttentionClarifications,
  type AttentionDashboard,
  type AttentionTask,
} from "./attention-data";
import { expiringInvitations, invitationQueryOptions } from "./invitation-data";
import "../next-attention.css";

const taskLabels = {
  conflicts: "Conflictos",
  clarifications: "Aclaraciones",
  ready: "Listas para decidir",
};
const taskCopy = {
  conflicts: {
    reason: "Preguntas con un conflicto registrado entre aportaciones.",
    action: "Ver conflictos",
  },
  clarifications: {
    reason: "Preguntas con aclaraciones abiertas, también si tienen conflicto.",
    action: "Ver aclaraciones",
  },
  ready: {
    reason:
      "Preguntas respondidas: revisa sus fuentes para documentar una decisión.",
    action: "Revisar para decidir",
  },
};

// Rows are revealed on demand so the DOM only holds what has been asked for.
// Short lists are shown whole; long ones start at `step` and grow by `step`.
const primaryPaging = { step: 25, whole: 30 };
const secondaryPaging = { step: 50, whole: 60 };
type Paging = typeof primaryPaging;
type AttentionUi = {
  open: Record<string, boolean>;
  limit: Record<string, number>;
};

export function ProjectAttention({
  projectId,
  data,
  lifecycle,
}: {
  projectId: string;
  data: AttentionDashboard;
  lifecycle: "ACTIVE" | "ARCHIVED";
}) {
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const client = useQueryClient();
  // Session-only presentation state, kept with the rest of the workbench
  // context so returning from a review restores what was open and revealed.
  const uiKey = ["workbench-context", projectId, "attention", "ui"];
  const savedFocus = client.getQueryData<{ focusId?: string }>([
    "workbench-context",
    projectId,
    "attention",
  ])?.focusId;
  const [ui, setUi] = useState<AttentionUi>(
    () => client.getQueryData<AttentionUi>(uiKey) ?? { open: {}, limit: {} },
  );
  const revealFocus = useRef<string | null>(null);
  function rememberUi(next: AttentionUi) {
    setUi(next);
    client.setQueryData(uiKey, next);
  }
  useEffect(() => {
    const id = revealFocus.current;
    revealFocus.current = null;
    if (id)
      document
        .querySelector<HTMLElement>(`[data-workbench-id="${id}"]`)
        ?.focus();
  }, [ui]);
  const clarifications = useAttentionClarifications(projectId, data, lifecycle);
  const invitations = useQuery(invitationQueryOptions(projectId));
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60000);
    return () => window.clearInterval(timer);
  }, []);
  const task = attentionTask(params.get("task"));
  const rawStatus = params.get("status") ?? "";
  const status = reviewStates.find((s) => s === rawStatus) ?? "";
  const clarificationReady =
    !clarifications.isPending && !clarifications.isError;
  const invitationReady = !invitations.isPending && !invitations.isError;
  const expiringCount = invitationReady
    ? expiringInvitations(invitations.data ?? [], now).length
    : undefined;
  const counts: Record<AttentionTask, number | undefined> = {
    conflicts: data.questions.filter((q) => q.status === "CONFLICT").length,
    clarifications: clarificationReady
      ? clarifications.data?.clarificationIds.length
      : undefined,
    ready: data.questions.filter((q) => q.status === "ANSWERED").length,
  };
  const casesReady = task !== "clarifications" || clarificationReady;
  const items = attentionQuestions(
    data.questions,
    task,
    status,
    clarifications.data?.clarificationIds ?? [],
  );
  function filterTask(nextTask: AttentionTask) {
    const next = new URLSearchParams(params);
    next.set("task", nextTask);
    next.delete("status");
    setParams(next);
  }
  function clearFilters() {
    const next = new URLSearchParams(params);
    next.delete("task");
    next.delete("status");
    setParams(next);
  }
  const canReview = data.role === "ANALYST" && lifecycle === "ACTIVE";
  const groups = attentionGroups(
    items,
    clarifications.data?.clarificationIds ?? [],
    canReview,
  );
  const evidenceIds = new Set(
    clarifications.data?.reviewItems
      .filter((item) => item.hasEvidence)
      .map((item) => item.questionId),
  );
  const lastContribution = new Map(
    clarifications.data?.reviewItems.map((item) => [
      item.questionId,
      item.lastContributionAt,
    ]),
  );
  const questionText = new Map(
    clarifications.data?.reviewItems.map((item) => [
      item.questionId,
      item.question,
    ]),
  );
  function row(
    q: AttentionDashboard["questions"][number],
    action: string,
    reason = "",
  ) {
    return (
      <QueueRow
        key={q.id}
        action={
          <Link
            data-workbench-id={q.id}
            className="button secondary"
            to={`/projects/${projectId}/review/${q.id}`}
            state={{
              workbenchReturn: { view: "attention", search: location.search },
            }}
            aria-label={`${action}: ${q.title}`}
          >
            {action}
          </Link>
        }
      >
        <h3>{questionText.get(q.id) ?? q.title}</h3>
        <MetaLine items={[q.externalId, q.sectionTitle, q.areaName]} />
        <div className="ac-attention-row-state">
          <StatusChip
            tone={
              q.status === "CONFLICT"
                ? "danger"
                : q.status === "VALIDATED"
                  ? "success"
                  : q.status === "PARTIAL" ||
                      q.status === "CLARIFICATION_REQUIRED"
                    ? "warning"
                    : "neutral"
            }
          >
            {reviewLabels[q.status]}
          </StatusChip>
          <span>
            {q.submittedRespondents === 0
              ? "Sin aportaciones enviadas"
              : `${q.submittedRespondents} ${q.submittedRespondents === 1 ? "aportación" : "aportaciones"}`}
          </span>
          {clarificationReady &&
            clarifications.data?.clarificationIds.includes(q.id) && (
              <StatusChip tone="warning" icon="help">
                Aclaraciones abiertas
              </StatusChip>
            )}
          {lastContribution.get(q.id) && (
            <span>
              Última aportación {dateText(lastContribution.get(q.id) ?? null)}
            </span>
          )}
          {evidenceIds.has(q.id) && (
            <StatusChip tone="neutral" icon="paperclip">
              Con evidencia
            </StatusChip>
          )}
        </div>
        {reason && <p className="ac-attention-reason">{reason}</p>}
        {q.conditionalWithoutCase && (
          <p className="hint">Condicional · aún sin caso aplicable</p>
        )}
        {!!q.referenceIds.length && (
          <Link
            className="ac-attention-reference"
            to={`/projects/${projectId}/traceability?questionId=${q.id}`}
          >
            Referencias de esta pregunta
          </Link>
        )}
      </QueueRow>
    );
  }
  // The row the review was opened from lives in the first section that lists
  // it; only that section is forced open / long enough, never the full list too.
  const focusHome = savedFocus
    ? [
        ...groups.map((group) => ({ id: group.id, list: group.questions })),
        { id: `filtered:${task ?? ""}:${status}`, list: items },
        { id: "all", list: items },
      ].find((section) => section.list.some((q) => q.id === savedFocus))?.id
    : undefined;
  function shownRows(id: string, list: typeof items, paging: Paging) {
    const base =
      ui.limit[id] ?? (list.length <= paging.whole ? list.length : paging.step);
    // The row to restore focus to must be rendered when returning from a review.
    const needed =
      id === focusHome ? list.findIndex((q) => q.id === savedFocus) + 1 : 0;
    return Math.min(list.length, Math.max(base, needed));
  }
  function isOpen(id: string, fallback: boolean) {
    return ui.open[id] ?? (fallback || id === focusHome);
  }
  function setOpen(id: string, open: boolean, current: boolean) {
    if (open !== current)
      rememberUi({ ...ui, open: { ...ui.open, [id]: open } });
  }
  function reveal(
    id: string,
    list: typeof items,
    shown: number,
    paging: Paging,
  ) {
    revealFocus.current = list[shown]?.id ?? null;
    rememberUi({
      ...ui,
      limit: { ...ui.limit, [id]: Math.min(list.length, shown + paging.step) },
    });
  }
  function rowList(
    id: string,
    label: string,
    list: typeof items,
    paging: Paging,
    render: (q: (typeof items)[number]) => ReactNode,
  ) {
    const shown = shownRows(id, list, paging);
    const more = list.length - shown;
    return (
      <>
        <ul aria-label={label}>{list.slice(0, shown).map(render)}</ul>
        {more > 0 && (
          <div className="ac-attention-more">
            <p aria-live="polite">
              Mostrando {shown} de {list.length}
            </p>
            <Button
              tone="secondary"
              onClick={() => reveal(id, list, shown, paging)}
            >
              Mostrar {Math.min(paging.step, more)} más
            </Button>
          </div>
        )}
      </>
    );
  }
  const allRows = (list: typeof items) =>
    list.map((q) =>
      row(
        q,
        q.status === "CONFLICT"
          ? "Revisar conflicto"
          : q.status === "VALIDATED"
            ? "Ver decisión"
            : "Revisar respuestas",
      ),
    );
  return (
    <section className="ac-attention" aria-labelledby="attention-title">
      <h2 id="attention-title" className="sr-only">
        Qué requiere atención
      </h2>
      <p className="ac-attention-intro">
        {canReview
          ? "Preguntas y pendientes"
          : "Consulta: las acciones corresponden al equipo analista"}{" "}
        · <strong>{data.projectName}</strong>
      </p>
      <div className="ac-attention-layout">
        <div className="ac-attention-content">
          <div className="ac-attention-filter" id="dashboard-questions">
            <Select
              label="Filtrar estado"
              value={status}
              onChange={(e) => {
                const next = new URLSearchParams(params);
                if (e.target.value) next.set("status", e.target.value);
                else next.delete("status");
                setParams(next);
              }}
            >
              <option value="">Todos los estados</option>
              {reviewStates.map((s) => (
                <option key={s} value={s}>
                  {reviewLabels[s]}
                </option>
              ))}
            </Select>
            {(task || status) && (
              <Button tone="tertiary" onClick={clearFilters}>
                Ver todas las preguntas
              </Button>
            )}
          </div>
          {task && status && (
            <p className="hint">
              Se muestran los casos que cumplen ambos filtros:{" "}
              {taskLabels[task]} y {reviewLabels[status]}.
            </p>
          )}
          {!casesReady ? (
            clarifications.isError ? (
              <p>
                No hay un conteo completo de estos casos. Reintenta la consulta.
              </p>
            ) : (
              <LoadingState />
            )
          ) : (
            <>
              <p className="ac-attention-result" role="status">
                {items.length} preguntas
              </p>
              {!items.length ? (
                <EmptyState
                  title={
                    data.questions.length
                      ? "Sin preguntas para este filtro"
                      : "Sin preguntas"
                  }
                >
                  {data.questions.length
                    ? "Puedes cambiar los filtros para consultar otros casos."
                    : "Publica preguntas para ver su avance."}
                </EmptyState>
              ) : task || status ? (
                <section
                  className="ac-attention-group"
                  aria-label={
                    task
                      ? taskLabels[task]
                      : reviewLabels[status as keyof typeof reviewLabels]
                  }
                >
                  <h2>
                    {task
                      ? taskLabels[task]
                      : reviewLabels[status as keyof typeof reviewLabels]}
                  </h2>
                  {rowList(
                    `filtered:${task ?? ""}:${status}`,
                    "Casos de atención",
                    items,
                    secondaryPaging,
                    (q) => allRows([q])[0],
                  )}
                </section>
              ) : (
                <>
                  {groups.map((group) => {
                    const open = isOpen(group.id, !group.collapsed);
                    const paging = group.collapsed
                      ? secondaryPaging
                      : primaryPaging;
                    const total = `${group.questions.length} ${
                      group.questions.length === 1 ? "pregunta" : "preguntas"
                    }`;
                    const title = group.turn ? (
                      <StatusChip
                        tone={group.id === "action" ? "info" : "warning"}
                      >
                        {group.label}
                      </StatusChip>
                    ) : (
                      group.label
                    );
                    const rows = (
                      <>
                        {group.explanation && (
                          <p className="ac-attention-group-note">
                            {group.explanation}
                          </p>
                        )}
                        {rowList(
                          group.id,
                          group.label,
                          group.questions,
                          paging,
                          (q) => row(q, group.action(q), group.reason(q)),
                        )}
                      </>
                    );
                    return group.collapsed ? (
                      <details
                        key={group.id}
                        className={`ac-attention-group ac-attention-fold ac-attention-${group.id}`}
                        open={open}
                        onToggle={(event) =>
                          setOpen(group.id, event.currentTarget.open, open)
                        }
                      >
                        <summary>
                          <span className="ac-attention-fold-title">
                            {title}
                          </span>
                          <span className="ac-attention-fold-count">
                            {total}
                          </span>
                        </summary>
                        {open && rows}
                      </details>
                    ) : (
                      <section
                        key={group.id}
                        className={`ac-attention-group ac-attention-${group.id}`}
                        aria-labelledby={`queue-${group.id}`}
                      >
                        <header>
                          <h2 id={`queue-${group.id}`}>{title}</h2>
                          <span>{total}</span>
                          {group.explanation && <p>{group.explanation}</p>}
                        </header>
                        {rowList(
                          group.id,
                          group.label,
                          group.questions,
                          paging,
                          (q) => row(q, group.action(q), group.reason(q)),
                        )}
                      </section>
                    );
                  })}
                  <details
                    className="ac-attention-all ac-attention-fold"
                    open={isOpen("all", false)}
                    onToggle={(event) =>
                      setOpen(
                        "all",
                        event.currentTarget.open,
                        isOpen("all", false),
                      )
                    }
                  >
                    <summary>Todas las preguntas ({items.length})</summary>
                    {isOpen("all", false) &&
                      rowList(
                        "all",
                        "Casos de atención",
                        items,
                        secondaryPaging,
                        (q) => allRows([q])[0],
                      )}
                  </details>
                </>
              )}
            </>
          )}
        </div>
        <aside
          className="ac-attention-summary"
          aria-label="Resumen de atención"
        >
          <h2>Resumen</h2>
          <p className="hint">
            Cada entrada tiene su propio alcance. Una pregunta puede aparecer en
            más de una.
          </p>
          {(["conflicts", "clarifications", "ready"] as const).map((key) => (
            <article key={key} aria-labelledby={`attention-${key}`}>
              <h3 id={`attention-${key}`}>{taskLabels[key]}</h3>
              <p className="ac-attention-count">
                {counts[key] === undefined ? (
                  clarifications.isError ? (
                    "Sin dato disponible"
                  ) : (
                    "Consultando…"
                  )
                ) : (
                  <>
                    <strong>{counts[key]}</strong>{" "}
                    {counts[key] === 1 ? "pregunta" : "preguntas"}
                  </>
                )}
              </p>
              <p className="hint">{taskCopy[key].reason}</p>
              <Button
                tone="tertiary"
                aria-pressed={task === key}
                onClick={() => filterTask(key)}
              >
                {taskCopy[key].action}
              </Button>
            </article>
          ))}
          {clarifications.isError && (
            <Alert error>
              No se pudieron completar las aclaraciones.{" "}
              {clarifications.error.message}{" "}
              <Button
                tone="secondary"
                onClick={() => void clarifications.refetch()}
              >
                Reintentar aclaraciones
              </Button>
            </Alert>
          )}
          <article aria-labelledby="attention-invitations">
            <h3 id="attention-invitations">Invitaciones por expirar</h3>
            <p className="ac-attention-count">
              {expiringCount !== undefined ? (
                <>
                  <strong>{expiringCount}</strong>{" "}
                  {expiringCount === 1 ? "enlace" : "enlaces"}
                </>
              ) : invitations.isError ? (
                "Sin dato disponible"
              ) : (
                "Consultando…"
              )}
            </p>
            <p className="hint">
              Enlaces sin revocar que vencen en los próximos 7 días, con
              cualquier avance de respuesta.
            </p>
            <Link
              className="button tertiary"
              to={`/projects/${projectId}/invitations?expiresWithin=7`}
            >
              Ver invitaciones por expirar
            </Link>
          </article>
          {invitations.isError && (
            <Alert error>
              No se pudieron completar las invitaciones.{" "}
              {invitations.error.message}{" "}
              <Button
                tone="secondary"
                onClick={() => void invitations.refetch()}
              >
                Reintentar invitaciones
              </Button>
            </Alert>
          )}
        </aside>
      </div>
    </section>
  );
}
