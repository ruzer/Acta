import { useLayoutEffect, useState, type CSSProperties } from "react";

// The visual viewport shrinks with the on-screen keyboard on mobile browsers.
// Reserve real space for the footer instead of covering the scrollable content.
export function useInspectorViewport(wide: boolean): CSSProperties | undefined {
  const [bounds, setBounds] = useState<{ height: number; top: number } | null>(
    null,
  );
  useLayoutEffect(() => {
    const viewport = window.visualViewport;
    if (wide || !viewport) return;
    const update = () =>
      setBounds({ height: viewport.height, top: viewport.offsetTop });
    update();
    viewport.addEventListener("resize", update);
    viewport.addEventListener("scroll", update);
    return () => {
      viewport.removeEventListener("resize", update);
      viewport.removeEventListener("scroll", update);
    };
  }, [wide]);
  return !wide && bounds
    ? { height: bounds.height, top: bounds.top }
    : undefined;
}
