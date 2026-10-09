import type { Ref } from "react";
import type { ReviewDetail } from "@requirements/contracts";
import { Button } from "../ui";
import { ParticipantIcon } from "./ParticipantIcon";
import { StatusChip } from "../ui/semantic";
import { actionLabels } from "./ReviewActions";
import {
  ContributionComparison,
  type ComparedPair,
} from "./ContributionComparison";
import { dateText } from "./ReviewShared";
import type { ThreadOpen } from "./ReviewThreads";

type Conflict = ReviewDetail["conflicts"][number];

function ConflictBand({
  conflict: c,
  data,
}: {
  conflict: Conflict;
  data: ReviewDetail;
}) {
  const open = c.status === "OPEN";
  return (
    <div
      className={`ac-conflict-band${open ? "" : " ac-conflict-band-resolved"}`}
    >
      <p className="ac-conflict-title">
        <ParticipantIcon name={open ? "flag" : "check"} />
        <strong>{open ? "Conflicto abierto" : "Conflicto resuelto"}</strong>
        <span>
          Registrado por {c.openedBy.displayName} · {dateText(c.openedAt)}
        </span>
      </p>
      <p>{c.reason}</p>
      {c.resolution && (
        <>
          <p>
            <strong>Resolución: </strong>
            {c.resolution.resolutionText}
          </p>
          <p className="hint">
            {c.resolution.resolvedBy.displayName} ·{" "}
            {dateText(c.resolution.resolvedAt)} · Fuentes:{" "}
            {c.resolution.sources
              .map((source) => {
                const s = data.submissions.find(
                  (s) => s.id === source.responseRevisionId,
                );
                return `${s?.respondent.displayName} #${s?.number}`;
              })
              .join(", ")}
          </p>
        </>
      )}
    </div>
  );
}

/**
 * Contraste: one heading, the conflict (if any) as a band, one comparison table
 * and, under it, the actions that are about the pair being compared.
 */
export function ReviewContrast({
  data: d,
  headingRef,
  onBack,
  freeOpen,
  setFreeOpen,
  onAction,
  compareFrom,
}: {
  data: ReviewDetail;
  headingRef: Ref<HTMLHeadingElement>;
  onBack: () => void;
  freeOpen: boolean;
  setFreeOpen: (open: boolean) => void;
  onAction: ThreadOpen;
  /** Contribution a "Contrastar con otra" started from; it opens as posture A. */
  compareFrom?: string;
}) {
  const current = d.submissions.filter((s) => s.current);
  const open = d.conflicts.filter((c) => c.status === "OPEN");
  const resolved = d.conflicts.filter((c) => c.status !== "OPEN");
  // Comparing never depends on conflicts: offer every current pair unless one
  // conflict comparison already lets the analyst pick among all of them.
  const conflictCoversCurrent = d.conflicts.some((c) =>
    current.every((s) =>
      c.participants.some((p) => p.responseRevisionId === s.id),
    ),
  );
  function askAbout(pair: ComparedPair) {
    if (!d.canReview) return null;
    return (["a", "b"] as const).map((side) => {
      const s = pair[side];
      if (!s) return null;
      const letter = side.toUpperCase();
      const thread = d.threads.find(
        (t) => t.responseRevisionId === s.id && t.status !== "CLOSED",
      );
      if (thread?.status === "WAITING_STAKEHOLDER")
        return (
          <StatusChip key={side} tone="warning" icon="help">
            Aclaración abierta con {letter}
          </StatusChip>
        );
      const again = thread?.status === "WAITING_ANALYST";
      return (
        <Button
          key={side}
          tone="secondary"
          aria-label={`${again ? "Preguntar nuevamente a" : "Pedir aclaración a"} ${letter} · ${s.respondent.displayName}`}
          onClick={() =>
            onAction("requestClarification", {
              responseRevisionId: s.id,
              threadId: again ? thread.id : undefined,
            })
          }
        >
          {again ? "Preguntar nuevamente a" : "Pedir aclaración a"} {letter}
        </Button>
      );
    });
  }
  const bar = (conflict?: Conflict) => (pair: ComparedPair) => (
    <div className="ac-compare-actions">
      <p>
        {conflict
          ? "Resolver este conflicto no valida la pregunta. La decisión se registra por separado."
          : "Comparar no registra un conflicto ni una decisión."}
      </p>
      {d.canReview && (
        <div>
          {askAbout(pair)}
          {conflict ? (
            <Button
              tone="secondary"
              onClick={() =>
                onAction("resolveConflict", { conflictId: conflict.id })
              }
            >
              {actionLabels.resolveConflict}
            </Button>
          ) : (
            <Button
              tone="secondary"
              onClick={() => onAction("markConflict", {})}
            >
              {actionLabels.markConflict}
            </Button>
          )}
        </div>
      )}
    </div>
  );
  return (
    <>
      <div className="ac-contrast-heading">
        <h2 ref={headingRef} tabIndex={-1}>
          Contrastar aportaciones
        </h2>
        <Button tone="secondary" onClick={onBack}>
          ← Volver a {current.length} aportaciones
        </Button>
      </div>
      {open.map((c) => (
        <section key={c.id} className="ac-contrast-block">
          <ConflictBand conflict={c} data={d} />
          <ContributionComparison
            key={compareFrom ?? "none"}
            initialA={compareFrom}
            data={d}
            revisionIds={c.participants.map((p) => p.responseRevisionId)}
            labelSuffix={
              d.conflicts.length > 1
                ? ` (conflicto de ${dateText(c.openedAt)})`
                : ""
            }
            footer={bar(c)}
          />
        </section>
      ))}
      {resolved.map((c) => (
        <details key={c.id} className="ac-contrast-resolved">
          <summary>
            Conflicto resuelto ·{" "}
            {dateText(c.resolution?.resolvedAt ?? c.openedAt)}
          </summary>
          <ConflictBand conflict={c} data={d} />
          <ContributionComparison
            data={d}
            revisionIds={c.participants.map((p) => p.responseRevisionId)}
            labelSuffix={` (conflicto resuelto de ${dateText(c.openedAt)})`}
          />
        </details>
      ))}
      {current.length < 2 ? (
        d.conflicts.length === 0 && (
          <p>Se necesitan al menos dos aportaciones para comparar.</p>
        )
      ) : d.conflicts.length === 0 ? (
        <ContributionComparison
          key={compareFrom ?? "none"}
          initialA={compareFrom}
          data={d}
          footer={bar()}
        />
      ) : (
        !conflictCoversCurrent && (
          <details
            className="ac-free-comparison"
            open={freeOpen}
            onToggle={(event) => setFreeOpen(event.currentTarget.open)}
          >
            <summary>
              Comparar otras aportaciones vigentes ({current.length})
            </summary>
            <ContributionComparison
              key={compareFrom ?? "none"}
              initialA={compareFrom}
              data={d}
              labelSuffix=" (comparación libre)"
              footer={bar()}
            />
          </details>
        )
      )}
    </>
  );
}
