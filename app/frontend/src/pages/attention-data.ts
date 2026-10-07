import {
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import type { z } from "zod";
import type { dashboardView, ReviewInbox } from "@requirements/contracts";
import { api } from "../api";

export type AttentionDashboard = z.infer<typeof dashboardView>;
export type AttentionTask = "conflicts" | "clarifications" | "ready";

async function allReviewItems(
  projectId: string,
): Promise<ReviewInbox["items"]> {
  const first = await api(
    "listReviewInbox",
    {},
    { projectId, page: 1, pageSize: 100 },
  );
  const items = new Map(first.items.map((row) => [row.questionId, row]));
  for (let page = 2; page <= Math.ceil(first.total / first.pageSize); page++) {
    const next = await api(
      "listReviewInbox",
      {},
      { projectId, page, pageSize: 100 },
    );
    if (next.total !== first.total)
      throw new Error(
        "Las preguntas cambiaron durante la consulta. Actualiza las aclaraciones.",
      );
    for (const row of next.items) items.set(row.questionId, row);
  }
  if (items.size !== first.total)
    throw new Error(
      "No se pudo completar la consulta de aclaraciones. Inténtalo nuevamente.",
    );
  return [...items.values()];
}

export async function loadClarificationQuestionIds(
  client: QueryClient,
  projectId: string,
  data: AttentionDashboard,
  lifecycle: "ACTIVE" | "ARCHIVED",
): Promise<string[]> {
  if (!data.questions.length) return [];
  if (data.role === "ANALYST" && lifecycle === "ACTIVE") {
    const questions = new Set(data.questions.map((q) => q.id));
    return (await allReviewItems(projectId))
      .filter((q) => questions.has(q.questionId) && q.openClarifications > 0)
      .map((q) => q.questionId);
  }
  // The inbox is restricted to active analyst memberships. ADMIN and archived
  // projects can read details; only CONFLICT can mask open clarifications in
  // the canonical projected status. Bound those reads and share the detail cache.
  const ids = data.questions
    .filter((q) => q.status === "CLARIFICATION_REQUIRED")
    .map((q) => q.id);
  const conflicts = data.questions.filter((q) => q.status === "CONFLICT");
  let cursor = 0;
  await Promise.all(
    Array.from({ length: Math.min(4, conflicts.length) }, async () => {
      while (cursor < conflicts.length) {
        const question = conflicts[cursor++]!;
        const detail = await client.fetchQuery({
          queryKey: ["review", projectId, question.id],
          queryFn: () => api("getReviewDetail", { projectId, id: question.id }),
          staleTime: 0,
        });
        if (detail.threads.some((t) => t.status !== "CLOSED"))
          ids.push(question.id);
      }
    }),
  );
  return ids;
}

export function useAttentionClarifications(
  projectId: string,
  data: AttentionDashboard,
  lifecycle: "ACTIVE" | "ARCHIVED",
) {
  const client = useQueryClient();
  return useQuery({
    // Review commands already invalidate this prefix as well as detail queries.
    queryKey: [
      "review-inbox",
      "attention",
      projectId,
      data.role,
      lifecycle,
      data.questions.map((q) => [q.id, q.status]),
    ],
    queryFn: () =>
      loadClarificationQuestionIds(client, projectId, data, lifecycle),
    staleTime: 0,
  });
}

export function attentionTask(value: string | null): AttentionTask | null {
  return value === "conflicts" ||
    value === "clarifications" ||
    value === "ready"
    ? value
    : null;
}

export function attentionQuestions(
  questions: AttentionDashboard["questions"],
  task: AttentionTask | null,
  status: string,
  clarificationIds: readonly string[],
) {
  const clarifications = new Set(clarificationIds);
  return questions.filter(
    (q) =>
      (!status || q.status === status) &&
      (!task ||
        (task === "conflicts"
          ? q.status === "CONFLICT"
          : task === "ready"
            ? q.status === "ANSWERED"
            : clarifications.has(q.id))),
  );
}
