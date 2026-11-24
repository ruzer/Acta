import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "react-router-dom";
import { z } from "zod";
import { api } from "./api";
import {
  loadReviewQueue,
  queuePosition,
  readReviewQueue,
  storeReviewQueue,
} from "./review-queue";

export function useReviewQueue(userId: string, projectId: string, id: string) {
  const location = useLocation();
  const sessionActive = useRef(true);
  useEffect(() => {
    sessionActive.current = true;
    const expired = () => {
      sessionActive.current = false;
    };
    window.addEventListener("session-expired", expired);
    return () => {
      sessionActive.current = false;
      window.removeEventListener("session-expired", expired);
    };
  }, [userId]);
  const params = new URLSearchParams(location.search);
  const token = params.get("reviewQueue") ?? "";
  const search = params.get("reviewSearch") ?? "";
  const enabled =
    !!userId && z.uuid().safeParse(token).success && params.has("reviewSearch");
  const q = useQuery({
    queryKey: ["review-queue", userId, token, search],
    enabled,
    initialData: () => {
      const stored = enabled ? readReviewQueue(userId, token) : null;
      return stored?.search === search ? stored : undefined;
    },
    queryFn: async (context) => {
      // Espera al ciclo síncrono de efectos (incluido el remontaje de StrictMode)
      // antes de consumir la señal: TanStack conserva una sola lectura pendiente.
      await Promise.resolve();
      const { signal } = context;
      const query = context.client.getQueryCache().find({
        queryKey: context.queryKey,
        exact: true,
      });
      const ensureActive = () => {
        signal.throwIfAborted();
        // También cubre un cambio de clave o sesión antes de consumir la señal.
        if (!sessionActive.current || !query?.isActive())
          throw new DOMException("La lista ya no está abierta.", "AbortError");
      };
      const snapshot = await loadReviewQueue(
        search,
        (input) => {
          ensureActive();
          return api("listReviewInbox", {}, input);
        },
        signal,
      );
      ensureActive();
      storeReviewQueue(userId, token, snapshot);
      return snapshot;
    },
    staleTime: Infinity,
    // Si sessionStorage no está disponible, la cola dura hasta cerrar la sesión.
    gcTime: Infinity,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  return {
    enabled,
    token,
    search,
    q,
    position: q.data ? queuePosition(q.data, projectId, id) : null,
  };
}
