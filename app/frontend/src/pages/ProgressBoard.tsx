import { Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { participationQuery } from "./Participation";
import type { z } from "zod";
import {
  reviewStates,
  statusLabels,
  type dashboardView,
} from "@requirements/contracts";
import "../progress-board.css";

const metrics = [
  { status: "VALIDATED", label: "Validadas" },
  { status: "PARTIAL", label: "Esperando a otras personas" },
  { status: "CLARIFICATION_REQUIRED", label: "Requieren aclaración" },
  { status: "CONFLICT", label: "Conflictos" },
] as const;

// Presentation order only; the backend remains authoritative for each status.
const stateOrder: Record<(typeof reviewStates)[number], number> = {
  NOT_REVIEWED: 0,
  PENDING: 1,
  PARTIAL: 2,
  CLARIFICATION_REQUIRED: 3,
  CONFLICT: 4,
  ANSWERED: 5,
  NOT_APPLICABLE: 6,
  VALIDATED: 7,
};

export function ProgressBoard({
  data,
  projectId,
}: {
  data: z.infer<typeof dashboardView>;
  projectId: string;
}) {
  const [params, setParams] = useSearchParams();
  // ParticipationCard owns the existing request. Observe its cache without
  // fetching a second time or adding another retry control to the dashboard.
  const participation = useQuery({
    ...participationQuery(projectId),
    enabled: false,
  });
  const blockers = (participation.data?.participants ?? [])
    .filter((person) => person.pending > 0)
    .sort(
      (a, b) =>
        b.pending - a.pending ||
        a.name.localeCompare(b.name, "es-MX") ||
        a.memberId.localeCompare(b.memberId),
    )
    .slice(0, 5);
  const states = reviewStates
    .toSorted((a, b) => stateOrder[a] - stateOrder[b])
    .map((status) => ({
      status,
      count: data.states.find((item) => item.status === status)?.count ?? 0,
    }));
  const totalQuestions = data.metrics.validation.denominator;
  let offset = 0;
  const segments = states.map((state) => {
    const start = offset;
    offset += state.count;
    return {
      ...state,
      start: totalQuestions ? start / totalQuestions : 0,
      ratio: totalQuestions ? state.count / totalQuestions : 0,
    };
  });
  function show(status: (typeof metrics)[number]["status"]) {
    const next = new URLSearchParams(params);
    next.set("status", status);
    next.delete("task");
    setParams(next);
    document
      .getElementById("dashboard-questions")
      ?.scrollIntoView({ behavior: "instant", block: "start" });
  }
  return (
    <section className="pb-board" aria-labelledby="progress-board-title">
      <h2 id="progress-board-title">Avance del proyecto</h2>
      <div
        className="pb-metrics"
        role="group"
        aria-label="Preguntas por estado"
      >
        {metrics.map(({ status, label }) => {
          const count =
            status === "VALIDATED"
              ? data.metrics.validation.numerator
              : (data.states.find((state) => state.status === status)?.count ??
                0);
          const total =
            status === "VALIDATED"
              ? ` de ${data.metrics.validation.denominator}`
              : "";
          return (
            <button
              key={status}
              type="button"
              className="pb-metric"
              aria-pressed={params.get("status") === status}
              aria-label={`${label} ${count}${total}. Ver estas preguntas.`}
              onClick={() => show(status)}
            >
              <span className="pb-metric-label">{label}</span>{" "}
              <strong className="pb-metric-number">
                {count}
                {total && <small>{total}</small>}
              </strong>
            </button>
          );
        })}
      </div>
      <p className="pb-submission">
        <span>Con al menos una respuesta</span>{" "}
        <strong>
          {data.metrics.submission.numerator} de{" "}
          {data.metrics.submission.denominator}
        </strong>{" "}
        ·{" "}
        {data.metrics.submission.percentage === null
          ? "Sin preguntas"
          : `${data.metrics.submission.percentage.toLocaleString("es-MX")} %`}
      </p>
      <div className="pb-state-summary">
        {totalQuestions === 0 && <p>Aún no hay preguntas publicadas.</p>}
        <div
          className="pb-stack"
          role="img"
          aria-label={`${totalQuestions ? `Estados de ${totalQuestions} preguntas` : "No hay preguntas publicadas"}. ${states.map((state) => `${statusLabels[state.status]}: ${state.count}`).join("; ")}.`}
        >
          {segments
            .filter((state) => state.count > 0)
            .map((state) => (
              <span
                key={state.status}
                className={`pb-stack-segment pb-state pb-state-${state.status}`}
                style={{
                  transform: `translateX(${state.start * 100}%) scaleX(${state.ratio})`,
                }}
                aria-hidden="true"
              />
            ))}
        </div>
        <ul className="pb-legend" aria-label="Estados de las preguntas">
          {states.map((state) => (
            <li key={state.status}>
              <span
                className={`pb-state pb-state-${state.status}`}
                aria-hidden="true"
              />
              <span>{statusLabels[state.status]}</span>
              <strong>{state.count}</strong>
            </li>
          ))}
        </ul>
      </div>
      <div className="pb-breakdowns">
        {(
          [
            {
              dimension: "section",
              label: "Por tema",
              empty: "No hay temas con preguntas publicadas.",
            },
            {
              dimension: "area",
              label: "Por área",
              empty: "No hay áreas con preguntas publicadas.",
            },
          ] as const
        ).map((group) => {
          const rows = data.breakdowns.filter(
            (row) => row.dimension === group.dimension,
          );
          return (
            <details key={group.dimension} className="pb-breakdown">
              <summary>
                {group.label}
                <span>({rows.length})</span>
              </summary>
              <section aria-label={group.label}>
                {!rows.length ? (
                  <p>{group.empty}</p>
                ) : (
                  <ul>
                    {rows.map((row) => {
                      const value = row.metrics.validation;
                      const ratio = value.denominator
                        ? value.numerator / value.denominator
                        : 0;
                      return (
                        <li key={row.key} data-pb-breakdown={row.key}>
                          <div className="pb-breakdown-label">
                            <span>{row.label}</span>
                            <span className="pb-breakdown-value">
                              {value.numerator} de {value.denominator} ·{" "}
                              {value.percentage === null
                                ? "Sin preguntas"
                                : `${value.percentage.toLocaleString("es-MX")} %`}
                            </span>
                          </div>
                          <div className="pb-track" aria-hidden="true">
                            <span
                              className="pb-fill"
                              style={{ transform: `scaleX(${ratio})` }}
                            />
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            </details>
          );
        })}
      </div>
      <section
        className="pb-blockers"
        aria-labelledby="progress-blockers-title"
      >
        <h3 id="progress-blockers-title">Qué me bloquea</h3>
        {participation.error ? (
          <p>
            No se pudieron consultar los pendientes. Abre Participación para
            volver a intentarlo.
          </p>
        ) : participation.isPending ? (
          <p role="status">Consultando participación…</p>
        ) : blockers.length ? (
          <>
            <p>Preguntas obligatorias pendientes por persona.</p>
            <ol>
              {blockers.map((person) => (
                <li key={person.memberId}>
                  <span>{person.name}</span>
                  <strong>
                    {person.pending}
                    <span className="sr-only">
                      {" "}
                      preguntas obligatorias pendientes
                    </span>
                  </strong>
                </li>
              ))}
            </ol>
          </>
        ) : (
          <p>Nadie tiene preguntas obligatorias pendientes.</p>
        )}
        <Link to={`/projects/${projectId}/participation`}>
          Ver participación
        </Link>
      </section>
    </section>
  );
}
