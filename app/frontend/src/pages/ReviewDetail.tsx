import {
  AnalystStatus,
  DecisionRecord,
  DispositionRecord,
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
  ActionMenu,
  QuestionBand,
  MetaLine,
  StateCard,
  TabNav,
  TabPanel,
  Timeline,
} from "../ui/semantic";
import { useMediaQuery } from "../ui/useMediaQuery";
import { ParticipantIcon } from "./ParticipantIcon";
import { deriveTurn } from "./review-turn";
import { ReviewContrast } from "./ReviewContrast";
import { ClarificationThread } from "./ReviewThreads";
import { buildTimeline } from "./review-timeline";
import "../direction-c-review.css";
import { workbenchPath } from "../workbench-context";
import { ContributionSet } from "./ContributionSet";
import { Alert, Button, ErrorState, LoadingState } from "../ui";
import {
  ReviewActionDialog,
  actionLabels,
  type ReviewAction,
} from "./ReviewActions";
import { dateText } from "./ReviewShared";
export function ReviewDetail() {
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const contrastHeading = useRef<HTMLHeadingElement>(null);
  const questionHeading = useRef<HTMLHeadingElement>(null);
  function changeTab(value: string, contribution?: string) {
    const next = new URLSearchParams(searchParams);
    next.set("tab", value);
    if (contribution) next.set("aportacion", contribution);
    else next.delete("aportacion");
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
      responseRevisionId?: string;
    } | null>(null),
    [message, setMessage] = useState("");
  const [freeComparisonOpen, setFreeComparisonOpen] = useState(false);
  const [compareFrom, setCompareFrom] = useState<string | undefined>();
  // < 760 px: secondary actions live in a "Más acciones" menu, not a select.
  const compact = useMediaQuery("(max-width: 759px)");
  // Moving between "Aportaciones" and "Contraste" changes the tab; the target
  // can only take focus once its panel is rendered visible, so the request is
  // recorded here and fulfilled after the commit that selects the tab instead
  // of guessing with a timer. It is one-shot: any later tab change clears it.
  const focusOnTab = useRef<"contrast" | "contributions" | "pane" | null>(null);
  const requestedTab = searchParams.get("tab");
  useEffect(() => {
    const wanted = focusOnTab.current;
    focusOnTab.current = null;
    // "pane" is the open contribution, which lives in the Aportaciones tab.
    if (
      !wanted ||
      (wanted === "pane" ? "contributions" : wanted) !== requestedTab
    )
      return;
    if (wanted === "contrast") contrastHeading.current?.focus();
    else if (wanted === "pane")
      document
        .querySelector<HTMLElement>(
          "#review-tabs-panel-contributions .ac-contribution-pane h2",
        )
        ?.focus();
    else
      (
        document.querySelector<HTMLButtonElement>(
          "#review-tabs-panel-contributions .ac-contribution-list-panel > .button",
        ) ?? document.getElementById("review-tabs-tab-contributions")
      )?.focus();
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
  const currentProject = projects.data?.find(
    (project) => project.id === projectId,
  );
  // An analyst is read-only only because the project is archived; every other
  // role simply does not review.
  const turn = deriveTurn(d, {
    archived:
      currentProject?.role === "ANALYST" &&
      currentProject.lifecycle === "ARCHIVED",
  });
  // UX-09: the team that reviews always gets the four tabs; a read-only
  // reader only gets the ones that have something to show (with what the
  // server already filters for that role).
  const readOnly = !d.canReview;
  const available = {
    contributions: true,
    contrast: !readOnly || d.conflicts.length > 0 || current.length >= 2,
    decision:
      !readOnly || d.validations.length > 0 || d.dispositions.length > 0,
    history:
      !readOnly ||
      d.threads.length > 0 ||
      d.dispositions.length > 0 ||
      d.references.length > 0,
  };
  type TabKey = keyof typeof available;
  const isAvailable = (value: string | null): value is TabKey =>
    !!value && Object.hasOwn(available, value) && available[value as TabKey];
  const selectedTab = searchParams.get("tab");
  const preferredTab: TabKey =
    hasCurrentDecision || d.status === "NOT_APPLICABLE"
      ? "decision"
      : openConflict
        ? "contrast"
        : "contributions";
  const tab: TabKey = isAvailable(selectedTab)
    ? selectedTab
    : isAvailable(preferredTab)
      ? preferredTab
      : "contributions";
  const projectRole = currentProject?.role;
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
  function chooseAction(value: ReviewAction) {
    setAction({
      action: value,
      threadId: value === "closeClarification" ? openThread?.id : undefined,
      conflictId: value === "resolveConflict" ? openConflict?.id : undefined,
    });
  }
  const otherControls = d.canReview && (
    <ActionMenu
      label={compact ? "Más acciones" : "Otras acciones"}
      items={otherActions.map((item) => ({
        value: item,
        label: actionLabels[item],
      }))}
      onSelect={(value) => chooseAction(value as ReviewAction)}
    />
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
  const openThreadAction = (
    next: ReviewAction,
    options: {
      threadId?: string;
      conflictId?: string;
      responseRevisionId?: string;
    },
  ) => setAction({ action: next, ...options });
  function threadsFor(submissionId?: string) {
    return d.threads
      .filter(
        (thread) => !submissionId || thread.responseRevisionId === submissionId,
      )
      .map((thread) => (
        <ClarificationThread
          key={thread.id}
          thread={thread}
          data={d}
          onAction={openThreadAction}
          showTarget={!submissionId}
        />
      ));
  }
  const timeline = buildTimeline(d).map((event) => ({
    ...event,
    date: dateText(event.at),
    dateTime: event.at,
  }));
  const currentDecisions = d.validations.filter((v) => !v.invalidatedAt);
  const historicalDecisions = d.validations.filter((v) => v.invalidatedAt);
  const currentDispositions = d.dispositions.filter((n) => !n.revokedAt);
  const historicalDispositions = d.dispositions.filter((n) => n.revokedAt);
  const reopen = () => setAction({ action: "reopenQuestion" });
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
          {
            value: "contrast",
            label: "Contraste",
            // UX-06: the conflict is visible from any tab, not only inside it.
            ...(openConflict && {
              indicator: (
                <span className="ac-tab-indicator" title="Conflicto abierto">
                  <ParticipantIcon name="flag" />
                </span>
              ),
              description: "Conflicto abierto",
            }),
          },
          { value: "decision", label: "Decisión" },
          { value: "history", label: "Historial" },
        ].filter((item) => available[item.value as TabKey])}
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
          openId={searchParams.get("aportacion") ?? undefined}
          renderActions={(submissionId) => {
            const submission = d.submissions.find((s) => s.id === submissionId);
            const asking = d.threads.some(
              (t) =>
                t.responseRevisionId === submissionId && t.status !== "CLOSED",
            );
            if (!submission?.current) return undefined;
            return (
              <>
                {d.canReview && !asking && (
                  <Button
                    tone="secondary"
                    aria-label={`Pedir aclaración a ${submission.respondent.displayName}`}
                    onClick={() =>
                      setAction({
                        action: "requestClarification",
                        responseRevisionId: submissionId,
                      })
                    }
                  >
                    Pedir aclaración
                  </Button>
                )}
                {current.length >= 2 && (
                  <Button
                    tone="secondary"
                    aria-label={`Contrastar la aportación de ${submission.respondent.displayName} con otra`}
                    onClick={() => {
                      setCompareFrom(submissionId);
                      setFreeComparisonOpen(true);
                      focusOnTab.current = "contrast";
                      changeTab("contrast");
                    }}
                  >
                    Contrastar con otra
                  </Button>
                )}
              </>
            );
          }}
          onCompare={() => {
            setCompareFrom(undefined);
            setFreeComparisonOpen(true);
            focusOnTab.current = "contrast";
            changeTab("contrast");
          }}
        />
        {participants}
      </TabPanel>
      {available.contrast && (
        <TabPanel id="review-tabs" value="contrast" active={tab === "contrast"}>
          <ReviewContrast
            compareFrom={compareFrom}
            data={d}
            headingRef={contrastHeading}
            onBack={() => {
              focusOnTab.current = "contributions";
              changeTab("contributions");
            }}
            freeOpen={freeComparisonOpen}
            setFreeOpen={setFreeComparisonOpen}
            onAction={openThreadAction}
          />
        </TabPanel>
      )}
      {available.decision && (
        <TabPanel id="review-tabs" value="decision" active={tab === "decision"}>
          <div
            className={`ac-decision-layout${timeline.length ? " ac-decision-layout-with-aside" : ""}`}
          >
            <div className="ac-decision-main">
              {currentDecisions.map((v) => (
                <DecisionRecord
                  key={v.id}
                  data={d}
                  validation={v}
                  onReopen={d.canReview ? reopen : undefined}
                  onOpenContribution={(submissionId) => {
                    focusOnTab.current = "pane";
                    changeTab("contributions", submissionId);
                  }}
                />
              ))}
              {d.status === "NOT_APPLICABLE" &&
                currentDispositions.map((n) => (
                  <DispositionRecord key={n.id} disposition={n} />
                ))}
              {d.canReview &&
                d.status === "NOT_APPLICABLE" &&
                currentDispositions.length > 0 && (
                  <Button tone="tertiary" onClick={reopen}>
                    Reabrir pregunta
                  </Button>
                )}
              {!d.validations.length && d.status !== "NOT_APPLICABLE" && (
                <p>No hay decisiones registradas.</p>
              )}
              {(historicalDecisions.length > 0 ||
                (d.status === "NOT_APPLICABLE" &&
                  historicalDispositions.length > 0)) && (
                <details className="ac-decision-history">
                  <summary>
                    Decisiones históricas (
                    {historicalDecisions.length +
                      (d.status === "NOT_APPLICABLE"
                        ? historicalDispositions.length
                        : 0)}
                    )
                  </summary>
                  {historicalDecisions.map((v) => (
                    <DecisionRecord key={v.id} data={d} validation={v} />
                  ))}
                  {d.status === "NOT_APPLICABLE" &&
                    historicalDispositions.map((n) => (
                      <DispositionRecord key={n.id} disposition={n} />
                    ))}
                </details>
              )}
            </div>
            {timeline.length > 0 && (
              <aside className="ac-decision-aside">
                <h2>Cómo se llegó aquí</h2>
                <Timeline
                  label="Cómo se llegó a esta decisión"
                  events={timeline}
                />
              </aside>
            )}
          </div>
        </TabPanel>
      )}
      {available.history && (
        <TabPanel id="review-tabs" value="history" active={tab === "history"}>
          <h2>Historial de la pregunta</h2>
          {timeline.length > 0 && (
            <section className="ac-history-timeline">
              <Timeline label="Cronología de la pregunta" events={timeline} />
            </section>
          )}
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
                <DispositionRecord key={n.id} disposition={n} />
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
      )}
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
