import type { QuestionnaireView, QuestionView } from "@requirements/contracts";
import { readiness } from "./readiness";

export type InspectorAction = "edit" | "publish" | "assign" | "responses";
export function inspectorActions(
  data: QuestionnaireView,
  question: QuestionView,
) {
  if (question.publication === "ARCHIVED")
    return { primary: null, secondary: [], pending: [] } as const;
  if (question.publication === "PUBLISHED")
    return {
      primary: "responses",
      secondary: ["assign"],
      pending: [],
    } as const;
  const pending = readiness(data).filter(
    (issue) =>
      issue.questionId === question.id &&
      (issue.level === "ERROR" ||
        (issue.level === "ADVERTENCIA" && !!issue.targetId)),
  );
  return pending.length
    ? ({ primary: "edit", secondary: ["assign"], pending } as const)
    : ({ primary: "publish", secondary: ["edit", "assign"], pending } as const);
}
