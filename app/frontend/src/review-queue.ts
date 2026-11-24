import { z } from "zod";
import { reviewInboxQuery, type ReviewInbox } from "@requirements/contracts";
import { presentationKey } from "./session-presentation";

const itemSchema = z.strictObject({ id: z.uuid(), projectId: z.uuid() });
const queueSchema = z.strictObject({
  search: z.string().max(4096),
  capturedAt: z.iso.datetime(),
  items: z.array(itemSchema),
});
export type ReviewQueue = z.infer<typeof queueSchema>;
export type QueueItem = z.infer<typeof itemSchema>;
type FetchPage = (
  input: z.input<typeof reviewInboxQuery>,
) => Promise<ReviewInbox>;
const changed = () =>
  new Error(
    "La lista cambió mientras se preparaba. Vuelve a la bandeja y abre la pregunta de nuevo.",
  );

/** Captura el orden del servidor una vez; las decisiones no eliminan posiciones. */
export async function loadReviewQueue(
  search: string,
  fetchPage: FetchPage,
  signal?: AbortSignal,
): Promise<ReviewQueue> {
  const parsed = reviewInboxQuery.safeParse(
    Object.fromEntries(new URLSearchParams(search)),
  );
  if (!parsed.success || search.length > 4096)
    throw new Error("No se pudieron recuperar los filtros de la lista.");
  const items: QueueItem[] = [];
  const seen = new Set<string>();
  let total: number | undefined;
  for (let page = 1; ; page++) {
    signal?.throwIfAborted();
    const result = await fetchPage({ ...parsed.data, page, pageSize: 100 });
    signal?.throwIfAborted();
    total ??= result.total;
    if (
      result.total !== total ||
      total < 0 ||
      result.page !== page ||
      result.pageSize !== 100 ||
      result.items.length !== Math.min(100, total - items.length)
    )
      throw changed();
    for (const item of result.items) {
      if (
        seen.has(item.questionId) ||
        (parsed.data.projectId && item.projectId !== parsed.data.projectId)
      )
        throw changed();
      seen.add(item.questionId);
      items.push({ id: item.questionId, projectId: item.projectId });
    }
    if (items.length === total) break;
  }
  return { search, capturedAt: new Date().toISOString(), items };
}
export function queuePosition(
  queue: ReviewQueue,
  projectId: string,
  id: string,
) {
  const index = queue.items.findIndex(
    (item) => item.id === id && item.projectId === projectId,
  );
  if (index < 0) return null;
  return {
    index,
    total: queue.items.length,
    previous: queue.items[index - 1] ?? null,
    next: queue.items[index + 1] ?? null,
  };
}
function key(userId: string, token: string) {
  return presentationKey(userId, "review", `queue:${token}`);
}
export function storeReviewQueue(
  userId: string,
  token: string,
  queue: ReviewQueue,
) {
  if (!userId) return false;
  try {
    sessionStorage.setItem(key(userId, token), JSON.stringify(queue));
    return true;
  } catch {
    return false;
  }
}
export function readReviewQueue(
  userId: string,
  token: string,
): ReviewQueue | null {
  if (!userId) return null;
  try {
    const result = queueSchema.safeParse(
      JSON.parse(sessionStorage.getItem(key(userId, token)) ?? "null"),
    );
    return result.success &&
      reviewInboxQuery.safeParse(
        Object.fromEntries(new URLSearchParams(result.data.search)),
      ).success
      ? result.data
      : null;
  } catch {
    return null;
  }
}

export function queuePath(item: QueueItem, token: string, search: string) {
  const params = new URLSearchParams({
    reviewQueue: token,
    reviewSearch: search,
  });
  return `/projects/${item.projectId}/review/${item.id}?${params}`;
}
