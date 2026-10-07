import { useEffect } from "react";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useLocation } from "react-router-dom";

export type WorkbenchView =
  "attention" | "questionnaire" | "decisions" | "invitations";
const paths: Record<WorkbenchView, string> = {
  attention: "dashboard",
  questionnaire: "editor",
  decisions: "decisions",
  invitations: "invitations",
};
type Context = {
  search: string;
  scroll: number;
  focusId?: string;
  focusLabel?: string;
};
const key = (projectId: string, view: WorkbenchView) => [
  "workbench-context",
  projectId,
  view,
];
export function workbenchPath(
  projectId: string,
  view: WorkbenchView,
  search = "",
) {
  const params = new URLSearchParams(search).toString();
  return `/projects/${projectId}/${paths[view]}${params ? `?${params}` : ""}`;
}
export function rememberWorkbenchItem(
  client: QueryClient,
  projectId: string,
  view: WorkbenchView,
  id: string,
) {
  const active = document.activeElement;
  client.setQueryData<Context>(key(projectId, view), (old) => ({
    search: old?.search ?? "",
    scroll: window.scrollY,
    focusId: id,
    focusLabel:
      active?.getAttribute("aria-label") ?? active?.textContent ?? undefined,
  }));
}

/** Session-only presentation state. It contains no answers or invitation URLs. */
export function useWorkbenchContext(projectId: string, view?: WorkbenchView) {
  const client = useQueryClient();
  const location = useLocation();
  const isList = !!view && location.pathname === workbenchPath(projectId, view);
  useEffect(() => {
    if (!isList || !view) return;
    client.setQueryData<Context>(key(projectId, view), (old) => ({
      ...old,
      search: location.search,
      scroll: old?.scroll ?? 0,
    }));
  }, [client, projectId, view, isList, location.search]);
  useEffect(() => {
    // Compact navigation on a detail must never replace its source-list context.
    if (!isList || !view) return;
    const contextKey = key(projectId, view);
    const saved = client.getQueryData<Context>(contextKey);
    let ready = false;
    let frame = 0;
    const firstFrame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => {
        if (saved?.focusId) {
          const items = Array.from(
            document.querySelectorAll<HTMLElement>(
              "[data-workbench-id], [data-question-id]",
            ),
          );
          const row = items.find(
            (el) => el.dataset.questionId === saved.focusId,
          );
          const candidates = items.filter(
            (el) => el.dataset.workbenchId === saved.focusId,
          );
          if (row)
            candidates.push(
              ...row.querySelectorAll<HTMLElement>("button, a, input, summary"),
            );
          const target =
            candidates.find(
              (el) =>
                (el.getAttribute("aria-label") ?? el.textContent) ===
                saved.focusLabel,
            ) ??
            candidates[0] ??
            row;
          if (target?.getClientRects().length)
            target.focus({ preventScroll: true });
          else {
            const heading = document.querySelector<HTMLElement>("main h1");
            heading?.setAttribute("tabindex", "-1");
            heading?.focus({ preventScroll: true });
          }
        }
        if (saved && saved.scroll !== window.scrollY)
          window.scrollTo(0, saved.scroll);
        ready = true;
      });
    });
    const remember = () => {
      if (!ready) return;
      client.setQueryData<Context>(contextKey, (old) => ({
        ...old,
        search: old?.search ?? "",
        scroll: window.scrollY,
      }));
    };
    const focus = (event: FocusEvent) => {
      if (!ready || !(event.target instanceof HTMLElement)) return;
      const row = event.target.closest<HTMLElement>(
        "[data-workbench-id], [data-question-id]",
      );
      const id = row?.dataset.workbenchId ?? row?.dataset.questionId;
      if (id) rememberWorkbenchItem(client, projectId, view, id);
    };
    window.addEventListener("scroll", remember, { passive: true });
    document.addEventListener("focusin", focus);
    return () => {
      cancelAnimationFrame(firstFrame);
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", remember);
      document.removeEventListener("focusin", focus);
    };
  }, [client, projectId, view, isList]);
  return {
    destination: (next: WorkbenchView) =>
      workbenchPath(
        projectId,
        next,
        client.getQueryData<Context>(key(projectId, next))?.search,
      ),
  };
}
