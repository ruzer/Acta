import { reviewInboxQuery } from "@requirements/contracts";
import { presentationKey } from "./session-presentation";

const keys = [
  "projectId",
  "status",
  "sectionId",
  "areaId",
  "participantId",
  "priority",
  "page",
  "pageSize",
];

export function cleanReviewSearch(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 4096) return null;
  const source = new URLSearchParams(value);
  const params = new URLSearchParams();
  for (const key of keys) {
    const value = source.get(key);
    if (value !== null) params.set(key, value);
  }
  return reviewInboxQuery.safeParse(Object.fromEntries(params)).success
    ? params.toString()
    : null;
}

export function rememberReviewSearch(userId: string, value: string) {
  const clean = cleanReviewSearch(value);
  if (!userId || clean === null) return;
  try {
    sessionStorage.setItem(presentationKey(userId, "review", "filters"), clean);
  } catch {
    /* URL remains usable when browser storage is unavailable. */
  }
}

export function reviewReturnSearch(
  userId: string,
  projectId: string,
  url: unknown,
  state: unknown,
) {
  let saved: string | null = null;
  try {
    if (userId)
      saved = sessionStorage.getItem(
        presentationKey(userId, "review", "filters"),
      );
  } catch {
    /* No request is needed to recover the navigation context. */
  }
  for (const candidate of [url, state, saved]) {
    const clean = cleanReviewSearch(candidate);
    if (clean === null) continue;
    const project = new URLSearchParams(clean).get("projectId");
    if (!project || project === projectId) return clean;
  }
  return new URLSearchParams({ projectId }).toString();
}
