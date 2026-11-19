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
    lastSavedAt = useRef(savedAt),
    retryDelay = useRef(30000),
    manualAction = useRef(0),
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
    if (savedAt !== lastSavedAt.current) {
      lastSavedAt.current = savedAt;
      retryDelay.current = 30000;
    }
    lastAttempt.current = Math.max(lastAttempt.current, savedAt);
    if (!dirty || !enabled) return;
    async function attempt() {
      if (
        running.current ||
        Date.now() - lastAttempt.current < retryDelay.current
      )
        return;
      lastAttempt.current = Date.now();
      running.current = true;
      const action = manualAction.current;
      let succeeded = false;
      try {
        succeeded = (await latestSave.current()) !== null;
      } catch {
        // El guardado conserva y presenta su error; aquí solo se regula el siguiente intento.
      } finally {
        if (action === manualAction.current)
          retryDelay.current = succeeded
            ? 30000
            : retryDelay.current === 30000
              ? 60000
              : retryDelay.current === 60000
                ? 120000
                : 300000;
        running.current = false;
        if (mounted.current) setCompleted((n) => n + 1);
      }
    }
    const timer = window.setTimeout(
      () => void attempt(),
      Math.max(8000, lastAttempt.current + retryDelay.current - Date.now()),
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
  return () => {
    manualAction.current++;
    retryDelay.current = 30000;
    lastAttempt.current = Date.now();
    setCompleted((n) => n + 1);
  };
}
