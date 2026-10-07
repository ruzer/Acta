import type { QuestionView } from "@requirements/contracts";

/** View state only. Kept in the authenticated query cache, never persisted. */
export type OrganizeContext = {
  topic: string;
  search: string;
  publication: string;
  area: string;
  approach: "prepare" | "analyze";
  page: number;
  collapsed: string[];
  selectedIds: string[];
};

export function questionAncestors(
  question: QuestionView,
  byId: ReadonlyMap<string, QuestionView>,
): QuestionView[] {
  const parents: QuestionView[] = [];
  const seen = new Set([question.id]);
  let id = question.groupParentId;
  while (id && !seen.has(id)) {
    seen.add(id);
    const parent = byId.get(id);
    if (!parent) break;
    parents.unshift(parent);
    id = parent.groupParentId;
  }
  return parents;
}

/** Collapse changes visibility only, never filter membership or selection. */
export function unfoldedQuestions(
  questions: QuestionView[],
  byId: ReadonlyMap<string, QuestionView>,
  collapsed: ReadonlySet<string>,
  searching: boolean,
) {
  const matchingIds = new Set(questions.map((q) => q.id));
  return searching
    ? questions
    : questions.filter(
        (q) =>
          !questionAncestors(q, byId).some(
            (p) => collapsed.has(p.id) && matchingIds.has(p.id),
          ),
      );
}
