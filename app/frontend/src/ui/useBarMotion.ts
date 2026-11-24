import { useEffect, useLayoutEffect, type RefObject } from "react";
import {
  presentationUsesKeyboard,
  readPresentationSnapshot,
  sessionPresentationKey,
  writePresentationSnapshot,
  type PresentationSnapshot,
} from "../session-presentation";

export type BarMemory = { projectId: string; bar: string };
export function progressRatio(value: number, total: number) {
  return total > 0 && Number.isFinite(value / total)
    ? Math.max(0, Math.min(1, value / total))
    : 0;
}

// Reproduce the original flex widths, including shrink and its fixed 2px gap.
// The layers occupy the same pixels at rest; only their transforms animate.
export function progressLayers(
  sent: number,
  drafts: number,
  total: number,
  width: number,
) {
  const s = progressRatio(sent, total),
    d = progressRatio(drafts, total);
  const shrink =
    width > 0 && s + d > 0
      ? Math.max(0, Math.min(1, (width - 2) / (width * (s + d))))
      : 1;
  return {
    sent: s * shrink,
    drafts: d && width > 0 ? Math.min(1, (s + d) * shrink + 2 / width) : 0,
    gap: s * shrink * Math.max(0, width),
  };
}

function transforms(snapshot: PresentationSnapshot, width: number) {
  if (snapshot.position)
    return {
      position: `scaleX(${progressRatio(snapshot.position.value, snapshot.position.total)})`,
    };
  const { sent, drafts } = snapshot;
  if (!sent || !drafts) return {};
  const layers = progressLayers(sent.value, drafts.value, sent.total, width);
  return {
    sent: `scaleX(${layers.sent})`,
    drafts: `scaleX(${layers.drafts})`,
    gap: `translateX(${layers.gap}px)`,
  };
}

export function useBarMotion(
  root: RefObject<HTMLDivElement | null>,
  memory: BarMemory | undefined,
  snapshot: PresentationSnapshot,
) {
  useLayoutEffect(() => {
    const element = root.current;
    if (!element) return;
    const layout = () => {
      const final = transforms(snapshot, element.clientWidth);
      for (const node of element.querySelectorAll<HTMLElement>(
        "[data-bar-part]",
      ))
        node.style.transform =
          final[node.dataset.barPart as keyof typeof final] ?? "none";
    };
    layout();
    const observer =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(layout);
    observer?.observe(element);
    return () => observer?.disconnect();
  }, [root, snapshot]);
  const projectId = memory?.projectId,
    bar = memory?.bar;
  useEffect(() => {
    const animations: Animation[] = [];
    // Like F3, defer one frame: StrictMode cannot consume the previous visit.
    const frame = requestAnimationFrame(() => {
      const element = root.current;
      const key =
        projectId && bar ? sessionPresentationKey(projectId, bar) : null;
      if (!key || !element) return;
      const previous = readPresentationSnapshot(key);
      writePresentationSnapshot(key, snapshot);
      if (
        !previous ||
        window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
        presentationUsesKeyboard()
      )
        return;
      const before = transforms(previous, element.clientWidth),
        after = transforms(snapshot, element.clientWidth);
      const easing = getComputedStyle(element)
        .getPropertyValue("--ac-ease-out")
        .trim();
      for (const node of element.querySelectorAll<HTMLElement>(
        "[data-bar-part]",
      )) {
        const id = node.dataset.barPart as keyof typeof after;
        if (!before[id] || before[id] === after[id] || !node.animate) continue;
        const animation = node.animate(
          [{ transform: before[id] }, { transform: after[id] }],
          { duration: 280, easing },
        );
        animations.push(animation);
        void animation.finished.catch(() => undefined);
      }
    });
    return () => {
      cancelAnimationFrame(frame);
      animations.forEach((a) => a.cancel());
    };
  }, [root, projectId, bar, snapshot]);
}
