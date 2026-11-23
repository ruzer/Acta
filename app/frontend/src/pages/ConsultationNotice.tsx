import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import type { ResponseContent, ResponseView } from "@requirements/contracts";
import { api, ApiFailure } from "../api";
import { Alert, Button } from "../ui";
import { ParticipantIcon } from "./ParticipantIcon";

type Undo = {
  projectId: string;
  id: string;
  content: ResponseContent;
  expectedVersion: number;
  requestId: string;
  expiresAt: number;
};
const pending = new Map<string, Undo>();
const cleanupPending = new Map<string, () => void>();
const clearEvents = ["pagehide", "session-expired", "session-restored"];
function release(token: string) {
  cleanupPending.get(token)?.();
}
/** Solo el identificador viaja en el historial; el borrador vive en memoria ocho segundos. */
export function registerConsultationUndo(
  projectId: string,
  id: string,
  response: ResponseView,
) {
  const draft = response.draft;
  if (!draft) return undefined;
  for (const token of pending.keys()) release(token);
  const token = crypto.randomUUID();
  pending.set(token, {
    projectId,
    id,
    content: {
      answer: draft.answer,
      comment: draft.comment,
      example: draft.example,
      consultationRequested: false,
    },
    expectedVersion: response.lockVersion,
    requestId: crypto.randomUUID(),
    expiresAt: Date.now() + 8000,
  });
  const clear = () => {
    window.clearTimeout(timer);
    pending.delete(token);
    cleanupPending.delete(token);
    for (const event of clearEvents) window.removeEventListener(event, clear);
  };
  const timer = window.setTimeout(clear, 8000);
  for (const event of clearEvents) window.addEventListener(event, clear);
  cleanupPending.set(token, clear);
  return token;
}

export function ConsultationNotice({ token }: { token: string }) {
  const client = useQueryClient();
  const [undo, setUndo] = useState(() => pending.get(token) ?? null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [conflict, setConflict] = useState(false);
  const alive = useRef(false),
    inFlight = useRef(false);
  useEffect(() => {
    alive.current = true;
    // Consumido una sola vez. Recargar, volver o cambiar de pregunta no lo recupera.
    release(token);
    const clear = () => {
      alive.current = false;
      setUndo(null);
    };
    const timer = window.setTimeout(
      clear,
      Math.max(0, (undo?.expiresAt ?? 0) - Date.now()),
    );
    for (const event of clearEvents) window.addEventListener(event, clear);
    return () => {
      alive.current = false;
      window.clearTimeout(timer);
      for (const event of clearEvents) window.removeEventListener(event, clear);
    };
  }, [token, undo]);
  async function revert() {
    if (
      !undo ||
      !alive.current ||
      inFlight.current ||
      conflict ||
      done ||
      Date.now() >= undo.expiresAt
    )
      return;
    inFlight.current = true;
    setBusy(true);
    setError("");
    try {
      await api(
        "saveDraft",
        { projectId: undo.projectId, id: undo.id },
        {
          ...undo.content,
          expectedVersion: undo.expectedVersion,
          requestId: undo.requestId,
        },
      );
      if (!alive.current) return;
      void client.invalidateQueries({ queryKey: ["my-work", undo.projectId] });
      setDone(true);
    } catch (error) {
      if (!alive.current) return;
      setError(
        error instanceof Error
          ? error.message
          : "No se pudo deshacer la marca.",
      );
      setConflict(error instanceof ApiFailure && error.status === 409);
    } finally {
      inFlight.current = false;
      if (alive.current) setBusy(false);
    }
  }
  if (!undo) return null;
  return (
    <div>
      <div role="status" className="participant-feedback">
        <ParticipantIcon name={done ? "check" : "flag"} />
        <span>
          {done
            ? "Deshiciste la marca Por consultar. Tu borrador se conserva."
            : "La pregunta anterior quedó como Por consultar"}
        </span>
        {!done && (
          <Button
            tone="secondary"
            disabled={busy || conflict}
            onClick={() => void revert()}
          >
            {busy ? "Deshaciendo…" : "Deshacer"}
          </Button>
        )}
      </div>
      {error && (
        <Alert error>
          {error}{" "}
          <Link to={`/projects/${undo.projectId}/respond/${undo.id}`}>
            Revisar la pregunta anterior
          </Link>
        </Alert>
      )}
    </div>
  );
}
