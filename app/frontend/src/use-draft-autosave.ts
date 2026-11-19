import { useEffect, useRef, useState } from "react";

/** Espera una pausa al escribir; también limita los intentos al ocultar la página. */
export function useDraftAutosave({
  changed,
  dirty,
  enabled,
  savedAt,
  save,
}: {
  changed: string;
  dirty: boolean;
  enabled: boolean;
  savedAt: number;
  save: () => Promise<unknown>;
}) {
  const lastAttempt = useRef(savedAt),
    running = useRef(false),
    mounted = useRef(true);
  const latestSave = useRef(save);
  const [completed, setCompleted] = useState(0);
  useEffect(() => {
    latestSave.current = save;
  });
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    lastAttempt.current = Math.max(lastAttempt.current, savedAt);
    if (!dirty || !enabled) return;
    async function attempt() {
      if (running.current || Date.now() - lastAttempt.current < 30000) return;
      lastAttempt.current = Date.now();
      running.current = true;
      try {
        await latestSave.current();
      } finally {
        running.current = false;
        if (mounted.current) setCompleted((n) => n + 1);
      }
    }
    const timer = window.setTimeout(
      () => void attempt(),
      Math.max(8000, lastAttempt.current + 30000 - Date.now()),
    );
    const hidden = () => {
      if (document.visibilityState === "hidden") void attempt();
    };
    const leaving = () => {
      void attempt();
    };
    document.addEventListener("visibilitychange", hidden);
    window.addEventListener("pagehide", leaving);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", hidden);
      window.removeEventListener("pagehide", leaving);
    };
  }, [changed, dirty, enabled, savedAt, completed]);
}
