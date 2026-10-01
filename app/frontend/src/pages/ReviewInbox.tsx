import { AnalystStatus } from "./AnalystVisual";
import { useQuery } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import { priorities, reviewStates } from "@requirements/contracts";
import { api } from "../api";
import { Button, EmptyState, ErrorState, LoadingState, Select } from "../ui";
import { dateText, reviewLabels } from "./ReviewShared";
export function ReviewInbox() {
  const [params, setParams] = useSearchParams();
  const input = Object.fromEntries(params);
  const q = useQuery({
    queryKey: ["review-inbox", input],
    queryFn: () => api("listReviewInbox", {}, input),
    staleTime: 0,
  });
  function filter(key: string, value: string) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete("page");
    if (key === "projectId") next.delete("sectionId");
    setParams(next);
  }
  return (
    <div className="av-scope">
      <Link className="back" to="/">
        ← Mis proyectos
      </Link>
      <h1>Revisión</h1>
      <p className="lead">
        Consulta las aportaciones y decide qué necesita seguimiento.
      </p>
      <div className="review-filters">
        <Select
          label="Estado"
          value={input.status ?? ""}
          onChange={(e) => filter("status", e.target.value)}
        >
          <option value="">Todos los estados</option>
          {reviewStates.map((s) => (
            <option key={s} value={s}>
              {reviewLabels[s]}
            </option>
          ))}
        </Select>
        <Select
          label="Prioridad"
          value={input.priority ?? ""}
          onChange={(e) => filter("priority", e.target.value)}
        >
          <option value="">Todas</option>
          {priorities.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </Select>
        {q.data &&
          (
            [
              ["projectId", "Proyecto", q.data.filters.projects],
              ["sectionId", "Tema", q.data.filters.sections],
              ["areaId", "Área responsable", q.data.filters.areas],
              [
                "participantId",
                "Participante asignado",
                q.data.filters.participants,
              ],
            ] as const
          ).map(([key, label, options]) => (
            <Select
              key={key}
              label={label}
              value={input[key] ?? ""}
              onChange={(e) => filter(key, e.target.value)}
            >
              <option value="">Todos</option>
              {options.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </Select>
          ))}
      </div>
      {params.size > 0 && (
        <Button tone="secondary" onClick={() => setParams({})}>
          Limpiar filtros
        </Button>
      )}
      {q.isPending ? (
        <LoadingState />
      ) : q.error ? (
        <ErrorState error={q.error} retry={() => void q.refetch()} />
      ) : (
        <>
          <p role="status">{q.data.total} preguntas encontradas</p>
          {q.data.items.length === 0 ? (
            <EmptyState title="No hay preguntas para estos filtros">
              Las preguntas publicadas de los proyectos donde eres analista
              aparecerán aquí.
            </EmptyState>
          ) : (
            <ul className="review-inbox">
              {q.data.items.map((item) => (
                <li key={item.questionId}>
                  <p className="eyebrow">
                    {item.projectName} · {item.sectionTitle}
                  </p>
                  <h2>
                    <Link
                      to={`/projects/${item.projectId}/review/${item.questionId}`}
                    >
                      {item.question}
                    </Link>
                  </h2>
                  <div className="actions">
                    <AnalystStatus status={item.status} />
                    <span className="av-metadata">
                      Prioridad {item.priority}
                    </span>
                    <span className="av-metadata">{item.areaName}</span>
                  </div>
                  <p>
                    {item.respondents.length
                      ? "Respondieron: " +
                        item.respondents
                          .map((r) => `${r.displayName} (${r.areaName})`)
                          .join(", ")
                      : "Aún no hay respuestas enviadas."}
                  </p>
                  <p className="hint">
                    Última aportación: {dateText(item.lastContributionAt)} ·{" "}
                    {item.hasEvidence ? "Con evidencia" : "Sin evidencia"}
                    {item.openClarifications > 0
                      ? ` · ${item.openClarifications} aclaraciones abiertas`
                      : ""}
                  </p>
                </li>
              ))}
            </ul>
          )}
          <div className="actions">
            <Button
              tone="secondary"
              disabled={q.data.page <= 1}
              onClick={() => {
                const next = new URLSearchParams(params);
                next.set("page", String(q.data.page - 1));
                setParams(next);
              }}
            >
              Anterior
            </Button>
            <span>
              Página {q.data.page} de{" "}
              {Math.max(1, Math.ceil(q.data.total / q.data.pageSize))}
            </span>
            <Button
              tone="secondary"
              disabled={q.data.page * q.data.pageSize >= q.data.total}
              onClick={() => {
                const next = new URLSearchParams(params);
                next.set("page", String(q.data.page + 1));
                setParams(next);
              }}
            >
              Siguiente
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
