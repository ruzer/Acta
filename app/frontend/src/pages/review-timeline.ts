import type { ReviewDetail } from "@requirements/contracts";

export type TimelineEvent = {
  id: string;
  at: string;
  icon: "send" | "help" | "chat" | "check" | "flag" | "edit";
  tone?: "danger" | "warning" | "success";
  actor: string;
  text: string;
};

/**
 * Presentation only (DEV-11): a chronological reading of what the review
 * detail already carries. There is no per-question history endpoint, so
 * nothing is inferred beyond the dated records the server returned for the
 * viewer's role (a VIEWER only gets the sources of a decision).
 */
export function buildTimeline(d: ReviewDetail): TimelineEvent[] {
  const events: TimelineEvent[] = [];
  const respondentOf = (revisionId: string) =>
    d.submissions.find((s) => s.id === revisionId)?.respondent.displayName ??
    "la persona";
  for (const s of d.submissions)
    events.push({
      id: `submission-${s.id}`,
      at: s.createdAt,
      icon: "send",
      actor: s.respondent.displayName,
      text:
        s.number > 1
          ? `envió una nueva versión (envío #${s.number}).`
          : "envió su aportación.",
    });
  for (const thread of d.threads) {
    const target = respondentOf(thread.responseRevisionId);
    thread.messages.forEach((m, index) => {
      const answered = m.author.id === thread.respondentId;
      events.push({
        id: `message-${m.id}`,
        at: m.createdAt,
        icon: answered ? "chat" : "help",
        tone: answered ? undefined : "warning",
        actor: m.author.displayName,
        text: answered
          ? "respondió la aclaración."
          : index === 0
            ? `pidió una aclaración a ${target}.`
            : `volvió a preguntar a ${target}.`,
      });
    });
    if (thread.closedAt && thread.closedBy)
      events.push({
        id: `thread-closed-${thread.id}`,
        at: thread.closedAt,
        icon: "check",
        actor: thread.closedBy.displayName,
        text: "cerró la aclaración.",
      });
  }
  for (const c of d.conflicts) {
    events.push({
      id: `conflict-${c.id}`,
      at: c.openedAt,
      icon: "flag",
      tone: "danger",
      actor: c.openedBy.displayName,
      text: "registró un conflicto entre aportaciones.",
    });
    if (c.resolution)
      events.push({
        id: `conflict-resolved-${c.id}`,
        at: c.resolution.resolvedAt,
        icon: "check",
        actor: c.resolution.resolvedBy.displayName,
        text: "resolvió el conflicto (no valida la pregunta).",
      });
  }
  for (const v of d.validations) {
    events.push({
      id: `validation-${v.id}`,
      at: v.validatedAt,
      icon: "check",
      tone: "success",
      actor: v.validatedBy.displayName,
      text: "registró la decisión.",
    });
    if (v.invalidatedAt)
      events.push({
        id: `validation-reopened-${v.id}`,
        at: v.invalidatedAt,
        icon: "edit",
        actor: v.invalidatedBy?.displayName ?? "El equipo analista",
        text: "volvió la pregunta a revisión.",
      });
  }
  for (const n of d.dispositions) {
    events.push({
      id: `disposition-${n.id}`,
      at: n.markedAt,
      icon: "check",
      actor: n.markedBy.displayName,
      text: "marcó la pregunta como No aplica.",
    });
    if (n.revokedAt)
      events.push({
        id: `disposition-reopened-${n.id}`,
        at: n.revokedAt,
        icon: "edit",
        actor: n.revokedBy?.displayName ?? "El equipo analista",
        text: "reabrió la pregunta.",
      });
  }
  // Stable for equal instants: records keep the order they were collected in.
  return events
    .map((event, index) => ({ event, index }))
    .sort(
      (a, b) =>
        Date.parse(a.event.at) - Date.parse(b.event.at) || a.index - b.index,
    )
    .map(({ event }) => event);
}
