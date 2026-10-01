import { type QuestionView, type ResponseContent } from "@requirements/contracts";
export type SimulatedAnswers = Record<string, ResponseContent["answer"]>;
export function applicability(
  id: string,
  questions: QuestionView[],
  answers: SimulatedAnswers,
  seen = new Set<string>(),
): "ENABLED" | "DISABLED" | "UNDETERMINED" {
  if (seen.has(id)) return "UNDETERMINED";
  seen.add(id);
  const q = questions.find((q) => q.id === id);
  if (!q) return "UNDETERMINED";
  const c = q.condition;
  if (!c) return "ENABLED";
  const parent = applicability(c.parentQuestionId, questions, answers, seen);
  if (parent !== "ENABLED") return parent;
  if (!Object.hasOwn(answers, c.parentQuestionId)) return "UNDETERMINED";
  const value = answers[c.parentQuestionId];
  const matches =
    c.operator === "CONTAINS"
      ? Array.isArray(value) && value.includes(String(c.value))
      : value === c.value;
  return (c.operator === "NOT_EQUALS" ? !matches : matches)
    ? "ENABLED"
    : "DISABLED";
}
export function applySimulation(
  id: string,
  answer: ResponseContent["answer"],
  questions: QuestionView[],
  answers: SimulatedAnswers,
): SimulatedAnswers {
  const next = { ...answers, [id]: answer };
  const descendants = new Set([id]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const q of questions)
      if (
        q.condition &&
        descendants.has(q.condition.parentQuestionId) &&
        !descendants.has(q.id)
      ) {
        descendants.add(q.id);
        delete next[q.id];
        changed = true;
      }
  }
  return next;
}
