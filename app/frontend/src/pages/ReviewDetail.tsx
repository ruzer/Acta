import {
  AnalystStatus,
  ConflictComparison,
  DecisionRecord,
} from "./AnalystVisual";
import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams, useLocation } from "react-router-dom";
import { api } from "../api";
import {
  Alert,
  Button,
  EmptyState,
  ErrorState,
  LoadingState,
  Select,
} from "../ui";
import {
  ReviewActionDialog,
  actionLabels,
  type ReviewAction,
} from "./ReviewActions";
import { dateText, SubmittedAnswer, ThreadMessages } from "./ReviewShared";
export function ReviewDetail() {
  const location = useLocation();
  const savedSearch = (location.state as { reviewSearch?: unknown } | null)
    ?.reviewSearch;
  const { projectId = "", id = "" } = useParams();
  const reviewSearch =
    typeof savedSearch === "string"
      ? new URLSearchParams(savedSearch).toString()
      : new URLSearchParams({ projectId }).toString();
  const client = useQueryClient();
  const q = useQuery({
    queryKey: ["review", projectId, id],
    queryFn: () => api("getReviewDetail", { projectId, id }),
    staleTime: 0,
  });
  const [action, setActionState] = useState<{
      action: ReviewAction;
      threadId?: string;
      conflictId?: string;
    } | null>(null),
    [message, setMessage] = useState("");
  const returnFocus = useRef<HTMLElement | null>(null);
  function setAction(next: typeof action) {
    if (next && !action)
      returnFocus.current = document.activeElement as HTMLElement;
    setActionState(next);
    if (!next) requestAnimationFrame(() => returnFocus.current?.focus());
  }
  if (q.isPending) return <LoadingState />;
  if (!q.data)
    return (
      <ErrorState
        error={q.error ?? new Error("No se pudo cargar la información.")}
        retry={() => void q.refetch()}
      />
    );
  const d = q.data,
    current = d.submissions.filter((s) => s.current),
    historical = d.submissions.filter((s) => !s.current),
    openConflict = d.conflicts.find((c) => c.status === "OPEN"),
    openThread = d.threads.find((t) => t.status !== "CLOSED");
  const primary: ReviewAction =
    d.status === "VALIDATED" || d.status === "NOT_APPLICABLE"
      ? "reopenQuestion"
      : openConflict
        ? "resolveConflict"
        : openThread?.status === "WAITING_ANALYST"
          ? "closeClarification"
          : current.length
            ? "validateQuestion"
            : "markPending";
  async function done() {
    setAction(null);
    setMessage("Revisión registrada. El historial se conserva.");
    await client.invalidateQueries({ queryKey: ["review"] });
    await client.invalidateQueries({ queryKey: ["review-inbox"] });
    await client.invalidateQueries({ queryKey: ["my-work"] });
  }
  return (
    <div className="review-page av-scope">
      <Link
        className="back"
        to={d.canReview ? `/review?${reviewSearch}` : `/projects/${projectId}`}
      >
        {d.canReview ? "← Revisión" : "← Proyecto"}
      </Link>
      <p className="eyebrow">
        {d.projectName} · {d.question.sectionTitle}
      </p>
      <h1>{d.question.title}</h1>
      <p className="lead">{d.question.question}</p>
      <AnalystStatus status={d.status} />
      {message && <Alert>{message}</Alert>}
      {d.pendingReviewReason && (
        <Alert>Pendiente: {d.pendingReviewReason}</Alert>
      )}
      {d.partialReviewReason && (
        <Alert>Falta información: {d.partialReviewReason}</Alert>
      )}
      {d.canReview && (
        <div className="review-toolbar">
          {openThread?.status === "WAITING_STAKEHOLDER" && !openConflict ? (
            <p>Esperando la aclaración del participante.</p>
          ) : (
            <Button
              onClick={() =>
                setAction({
                  action: primary,
                  threadId:
                    primary === "closeClarification"
                      ? openThread?.id
                      : undefined,
                  conflictId: openConflict?.id,
                })
              }
            >
              {actionLabels[primary]}
            </Button>
          )}
          <Select
            label="Otras acciones"
            value=""
            onChange={(e) => {
              if (e.target.value)
                setAction({ action: e.target.value as ReviewAction });
            }}
          >
            <option value="">Selecciona una acción</option>
            {(
              [
                "requestClarification",
                "markPartial",
                "markPending",
                "markConflict",
                "markNotApplicable",
              ] as ReviewAction[]
            ).map((a) => (
              <option key={a} value={a}>
                {actionLabels[a]}
              </option>
            ))}
          </Select>
        </div>
      )}
      {!d.canReview && <p className="hint">Consulta de solo lectura.</p>}
      {d.validations.length > 0 && (
        <section aria-labelledby="decisions-title">
          <h2 id="decisions-title">Decisiones registradas</h2>
          {d.validations
            .filter((v) => !v.invalidatedAt)
            .map((v) => (
              <DecisionRecord key={v.id} data={d} validation={v} />
            ))}
          {d.validations.some((v) => v.invalidatedAt) && (
            <details>
              <summary>
                Decisiones históricas (
                {d.validations.filter((v) => v.invalidatedAt).length})
              </summary>
              {d.validations
                .filter((v) => v.invalidatedAt)
                .map((v) => (
                  <DecisionRecord key={v.id} data={d} validation={v} />
                ))}
            </details>
          )}
        </section>
      )}
      <section aria-labelledby="received">
        <h2 id="received">Respuestas recibidas</h2>
        {current.length === 0 ? (
          <EmptyState title="Sin respuestas vigentes">
            Las aportaciones aparecerán cuando los participantes las envíen.
          </EmptyState>
        ) : (
          current.map((s) => (
            <article className="review-submission" key={s.id}>
              <h3>{s.respondent.displayName}</h3>
              <p>{s.area.name}</p>
              <SubmittedAnswer
                revision={s}
                question={d.question}
                projectId={projectId}
              />
            </article>
          ))
        )}
        {historical.length > 0 && (
          <details>
            <summary>Envíos históricos ({historical.length})</summary>
            {historical.map((s) => (
              <article className="review-submission" key={s.id}>
                <h3>
                  {s.respondent.displayName} · envío #{s.number}
                </h3>
                <p>{s.area.name}</p>
                <SubmittedAnswer
                  revision={s}
                  question={d.question}
                  projectId={projectId}
                />
              </article>
            ))}
          </details>
        )}
      </section>
      {d.participants.length > 0 && (
        <section>
          <h2>Participantes</h2>
          <ul>
            {d.participants.map((p) => (
              <li key={p.memberId}>
                {p.person.displayName} · {p.area} ·{" "}
                {p.required ? "Aportación requerida" : "Aportación opcional"} ·{" "}
                {p.applicability !== "ENABLED"
                  ? "Fuera del recorrido actual"
                  : p.currentRevisionId
                    ? "Respuesta recibida"
                    : "Falta respuesta"}
              </li>
            ))}
          </ul>
        </section>
      )}
      {d.threads.length > 0 && (
        <section>
          <h2>Aclaraciones</h2>
          {d.threads.map((t) => (
            <article key={t.id} className="review-submission">
              <h3>
                Aclaración sobre{" "}
                {
                  d.submissions.find((s) => s.id === t.responseRevisionId)
                    ?.respondent.displayName
                }{" "}
                · envío #
                {
                  d.submissions.find((s) => s.id === t.responseRevisionId)
                    ?.number
                }
              </h3>
              <ThreadMessages thread={t} />
              {d.canReview && t.status === "WAITING_ANALYST" && (
                <div className="actions">
                  <Button
                    onClick={() =>
                      setAction({
                        action: "closeClarification",
                        threadId: t.id,
                      })
                    }
                  >
                    Cerrar aclaración
                  </Button>
                  <Button
                    tone="secondary"
                    onClick={() =>
                      setAction({
                        action: "requestClarification",
                        threadId: t.id,
                      })
                    }
                  >
                    Preguntar nuevamente
                  </Button>
                </div>
              )}
            </article>
          ))}
        </section>
      )}
      {d.conflicts.length > 0 && (
        <section>
          <h2>Conflictos</h2>
          {d.conflicts.map((c) => (
            <article key={c.id} className="review-submission">
              <h3>
                {c.status === "OPEN"
                  ? "Conflicto abierto"
                  : "Conflicto resuelto"}
              </h3>
              <p className="answer-text">{c.reason}</p>
              <p className="hint">
                Registrado por {c.openedBy.displayName} · {dateText(c.openedAt)}
              </p>
              <details open={c.status === "OPEN"}>
                <summary>Comparar respuestas en conflicto</summary>
                <ConflictComparison data={d} conflict={c} />
              </details>
              <p className="hint">
                Resolver este conflicto no valida la pregunta. La decisión se
                registra por separado.
              </p>
              {c.resolution ? (
                <>
                  <p className="answer-text">
                    <strong>Resolución: </strong>
                    {c.resolution.resolutionText}
                  </p>
                  <p>
                    {c.resolution.resolvedBy.displayName} ·{" "}
                    {dateText(c.resolution.resolvedAt)}
                  </p>
                  <p>
                    Fuentes:{" "}
                    {c.resolution.sources
                      .map((source) => {
                        const s = d.submissions.find(
                          (s) => s.id === source.responseRevisionId,
                        );
                        return `${s?.respondent.displayName} #${s?.number}`;
                      })
                      .join(", ")}
                  </p>
                </>
              ) : (
                d.canReview && (
                  <Button
                    onClick={() =>
                      setAction({ action: "resolveConflict", conflictId: c.id })
                    }
                  >
                    Resolver conflicto
                  </Button>
                )
              )}
            </article>
          ))}
        </section>
      )}
      {d.dispositions.length > 0 && (
        <details>
          <summary>Decisiones de no aplica</summary>
          {d.dispositions.map((n) => (
            <article key={n.id}>
              <h3>
                {n.revokedAt ? "Decisión histórica" : "No aplica vigente"}
              </h3>
              <p>{n.reason}</p>
              <p>Alcance: {n.scope}</p>
              <p>
                {n.markedBy.displayName} · {dateText(n.markedAt)}
              </p>
              {n.revokedAt && <p>Reabierta: {n.revokeReason}</p>}
            </article>
          ))}
        </details>
      )}
      <details>
        <summary>Ver trazabilidad</summary>
        {d.references.length ? (
          <ul>
            {d.references.map((r) => (
              <li key={r.id}>
                {r.externalId} · {r.label} · {r.scopeNote}
              </li>
            ))}
          </ul>
        ) : (
          <p>Esta pregunta no tiene referencias vinculadas.</p>
        )}
      </details>
      {action && (
        <ReviewActionDialog
          {...action}
          data={d}
          onClose={() => setAction(null)}
          onDone={() => void done()}
          refresh={() => q.refetch()}
        />
      )}
    </div>
  );
}
