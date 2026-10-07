import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { reviewStates } from "@requirements/contracts";
import { Alert, Button, EmptyState, LoadingState, Select } from "../ui";
import { AnalystStatus } from "./AnalystVisual";
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
      ? clarifications.data?.length
      : undefined,
    ready: data.questions.filter((q) => q.status === "ANSWERED").length,
  };
  const casesReady = task !== "clarifications" || clarificationReady;
  const items = attentionQuestions(
    data.questions,
    task,
    status,
    clarifications.data ?? [],
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
  return (
    <section className="next-attention" aria-labelledby="attention-title">
      <h2 id="attention-title">Qué requiere atención</h2>
      <p className="hint">
        Cada entrada tiene su propio alcance. Una pregunta puede aparecer en más
        de una.
      </p>
      <div className="next-attention-entries">
        {(["conflicts", "clarifications", "ready"] as const).map((key) => (
          <article
            key={key}
            aria-labelledby={`attention-${key}`}
            className={
              task === key
                ? "next-attention-entry is-active"
                : "next-attention-entry"
            }
          >
            <h3 id={`attention-${key}`}>{taskLabels[key]}</h3>
            <p className="next-attention-count">
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
            <p>{taskCopy[key].reason}</p>
            <Button
              tone="secondary"
              aria-pressed={task === key}
              onClick={() => filterTask(key)}
            >
              {taskCopy[key].action}
            </Button>
          </article>
        ))}
        <article
          className="next-attention-entry"
          aria-labelledby="attention-invitations"
        >
          <h3 id="attention-invitations">Invitaciones por expirar</h3>
          <p className="next-attention-count">
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
          <p>
            Enlaces sin revocar que vencen en los próximos 7 días, con cualquier
            avance de respuesta.
          </p>
          <Link
            className="button secondary"
            to={`/projects/${projectId}/invitations?expiresWithin=7`}
          >
            Ver invitaciones por expirar
          </Link>
        </article>
      </div>
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
      {invitations.isError && (
        <Alert error>
          No se pudieron completar las invitaciones. {invitations.error.message}{" "}
          <Button tone="secondary" onClick={() => void invitations.refetch()}>
            Reintentar invitaciones
          </Button>
        </Alert>
      )}
      <div className="next-attention-cases-heading">
        <h2 id="dashboard-questions">
          {task ? taskLabels[task] : "Preguntas y pendientes"}
        </h2>
        {(task || status) && (
          <Button tone="secondary" onClick={clearFilters}>
            Ver todas las preguntas
          </Button>
        )}
      </div>
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
      {task && status && (
        <p className="hint">
          Se muestran los casos que cumplen ambos filtros: {taskLabels[task]} y{" "}
          {reviewLabels[status]}.
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
          <p role="status">{items.length} preguntas</p>
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
          ) : (
            <ul
              className="next-attention-cases review-inbox"
              aria-label="Casos de atención"
            >
              {items.map((q) => (
                <li key={q.id}>
                  <div className="next-attention-case-content">
                    <h3>
                      <Link
                        data-workbench-id={q.id}
                        to={`/projects/${projectId}/review/${q.id}`}
                        state={{
                          workbenchReturn: {
                            view: "attention",
                            search: location.search,
                          },
                        }}
                      >
                        {q.title}
                      </Link>
                    </h3>
                    <p>
                      {q.sectionTitle} · {q.areaName}
                    </p>
                    <div className="next-attention-case-status">
                      <AnalystStatus status={q.status} />
                      <span>
                        {q.submittedRespondents === 0
                          ? "Sin aportaciones enviadas"
                          : `${q.submittedRespondents} ${q.submittedRespondents === 1 ? "aportación" : "aportaciones"}`}
                      </span>
                      {clarificationReady &&
                        clarifications.data?.includes(q.id) && (
                          <span>Aclaraciones abiertas</span>
                        )}
                    </div>
                    {q.conditionalWithoutCase && (
                      <p className="hint">
                        Condicional · aún sin caso aplicable
                      </p>
                    )}
                    {!!q.referenceIds.length && (
                      <Link
                        to={`/projects/${projectId}/traceability?questionId=${q.id}`}
                      >
                        Referencias de esta pregunta
                      </Link>
                    )}
                  </div>
                  <Link
                    data-workbench-id={q.id}
                    className="button secondary"
                    to={`/projects/${projectId}/review/${q.id}`}
                    state={{
                      workbenchReturn: {
                        view: "attention",
                        search: location.search,
                      },
                    }}
                    aria-label={`${q.status === "CONFLICT" ? "Revisar conflicto" : q.status === "VALIDATED" ? "Ver decisión" : "Revisar respuestas"}: ${q.title}`}
                  >
                    {q.status === "CONFLICT"
                      ? "Revisar conflicto"
                      : q.status === "VALIDATED"
                        ? "Ver decisión"
                        : "Revisar respuestas"}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
