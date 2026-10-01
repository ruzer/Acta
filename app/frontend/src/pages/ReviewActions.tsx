import { useEffect, useRef, useState } from "react";
import { contracts, type ReviewDetail } from "@requirements/contracts";
import { api, ApiFailure, formValues } from "../api";
import { Alert, Button, Checkbox, Dialog, Select, Textarea } from "../ui";
export type ReviewAction =
  | "requestClarification"
  | "closeClarification"
  | "markPartial"
  | "markPending"
  | "validateQuestion"
  | "markNotApplicable"
  | "reopenQuestion"
  | "markConflict"
  | "resolveConflict";
export const actionLabels: Record<ReviewAction, string> = {
  requestClarification: "Solicitar aclaración",
  closeClarification: "Cerrar aclaración",
  markPartial: "Marcar respuesta parcial",
  markPending: "Marcar pendiente",
  validateQuestion: "Registrar decisión",
  markNotApplicable: "Marcar no aplica",
  reopenQuestion: "Reabrir pregunta",
  markConflict: "Marcar conflicto",
  resolveConflict: "Resolver conflicto",
};
export function ReviewActionDialog({
  data: d,
  action,
  threadId,
  conflictId,
  onClose,
  onDone,
  refresh,
}: {
  data: ReviewDetail;
  action: ReviewAction;
  threadId?: string;
  conflictId?: string;
  onClose: () => void;
  onDone: () => void;
  refresh: () => Promise<unknown>;
}) {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [dirty, setDirty] = useState(false),
    [conflict, setConflict] = useState(false);
  const request = useRef({ key: "", id: "" });
  const t = d.threads.find((t) => t.id === threadId),
    c = d.conflicts.find((c) => c.id === conflictId);
  const sources =
    action === "markConflict"
      ? d.submissions
      : d.submissions.filter((s) => s.current);
  useEffect(() => {
    const guard = (event: BeforeUnloadEvent) => {
      if (dirty) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, [dirty]);
  function close() {
    if (
      !busy &&
      (!dirty ||
        window.confirm("Hay texto sin registrar. ¿Descartarlo y cerrar?"))
    )
      onClose();
  }
  async function submit(form: HTMLFormElement) {
    const v = formValues(form),
      fd = new FormData(form);
    setError("");
    setBusy(true);
    const payload = {
      expectedVersion: d.lockVersion,
      ...(action === "requestClarification"
        ? {
            body: v.body,
            responseRevisionId: t?.responseRevisionId ?? v.responseRevisionId,
            threadId: t?.id ?? null,
            expectedThreadVersion: t?.lockVersion ?? null,
          }
        : action === "closeClarification"
          ? {
              reason: v.reason,
              threadId: t?.id,
              expectedThreadVersion: t?.lockVersion,
            }
          : action === "validateQuestion"
            ? {
                decisionText: v.decisionText,
                scope: v.scope,
                exceptions: v.exceptions,
                validationComment: v.validationComment,
                coverageExplanation: v.coverageExplanation ?? "",
                responseRevisionIds: fd.getAll("sources"),
                clarificationMessageIds: fd.getAll("messages"),
                conflictResolutionIds: fd.getAll("resolutions"),
              }
            : action === "markConflict"
              ? { reason: v.reason, responseRevisionIds: fd.getAll("sources") }
              : action === "resolveConflict"
                ? {
                    resolutionText: v.resolutionText,
                    conflictId: c?.id,
                    expectedConflictVersion: c?.lockVersion,
                    responseRevisionIds: fd.getAll("sources"),
                  }
                : action === "markNotApplicable"
                  ? { reason: v.reason, scope: v.scope }
                  : { reason: v.reason }),
    };
    try {
      const key = JSON.stringify(payload);
      if (request.current.key !== key)
        request.current = { key, id: crypto.randomUUID() };
      const parsed = contracts[action].input.safeParse({
        ...payload,
        requestId: request.current.id,
      });
      if (!parsed.success) {
        setError(
          "Completa los campos obligatorios y selecciona las fuentes necesarias.",
        );
        return;
      }
      await api(
        action,
        { projectId: d.projectId, id: d.question.id },
        parsed.data,
      );
      setDirty(false);
      onDone();
    } catch (e) {
      setError((e as Error).message);
      setConflict(e instanceof ApiFailure && e.status === 409);
    } finally {
      setBusy(false);
    }
  }
  const pickSources = [
    "validateQuestion",
    "markConflict",
    "resolveConflict",
  ].includes(action);
  return (
    <Dialog title={actionLabels[action]} onClose={close}>
      <form
        onChange={() => setDirty(true)}
        onSubmit={(e) => {
          e.preventDefault();
          void submit(e.currentTarget);
        }}
      >
        <p>{d.question.title}</p>
        {error && <Alert error>{error}</Alert>}
        {conflict && (
          <Button
            tone="secondary"
            disabled={busy}
            onClick={() =>
              void refresh().then(() => {
                setConflict(false);
                setError(
                  "Información actualizada. Tu texto se conservó: revisa las fuentes antes de registrar.",
                );
              })
            }
          >
            Actualizar información conservando texto
          </Button>
        )}
        <fieldset disabled={busy} className="review-form-fields">
          <legend className="sr-only">
            Datos de {actionLabels[action].toLowerCase()}
          </legend>
          {action === "requestClarification" && (
            <>
              {!t && (
                <Select
                  name="responseRevisionId"
                  label="Respuesta sobre la que necesitas aclaración"
                  required
                  defaultValue=""
                >
                  <option value="">Selecciona una respuesta</option>
                  {d.submissions
                    .filter((s) => s.current)
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.respondent.displayName} · envío #{s.number}
                      </option>
                    ))}
                </Select>
              )}
              <Textarea
                label="Pregunta de aclaración"
                name="body"
                required
                maxLength={10000}
              />
              <p className="hint">
                La respuesta enviada se conserva. El participante recibirá esta
                pregunta en sus pendientes.
              </p>
            </>
          )}
          {action === "validateQuestion" && (
            <>
              <Textarea
                label="Decisión acordada"
                name="decisionText"
                required
                maxLength={10000}
              />
              <Textarea
                label="Alcance"
                name="scope"
                required
                maxLength={10000}
              />
              <Textarea
                label="Excepciones (opcional)"
                name="exceptions"
                maxLength={10000}
              />
              <Textarea
                label="Comentario interno"
                name="validationComment"
                required
                maxLength={10000}
              />
              {d.partialReviewReason && (
                <Textarea
                  label="Cómo se atendió la información faltante"
                  name="coverageExplanation"
                  required
                  maxLength={10000}
                />
              )}
            </>
          )}
          {action === "resolveConflict" && (
            <>
              <Textarea
                label="Resolución del conflicto"
                name="resolutionText"
                required
                maxLength={10000}
              />
              <p className="hint">
                Resolver no valida la pregunta. Después podrás registrar la
                decisión acordada.
              </p>
            </>
          )}
          {[
            "markPartial",
            "markPending",
            "markNotApplicable",
            "reopenQuestion",
            "markConflict",
            "closeClarification",
          ].includes(action) && (
            <Textarea label="Motivo" name="reason" required maxLength={10000} />
          )}
          {action === "markNotApplicable" && (
            <Textarea
              label="Alcance de no aplica"
              name="scope"
              required
              maxLength={10000}
            />
          )}
          {action === "markPending" && (
            <p className="hint">
              El motivo se conserva. Si ya hay respuestas, el estado refleja
              primero su cobertura (respondida o parcial).
            </p>
          )}
          {pickSources && (
            <fieldset>
              <legend>Fuentes utilizadas</legend>
              <p className="hint">
                Selecciona{" "}
                {action === "markConflict"
                  ? "al menos dos envíos de participantes distintos"
                  : "las respuestas enviadas que sustentan esta decisión"}
                .
              </p>
              {sources.map((s) => (
                <Checkbox
                  key={s.id}
                  name="sources"
                  value={s.id}
                  label={`${s.respondent.displayName} · envío #${s.number}${s.current ? "" : " · histórico"}`}
                />
              ))}
              {action === "validateQuestion" && (
                <>
                  {d.threads
                    .filter((t) => t.status === "CLOSED")
                    .flatMap((t) =>
                      t.messages.map((m) => (
                        <Checkbox
                          key={m.id}
                          name="messages"
                          value={m.id}
                          label={`Aclaración de ${m.author.displayName}: ${m.body}`}
                        />
                      )),
                    )}
                  {d.conflicts
                    .filter((c) => c.resolution)
                    .map((c) => (
                      <Checkbox
                        key={c.id}
                        name="resolutions"
                        value={c.resolution!.id}
                        label={`Resolución: ${c.resolution!.resolutionText}`}
                      />
                    ))}
                </>
              )}
            </fieldset>
          )}
        </fieldset>
        <div className="actions">
          <Button type="submit" disabled={busy}>
            {busy
              ? "Registrando…"
              : action === "validateQuestion"
                ? "Registrar como validada"
                : action === "requestClarification"
                  ? "Enviar solicitud"
                  : actionLabels[action]}
          </Button>
          <Button tone="secondary" disabled={busy} onClick={close}>
            Cancelar
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
