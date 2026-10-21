import type { QuestionView } from "@requirements/contracts";
/** Structural grouping only. A condition never selects its related question. */
export function questionGroup(questions: QuestionView[], rootId: string) {
  const children = new Map<string, string[]>();
  for (const q of questions)
    if (q.groupParentId)
      children.set(q.groupParentId, [
        ...(children.get(q.groupParentId) ?? []),
        q.id,
      ]);
  const ids = new Set([rootId]),
    queue = [rootId];
  for (let i = 0; i < queue.length; i++)
    for (const id of children.get(queue[i]!) ?? [])
      if (!ids.has(id)) {
        ids.add(id);
        queue.push(id);
      }
  return questions.filter((q) => ids.has(q.id) && q.publication !== "ARCHIVED");
}
