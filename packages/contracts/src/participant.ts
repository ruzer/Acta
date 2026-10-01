import type { PersonalProjectView } from "./index.js";
export type PersonalQuestion =
  PersonalProjectView["sections"][number]["questions"][number];
export type ParticipantState =
  | "clarification"
  | "draft"
  | "consultation"
  | "pending"
  | "sent"
  | "review"
  | "validated"
  | "notApplicable";
// Presentation/queue policy only. Mutations remain authorized by the backend.
export function participantState(q: PersonalQuestion): ParticipantState {
  if (q.reviewStatus === "NOT_APPLICABLE") return "notApplicable";
  if (q.clarificationWaiting > 0) return "clarification";
  if (q.reviewStatus === "VALIDATED") return "validated";
  if (q.hasSubmission || q.currentSubmission || q.state === "SENT")
    return q.reviewStatus === "CONFLICT" ||
      q.reviewStatus === "CLARIFICATION_REQUIRED"
      ? "review"
      : "sent";
  if (q.state === "CONSULTATION") return "consultation";
  if (q.state === "DRAFT") return "draft";
  return "pending";
}
export function participantPriority(q: PersonalQuestion): number {
  const state = participantState(q);
  // A requested clarification concerns an existing submission, even if its
  // condition is no longer enabled. The reply endpoint rechecks authorization.
  if (state === "clarification") return 0;
  if (q.applicability !== "ENABLED") return Infinity;
  return state === "draft"
    ? 1
    : state === "consultation"
      ? 2
      : state === "pending"
        ? 3
        : Infinity;
}
export function participantStart(
  items: PersonalQuestion[],
): PersonalQuestion | undefined {
  return items.reduce<PersonalQuestion | undefined>(
    (best, q) =>
      participantPriority(q) < (best ? participantPriority(best) : Infinity)
        ? q
        : best,
    undefined,
  );
}
export function participantNext(
  items: PersonalQuestion[],
  currentId: string,
): PersonalQuestion | undefined {
  // Locate the ID in the complete documentary sequence, never in a shrinking queue.
  const position = items.findIndex((q) => q.id === currentId);
  return position < 0
    ? undefined
    : items
        .slice(position + 1)
        .find((q) => Number.isFinite(participantPriority(q)));
}
