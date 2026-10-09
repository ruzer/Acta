import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Link,
  useParams,
  useNavigate,
  useBlocker,
  useBeforeUnload,
} from "react-router-dom";
import {
  contracts,
  type ClarificationThreadView,
  type MyClarifications,
} from "@requirements/contracts";
import { api } from "../api";
import {
  Dialog,
  Alert,
  Button,
  EmptyState,
  ErrorState,
  LoadingState,
  Textarea,
} from "../ui";
import {
  NextSteps,
  StatusChip,
  ThreadInset,
  ThreadMessage,
} from "../ui/semantic";
import { nextParticipantPath, ParticipantFocus } from "./ParticipantFlow";
import { dateText, SubmittedAnswer, ThreadStatus } from "./ReviewShared";

/** "Qué sigue" from the threads and submissions the server returned; nothing is promised. */
function clarificationSteps(d: MyClarifications) {
  const waiting = d.threads.some((t) => t.status === "WAITING_STAKEHOLDER");
  const answered = d.threads.some((t) => t.status === "WAITING_ANALYST");
  const sentAt = d.submissions[0]?.createdAt;
  const steps: {
    id: string;
    state: "done" | "current" | "todo";
    title: string;
    detail?: string;
  }[] = [
    {
      id: "sent",
      state: "done",
      title: "Enviaste tu respuesta",
      detail: sentAt ? dateText(sentAt) : undefined,
    },
    waiting
      ? {
          id: "clarification",
          state: "current",
          title: "Pidieron una aclaración",
          detail: "Te toca responder.",
        }
      : {
          id: "clarification",
          state: "done",
          title: answered
            ? "Respondiste la aclaración"
            : "Se pidió una aclaración",
          detail: answered
            ? "Espera la revisión del equipo analista."
            : "Ya no está pendiente de tu parte.",
        },
  ];
  if (!waiting)
    steps.push({
      id: "review",
      state: "current",
      title: "El equipo analista revisa tu respuesta",
    });
  steps.push({
    id: "decision",
    state: "todo",
    title: "Decisión validada",
    detail: "Verás el estado «Validada» en esta pregunta.",
  });
  return steps;
}
function Reply({
  thread: t,
  version,
  projectId,
  id,
  onDone,
  refresh,
  onDirty,
}: {
  thread: ClarificationThreadView;
  version: number;
  projectId: string;
  id: string;
  onDirty: (dirty: boolean) => void;
  onDone: () => void;
  refresh: () => Promise<unknown>;
}) {
  const [text, setText] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const request = useRef({ key: "", id: "" });
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setBusy(true);
        setError("");
        const payload = {
          expectedVersion: version,
          threadId: t.id,
          expectedThreadVersion: t.lockVersion,
          body: text,
        };
        const key = JSON.stringify(payload);
        if (request.current.key !== key)
          request.current = { key, id: crypto.randomUUID() };
        const parsed = contracts.replyClarification.input.safeParse({
          ...payload,
          requestId: request.current.id,
        });
        if (!parsed.success) {
          setError("Escribe tu aclaración antes de enviar.");
          setBusy(false);
          return;
        }
        void api("replyClarification", { projectId, id }, parsed.data)
          .then(() => {
            setText("");
            onDirty(false);
            onDone();
          })
          .catch((e) => setError((e as Error).message))
          .finally(() => setBusy(false));
      }}
    >
      {error && (
        <Alert error>
          {error}
          <Button
            tone="secondary"
            disabled={busy}
            onClick={() => void refresh()}
          >
            Actualizar información conservando texto
          </Button>
        </Alert>
      )}
      <Textarea
        label="Tu aclaración"
        required
        maxLength={10000}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          onDirty(e.target.value.length > 0);
        }}
        disabled={busy}
        hint="Este mensaje explica tu respuesta enviada; no la reemplaza."
      />
      <Button type="submit" disabled={busy}>
        {busy ? "Enviando…" : "Enviar aclaración"}
      </Button>
    </form>
  );
}
export function Clarifications() {
  const { projectId = "", id = "" } = useParams(),
    navigate = useNavigate(),
    client = useQueryClient(),
    [message, setMessage] = useState("");
  const [pending, setPending] = useState<Record<string, boolean>>({});
  const [leave, setLeave] = useState<(() => void) | null>(null);
  const dirty = Object.values(pending).some(Boolean);
  const blocker = useBlocker(dirty);
  useBeforeUnload((e) => {
    if (dirty) {
      e.preventDefault();
      e.returnValue = "";
    }
  });
  useEffect(() => {
    const listener = (e: Event) => {
      if (dirty) {
        e.preventDefault();
        setLeave(
          () => (e as CustomEvent<{ proceed: () => void }>).detail.proceed,
        );
      }
    };
    window.addEventListener("before-session-logout", listener);
    return () => window.removeEventListener("before-session-logout", listener);
  }, [dirty]);
  const q = useQuery({
    queryKey: ["clarifications", projectId, id],
    queryFn: () => api("myClarifications", { projectId, id }),
    staleTime: 0,
  });
  if (q.isPending) return <LoadingState />;
  if (!q.data)
    return (
      <ErrorState
        error={q.error ?? new Error("No se pudo cargar la información.")}
        retry={() => void q.refetch()}
      />
    );
  const d = q.data;
  async function done() {
    setMessage("Aclaración enviada. El analista la revisará.");
    const refreshed = await q.refetch();
    await client.invalidateQueries({ queryKey: ["my-work"] });
    if (
      refreshed.data &&
      !refreshed.data.threads.some((t) => t.status === "WAITING_STAKEHOLDER")
    ) {
      try {
        navigate(await nextParticipantPath(projectId, id), {
          state: {
            participantNotice:
              "Aclaración enviada. Ya no está pendiente de tu parte.",
          },
        });
      } catch {
        setMessage("Aclaración enviada. Vuelve a Mi trabajo para continuar.");
      }
    }
  }
  const waiting = d.threads.some((t) => t.status === "WAITING_STAKEHOLDER");
  return (
    <div className="participant-page participant-wide">
      <ParticipantFocus />
      {(blocker.state === "blocked" || leave) && (
        <Dialog
          title="Tienes una aclaración sin enviar"
          onClose={() => {
            if (blocker.state === "blocked") blocker.reset();
            setLeave(null);
          }}
        >
          <p>
            El texto todavía no se ha enviado. Puedes volver para terminarlo.
          </p>
          <div className="actions">
            <Button
              onClick={() => {
                if (blocker.state === "blocked") blocker.reset();
                setLeave(null);
              }}
            >
              Seguir escribiendo
            </Button>
            <Button
              tone="danger"
              onClick={() => {
                if (blocker.state === "blocked") blocker.proceed();
                leave?.();
                setLeave(null);
              }}
            >
              Salir sin enviar
            </Button>
          </div>
        </Dialog>
      )}
      <div>
        <p className="participant-overline">{d.question.sectionTitle}</p>
        <h1>{d.question.question}</h1>
        <StatusChip
          tone={waiting ? "warning" : "info"}
          icon={waiting ? "help" : "send"}
        >
          {waiting
            ? "Necesitamos que aclares esta respuesta"
            : "Aclaración enviada para revisión"}
        </StatusChip>
      </div>
      {message && <Alert>{message}</Alert>}
      <div className="participant-columns">
        <div className="participant-main">
          {d.threads.length === 0 ? (
            <EmptyState title="No hay aclaraciones solicitadas">
              Puedes continuar con tus respuestas.
            </EmptyState>
          ) : (
            d.threads.map((t) => {
              const s = d.submissions.find(
                (s) => s.id === t.responseRevisionId,
              );
              return (
                <section className="review-submission" key={t.id}>
                  <div className="participant-submission">
                    <div className="participant-submission-head">
                      <h2>Tu respuesta original</h2>
                    </div>
                    {s && (
                      <SubmittedAnswer
                        participant
                        revision={s}
                        question={d.question}
                        projectId={projectId}
                      />
                    )}
                  </div>
                  <div className="participant-exchange">
                    <ThreadInset
                      title="Aclaración solicitada"
                      status={<ThreadStatus status={t.status} />}
                      turn={
                        t.status === "WAITING_STAKEHOLDER"
                          ? "Te toca responder."
                          : t.status === "WAITING_ANALYST"
                            ? "Tu aclaración espera la revisión del equipo analista."
                            : null
                      }
                    >
                      {t.messages.map((m) => (
                        <ThreadMessage
                          key={m.id}
                          from={
                            m.author.id === t.respondentId ? "answers" : "asks"
                          }
                          author={
                            m.author.id === t.respondentId
                              ? "Tú"
                              : m.author.displayName
                          }
                          date={dateText(m.createdAt)}
                          dateTime={m.createdAt}
                        >
                          {m.body}
                        </ThreadMessage>
                      ))}
                      {t.closedAt && (
                        <li className="ac-thread-closed">
                          <p className="hint">
                            Cerrada por {t.closedBy?.displayName} ·{" "}
                            {dateText(t.closedAt)}. {t.closeReason}
                          </p>
                        </li>
                      )}
                    </ThreadInset>
                    {t.status === "WAITING_STAKEHOLDER" && (
                      <Reply
                        thread={t}
                        version={d.lockVersion}
                        projectId={projectId}
                        id={id}
                        onDirty={(dirty) =>
                          setPending((previous) => ({
                            ...previous,
                            [t.id]: dirty,
                          }))
                        }
                        onDone={() => void done()}
                        refresh={() => q.refetch()}
                      />
                    )}
                  </div>
                </section>
              );
            })
          )}
        </div>
        {d.submissions.length > 0 && (
          <NextSteps steps={clarificationSteps(d)}>
            <p>Vuelve a esta página para ver novedades.</p>
          </NextSteps>
        )}
      </div>
      <Link className="participant-back" to={`/projects/${projectId}/work`}>
        Volver a Mi trabajo
      </Link>
    </div>
  );
}
