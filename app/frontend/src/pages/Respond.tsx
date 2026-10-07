import { formatDate as date } from "../branding";
import { useEffect, useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Link,
  useBeforeUnload,
  useBlocker,
  useNavigate,
  useParams,
} from "react-router-dom";
import {
  ResponseContent,
  ResponseView,
  EvidenceView,
} from "@requirements/contracts";
import { api, ApiFailure, uploadEvidence, downloadEvidence } from "../api";
import {
  Alert,
  Button,
  Dialog,
  ErrorState,
  Input,
  LoadingState,
  Textarea,
} from "../ui";
import {
  nextParticipantPath,
  SubmittedResponseContent,
} from "./ParticipantFlow";
import { ParticipantIcon } from "./ParticipantIcon";
import { AnswerControl, answerText } from "./AnswerControl";
const empty: ResponseContent = {
  answer: null,
  comment: "",
  example: "",
  consultationRequested: false,
};
const initial = (v: ResponseView): ResponseContent => {
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
export function Respond() {
  const { projectId = "", id = "" } = useParams();
  const q = useQuery({
    queryKey: ["response", projectId, id],
    queryFn: () => api("getResponse", { projectId, id }),
    staleTime: 0,
    gcTime: 0,
  });
  if (q.isPending) return <LoadingState />;
  if (q.error)
    return <ErrorState error={q.error} retry={() => void q.refetch()} />;
  if (
    q.data.revisions.length > 0 ||
    q.data.reviewStatus === "VALIDATED" ||
    q.data.reviewStatus === "NOT_APPLICABLE" ||
    q.data.question.applicability !== "ENABLED"
  )
    return <SubmittedResponseContent data={q.data} projectId={projectId} />;
  return (
    <ResponseEditor
      key={projectId + id}
      data={q.data}
      projectId={projectId}
      id={id}
    />
  );
}
function ResponseEditor({
  data,
  projectId,
  id,
}: {
  data: ResponseView;
  projectId: string;
  id: string;
}) {
  const client = useQueryClient(),
    navigate = useNavigate();
  const [server, setServer] = useState(data),
    [editing, setEditing] = useState(!!data.draft || !data.revisions.length);
  const form = useForm<ResponseContent>({ defaultValues: initial(data) }),
    values = useWatch({ control: form.control }) as ResponseContent;
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState(""),
    [fields, setFields] = useState<Record<string, string>>({});
  const [conflict, setConflict] = useState<ResponseView | null>(null),
    [hasConflict, setHasConflict] = useState(false);
  const [localBackup, setLocalBackup] = useState<ResponseContent | null>(null),
    [leave, setLeave] = useState<(() => void) | null>(null);
  const [file, setFile] = useState<File | null>(null),
    [staged, setStaged] = useState<EvidenceView | null>(null);
  const allowNavigation = useRef(false),
    requests = useRef(new Map<string, string>()),
    errorRef = useRef<HTMLDivElement>(null);
  const dirty = form.formState.isDirty || !!file || !!staged;
  const blocker = useBlocker(() => dirty && !allowNavigation.current);
  useBeforeUnload((e) => {
    if (dirty || busy) {
      e.preventDefault();
      e.returnValue = "";
    }
  });
  useEffect(() => {
    const listener = (e: Event) => {
      if (dirty || busy) {
        e.preventDefault();
        const proceed = (e as CustomEvent<{ proceed: () => void }>).detail
          .proceed;
        setLeave(() => proceed);
      }
    };
    window.addEventListener("before-session-logout", listener);
    return () => window.removeEventListener("before-session-logout", listener);
  }, [dirty, busy]);
  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);
  useEffect(() => {
    const heading = document.querySelector<HTMLElement>("main h1");
    heading?.setAttribute("tabindex", "-1");
    heading?.focus();
    window.scrollTo(0, 0);
  }, []);
  function requestId(operation: string, payload: unknown) {
    const key = operation + JSON.stringify(payload);
    let value = requests.current.get(key);
    if (!value) {
      value = crypto.randomUUID();
      requests.current.set(key, value);
    }
    return value;
  }
  function content(): ResponseContent {
    const c = form.getValues();
    if (server.question.type === "NUMBER" && typeof c.answer === "string") {
      if (c.answer === "") return { ...c, answer: null };
      if (!/^-?(?:\d+)(?:\.\d{1,6})?$/.test(c.answer))
        throw new ApiFailure(422, "Introduce un número válido.", {
          answer:
            "Usa un número sin separadores de miles y hasta seis decimales.",
        });
      return { ...c, answer: Number(c.answer) };
    }
    return c;
  }
  function accept(v: ResponseView) {
    setServer(v);
    form.reset(initial(v));
    requests.current.clear();
    setHasConflict(false);
    setConflict(null);
    void client.invalidateQueries({ queryKey: ["my-work", projectId] });
  }
  function failed(e: unknown) {
    const failure =
      e instanceof Error ? e : new Error("No se pudo completar la operación.");
    setError(failure.message);
    setMessage("No se pudo guardar");
    if (e instanceof ApiFailure) {
      setFields(e.fields);
      if (e.status === 409) setHasConflict(true);
    }
  }
  async function save(destination: "stay" | "exit" | "consult" = "stay") {
    setBusy(true);
    setError("");
    setFields({});
    setMessage("Guardando…");
    try {
      const payload = {
        ...content(),
        ...(destination === "consult" ? { consultationRequested: true } : {}),
        expectedVersion: server.lockVersion,
      };
      const result = await api(
        "saveDraft",
        { projectId, id },
        { ...payload, requestId: requestId("save", payload) },
      );
      accept(result);
      setMessage("Borrador guardado · " + date(result.draft!.updatedAt));
      if (destination !== "stay" && !file && !staged) {
        const target =
          destination === "consult"
            ? await nextParticipantPath(projectId, id).catch(
                () => `/projects/${projectId}/work`,
              )
            : `/projects/${projectId}/work`;
        allowNavigation.current = true;
        navigate(target, {
          state: {
            participantNotice:
              destination === "consult"
                ? "Pregunta marcada como Por consultar. Tu borrador se conserva."
                : "Borrador guardado. Puedes retomarlo después.",
          },
        });
      }
      return result;
    } catch (e) {
      failed(e);
      return null;
    } finally {
      setBusy(false);
    }
  }
  async function submit() {
    setBusy(true);
    setError("");
    setFields({});
    try {
      let current = server;
      if (form.formState.isDirty || !server.draft) {
        const saved = await save();
        if (!saved) return;
        current = saved;
        setBusy(true);
      }
      const payload = { expectedVersion: current.lockVersion };
      const result = await api(
        "submitResponse",
        { projectId, id },
        { ...payload, requestId: requestId("submit", payload) },
      );
      accept(result);
      setEditing(false);
      setMessage("Respuesta enviada. Pendiente de revisión.");
      const target = await nextParticipantPath(projectId, id).catch(
        () => `/projects/${projectId}/work`,
      );
      allowNavigation.current = true;
      navigate(target, {
        state: {
          participantNotice:
            "Respuesta enviada. El equipo de revisión la recibirá.",
        },
      });
    } catch (e) {
      failed(e);
    } finally {
      setBusy(false);
    }
  }
  async function attach() {
    if (!file && !staged) return;
    setBusy(true);
    setError("");
    setMessage("Adjuntando evidencia…");
    try {
      let current = server;
      if (form.formState.isDirty || !server.draft) {
        const saved = await save();
        if (!saved) return;
        current = saved;
        setBusy(true);
      }
      let evidence = staged;
      if (!evidence && file) {
        const metadata = { originalName: file.name };
        evidence = await uploadEvidence(
          { projectId, id },
          {
            ...metadata,
            requestId: requestId("stage", {
              ...metadata,
              size: file.size,
              lastModified: file.lastModified,
            }),
          },
          file,
        );
        setStaged(evidence);
      }
      if (!evidence) return;
      const payload = {
        expectedVersion: current.lockVersion,
        evidenceId: evidence.id,
      };
      const result = await api(
        "attachEvidenceToDraft",
        { projectId, id },
        { ...payload, requestId: requestId("attach", payload) },
      );
      accept(result);
      setFile(null);
      setStaged(null);
      setMessage("Evidencia adjunta al borrador. Todavía no se ha enviado.");
    } catch (e) {
      failed(e);
    } finally {
      setBusy(false);
    }
  }
  async function remove(evidenceId: string) {
    setBusy(true);
    setError("");
    try {
      const local = form.getValues(),
        wasDirty = form.formState.isDirty;
      const payload = { expectedVersion: server.lockVersion, evidenceId };
      const result = await api(
        "removeDraftEvidence",
        { projectId, id },
        { ...payload, requestId: requestId("remove", payload) },
      );
      accept(result);
      if (wasDirty)
        for (const key of Object.keys(local) as (keyof ResponseContent)[])
          form.setValue(key, local[key], { shouldDirty: true });
      setMessage(
        "Adjunto retirado del borrador. Los envíos anteriores se conservan.",
      );
    } catch (e) {
      failed(e);
    } finally {
      setBusy(false);
    }
  }
  async function download(e: EvidenceView) {
    try {
      const blob = await downloadEvidence(projectId, e.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = e.originalName;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  function files(
    list: { id: string; evidence: EvidenceView }[],
    removable = false,
  ) {
    return list.length ? (
      <ul className="evidence-list">
        {list.map(({ id: link, evidence: e }) => (
          <li key={link}>
            <div>
              <strong>{e.originalName}</strong>
              <span className="hint">
                {(e.byteSize / 1024).toFixed(1)} KB
                {e.status === "QUARANTINED"
                  ? " · En revisión de seguridad"
                  : ""}
              </span>
            </div>
            <div className="actions">
              <Button
                tone="secondary"
                disabled={busy || e.status !== "READY"}
                onClick={() => void download(e)}
              >
                Descargar {e.originalName}
              </Button>
              {removable && (
                <Button
                  tone="secondary"
                  disabled={busy}
                  onClick={() => void remove(e.id)}
                >
                  Retirar {e.originalName}
                </Button>
              )}
            </div>
          </li>
        ))}
      </ul>
    ) : (
      <p className="hint">Sin evidencias adjuntas.</p>
    );
  }
  const saveStatus = (
    <p className="save-status" role="status" aria-live="polite">
      {busy
        ? message || "Procesando…"
        : error
          ? "No se pudo guardar"
          : dirty
            ? "Cambios sin guardar"
            : message ||
              (server.draft
                ? `Borrador guardado · ${date(server.draft.updatedAt)}`
                : "")}
    </p>
  );
  return (
    <section className="response-page participant-page">
      <div className="participant-step-meta">
        <span>{server.question.sectionTitle}</span>
        <span>
          {server.question.position
            ? `Pregunta ${server.question.position} de ${server.question.total}`
            : "Fuera del recorrido actual"}
        </span>
      </div>
      <div
        className="participant-progress"
        role="progressbar"
        aria-label="Posición en el cuestionario"
        aria-valuetext={`Pregunta ${server.question.position} de ${server.question.total}. La posición no indica cuántas respuestas has enviado.`}
        aria-valuemin={0}
        aria-valuemax={Math.max(1, server.question.total)}
        aria-valuenow={Math.max(0, server.question.position - 1)}
      >
        <span
          style={{
            width: `${server.question.total ? (Math.max(0, server.question.position - 1) / server.question.total) * 100 : 0}%`,
          }}
        />
      </div>
      <div className="participant-answer-card">
        {server.question.helpText && (
          <p className="help">
            <ParticipantIcon name="info" />
            {server.question.helpText}
          </p>
        )}
        <h1>{server.question.question}</h1>
        {values.consultationRequested && (
          <p className="participant-badge consultation">
            <ParticipantIcon name="flag" />
            Por consultar
          </p>
        )}
        {server.reviewStatus === "NOT_APPLICABLE" && (
          <Alert>
            El analista marcó esta pregunta como no aplica. Conservamos tu
            contenido; para aportar de nuevo debe reabrirla.
          </Alert>
        )}
        {server.question.applicability !== "ENABLED" && (
          <Alert>
            Esta pregunta depende de una respuesta anterior enviada. Conservamos
            tu contenido, pero no puedes enviarlo hasta que esté habilitada.
          </Alert>
        )}
        {error && (
          <div ref={errorRef} tabIndex={-1}>
            <Alert error>
              {error}
              {hasConflict && (
                <p>
                  <Button
                    tone="secondary"
                    disabled={busy}
                    onClick={() => {
                      void api("getDraft", { projectId, id })
                        .then(setConflict)
                        .catch(failed);
                    }}
                  >
                    Consultar versión del servidor
                  </Button>
                </p>
              )}
            </Alert>
          </div>
        )}
        {!editing && saveStatus}
        {editing ? (
          <>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void submit();
              }}
            >
              <fieldset
                className="formal-contribution"
                disabled={server.reviewStatus === "NOT_APPLICABLE"}
              >
                <legend className="sr-only">Contenido de la aportación</legend>
                <AnswerControl
                  compact
                  question={server.question}
                  value={values.answer}
                  onChange={(a) =>
                    form.setValue("answer", a, { shouldDirty: true })
                  }
                  error={fields.answer}
                  disabled={busy}
                />
                <Textarea
                  label="Comentario adicional (opcional)"
                  rows={2}
                  {...form.register("comment")}
                  maxLength={10000}
                  error={fields.comment}
                  disabled={busy}
                />
                <details className="participant-disclosure">
                  <summary>Agregar un ejemplo (opcional)</summary>
                  <Textarea
                    label="Ejemplo (opcional)"
                    {...form.register("example")}
                    maxLength={10000}
                    disabled={busy}
                  />
                </details>
                <details className="participant-disclosure evidence-section next-participant-evidence">
                  <summary>
                    <ParticipantIcon name="paperclip" />
                    Adjuntar evidencia
                    {server.draft?.evidence.length
                      ? ` (${server.draft.evidence.length})`
                      : ""}
                    {!!server.draft?.evidence.length && (
                      <span className="next-evidence-summary">
                        {server.draft.evidence
                          .map((link) => link.evidence.originalName)
                          .join(" · ")}
                      </span>
                    )}
                  </summary>
                  {files(server.draft?.evidence ?? [], true)}
                  <Input
                    key={file ? "chosen" : "empty"}
                    label="Seleccionar evidencia"
                    type="file"
                    accept=".pdf,.docx,.xlsx,.png,.jpg,.jpeg"
                    hint={`PDF, Word, Excel o imagen sin macros ni cifrado. Hasta ${server.evidencePolicy.maxBytes / 1048576} MiB por archivo y ${server.evidencePolicy.maxAttachments} adjuntos.`}
                    disabled={busy}
                    onChange={(e) => {
                      setFile(e.target.files?.[0] ?? null);
                      setStaged(null);
                    }}
                  />
                  {file && <p>{file.name} · pendiente de adjuntar</p>}
                  {(file || staged) && (
                    <div className="actions">
                      <Button
                        tone="secondary"
                        disabled={busy}
                        onClick={() => void attach()}
                      >
                        Adjuntar al borrador
                      </Button>
                      <Button
                        tone="secondary"
                        disabled={busy}
                        onClick={() => {
                          setFile(null);
                          setStaged(null);
                        }}
                      >
                        Cancelar selección
                      </Button>
                    </div>
                  )}
                  <p className="hint">
                    Adjuntar confirma los cambios actuales del borrador. No
                    envía la respuesta.
                  </p>
                </details>
                {(file || staged) && (
                  <p className="hint">
                    Adjunta el archivo seleccionado o cancela su selección antes
                    de continuar.
                  </p>
                )}
                {saveStatus}
                <div className="response-actions">
                  <Button
                    className="participant-text-button"
                    disabled={
                      busy ||
                      !!file ||
                      !!staged ||
                      server.question.applicability !== "ENABLED"
                    }
                    onClick={() => void save("consult")}
                  >
                    <ParticipantIcon name="help" />
                    Necesito consultar esto
                  </Button>
                  <div className="actions">
                    <Button
                      tone="secondary"
                      disabled={busy || !!file || !!staged}
                      onClick={() => void save("exit")}
                    >
                      Guardar y salir
                    </Button>
                    <Button
                      type="submit"
                      disabled={
                        busy ||
                        !!file ||
                        !!staged ||
                        server.question.applicability !== "ENABLED"
                      }
                    >
                      Enviar respuesta <ParticipantIcon name="arrow" />
                    </Button>
                  </div>
                </div>
                <p className="hint">
                  “Guardar y salir” conserva tu borrador privado, incluso si aún
                  no respondes. “Enviar respuesta” registra una versión que no
                  se puede modificar.
                </p>
              </fieldset>
            </form>
          </>
        ) : (
          <>
            <p>
              Tu respuesta fue enviada y ya no está en la cola de pendientes.
            </p>
            <Link className="button primary" to={`/projects/${projectId}/work`}>
              Volver a Mi trabajo
            </Link>
          </>
        )}
      </div>
      {conflict && (
        <Dialog
          title="Comparar con el borrador del servidor"
          onClose={() => setConflict(null)}
        >
          <h3>Tu contenido local</h3>
          <p className="answer-text">
            {answerText(server.question, values.answer)}
          </p>
          <p>{values.comment}</p>
          <h3>Último contenido confirmado</h3>
          <p className="answer-text">
            {answerText(conflict.question, initial(conflict).answer)}
          </p>
          <p>{initial(conflict).comment}</p>
          <p>
            Tu contenido se conserva como copia en esta pantalla cuando eliges
            la versión del servidor.
          </p>
          <Button
            onClick={() => {
              setLocalBackup(form.getValues());
              accept(conflict);
              setError("");
              setEditing(!conflict.revisions.length);
              setMessage(
                "Versión del servidor recuperada. Conservas una copia local debajo.",
              );
            }}
          >
            Usar versión del servidor y conservar copia local
          </Button>
        </Dialog>
      )}
      {localBackup && (
        <aside className="local-copy">
          <h2>Copia de tus cambios anteriores</h2>
          <p className="answer-text">
            {answerText(server.question, localBackup.answer)}
          </p>
          <p>{localBackup.comment}</p>
          <p>{localBackup.example}</p>
          <Button
            tone="secondary"
            onClick={() => {
              for (const key of Object.keys(
                localBackup,
              ) as (keyof ResponseContent)[])
                form.setValue(key, localBackup[key], { shouldDirty: true });
              setEditing(true);
            }}
          >
            Llevar copia local al formulario
          </Button>
        </aside>
      )}
      {(blocker.state === "blocked" || leave) && (
        <Dialog
          title="Tienes cambios sin guardar"
          onClose={() => {
            if (blocker.state === "blocked") blocker.reset();
            setLeave(null);
          }}
        >
          <p>
            Guarda antes de salir para recuperar tus cambios después. Los
            cambios sin confirmar solo están en esta pestaña.
          </p>
          <div className="actions">
            <Button
              onClick={() => {
                if (blocker.state === "blocked") blocker.reset();
                setLeave(null);
              }}
            >
              Volver al borrador
            </Button>
            <Button
              tone="danger"
              disabled={busy}
              onClick={() => {
                allowNavigation.current = true;
                if (blocker.state === "blocked") blocker.proceed();
                leave?.();
                setLeave(null);
              }}
            >
              Salir sin guardar
            </Button>
          </div>
        </Dialog>
      )}
    </section>
  );
}
