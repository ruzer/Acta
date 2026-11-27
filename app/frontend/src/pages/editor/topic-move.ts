import type { QuestionnaireView, QuestionView } from "@requirements/contracts";

// Match the server's grouping tree, including archived and nested descendants.
// Conditions of display do not establish membership in this family.
export function questionTopicMove(
  data: QuestionnaireView,
  question: QuestionView,
) {
  const byId = new Map(data.questions.map((q) => [q.id, q]));
  let root = question;
  const ancestors = new Set<string>();
  while (root.groupParentId) {
    if (ancestors.has(root.id))
      return {
        family: [],
        reason: "El grupo de preguntas contiene un ciclo.",
        notice: "",
      };
    ancestors.add(root.id);
    const parent = byId.get(root.groupParentId);
    if (!parent)
      return {
        family: [],
        reason: "No se encontró la pregunta principal del grupo.",
        notice: "",
      };
    root = parent;
  }
  const family: QuestionView[] = [];
  const pending = [root];
  const seen = new Set<string>();
  while (pending.length) {
    const next = pending.pop()!;
    if (seen.has(next.id))
      return {
        family: [],
        reason: "El grupo de preguntas contiene un ciclo.",
        notice: "",
      };
    seen.add(next.id);
    family.push(next);
    pending.push(...data.questions.filter((q) => q.groupParentId === next.id));
  }
  family.sort((a, b) => a.order - b.order);
  const blocked = family.find((q) => q.publication !== "DRAFT");
  const reason = blocked
    ? `No se puede cambiar de tema: «${blocked.title}» (${blocked.externalId}) no está en borrador.`
    : "";
  const followers = family.filter((q) => q.id !== root.id);
  const names = followers.map((q) => `«${q.title}»`).join(", ");
  const notice = followers.length
    ? question.id === root.id
      ? `Se moverá con sus ${followers.length} seguimientos: ${names}.`
      : `Se moverá con su pregunta principal «${root.title}» y sus ${followers.length} seguimientos: ${names}.`
    : "";
  return { family, reason, notice };
}
export const simultaneousTopicAndGroupReason =
  "Cambia primero el tema o el vínculo de seguimiento; guarda un cambio antes de hacer el otro.";
