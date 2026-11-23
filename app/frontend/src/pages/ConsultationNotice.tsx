import { useLayoutEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import type {
  PersonalProjectView,
  ResponseContent,
  ResponseView,
} from "@requirements/contracts";
import { api, ApiFailure } from "../api";
import { Alert, Button } from "../ui";
import { ParticipantIcon } from "./ParticipantIcon";

type Undo = {
  active: boolean;
  projectId: string;
  id: string;
  content: ResponseContent | null;
  expectedVersion: number;
  requestId: string;
  expiresAt: number;
};
const pending = new Map<string, Undo>();
const cleanupPending = new Map<string, (discard: boolean) => void>();
const clearEvents = ["pagehide", "session-expired", "session-restored"];
function release(token: string, discard = true) {
  cleanupPending.get(token)?.(discard);
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
  const undo: Undo = {
    active: true,
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
  };
  pending.set(token, undo);
  const clear = () => release(token);
  const dispose = (discard: boolean) => {
    if (discard) {
      undo.active = false;
      undo.content = null;
    }
    window.clearTimeout(timer);
    pending.delete(token);
    cleanupPending.delete(token);
    for (const event of clearEvents) window.removeEventListener(event, clear);
  };
  const timer = window.setTimeout(clear, 8000);
  for (const event of clearEvents) window.addEventListener(event, clear);
  cleanupPending.set(token, dispose);
  return token;
}

export function ConsultationNotice({ token }: { token: string }) {
  const client = useQueryClient();
  const [undo] = useState(() => pending.get(token) ?? null);
  const [visible, setVisible] = useState(!!undo);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [conflict, setConflict] = useState(false);
  const alive = useRef(false),
    inFlight = useRef(false);
  useLayoutEffect(() => {
    // Un evento puede cancelar el registro después del render y antes de este efecto.
    if (!undo?.active || Date.now() >= undo.expiresAt) {
      alive.current = false;
      release(token);
      setVisible(false);
      return;
    }
    alive.current = true;
    const expire = () => {
      undo.active = false;
      undo.content = null;
      setVisible(false);
    };
    const clear = () => {
      alive.current = false;
      expire();
    };
    for (const event of clearEvents) window.addEventListener(event, clear);
    // Suscribir antes de entregar el registro; no queda una ventana sin escucha.
    release(token, false);
    const timer = window.setTimeout(
      expire,
      Math.max(0, undo.expiresAt - Date.now()),
    );
    return () => {
      alive.current = false;
      window.clearTimeout(timer);
      for (const event of clearEvents) window.removeEventListener(event, clear);
    };
  }, [token, undo]);
  async function revert() {
    if (
      !undo?.active ||
      !undo.content ||
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
      const result = await api(
        "saveDraft",
        { projectId: undo.projectId, id: undo.id },
        {
          ...undo.content,
          expectedVersion: undo.expectedVersion,
          requestId: undo.requestId,
        },
      );
      if (!alive.current) return;
      const queryKey = ["my-work", undo.projectId];
      // Una lectura iniciada antes de deshacer no debe restaurar la marca vieja.
      await client.cancelQueries({ queryKey, exact: true });
      if (!alive.current) return;
      const draft = result.draft;
      if (draft && !draft.consultationRequested)
        client.setQueryData<PersonalProjectView>(queryKey, (current) =>
          current
            ? {
                ...current,
                sections: current.sections.map((section) => ({
                  ...section,
                  questions: section.questions.map((question) =>
                    question.id === undo.id && question.state === "CONSULTATION"
                      ? {
                          ...question,
                          state: "DRAFT",
                          updatedAt: draft.updatedAt,
                        }
                      : question,
                  ),
                })),
              }
            : current,
        );
      // Deshacer solo cambia la marca. El resto se reconcilia en la próxima lectura.
      void client.invalidateQueries({
        queryKey,
        exact: true,
        refetchType: "none",
      });
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
  if (!undo || !visible) return null;
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
