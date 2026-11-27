import { useLayoutEffect, useRef, useState } from "react";

export type InspectorPhase = "closed" | "entering" | "open" | "closing";

function milliseconds(value: string) {
  const number = Number.parseFloat(value);
  if (!Number.isFinite(number)) return 0;
  return value.trim().endsWith("ms") ? number : number * 1000;
}

function closingTransition(element: HTMLElement) {
  const style = getComputedStyle(element);
  const properties = style.transitionProperty.split(",").map((s) => s.trim());
  const durations = style.transitionDuration.split(",").map(milliseconds);
  const delays = style.transitionDelay.split(",").map(milliseconds);
  let duration = 0;
  let property = "opacity";
  properties.forEach((name, index) => {
    if (!["all", "opacity", "transform"].includes(name)) return;
    const active = durations[index % durations.length] ?? 0;
    const total =
      active > 0
        ? Math.max(0, active + (delays[index % delays.length] ?? 0))
        : 0;
    if (total > duration) {
      duration = total;
      property = name === "all" ? "opacity" : name;
    }
  });
  return { duration, property };
}

/** Keep this hook mounted when question becomes null; only its returned question
 * controls the presence of the frame. Changing a question never restarts entry.
 * Focus, history and actions remain synchronous responsibilities of the caller.
 */
export function useInspectorPresence<T>(
  question: T | null,
  { animateExit = true }: { animateExit?: boolean } = {},
) {
  const open = question !== null;
  const [wasOpen, setWasOpen] = useState(open);
  const [retained, setRetained] = useState(question);
  const [phase, setPhase] = useState<InspectorPhase>(
    open ? "entering" : "closed",
  );
  const elementRef = useRef<HTMLElement | null>(null);

  // Adjust during render so the frame never disappears for one render between
  // logical close and visual exit, and a reopen invalidates exit before paint.
  if (question !== null && question !== retained) setRetained(question);
  if (open !== wasOpen) {
    setWasOpen(open);
    setPhase(
      open
        ? phase === "closed"
          ? "entering"
          : "open"
        : animateExit
          ? "closing"
          : "closed",
    );
  } else if (!open && !animateExit && phase !== "closed") {
    setPhase("closed");
  }

  useLayoutEffect(() => {
    if (phase !== "entering") return;
    if (document.documentElement.hasAttribute("data-presentation-keyboard")) {
      setPhase("open");
      return;
    }
    let cancelled = false;
    let secondFrame = 0;
    const firstFrame = requestAnimationFrame(() => {
      if (cancelled) return;
      secondFrame = requestAnimationFrame(() => {
        if (!cancelled) setPhase("open");
      });
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(firstFrame);
      cancelAnimationFrame(secondFrame);
    };
  }, [phase]);

  useLayoutEffect(() => {
    if (phase !== "closing") return;
    const element = elementRef.current;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let expectedProperty = "opacity";
    const finish = () => {
      if (!cancelled) setPhase("closed");
    };
    const scheduleFallback = () => {
      clearTimeout(timer);
      const transition = element
        ? closingTransition(element)
        : { duration: 0, property: "opacity" };
      expectedProperty = transition.property;
      if (transition.duration === 0) {
        // There is no transitionend for zero duration, including keyboard CSS.
        queueMicrotask(finish);
      } else {
        timer = setTimeout(finish, transition.duration + 50);
      }
    };
    const ended = (event: TransitionEvent) => {
      if (event.target === element && event.propertyName === expectedProperty)
        finish();
    };
    const transitionCancelled = (event: TransitionEvent) => {
      if (event.target === element) scheduleFallback();
    };
    element?.addEventListener("transitionend", ended);
    element?.addEventListener("transitioncancel", transitionCancelled);
    const reducedMotion = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    );
    reducedMotion?.addEventListener("change", scheduleFallback);
    const modality = new MutationObserver(scheduleFallback);
    modality.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-presentation-keyboard"],
    });
    scheduleFallback();
    return () => {
      cancelled = true;
      clearTimeout(timer);
      modality.disconnect();
      reducedMotion?.removeEventListener("change", scheduleFallback);
      element?.removeEventListener("transitionend", ended);
      element?.removeEventListener("transitioncancel", transitionCancelled);
    };
  }, [phase]);

  return {
    question: phase === "closed" ? null : (question ?? retained),
    open,
    phase,
    elementRef,
  };
}
