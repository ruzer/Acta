import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { reviewStates } from "@requirements/contracts";
import { Alert, Button, EmptyState, LoadingState, Select } from "../ui";
import { MetaLine, QueueRow, StatusChip } from "../ui/semantic";
import { attentionGroups } from "./attention-groups";
import { reviewLabels } from "./ReviewShared";
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
  const disclosureKey = [
    "workbench-context",
    projectId,
    "attention",
    "all-questions",
  ];
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
              <span>Aclaraciones abiertas</span>
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
                  <ul aria-label="Casos de atención">{allRows(items)}</ul>
                </section>
              ) : (
                <>
                  {groups.map((group) => (
                    <section
                      key={group.id}
                      className={`ac-attention-group ac-attention-${group.id}`}
                      aria-labelledby={`queue-${group.id}`}
                    >
                      <header>
                        <h2 id={`queue-${group.id}`}>
                          {group.turn ? (
                            <StatusChip
                              tone={group.id === "action" ? "info" : "warning"}
                            >
                              {group.label}
                            </StatusChip>
                          ) : (
                            group.label
                          )}
                        </h2>
                        <span>
                          {group.questions.length}{" "}
                          {group.questions.length === 1
                            ? "pregunta"
                            : "preguntas"}
                        </span>
                        {group.explanation && <p>{group.explanation}</p>}
                      </header>
                      <ul aria-label={group.label}>
                        {group.questions.map((q) =>
                          row(q, group.action(q), group.reason(q)),
                        )}
                      </ul>
                    </section>
                  ))}
                  <details
                    className="ac-attention-all"
                    open={client.getQueryData<boolean>(disclosureKey) ?? false}
                    onToggle={(event) => {
                      client.setQueryData(
                        disclosureKey,
                        event.currentTarget.open,
                      );
                    }}
                  >
                    <summary>Todas las preguntas ({items.length})</summary>
                    <ul aria-label="Casos de atención">{allRows(items)}</ul>
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
