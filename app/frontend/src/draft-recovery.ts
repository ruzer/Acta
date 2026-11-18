import { z } from "zod";
import type { ResponseContent } from "@requirements/contracts";

const prefix = "acta-draft:";
const text = z.strictObject({
  answer: z.string().max(10000).optional(),
  comment: z.string().max(10000),
  example: z.string().max(10000),
});
export type DraftText = z.infer<typeof text>;
export function draftKey(
  userId: string,
  projectId: string,
  questionId: string,
) {
  return `${prefix}${userId}:${projectId}:${questionId}`;
}
export function draftText(type: string, content: ResponseContent): DraftText {
  return {
    ...(["SHORT_TEXT", "LONG_TEXT"].includes(type) &&
    typeof content.answer === "string"
      ? { answer: content.answer }
      : {}),
    comment: content.comment,
    example: content.example,
  };
}
export function readDraftText(key: string): DraftText | null {
  try {
    const parsed = text.safeParse(
      JSON.parse(sessionStorage.getItem(key) ?? "null"),
    );
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
export function writeDraftText(key: string, value: DraftText) {
  try {
    sessionStorage.setItem(key, JSON.stringify(text.parse(value)));
    return true;
  } catch {
    return false;
  }
}
export function removeDraftText(key: string) {
  try {
    sessionStorage.removeItem(key);
  } catch {
    /* The tab may forbid storage. */
  }
}
export function clearDraftTexts(keepUserId?: string) {
  try {
    for (const key of Object.keys(sessionStorage)) {
      if (
        key.startsWith(prefix) &&
        (!keepUserId || !key.startsWith(`${prefix}${keepUserId}:`))
      )
        sessionStorage.removeItem(key);
    }
  } catch {
    /* The tab may forbid storage. */
  }
}
