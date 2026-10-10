import { ProjectAttention } from "./ProjectAttention";
import { ProjectWorkbench } from "./ProjectWorkbench";
import { PageHeader } from "../ui/semantic";
import { auditActions, auditObjects } from "./audit-labels";
import { AnalystStatus } from "./AnalystVisual";
import { useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import * as C from "@requirements/contracts";
import { api, exchangeRequest } from "../api";
import {
  Alert,
  Button,
  DataTable,
  EmptyState,
  ErrorState,
  Input,
  LoadingState,
  Select,
} from "../ui";
export function Metric({
  label,
  value,
}: {
  label: string;
  value: z.infer<typeof C.metricView>;
}) {
  return (
    <div>
      <h3>{label}</h3>
      <p>
        <strong>
          {value.numerator} / {value.denominator}
        </strong>{" "}
        <span>
          {value.percentage === null
            ? "Sin preguntas"
            : `${value.percentage.toLocaleString("es-MX")} %`}
        </span>
      </p>
    </div>
  );
}
function MetricRow({ value }: { value: z.infer<typeof C.metricsView> }) {
  return (
    <div className="metric-row">
      <Metric label="Validación" value={value.validation} />
      <Metric label="Cierre" value={value.closure} />
      <Metric label="Con respuestas" value={value.submission} />
    </div>
  );
}
export function Dashboard() {
  const { projectId = "" } = useParams(),
    [params, setParams] = useSearchParams();
  const q = useQuery({
    queryKey: ["dashboard", projectId],
    queryFn: () => exchangeRequest(projectId, "dashboard", C.dashboardView),
    staleTime: 0,
  });
  const projects = useQuery({
    queryKey: ["projects"],
    queryFn: () => api("projects"),
  });
  const [dimension, setDimension] = useState("section");
  if (q.isPending || projects.isPending) return <LoadingState />;
  if (q.error || projects.error)
    return (
      <ErrorState
        error={q.error ?? projects.error!}
        retry={() => {
          void q.refetch();
          void projects.refetch();
        }}
      />
    );
  const data = q.data,
    filter = params.get("status") ?? "";
  const project = projects.data?.find((p) => p.id === projectId);
  if (!project)
    return (
      <ErrorState
        error={new Error("El proyecto no está disponible.")}
        retry={() => void projects.refetch()}
      />
    );
  return (
    <div className="av-scope">
      <ProjectWorkbench
        projectId={projectId}
        projectName={data.projectName}
        role={data.role}
        active="attention"
      />
      <ProjectAttention
        projectId={projectId}
        data={data}
        lifecycle={project.lifecycle}
      />
      <details className="pw-metrics">
        <summary>Resumen y métricas</summary>
        <h2>Resumen</h2>
        <p>
          Preguntas publicadas y no archivadas. Una respuesta enviada aún
          requiere revisión.
        </p>
        <MetricRow value={data.metrics} />
        <h2>Estados</h2>
        <ul className="state-summary av-status-summary">
          {data.states.map((s) => (
            <li key={s.status}>
              <button
                type="button"
                aria-pressed={filter === s.status}
                onClick={() => {
                  const next = new URLSearchParams(params);
                  next.set("status", s.status);
                  next.delete("task");
                  setParams(next);
                  document
                    .getElementById("dashboard-questions")
                    ?.scrollIntoView();
                }}
              >
                <AnalystStatus status={s.status} /> <strong>{s.count}</strong>
              </button>
            </li>
          ))}
        </ul>
        <h2>Desgloses</h2>
        <Select
          label="Desglosar por"
          value={dimension}
          onChange={(e) => setDimension(e.target.value)}
        >
          <option value="section">Tema</option>
          <option value="priority">Prioridad</option>
          <option value="area">Área responsable</option>
          <option value="status">Estado</option>
        </Select>
        <div className="table-scroll">
          <table>
            <caption>
              Métricas por{" "}
              {dimension === "section"
                ? "tema"
                : dimension === "area"
                  ? "área"
                  : dimension === "priority"
                    ? "prioridad"
                    : "estado"}
            </caption>
            <thead>
              <tr>
                <th scope="col">Grupo</th>
                <th scope="col">Validación</th>
                <th scope="col">Cierre</th>
                <th scope="col">Con respuestas</th>
              </tr>
            </thead>
            <tbody>
              {data.breakdowns
                .filter((b) => b.dimension === dimension)
                .map((b) => (
                  <tr key={b.key}>
                    <th scope="row">{b.label}</th>
                    {(["validation", "closure", "submission"] as const).map(
                      (k) => (
                        <td key={k}>
                          {b.metrics[k].numerator} / {b.metrics[k].denominator}{" "}
                          · {b.metrics[k].percentage ?? 0} %
                        </td>
                      ),
                    )}
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
export function Traceability() {
  const { projectId = "" } = useParams(),
    [params, setParams] = useSearchParams();
  const q = useQuery({
    queryKey: ["traceability", projectId],
    queryFn: () =>
      exchangeRequest(projectId, "traceability", C.traceabilityView),
  });
  if (q.isPending) return <LoadingState />;
  if (q.error)
    return <ErrorState error={q.error} retry={() => void q.refetch()} />;
  const refs = q.data.references.filter(
    (r) =>
      (!params.get("questionId") ||
        r.questions.some((q) => q.id === params.get("questionId"))) &&
      (!params.get("referenceId") || r.id === params.get("referenceId")),
  );
  return (
    <>
      <PageHeader
        title="Trazabilidad"
        lead="La validación corresponde a una pregunta. Nunca se propaga a sus referencias."
      />
      <p>
        Preguntas publicadas con referencias: {q.data.questionsWithReferences}.
        Sin referencias: {q.data.questionsWithoutReferences}. Referencias
        relacionadas:{" "}
        {q.data.references.filter((r) => r.questions.length).length}.
      </p>
      {params.size > 0 && (
        <Button tone="secondary" onClick={() => setParams({})}>
          Ver todas las referencias
        </Button>
      )}
      {!refs.length ? (
        <EmptyState title="Sin referencias para mostrar" />
      ) : (
        <ul className="review-inbox">
          {refs.map((r) => (
            <li key={r.id}>
              <h2>
                <Link to={`?referenceId=${r.id}`}>{r.externalId}</Link> ·{" "}
                {r.label}
              </h2>
              <p>{r.type}</p>
              {r.description && <p>{r.description}</p>}
              {r.url && (
                <a href={r.url} target="_blank" rel="noreferrer">
                  Abrir referencia externa (nueva pestaña)
                </a>
              )}
              <h3>Preguntas relacionadas</h3>
              {!r.questions.length ? (
                <p>Sin preguntas relacionadas.</p>
              ) : (
                <ul>
                  {r.questions.map((q) => (
                    <li key={q.id}>
                      <Link
                        to={
                          q.publication === "PUBLISHED"
                            ? `/projects/${projectId}/review/${q.id}`
                            : `/projects/${projectId}/editor`
                        }
                      >
                        {q.externalId} · {q.title}
                      </Link>{" "}
                      · {C.statusLabels[q.status]}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
export function History() {
  const { projectId = "" } = useParams(),
    [params, setParams] = useSearchParams(),
    input = Object.fromEntries(params);
  const q = useQuery({
    queryKey: ["history", projectId, input],
    queryFn: () =>
      exchangeRequest(projectId, "history", C.historyView, { query: input }),
    staleTime: 0,
  });
  const filter = (key: string, value: string) => {
    const p = new URLSearchParams(params);
    p.delete("page");
    if (value) p.set(key, value);
    else p.delete(key);
    setParams(p);
  };
  return (
    <>
      <PageHeader
        title="Bitácora del proyecto"
        lead="Historial de solo lectura. Los datos privados de borradores y archivos no se muestran."
      />
      <div className="review-filters">
        <Input
          label="Objeto"
          value={input.objectType ?? ""}
          placeholder="Question, ImportBatch…"
          onChange={(e) => filter("objectType", e.target.value)}
        />
        <Input
          label="Acción"
          value={input.action ?? ""}
          list="audit-actions"
          onChange={(e) => filter("action", e.target.value)}
        />
        <datalist id="audit-actions">
          <option value="PROJECT_IMPORTED" />
          <option value="EXPORT_CREATED" />
        </datalist>
        <Select
          label="Actor"
          value={input.actorId ?? ""}
          onChange={(e) => filter("actorId", e.target.value)}
        >
          <option value="">Todos</option>
          {q.data?.actors.map((a) => (
            <option value={a.id} key={a.id}>
              {a.displayName}
            </option>
          ))}
        </Select>
        <Input
          label="Desde"
          type="date"
          value={input.from?.slice(0, 10) ?? ""}
          onChange={(e) =>
            filter(
              "from",
              e.target.value ? e.target.value + "T00:00:00.000Z" : "",
            )
          }
        />
        <Input
          label="Hasta"
          type="date"
          value={input.to?.slice(0, 10) ?? ""}
          onChange={(e) =>
            filter(
              "to",
              e.target.value ? e.target.value + "T23:59:59.999Z" : "",
            )
          }
        />
      </div>
      {q.isPending ? (
        <LoadingState />
      ) : q.error ? (
        <ErrorState error={q.error} retry={() => void q.refetch()} />
      ) : (
        <>
          <p role="status">{q.data.total} eventos</p>
          {!q.data.items.length ? (
            <EmptyState title="No hay eventos para estos filtros" />
          ) : (
            <DataTable
              caption="Eventos registrados"
              columns={[
                { label: "Fecha", bare: true },
                { label: "Actor" },
                { label: "Acción" },
                { label: "Objeto" },
                { label: "Detalle" },
              ]}
              rows={q.data.items.map((e) => ({
                key: e.id,
                cells: [
                  new Date(e.occurredAt).toLocaleString("es-MX"),
                  e.actorName,
                  <span key="a" className="ac-audit-code">
                    {auditActions[e.action] ?? e.action}
                    {auditActions[e.action] && <small>{e.action}</small>}
                  </span>,
                  <span key="o">
                    {auditObjects[e.objectType] ?? e.objectType}
                    <details>
                      <summary>Identificador</summary>
                      {e.objectId}
                    </details>
                  </span>,
                  `${e.exportType ?? "—"} ${e.scope ?? ""}`.trim(),
                ],
              }))}
            />
          )}
          <div className="actions">
            <Button
              tone="secondary"
              disabled={q.data.page <= 1}
              onClick={() =>
                setParams({ ...input, page: String(q.data.page - 1) })
              }
            >
              Anterior
            </Button>
            <span>Página {q.data.page}</span>
            <Button
              tone="secondary"
              disabled={q.data.page * q.data.pageSize >= q.data.total}
              onClick={() =>
                setParams({ ...input, page: String(q.data.page + 1) })
              }
            >
              Siguiente
            </Button>
          </div>
        </>
      )}
      {input.from && input.to && input.from > input.to && (
        <Alert error>La fecha inicial es posterior a la final.</Alert>
      )}
    </>
  );
}
