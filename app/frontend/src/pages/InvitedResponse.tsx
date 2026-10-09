import { useCallback, useEffect, useRef, useState } from "react";
import { useBeforeUnload, useBlocker } from "react-router-dom";
import type {
  InvitationAccessView,
  MyClarifications,
  ResponseContent,
  ResponseView,
  EvidenceView,
} from "@requirements/contracts";
import {
  invitationClient as client,
  openInvitation,
  captureInvitationFragment,
  discardInvitationFragment,
} from "../invitation-api";
import { ApiFailure, saveDownload } from "../api";
import { Brand, formatDate, useBranding } from "../branding";
import {
  Alert,
  Button,
  Checkbox,
  Dialog,
  Input,
  LoadingState,
  Textarea,
} from "../ui";
import { FactGrid, NextSteps, StatusChip } from "../ui/semantic";
import { AnswerControl, answerText } from "./AnswerControl";
import { ParticipantIcon } from "./ParticipantIcon";
import "../invitation.css";
const empty: ResponseContent = {
  answer: null,
  comment: "",
  example: "",
  consultationRequested: false,
};
const content = (v: ResponseView): ResponseContent => {
  const d = v.draft ?? v.revisions[0];
  return d
    ? {
        answer: d.answer,
        comment: d.comment,
        example: d.example,
        consultationRequested: v.draft?.consultationRequested ?? false,
      }
    : empty;
};
export function InvitedResponse() {
  const branding = useBranding();
  const [access, setAccess] = useState<InvitationAccessView>();
  const [error, setError] = useState("");
  const [selected, setSelected] = useState("");
  const [closed, setClosed] = useState(false);
  const [pendingLink, setPendingLink] = useState(false);
  const reopen = useCallback(() => {
    setPendingLink(false);
    setClosed(false);
    setSelected("");
    setAccess(undefined);
    setError("");
    void openInvitation()
      .then(setAccess)
      .catch((e: Error) => setError(e.message));
  }, []);
  useEffect(() => {
    function changed() {
      if (!captureInvitationFragment()) return;
      if (access && !closed) setPendingLink(true);
      else reopen();
    }
    window.addEventListener("hashchange", changed);
    return () => window.removeEventListener("hashchange", changed);
  }, [access, closed, reopen]);
  useEffect(() => {
    let active = true;
    void openInvitation()
      .then((v) => {
        if (active) setAccess(v);
      })
      .catch((e: Error) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, []);
  async function refresh() {
    const v = await client.request("invitationAccess");
    setAccess(v);
  }
  return (
    <div className="invitation-shell acta-participant">
      <a className="skip" href="#main">
        Ir al contenido
      </a>
      <header className="invitation-header">
        <Brand />
      </header>
      <main id="main" className="invitation-content">
        {pendingLink && (
          <Dialog
            title="Abrir otro enlace de invitación"
            onClose={() => {
              discardInvitationFragment();
              setPendingLink(false);
            }}
          >
            <p>
              Al abrir este enlace saldrás de la pantalla actual. Los cambios
              que no hayas guardado se perderán. Puedes cancelar para guardarlos
              primero.
            </p>
            <Button onClick={reopen}>Abrir enlace</Button>
            <Button
              tone="secondary"
              onClick={() => {
                discardInvitationFragment();
                setPendingLink(false);
              }}
            >
              Cancelar
            </Button>
          </Dialog>
        )}
        {closed ? (
          <>
            <h1>Hasta luego</h1>
            <p>
              Para continuar, abre de nuevo el enlace que recibiste. Lo que
              guardaste permanece disponible hasta el vencimiento.
            </p>
          </>
        ) : !access ? (
          error ? (
            <>
              <h1>Invitación no disponible</h1>
              <Alert error>{error}</Alert>
              <p>
                Abre el enlace original o solicita uno nuevo a quien te invitó.
              </p>
            </>
          ) : (
            <LoadingState />
          )
        ) : (
          <>
            {error && <Alert error>{error}</Alert>}
            {selected ? (
              <InvitedQuestion
                key={selected}
                id={selected}
                allowEvidence={access.allowEvidence}
                expiresAt={access.expiresAt}
                position={
                  access.work.sections
                    .flatMap((s) => s.questions)
                    .findIndex((q) => q.id === selected) + 1
                }
                total={access.work.sections.flatMap((s) => s.questions).length}
                onBack={() => {
                  setSelected("");
                  void refresh().catch((e: Error) => setError(e.message));
                }}
                onChange={() => {
                  void refresh().catch((e: Error) => setError(e.message));
                }}
              />
            ) : (
              <InvitationHome
                access={access}
                organization={branding.organizationName}
                onSelect={setSelected}
                onExit={() => {
                  void client
                    .request("invitationLogout")
                    .then(() => setClosed(true))
                    .catch((e: Error) => setError(e.message));
                }}
              />
            )}
          </>
        )}
      </main>
    </div>
  );
}
function daysUntil(date: string) {
  return Math.ceil((Date.parse(date) - Date.now()) / 86_400_000);
}
const invitationStatus = (
  q: InvitationAccessView["work"]["sections"][number]["questions"][number],
) =>
  q.clarificationWaiting > 0
    ? {
        text: "Tienes una aclaración por responder",
        tone: "warning" as const,
        icon: "help",
      }
    : q.hasSubmission
      ? { text: "Enviada", tone: "success" as const, icon: "check" }
      : q.state === "DRAFT"
        ? { text: "Borrador guardado", tone: "info" as const, icon: "edit" }
        : q.applicability === "ENABLED"
          ? { text: "Por responder", tone: "neutral" as const, icon: "clock" }
          : {
              text: "Depende de otra respuesta",
              tone: "neutral" as const,
              icon: "info",
            };
/**
 * The invitation as a letter: who writes, what is asked, until when, and the
 * truth about the link. It says nothing about who the recipient is (the
 * contract has no recipient or purpose): only the organization, the project,
 * the number of questions, the expiry and whether files are allowed.
 */
export function InvitationHome({
  access,
  organization,
  onSelect,
  onExit,
}: {
  access: InvitationAccessView;
  organization: string;
  onSelect: (id: string) => void;
  onExit: () => void;
}) {
  const questions = access.work.sections.flatMap((s) => s.questions);
  const sent = questions.filter((q) => q.hasSubmission).length;
  const drafts = questions.filter((q) => q.state === "DRAFT").length;
  const complete = questions.length > 0 && sent === questions.length;
  const start =
    questions.find((q) => q.clarificationWaiting > 0) ??
    questions.find((q) => !q.hasSubmission && q.applicability === "ENABLED");
  const days = daysUntil(access.expiresAt);
  const noun = questions.length === 1 ? "pregunta" : "preguntas";
  return (
    <div className="invitation-home">
      {complete ? (
        <>
          <div className="invitation-done">
            <span className="participant-success-icon">
              <ParticipantIcon />
            </span>
            <h1>Gracias. Recibimos tus respuestas</h1>
            <p className="participant-subtitle">
              Enviaste {sent} de {questions.length} {noun}.
            </p>
          </div>
          <NextSteps
            steps={[
              {
                id: "review",
                state: "todo",
                title: "El equipo analista revisará tus respuestas.",
              },
              {
                id: "clarify",
                state: "todo",
                title: `Si necesitan precisión, verás una aclaración al volver a abrir este enlace antes de que venza (${formatDate(access.expiresAt)}).`,
              },
              {
                id: "close",
                state: "todo",
                title:
                  "Puedes cerrar esta página. No hace falta hacer nada más.",
              },
            ]}
            variant="guide"
          />
        </>
      ) : (
        <>
          <div>
            <p className="participant-overline">Invitación para aportar</p>
            <h1>
              {organization} te invita a responder {questions.length} {noun}
            </h1>
            <p className="participant-subtitle">
              Proyecto: <strong>{access.work.projectName}</strong>
            </p>
          </div>
          <FactGrid
            facts={[
              {
                id: "questions",
                icon: "list",
                label: "Preguntas",
                value: questions.length,
              },
              {
                id: "expires",
                icon: "clock",
                label: "Vence",
                value: (
                  <>
                    {formatDate(access.expiresAt)}
                    {days >= 1 && (
                      <span className="hint">
                        {" "}
                        · en {days} {days === 1 ? "día" : "días"}
                      </span>
                    )}
                  </>
                ),
              },
              {
                id: "files",
                icon: "paperclip",
                label: "Archivos",
                value: access.allowEvidence
                  ? "Puedes adjuntar evidencia"
                  : "No se piden archivos",
              },
              {
                id: "account",
                icon: "info",
                label: "Cuenta",
                value: "No necesitas crear una",
              },
            ]}
          />
          <p className="invitation-notice">
            <ParticipantIcon name="info" />
            <span>
              <strong>Este enlace es personal.</strong> Permite acceder a tus
              respuestas: no lo reenvíes.
            </span>
          </p>
          {start && (
            <div className="participant-progress-actions">
              <Button onClick={() => onSelect(start.id)}>
                {sent === 0 && drafts === 0 ? "Comenzar" : "Continuar"}{" "}
                <ParticipantIcon name="arrow" />
              </Button>
              <span className="hint">
                Puedes guardar un borrador y volver con tu enlace.
              </span>
            </div>
          )}
          <NextSteps
            title="Cómo funciona"
            variant="guide"
            steps={[
              {
                id: "answer",
                state: "todo",
                title: "Responde con calma",
                detail: `Cada pregunta se responde por separado.${access.allowEvidence ? " Puedes adjuntar archivos de respaldo." : ""}`,
              },
              {
                id: "save",
                state: "todo",
                title: "Guarda tu avance",
                detail: `“Guardar borrador” lo conserva con este enlace hasta que venza (${formatDate(access.expiresAt)}).`,
              },
              {
                id: "send",
                state: "todo",
                title: "Envía cada respuesta",
                detail:
                  "“Enviar” la entrega para revisión. Si necesitan precisión, te pedirán una aclaración aquí mismo.",
              },
            ]}
          />
        </>
      )}
      <p role="status">
        {sent} de {questions.length} preguntas con respuesta enviada
      </p>
      {access.work.sections.map((section) => (
        <section
          key={section.id}
          className="invitation-section"
          aria-label={section.title}
        >
          <h2>{section.title}</h2>
          <ul>
            {section.questions.map((q) => {
              const status = invitationStatus(q);
              return (
                <li key={q.id}>
                  <div>
                    <strong>{q.title || q.question}</strong>
                    <p>
                      <StatusChip tone={status.tone} icon={status.icon}>
                        {status.text}
                      </StatusChip>
                    </p>
                  </div>
                  <Button tone="secondary" onClick={() => onSelect(q.id)}>
                    {q.hasSubmission ? "Consultar respuesta" : "Responder"}
                  </Button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
      <div>
        <Button tone="secondary" onClick={onExit}>
          Salir
        </Button>
      </div>
    </div>
  );
}
function InvitedQuestion({
  id,
  allowEvidence,
  expiresAt,
  position,
  total,
  onBack,
  onChange,
}: {
  id: string;
  allowEvidence: boolean;
  expiresAt: string;
  position: number;
  total: number;
  onBack: () => void;
  onChange: () => void;
}) {
  const [view, setView] = useState<ResponseView>();
  const [values, setValues] = useState<ResponseContent>(empty);
  const [threads, setThreads] = useState<MyClarifications>();
  const [editing, setEditing] = useState(false),
    [dirty, setDirty] = useState(false),
    [busy, setBusy] = useState(false);
  const [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [fields, setFields] = useState<Record<string, string>>({});
  const [leave, setLeave] = useState(false),
    [confirm, setConfirm] = useState(false),
    [conflict, setConflict] = useState(false);
  const [file, setFile] = useState<File | null>(null),
    [staged, setStaged] = useState<EvidenceView | null>(null);
  const [reply, setReply] = useState<Record<string, string>>({});
  const errorRef = useRef<HTMLDivElement>(null),
    heading = useRef<HTMLHeadingElement>(null);
  const requests = useRef(new Map<string, string>());
  function requestId(operation: string, payload: unknown) {
    const key = operation + JSON.stringify(payload);
    if (!requests.current.has(key))
      requests.current.set(key, crypto.randomUUID());
    return requests.current.get(key)!;
  }
  useEffect(() => {
    let active = true;
    void Promise.all([
      client.request("invitationResponse", id),
      client.request("invitationClarifications", id),
    ])
      .then(([v, t]) => {
        if (active) {
          setView(v);
          setValues(content(v));
          setThreads(t);
          setEditing(!!v.draft || !v.revisions.length);
        }
      })
      .catch((e: Error) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [id]);
  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);
  const ready = !!view;
  useEffect(() => {
    if (ready) heading.current?.focus();
  }, [ready]);
  const blocker = useBlocker(
    () =>
      dirty || busy || !!file || !!staged || Object.values(reply).some(Boolean),
  );
  useBeforeUnload((e) => {
    if (dirty || busy || file || staged || Object.values(reply).some(Boolean)) {
      e.preventDefault();
      e.returnValue = "";
    }
  });
  function failed(e: unknown) {
    setConfirm(false);
    setError(
      e instanceof Error ? e.message : "No fue posible completar la operación.",
    );
    if (e instanceof ApiFailure) {
      setFields(e.fields);
      if (e.status === 409) setConflict(true);
    }
  }
  function accept(v: ResponseView) {
    setView(v);
    setValues(content(v));
    setDirty(false);
    requests.current.clear();
    onChange();
  }
  async function save() {
    if (!view) return;
    let value = values;
    if (view.question.type === "NUMBER" && typeof values.answer === "string") {
      if (values.answer !== "" && !/^-?\d+(?:\.\d{1,6})?$/.test(values.answer))
        throw new ApiFailure(422, "Introduce un número válido.", {
          answer:
            "Usa un número sin separadores de miles y hasta seis decimales.",
        });
      value = {
        ...values,
        answer: values.answer === "" ? null : Number(values.answer),
      };
    }
    const d = { ...value, expectedVersion: view.lockVersion };
    const v = await client.request("invitationSave", id, {
      ...d,
      requestId: requestId("save", d),
    });
    accept(v);
    return v;
  }
  async function run(work: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError("");
    setFields({});
    setNotice("");
    try {
      await work();
    } catch (e) {
      failed(e);
    } finally {
      setBusy(false);
    }
  }
  if (!view)
    return (
      <>
        <div ref={errorRef} tabIndex={-1}>
          {error ? <Alert error>{error}</Alert> : <LoadingState />}
        </div>
        <Button tone="secondary" onClick={onBack}>
          Volver a las preguntas
        </Button>
      </>
    );
  const editable =
    editing &&
    view.question.applicability === "ENABLED" &&
    view.reviewStatus !== "NOT_APPLICABLE";
  const latest = view.revisions[0];
  return (
    <article className="invitation-question participant-answer-card">
      <Button
        tone="secondary"
        disabled={busy}
        onClick={() => {
          if (dirty || file || staged || Object.values(reply).some(Boolean))
            setLeave(true);
          else onBack();
        }}
      >
        ← Todas las preguntas
      </Button>
      {position > 0 && (
        <p className="participant-overline">
          Pregunta {position} de {total}
        </p>
      )}
      <h1 ref={heading} tabIndex={-1}>
        {view.question.question}
      </h1>
      {view.question.helpText && <p>{view.question.helpText}</p>}
      <div ref={errorRef} tabIndex={-1}>
        {error && <Alert error>{error}</Alert>}
      </div>
      {!editable && notice && <p role="status">{notice}</p>}
      {conflict && (
        <Alert error>
          Esta respuesta cambió en otra pestaña. Copia tu texto antes de volver
          a las preguntas y abrir la versión actual. No se sobrescribió la otra
          versión.
        </Alert>
      )}
      {view.question.applicability !== "ENABLED" && (
        <p>
          Esta pregunta depende de otra respuesta. Vuelve a la lista para
          continuar.
        </p>
      )}
      {view.reviewStatus === "NOT_APPLICABLE" && (
        <p>
          Esta pregunta está marcada como no aplicable y no admite nuevas
          respuestas.
        </p>
      )}
      {editable ? (
        <>
          <AnswerControl
            question={view.question}
            value={values.answer}
            error={fields.answer}
            disabled={busy || conflict}
            onChange={(answer) => {
              setValues({ ...values, answer });
              setDirty(true);
            }}
          />
          <Textarea
            label="Comentario"
            value={values.comment}
            maxLength={10000}
            disabled={busy || conflict}
            error={fields.comment}
            onChange={(e) => {
              setValues({ ...values, comment: e.target.value });
              setDirty(true);
            }}
          />
          <Textarea
            label="Ejemplo (opcional)"
            value={values.example}
            maxLength={10000}
            disabled={busy || conflict}
            error={fields.example}
            onChange={(e) => {
              setValues({ ...values, example: e.target.value });
              setDirty(true);
            }}
          />
          <Checkbox
            label="Necesito consultar información antes de enviar"
            checked={values.consultationRequested}
            disabled={busy || conflict}
            onChange={(e) => {
              setValues({ ...values, consultationRequested: e.target.checked });
              setDirty(true);
            }}
          />
          {allowEvidence && (
            <section aria-label="Evidencia">
              <h2>Archivos de respaldo</h2>
              <p>
                Adjunta solo información necesaria. Los archivos se revisan
                antes de aceptarse.
              </p>
              <Input
                type="file"
                label="Elegir archivo"
                disabled={busy || conflict}
                onChange={(e) => {
                  setFile(e.target.files?.[0] ?? null);
                  setStaged(null);
                }}
              />
              <Button
                tone="secondary"
                disabled={busy || conflict || (!file && !staged)}
                onClick={() =>
                  void run(async () => {
                    const saved = dirty || !view.draft ? await save() : view;
                    if (!saved) return;
                    const upload =
                      staged ??
                      (await client.upload(
                        id,
                        file!,
                        requestId("upload", {
                          name: file!.name,
                          size: file!.size,
                          lastModified: file!.lastModified,
                        }),
                      ));
                    setStaged(upload);
                    const d = {
                      evidenceId: upload.id,
                      expectedVersion: saved.lockVersion,
                    };
                    const result = await client.request(
                      "invitationAttach",
                      id,
                      { ...d, requestId: requestId("attach", d) },
                    );
                    accept(result);
                    setStaged(null);
                    setFile(null);
                    setNotice("Archivo adjuntado al borrador.");
                  })
                }
              >
                Adjuntar archivo
              </Button>
            </section>
          )}
          <p
            className="invitation-save-status"
            role="status"
            aria-live="polite"
          >
            {busy
              ? "Procesando…"
              : error
                ? "No se completó la operación. Tu contenido permanece en esta pantalla."
                : file || staged
                  ? "Archivo pendiente de adjuntar"
                  : dirty
                    ? "Cambios sin guardar"
                    : notice ||
                      (view.draft
                        ? `Borrador guardado · ${formatDate(view.draft.updatedAt)}`
                        : "Todavía no has guardado un borrador.")}
          </p>
          <p className="hint">
            Guardar conserva un borrador para continuar con este enlace hasta{" "}
            {formatDate(expiresAt)}. Enviar entrega esta respuesta para
            revisión.
          </p>
          <div className="invitation-actions">
            <Button
              tone="secondary"
              disabled={busy || conflict}
              onClick={() =>
                void run(async () => {
                  await save();
                  setNotice(
                    "Borrador guardado. Puedes cerrar y volver con tu enlace.",
                  );
                })
              }
            >
              Guardar borrador
            </Button>
            <Button
              disabled={busy || conflict || !!file || !!staged}
              onClick={() => setConfirm(true)}
            >
              Enviar respuesta
            </Button>
          </div>
        </>
      ) : (
        latest && (
          <section aria-label="Respuesta enviada">
            <h2>Respuesta enviada</h2>
            <p>{formatDate(latest.createdAt)}</p>
            <p className="invitation-answer">
              {answerText(view.question, latest.answer)}
            </p>
            {latest.comment && <p>{latest.comment}</p>}
            {latest.example && <p>{latest.example}</p>}
            {view.question.applicability === "ENABLED" &&
              view.reviewStatus !== "NOT_APPLICABLE" && (
                <>
                  <p>
                    Una corrección crea una nueva versión y requiere revisar de
                    nuevo la decisión asociada.
                  </p>
                  <Button tone="secondary" onClick={() => setEditing(true)}>
                    Preparar una corrección
                  </Button>
                </>
              )}
          </section>
        )
      )}
      {allowEvidence &&
        (view.draft?.evidence ?? latest?.evidence ?? []).map((link) => (
          <div className="invitation-file" key={link.id}>
            <span>{link.evidence.originalName}</span>
            <Button
              tone="secondary"
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  saveDownload(
                    await client.download(link.evidence.id),
                    link.evidence.originalName,
                  );
                })
              }
            >
              Descargar
            </Button>
            {editable && view.draft && (
              <Button
                tone="secondary"
                disabled={busy || conflict}
                onClick={() =>
                  void run(async () => {
                    const saved = dirty ? await save() : view;
                    if (!saved) return;
                    const d = {
                      evidenceId: link.evidence.id,
                      expectedVersion: saved.lockVersion,
                    };
                    accept(
                      await client.request("invitationRemove", id, {
                        ...d,
                        requestId: requestId("remove", d),
                      }),
                    );
                  })
                }
              >
                Quitar del borrador
              </Button>
            )}
          </div>
        ))}
      {!!threads?.threads.length && (
        <section aria-label="Aclaraciones">
          <h2>Aclaraciones</h2>
          {threads.threads.map((t) => (
            <section key={t.id} className="invitation-thread">
              {t.messages.map((m) => (
                <div key={m.id}>
                  <strong>{m.author.displayName}</strong>
                  <p>{m.body}</p>
                </div>
              ))}
              {t.status === "WAITING_STAKEHOLDER" ? (
                <>
                  <Textarea
                    label="Tu aclaración"
                    value={reply[t.id] ?? ""}
                    maxLength={10000}
                    disabled={busy || conflict}
                    onChange={(e) =>
                      setReply({ ...reply, [t.id]: e.target.value })
                    }
                  />
                  <Button
                    disabled={busy || conflict || !reply[t.id]?.trim()}
                    onClick={() =>
                      void run(async () => {
                        const d = {
                          threadId: t.id,
                          body: reply[t.id],
                          expectedThreadVersion: t.lockVersion,
                          expectedVersion: threads.lockVersion,
                        };
                        await client.request("invitationReply", id, {
                          ...d,
                          requestId: requestId("reply", d),
                        });
                        setReply({ ...reply, [t.id]: "" });
                        setThreads(
                          await client.request("invitationClarifications", id),
                        );
                        setNotice("Aclaración enviada.");
                        onChange();
                      })
                    }
                  >
                    Enviar aclaración
                  </Button>
                </>
              ) : (
                <p>
                  {t.status === "CLOSED"
                    ? "Aclaración cerrada"
                    : "Tu aclaración está pendiente de revisión"}
                </p>
              )}
            </section>
          ))}
        </section>
      )}
      {confirm && (
        <Dialog
          title="Enviar respuesta"
          onClose={() => {
            if (!busy) setConfirm(false);
          }}
        >
          <p>
            Se enviará esta respuesta para revisión. Las otras preguntas
            mantienen su propio avance.
          </p>
          <Button
            disabled={busy}
            onClick={() =>
              void run(async () => {
                const saved = dirty || !view.draft ? await save() : view;
                if (!saved) return;
                const d = { expectedVersion: saved.lockVersion };
                accept(
                  await client.request("invitationSubmit", id, {
                    ...d,
                    requestId: requestId("submit", d),
                  }),
                );
                setEditing(false);
                setConfirm(false);
                setNotice("Respuesta enviada. Gracias por tu aportación.");
                heading.current?.focus();
              })
            }
          >
            Confirmar envío
          </Button>
          <Button
            tone="secondary"
            disabled={busy}
            onClick={() => setConfirm(false)}
          >
            Volver
          </Button>
        </Dialog>
      )}
      {(leave || blocker.state === "blocked") && (
        <Dialog
          title="Tienes cambios sin guardar"
          onClose={() => {
            setLeave(false);
            if (blocker.state === "blocked") blocker.reset();
          }}
        >
          <p>
            Guarda el borrador antes de salir. Los archivos elegidos y las
            aclaraciones sin enviar no se guardan automáticamente.
          </p>
          <Button
            onClick={() => {
              setLeave(false);
              if (blocker.state === "blocked") blocker.reset();
            }}
          >
            Seguir aquí
          </Button>
          <Button
            tone="secondary"
            disabled={busy}
            onClick={() => {
              if (blocker.state === "blocked") blocker.proceed();
              else onBack();
            }}
          >
            Salir sin guardar estos cambios
          </Button>
        </Dialog>
      )}
    </article>
  );
}
