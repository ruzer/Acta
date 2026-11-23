import type { PersonalQuestion } from "@requirements/contracts";

/** Misma base que Participación: asignadas, aplicables y sin decisión No aplica. */
export function activeParticipantQuestions(items: PersonalQuestion[]) {
  return items.filter(
    (q) => q.applicability === "ENABLED" && q.reviewStatus !== "NOT_APPLICABLE",
  );
}
export function participantProgress(items: PersonalQuestion[]) {
  const active = activeParticipantQuestions(items);
  const drafts = active.filter(
    (q) => q.state === "DRAFT" || q.state === "CONSULTATION",
  );
  return {
    total: active.length,
    sent: active.filter((q) => q.currentSubmission).length,
    // Segmentos disjuntos: un borrador sobre un envío se explica aparte.
    drafts: drafts.filter((q) => !q.currentSubmission).length,
    overlappingDrafts: drafts.filter((q) => q.currentSubmission).length,
    notApplicable: items.filter((q) => q.reviewStatus === "NOT_APPLICABLE")
      .length,
  };
}
