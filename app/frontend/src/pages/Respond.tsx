import { useBranding } from "../branding";
import { useDraftAutosave } from "../use-draft-autosave";
import {
  draftKey,
  draftText,
  readDraftText,
  writeDraftText,
  removeDraftText,
} from "../draft-recovery";
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
import { StatusChip } from "../ui/semantic";
import { ParticipantIcon } from "./ParticipantIcon";
import { AnswerControl, answerText } from "./AnswerControl";
import { SaveStatus } from "./SaveStatus";
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
export function Respond({ userId }: { userId: string }) {
  const { projectId = "", id = "" } = useParams();
  const q = useQuery({
    queryKey: ["response", projectId, id],
    queryFn: () => api("getResponse", { projectId, id }),
    staleTime: 0,
    gcTime: 0,
  });
  if (q.isPending) return <LoadingState skeleton />;
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
      userId={userId}
      data={q.data}
      projectId={projectId}
      id={id}
    />
  );
}
function ResponseEditor({
  userId,
  data,
  projectId,
  id,
}: {
  userId: string;
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
    [leave, setLeave] = useState<(() => void) | null>(null),
    [leaveError, setLeaveError] = useState("");
  const [file, setFile] = useState<File | null>(null),
    [staged, setStaged] = useState<EvidenceView | null>(null);
  const allowNavigation = useRef(false),
    leaveAttempt = useRef(0),
    requests = useRef(new Map<string, string>()),
    errorRef = useRef<HTMLDivElement>(null);
  const pageRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const page = pageRef.current!;
    const viewport = window.visualViewport;
    let frame = 0;
    const revealField = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const mobile = window.innerWidth <= 640;
        const height = viewport?.height ?? window.innerHeight;
        const unzoomed = (viewport?.scale ?? 1) <= 1.01;
        page.style.setProperty(
          "--response-viewport-inset",
          `${mobile && unzoomed ? Math.max(0, window.innerHeight - height) : 0}px`,
        );
        page.classList.toggle(
          "response-short-viewport",
          mobile && unzoomed && height <= 600,
        );
        const field = document.activeElement;
        if (
          !mobile ||
          !field ||
          !page.contains(field) ||
          !field.matches('input:not([type="file"]), textarea, select')
        )
          return;
        const footer = page.querySelector<HTMLElement>(".response-footer");
        if (!footer) return;
        const top = (viewport?.offsetTop ?? 0) + 8;
        const bottom =
          Math.min(
            (viewport?.offsetTop ?? 0) + height,
            getComputedStyle(footer).position === "sticky"
              ? footer.getBoundingClientRect().top
              : Infinity,
          ) - 8;
        const box = field.getBoundingClientRect();
        // El desplazamiento nativo de foco no tiene en cuenta el pie superpuesto.
        if (box.top < top) window.scrollBy(0, box.top - top);
        else if (box.bottom > bottom) window.scrollBy(0, box.bottom - bottom);
      });
    };
    page.addEventListener("focusin", revealField);
    window.addEventListener("resize", revealField);
    viewport?.addEventListener("resize", revealField);
    viewport?.addEventListener("scroll", revealField);
    revealField();
    return () => {
      cancelAnimationFrame(frame);
      page.removeEventListener("focusin", revealField);
      window.removeEventListener("resize", revealField);
      viewport?.removeEventListener("resize", revealField);
      viewport?.removeEventListener("scroll", revealField);
    };
  }, []);
  const branding = useBranding();
  const backupKey = draftKey(userId, projectId, id);
  const serverRef = useRef(data),
    pendingSave = useRef<Promise<ResponseView | null> | null>(null);
  const busyRef = useRef(false),
    mounted = useRef(true),
    sessionActive = useRef(true);
  const [saving, setSaving] = useState(false),
    [savingStartedAt, setSavingStartedAt] = useState<number | null>(null),
    [authenticated, setAuthenticated] = useState(true);
  const [recovery, setRecovery] = useState(() => {
    const copy = readDraftText(backupKey);
    return copy &&
      JSON.stringify(copy) !==
        JSON.stringify(draftText(data.question.type, initial(data)))
      ? copy
      : null;
  });
  const [backupUnavailable, setBackupUnavailable] = useState(false);
  function working(value: boolean) {
    busyRef.current = value;
    setBusy(value);
  }
  const savedTime = (value: string) =>
    new Intl.DateTimeFormat(branding.locale, {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: branding.timezone,
    }).format(new Date(value));
  useEffect(() => {
    mounted.current = true;
    const expired = () => {
      sessionActive.current = false;
      setAuthenticated(false);
      removeDraftText(backupKey);
      setRecovery(null);
    };
    const restored = (event: Event) => {
      if ((event as CustomEvent<{ userId: string }>).detail.userId === userId) {
        sessionActive.current = true;
        setAuthenticated(true);
      }
    };
    window.addEventListener("session-expired", expired);
    window.addEventListener("session-restored", restored);
    return () => {
      mounted.current = false;
      window.removeEventListener("session-expired", expired);
      window.removeEventListener("session-restored", restored);
    };
  }, [backupKey, userId]);
  useEffect(() => {
    if (!sessionActive.current || recovery) return;
    const copy = draftText(server.question.type, values);
    if (
      JSON.stringify(copy) !==
      JSON.stringify(draftText(server.question.type, initial(server)))
    ) {
      setBackupUnavailable(!writeDraftText(backupKey, copy));
    } else removeDraftText(backupKey);
  }, [values, server, backupKey, recovery, authenticated]);
  const resetAutosave = useDraftAutosave({
    changed: JSON.stringify(values),
    dirty: form.formState.isDirty,
    enabled: editing && !busy && !hasConflict && authenticated && !recovery,
    savedAt: server.draft ? Date.parse(server.draft.updatedAt) : 0,
    save: () => save("stay", true),
  });
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
  function accept(v: ResponseView, sent?: ResponseContent) {
    const current = form.getValues();
    serverRef.current = v;
    setServer(v);
    form.reset(initial(v));
    if (sent)
      for (const key of Object.keys(current) as (keyof ResponseContent)[]) {
        if (JSON.stringify(current[key]) !== JSON.stringify(sent[key]))
          form.setValue(key, current[key], { shouldDirty: true });
      }
    removeDraftText(backupKey);
    setRecovery(null);
    requests.current.clear();
    setHasConflict(false);
    setConflict(null);
    void client.invalidateQueries({ queryKey: ["my-work", projectId] });
  }
  function failed(e: unknown) {
    const failure =
      e instanceof Error ? e : new Error("No se pudo completar la operación.");
    setError(failure.message);
    setMessage("");
    if (e instanceof ApiFailure) {
      setFields(e.fields);
      if (e.status === 409) setHasConflict(true);
    }
  }
  function edited(field: keyof ResponseContent) {
    setFields((current) => {
      const next = { ...current };
      delete next[field];
      return next;
    });
    setError("");
    setMessage("");
  }
  async function save(
    destination: "stay" | "exit" | "consult" = "stay",
    automatic = false,
  ) {
    if (
      !sessionActive.current ||
      (automatic && (busyRef.current || hasConflict))
    )
      return null;
    if (!automatic) {
      resetAutosave();
      working(true);
    }
    let own: Promise<ResponseView | null> | null = null;
    try {
      // La acción manual espera el guardado automático antes de tomar su versión.
      if (pendingSave.current) {
        const previous = await pendingSave.current;
        if (!previous && automatic) return null;
      }
      if (!mounted.current || !sessionActive.current) return null;
      // Comparar la edición cruda: el campo numérico usa texto y la API, números.
      const submittedForm = form.getValues();
      const sent = {
        ...content(),
        ...(destination === "consult" ? { consultationRequested: true } : {}),
      };
      if (
        automatic &&
        JSON.stringify(sent) === JSON.stringify(initial(serverRef.current))
      )
        return serverRef.current;
      setError("");
      setFields({});
      setSaving(true);
      setSavingStartedAt(Date.now());
      setMessage("Guardando…");
      own = (async () => {
        let result = serverRef.current;
        if (
          !result.draft ||
          JSON.stringify(sent) !== JSON.stringify(initial(result))
        ) {
          const payload = { ...sent, expectedVersion: result.lockVersion };
          result = await api(
            "saveDraft",
            { projectId, id },
            { ...payload, requestId: requestId("save", payload) },
          );
        }
        if (mounted.current && sessionActive.current) {
          accept(result, submittedForm);
          setMessage(
            "Borrador guardado a las " + savedTime(result.draft!.updatedAt),
          );
        }
        return result;
      })().catch((e: unknown) => {
        if (mounted.current) failed(e);
        return null;
      });
      pendingSave.current = own;
      const result = await own;
      if (
        result &&
        mounted.current &&
        destination !== "stay" &&
        !file &&
        !staged
      ) {
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
      if (mounted.current) failed(e);
      return null;
    } finally {
      if (pendingSave.current === own) pendingSave.current = null;
      if (mounted.current) {
        setSaving(false);
        if (!automatic) working(false);
      }
    }
  }
  function cancelLeave() {
    leaveAttempt.current++;
    if (blocker.state === "blocked") blocker.reset();
    setLeave(null);
    setLeaveError("");
  }
  async function saveAndLeave() {
    const attempt = ++leaveAttempt.current;
    setLeaveError("");
    const result = await save();
    if (
      !result ||
      !mounted.current ||
      !sessionActive.current ||
      attempt !== leaveAttempt.current
    )
      return;
    try {
      if (JSON.stringify(content()) !== JSON.stringify(initial(result))) {
        setLeaveError("Hay cambios más recientes. Guárdalos antes de salir.");
        return;
      }
    } catch {
      setLeaveError("Hay cambios más recientes. Guárdalos antes de salir.");
      return;
    }
    allowNavigation.current = true;
    if (blocker.state === "blocked") blocker.proceed();
    leave?.();
    setLeave(null);
  }
  async function submit() {
    resetAutosave();
    working(true);
    setError("");
    setFields({});
    try {
      if (pendingSave.current) await pendingSave.current;
      let current = serverRef.current;
      if (form.formState.isDirty || !server.draft) {
        const saved = await save();
        if (!saved) return;
        current = saved;
        working(true);
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
      working(false);
    }
  }
  async function attach() {
    if (!file && !staged) return;
    working(true);
    setError("");
    setMessage("Adjuntando evidencia…");
    try {
      if (pendingSave.current && !(await pendingSave.current)) return;
      let current = serverRef.current;
      if (form.formState.isDirty || !server.draft) {
        const saved = await save();
        if (!saved) return;
        current = saved;
        working(true);
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
      working(false);
    }
  }
  async function remove(evidenceId: string) {
    working(true);
    setError("");
    try {
      if (pendingSave.current && !(await pendingSave.current)) return;
      const local = form.getValues(),
        wasDirty = form.formState.isDirty;
      const payload = {
        expectedVersion: serverRef.current.lockVersion,
        evidenceId,
      };
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
      working(false);
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
    <SaveStatus
      saving={saving}
      startedAt={savingStartedAt}
      busy={busy}
      error={
        error
          ? Object.keys(fields).length === 1
            ? Object.values(fields)[0]!
            : error
          : ""
      }
      dirty={dirty}
      message={message}
      savedMessage={
        server.draft
          ? `Borrador guardado a las ${savedTime(server.draft.updatedAt)}`
          : ""
      }
    />
  );
  return (
    <section ref={pageRef} className="response-page participant-page">
      <div className="participant-step-meta">
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
        <p className="participant-overline">{server.question.sectionTitle}</p>
        <h1>{server.question.question}</h1>
        {server.question.helpText && (
          <p className="help">
            <ParticipantIcon name="info" />
            {server.question.helpText}
          </p>
        )}
        {values.consultationRequested && (
          <p>
            <StatusChip tone="warning" icon="flag">
              Por consultar
            </StatusChip>
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
        {recovery && (
          <Alert>
            <p>
              Hay texto sin guardar de esta pregunta en esta pestaña. ¿Quieres
              recuperarlo?
            </p>
            <div className="actions">
              <Button
                onClick={() => {
                  for (const [key, value] of Object.entries(recovery))
                    form.setValue(
                      key as "answer" | "comment" | "example",
                      value,
                      { shouldDirty: true },
                    );
                  setRecovery(null);
                }}
              >
                Restaurar texto de esta pestaña
              </Button>
              <Button
                tone="secondary"
                onClick={() => {
                  removeDraftText(backupKey);
                  setRecovery(null);
                }}
              >
                Descartar copia de esta pestaña
              </Button>
            </div>
          </Alert>
        )}
        {backupUnavailable && (
          <Alert>
            No se pudo guardar una copia en esta pestaña. Conserva esta pantalla
            hasta que se confirme el guardado.
          </Alert>
        )}
        {((error && Object.keys(fields).length >= 2) || hasConflict) && (
          <div ref={errorRef} tabIndex={-1}>
            {error && Object.keys(fields).length >= 2 && (
              <Alert error>{error}</Alert>
            )}
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
                  onChange={(a) => {
                    form.setValue("answer", a, { shouldDirty: true });
                    edited("answer");
                  }}
                  error={fields.answer}
                  disabled={busy}
                />
                <Textarea
                  label="Comentario adicional (opcional)"
                  rows={2}
                  {...form.register("comment", {
                    onChange: () => edited("comment"),
                  })}
                  maxLength={10000}
                  error={fields.comment}
                  disabled={busy}
                />
                <details className="participant-disclosure">
                  <summary>Agregar un ejemplo (opcional)</summary>
                  <Textarea
                    label="Ejemplo (opcional)"
                    {...form.register("example", {
                      onChange: () => edited("example"),
                    })}
                    error={fields.example}
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
                <p className="hint">
                  “Guardar y salir” conserva tu borrador privado, incluso si aún
                  no respondes. “Enviar respuesta” registra una versión que no
                  se puede modificar.
                </p>
                {saveStatus}
                <div className="response-footer">
                  <div className="response-actions">
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
                </div>
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
        <Dialog title="Tienes cambios sin guardar" onClose={cancelLeave}>
          <p>
            Guarda antes de salir para recuperar tus cambios después. Los
            cambios sin confirmar solo están en esta pestaña.
          </p>
          {(error || leaveError) && <Alert error>{leaveError || error}</Alert>}
          {(file || staged) && (
            <p>
              Vuelve al borrador para adjuntar el archivo o cancelar su
              selección antes de guardar y salir.
            </p>
          )}
          <div className="actions">
            <Button
              data-autofocus
              disabled={busy || !!file || !!staged}
              onClick={() => void saveAndLeave()}
            >
              Guardar y salir
            </Button>
            <Button tone="secondary" onClick={cancelLeave}>
              Volver al borrador
            </Button>
            <Button
              tone="danger"
              disabled={busy}
              onClick={() => {
                leaveAttempt.current++;
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
