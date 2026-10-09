import {
  AnalystStatus,
  ConflictComparison,
  DecisionRecord,
} from "./AnalystVisual";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Link,
  useParams,
  useLocation,
  useSearchParams,
} from "react-router-dom";
import { api } from "../api";
import { typeLabels, type dashboardView } from "@requirements/contracts";
import type { z } from "zod";
import {
  QuestionBand,
  MetaLine,
  StateCard,
  TabNav,
  TabPanel,
} from "../ui/semantic";
import { deriveTurn } from "./review-turn";
import { ContributionComparison } from "./ContributionComparison";
import "../direction-c-review.css";
import { workbenchPath } from "../workbench-context";
import { ContributionSet } from "./ContributionSet";
import { Alert, Button, ErrorState, LoadingState, Select } from "../ui";
import {
  ReviewActionDialog,
  actionLabels,
  type ReviewAction,
} from "./ReviewActions";
import { dateText, ThreadMessages } from "./ReviewShared";
export function ReviewDetail() {
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const contrastHeading = useRef<HTMLHeadingElement>(null);
  const questionHeading = useRef<HTMLHeadingElement>(null);
  function changeTab(value: string) {
    const next = new URLSearchParams(searchParams);
    next.set("tab", value);
    setSearchParams(next, {
      replace: true,
      state: location.state,
      preventScrollReset: true,
    });
  }

  const savedSearch = (location.state as { reviewSearch?: unknown } | null)
    ?.reviewSearch;
  const questionnaireReturn =
    (location.state as { questionnaireReturn?: unknown } | null)
      ?.questionnaireReturn === true;
  const { projectId = "", id = "" } = useParams();
  const reviewSearch =
    typeof savedSearch === "string"
      ? new URLSearchParams(savedSearch).toString()
      : new URLSearchParams({ projectId }).toString();
  const source = (
    location.state as {
      workbenchReturn?: { view?: unknown; search?: unknown };
    } | null
  )?.workbenchReturn;
  const sourceView =
    source?.view === "decisions" || source?.view === "attention"
      ? source.view
      : null;
  const sourcePath = sourceView
    ? workbenchPath(
        projectId,
        sourceView,
        typeof source?.search === "string" ? source.search : "",
      )
    : null;
  const projects = useQuery({
    queryKey: ["projects"],
    queryFn: () => api("projects"),
  });
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
  const [freeComparisonOpen, setFreeComparisonOpen] = useState(false);
  // "Comparar aportaciones" changes the tab; the heading can only take focus
  // once the Contraste panel is rendered visible, so move it after the commit
  // that selects the tab instead of guessing with a timer.
  const focusContrastOnTab = useRef(false);
  const requestedTab = searchParams.get("tab");
  useEffect(() => {
    const wanted = focusContrastOnTab.current;
    focusContrastOnTab.current = false;
    if (wanted && requestedTab === "contrast") contrastHeading.current?.focus();
  }, [requestedTab]);
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
    await client.invalidateQueries({ queryKey: ["dashboard", projectId] });
    await client.invalidateQueries({ queryKey: ["questionnaire", projectId] });
    // A successful command can remove its trigger (for example, validation).
    // Keep cancellation focus unchanged and restore a useful anchor only if lost.
    requestAnimationFrame(() => {
      if (document.activeElement === document.body)
        questionHeading.current?.focus();
    });
  }
  const hasCurrentDecision = d.validations.some((v) => !v.invalidatedAt);
  const turn = deriveTurn(d);
  const selectedTab = searchParams.get("tab");
  const tab =
    selectedTab &&
    ["contributions", "contrast", "decision", "history"].includes(selectedTab)
      ? selectedTab
      : hasCurrentDecision || d.status === "NOT_APPLICABLE"
        ? "decision"
        : openConflict
          ? "contrast"
          : "contributions";
  const projectRole = projects.data?.find(
    (project) => project.id === projectId,
  )?.role;
  // DEV-01/02: reuse only an existing dashboard cache, never fetch per question.
  const cached =
    projectRole === "ADMIN" || projectRole === "ANALYST"
      ? client
          .getQueryData<z.infer<typeof dashboardView>>(["dashboard", projectId])
          ?.questions.find((question) => question.id === id)
      : undefined;
  // v0.5.0 withheld "Registrar decisión" while a clarification was open; the
  // backend refuses to validate until every thread is closed.
  const validationBlocked = primary === "validateQuestion" && !!openThread;
  // Comparing never depends on conflicts: offer every current pair unless one
  // conflict comparison already lets the analyst pick among all of them.
  const conflictCoversCurrent = d.conflicts.some((c) =>
    current.every((s) =>
      c.participants.some((p) => p.responseRevisionId === s.id),
    ),
  );
  const otherActions = [
    ...new Set<ReviewAction>([
      ...((!turn.action || primary !== turn.action) &&
      primary !== "reopenQuestion" &&
      !validationBlocked
        ? [primary]
        : []),
      "requestClarification",
      "markPartial",
      "markPending",
      "markConflict",
      "markNotApplicable",
    ]),
  ];
  const otherControls = d.canReview && (
    <Select
      label="Otras acciones"
      value=""
      onChange={(event) => {
        const value = event.target.value as ReviewAction;
        if (value)
          setAction({
            action: value,
            threadId:
              value === "closeClarification" ? openThread?.id : undefined,
            conflictId:
              value === "resolveConflict" ? openConflict?.id : undefined,
          });
      }}
    >
      <option value="">Selecciona una acción</option>
      {otherActions.map((item) => (
        <option key={item} value={item}>
          {actionLabels[item]}
        </option>
      ))}
    </Select>
  );
  const participants = d.participants.length > 0 && (
    <details className="ac-review-participants">
      <summary>Participantes ({d.participants.length})</summary>
      <ul>
        {d.participants.map((person) => (
          <li key={person.memberId}>
            {person.person.displayName} · {person.area} ·{" "}
            {person.required ? "Aportación requerida" : "Aportación opcional"} ·{" "}
            {person.applicability !== "ENABLED"
              ? "Fuera del recorrido actual"
              : person.currentRevisionId
                ? "Respuesta recibida"
                : "Falta respuesta"}
          </li>
        ))}
      </ul>
    </details>
  );
  function threadsFor(submissionId?: string) {
    return d.threads
      .filter(
        (thread) => !submissionId || thread.responseRevisionId === submissionId,
      )
      .map((thread) => (
        <article key={thread.id} className="ac-review-thread">
          <h3>
            Aclaración sobre{" "}
            {
              d.submissions.find(
                (submission) => submission.id === thread.responseRevisionId,
              )?.respondent.displayName
            }{" "}
            · envío #
            {
              d.submissions.find(
                (submission) => submission.id === thread.responseRevisionId,
              )?.number
            }
          </h3>
          <ThreadMessages thread={thread} />
          {d.canReview && thread.status === "WAITING_ANALYST" && (
            <div className="actions">
              <Button
                tone="secondary"
                onClick={() =>
                  setAction({
                    action: "closeClarification",
                    threadId: thread.id,
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
                    threadId: thread.id,
                  })
                }
              >
                Preguntar nuevamente
              </Button>
            </div>
          )}
        </article>
      ));
  }
  const conflictsSection = d.conflicts.length > 0 && (
    <section>
      <h2>Conflictos</h2>
      {d.conflicts.map((c) => (
        <article key={c.id} className="review-submission">
          <h3>
            {c.status === "OPEN" ? "Conflicto abierto" : "Conflicto resuelto"}
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
                tone="secondary"
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
  );
  return (
    <div className="review-page av-scope ac-review">
      <div className="ac-review-back">
        {" "}
        <Link
          className="back"
          to={
            sourcePath ??
            (questionnaireReturn
              ? `/projects/${projectId}/editor`
              : d.canReview
                ? `/review?${reviewSearch}`
                : `/projects/${projectId}`)
          }
        >
          {sourceView
            ? sourceView === "attention"
              ? "← Atención"
              : "← Decisiones"
            : questionnaireReturn
              ? "← Cuestionario"
              : d.canReview
                ? "← Revisar respuestas"
                : "← Proyecto"}
        </Link>
      </div>
      <div className="ac-review-heading">
        <div>
          <QuestionBand
            headingRef={questionHeading}
            question={d.question.question}
            title={[
              d.question.sectionTitle,
              cached?.externalId,
              d.question.title,
              typeLabels[d.question.type],
              d.question.required ? "Obligatoria" : "Opcional",
            ]
              .filter(Boolean)
              .join(" · ")}
            metadata={
              <MetaLine
                items={[
                  cached?.areaName,
                  d.participants.length
                    ? `${d.participants.filter((person) => person.currentRevisionId).length} de ${d.participants.length} enviaron`
                    : null,
                ]}
              />
            }
          />
          {d.question.helpText && (
            <details className="ac-question-help">
              <summary>Texto de ayuda para quien responde</summary>
              <p>{d.question.helpText}</p>
            </details>
          )}
        </div>
        <StateCard
          title={turn.title}
          status={
            <div className="ac-review-state-labels">
              {turn.label && <p className="ac-turn-label">{turn.label}</p>}
              <AnalystStatus status={d.status} />
            </div>
          }
          action={
            d.canReview && turn.action ? (
              <Button
                onClick={() =>
                  setAction({
                    action: turn.action!,
                    threadId: turn.threadId,
                    conflictId: turn.conflictId,
                  })
                }
              >
                {actionLabels[turn.action]}
              </Button>
            ) : undefined
          }
          otherActions={otherControls}
        >
          <p>{turn.detail}</p>
          {d.pendingReviewReason && <p>Pendiente: {d.pendingReviewReason}</p>}
          {d.partialReviewReason && (
            <p>Falta información: {d.partialReviewReason}</p>
          )}
        </StateCard>
      </div>
      {message && <Alert>{message}</Alert>}
      <TabNav
        id="review-tabs"
        label="Contenido de la revisión"
        value={tab}
        onChange={changeTab}
        items={[
          { value: "contributions", label: `Aportaciones (${current.length})` },
          { value: "contrast", label: "Contraste" },
          { value: "decision", label: "Decisión" },
          { value: "history", label: "Historial" },
        ]}
      />
      <TabPanel
        id="review-tabs"
        value="contributions"
        active={tab === "contributions"}
      >
        <ContributionSet
          key={d.question.id}
          data={d}
          renderThreads={threadsFor}
          onCompare={() => {
            setFreeComparisonOpen(true);
            focusContrastOnTab.current = true;
            changeTab("contrast");
          }}
        />
        {participants}
      </TabPanel>
      <TabPanel id="review-tabs" value="contrast" active={tab === "contrast"}>
        <div className="ac-contrast-heading">
          <h2 ref={contrastHeading} tabIndex={-1}>
            Contrastar aportaciones
          </h2>
          <Button
            tone="secondary"
            onClick={() => {
              changeTab("contributions");
              requestAnimationFrame(() => {
                const button = document.querySelector<HTMLButtonElement>(
                  "#review-tabs-panel-contributions .ac-contribution-list-panel > .button",
                );
                (
                  button ??
                  document.getElementById("review-tabs-tab-contributions")
                )?.focus();
              });
            }}
          >
            ← Volver a {current.length} aportaciones
          </Button>
        </div>
        {conflictsSection}
        {current.length < 2 ? (
          !conflictsSection && (
            <p>Se necesitan al menos dos aportaciones para comparar.</p>
          )
        ) : !conflictsSection ? (
          <ContributionComparison data={d} />
        ) : (
          !conflictCoversCurrent && (
            <details
              className="ac-free-comparison"
              open={freeComparisonOpen}
              onToggle={(event) =>
                setFreeComparisonOpen(event.currentTarget.open)
              }
            >
              <summary>
                Comparar otras aportaciones vigentes ({current.length})
              </summary>
              <ContributionComparison
                data={d}
                labelSuffix=" (comparación libre)"
              />
            </details>
          )
        )}
      </TabPanel>
      <TabPanel id="review-tabs" value="decision" active={tab === "decision"}>
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

        {!d.validations.length && <p>No hay decisiones registradas.</p>}
        {d.status === "NOT_APPLICABLE" && d.dispositions.length > 0 && (
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
        {d.canReview &&
          (d.status === "VALIDATED" || d.status === "NOT_APPLICABLE") && (
            <Button
              tone="secondary"
              onClick={() => setAction({ action: "reopenQuestion" })}
            >
              Reabrir pregunta
            </Button>
          )}
      </TabPanel>
      <TabPanel id="review-tabs" value="history" active={tab === "history"}>
        <h2>Historial de la pregunta</h2>
        {d.threads.length > 0 && (
          <section>
            <h3>Aclaraciones</h3>
            {threadsFor()}
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
      </TabPanel>
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
