import { reviewLabels } from "./ReviewShared";
import { AnalystStatus, AttentionPanel } from "./AnalystVisual";
import { useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import * as C from "@requirements/contracts";
import { exchangeRequest } from "../api";
import {
  Alert,
  Button,
  EmptyState,
  ErrorState,
  Input,
  LoadingState,
  Select,
} from "../ui";
export function ProjectTools({ projectId }: { projectId: string }) {
  return (
    <nav className="actions" aria-label="Herramientas del proyecto">
      <Link to={`/projects/${projectId}/dashboard`}>Resumen</Link>
      <Link to={`/projects/${projectId}/traceability`}>Trazabilidad</Link>
      <Link to={`/projects/${projectId}/import`}>Importar</Link>
      <Link to={`/projects/${projectId}/export`}>Exportar</Link>
      <Link to={`/projects/${projectId}/history`}>Bitácora</Link>
      <Link to={`/projects/${projectId}/editor`}>Editor</Link>
    </nav>
  );
}
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
  const [dimension, setDimension] = useState("section");
  if (q.isPending) return <LoadingState />;
  if (q.error)
    return <ErrorState error={q.error} retry={() => void q.refetch()} />;
  const data = q.data,
    filter = params.get("status") ?? "",
    items = data.questions.filter((q) => !filter || q.status === filter);
  return (
    <div className="av-scope">
      <Link to="/" className="back">
        ← Mis proyectos
      </Link>
      <h1>{data.projectName}</h1>
      <ProjectTools projectId={projectId} />
      <AttentionPanel data={data} projectId={projectId} />
      <h2>Resumen</h2>
      <p>
        Preguntas publicadas y no archivadas. Una respuesta enviada aún requiere
        revisión.
      </p>
      <MetricRow value={data.metrics} />
      <h2>Estados</h2>
      <ul className="state-summary av-status-summary">
        {data.states.map((s) => (
          <li key={s.status}>
            <button
              type="button"
              aria-pressed={filter === s.status}
              onClick={() => setParams({ status: s.status })}
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
                        {b.metrics[k].numerator} / {b.metrics[k].denominator} ·{" "}
                        {b.metrics[k].percentage ?? 0} %
                      </td>
                    ),
                  )}
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      <h2 id="dashboard-questions">Preguntas y pendientes</h2>
      <Select
        label="Filtrar estado"
        value={filter}
        onChange={(e) =>
          setParams(e.target.value ? { status: e.target.value } : {})
        }
      >
        <option value="">Todos los estados</option>
        {C.reviewStates.map((s) => (
          <option key={s} value={s}>
            {reviewLabels[s]}
          </option>
        ))}
      </Select>
      <p role="status">{items.length} preguntas</p>
      {!items.length ? (
        <EmptyState
          title={
            data.questions.length
              ? "Sin preguntas para este filtro"
              : "Sin preguntas"
          }
        >
          Publica preguntas para ver sus métricas.
        </EmptyState>
      ) : (
        <ul className="review-inbox">
          {items.map((x) => (
            <li key={x.id}>
              <Link to={`/projects/${projectId}/review/${x.id}`}>
                {x.title}
              </Link>
              <p>
                {x.sectionTitle} · {x.areaName} · {x.priority}
              </p>
              <AnalystStatus status={x.status} />
              {x.conditionalWithoutCase && (
                <p>Condicional · aún sin caso aplicable</p>
              )}
              {!!x.referenceIds.length && (
                <Link
                  to={`/projects/${projectId}/traceability?questionId=${x.id}`}
                >
                  Referencias de esta pregunta
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}
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
      <h1>Trazabilidad</h1>
      <ProjectTools projectId={projectId} />
      <p>
        La validación corresponde a una pregunta. Nunca se propaga a sus
        referencias.
      </p>
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
      <h1>Bitácora del proyecto</h1>
      <ProjectTools projectId={projectId} />
      <p>
        Historial de solo lectura. Los datos privados de borradores y archivos
        no se muestran.
      </p>
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
            <div className="table-scroll">
              <table>
                <caption>Eventos registrados</caption>
                <thead>
                  <tr>
                    <th scope="col">Fecha</th>
                    <th scope="col">Actor</th>
                    <th scope="col">Acción</th>
                    <th scope="col">Objeto</th>
                    <th scope="col">Detalle</th>
                  </tr>
                </thead>
                <tbody>
                  {q.data.items.map((e) => (
                    <tr key={e.id}>
                      <td>{new Date(e.occurredAt).toLocaleString("es-MX")}</td>
                      <td>{e.actorName}</td>
                      <td>{e.action}</td>
                      <td>
                        {e.objectType}
                        <details>
                          <summary>Identificador</summary>
                          {e.objectId}
                        </details>
                      </td>
                      <td>
                        {e.exportType ?? "—"} {e.scope ?? ""}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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
