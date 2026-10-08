import { useEffect, useRef, useState } from "react";
import type {
  BulkAreaInput,
  BulkParticipantsInput,
  BulkPublishInput,
  BulkOperation,
  BulkPreview,
  BulkResult,
  QuestionnaireView,
  QuestionView,
} from "@requirements/contracts";
import { api, ApiFailure } from "../../api";
import { Alert, Button, Checkbox, Dialog, Radio, Select } from "../../ui";
import { StatusChip } from "../../ui/semantic";
type Command = BulkAreaInput | BulkParticipantsInput | BulkPublishInput;
const titles: Record<BulkOperation, string> = {
  ASSIGN_AREA: "Asignar área a las preguntas",
  ADD_PARTICIPANTS: "Agregar participantes a las preguntas",
  PUBLISH: "Publicar preguntas seleccionadas",
};
const states = {
  READY: "Lista",
  ALREADY_PUBLISHED: "Ya publicada",
  WARNING: "Lista con advertencia",
  BLOCKED: "Bloqueada",
  UNCHANGED: "Sin cambios",
};
export function BulkDialog({
  data,
  questions,
  projectId,
  operation,
  onClose,
  onComplete,
  onCorrect,
  onAddDependency,
  onRefresh,
}: {
  data: QuestionnaireView;
  questions: QuestionView[];
  projectId: string;
  operation: BulkOperation;
  onRefresh?: () => Promise<QuestionnaireView>;
  onClose: () => void;
  onComplete: (result: BulkResult) => void;
  onCorrect: (id: string, field: string) => void;
  onAddDependency: (id: string) => void;
}) {
  const [snapshot, setSnapshot] = useState(data);
  const [targetArea, setTargetArea] = useState("");
  const [sourceArea, setSourceArea] = useState("");
  const [allAreas, setAllAreas] = useState(false);
  const [members, setMembers] = useState<Set<string>>(new Set());
  const [required, setRequired] = useState<"" | "yes" | "no">("");
  const [preview, setPreview] = useState<BulkPreview | null>(null);
  const [command, setCommand] = useState<Command | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [stale, setStale] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const errorBox = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (preview) heading.current?.focus();
  }, [preview]);
  useEffect(() => {
    if (error) errorBox.current?.focus();
  }, [error]);
  const selected = snapshot.questions.filter((q) =>
    questions.some((s) => s.id === q.id),
  );
  const areaCounts = new Map<string, number>();
  for (const q of selected)
    areaCounts.set(
      q.responsibleAreaId,
      (areaCounts.get(q.responsibleAreaId) ?? 0) + 1,
    );
  const participants = snapshot.members.filter(
    (m) => m.active && m.role === "STAKEHOLDER",
  );
  const configured =
    operation === "PUBLISH" ||
    (operation === "ASSIGN_AREA"
      ? !!targetArea && (allAreas || !!sourceArea)
      : members.size > 0 && required !== "");
  async function review(reload = false) {
    setBusy(true);
    setError("");
    try {
      const current = reload
        ? await (onRefresh ? onRefresh() : api("questionnaire", { projectId }))
        : snapshot;
      setSnapshot(current);
      const common = {
        requestId: crypto.randomUUID(),
        questions: questions.map((q) => ({
          id: q.id,
          expectedVersion:
            current.questions.find((x) => x.id === q.id)?.lockVersion ??
            q.lockVersion,
        })),
      };
      let next: Command, result: BulkPreview;
      if (operation === "ASSIGN_AREA") {
        next = {
          ...common,
          targetAreaId: targetArea,
          sourceAreaId: allAreas ? null : sourceArea,
        };
        result = await api("bulkAreaPreview", { projectId }, next);
      } else if (operation === "ADD_PARTICIPANTS") {
        next = {
          ...common,
          participants: [...members].map((projectMemberId) => ({
            projectMemberId,
            required: required === "yes",
          })),
        };
        result = await api("bulkParticipantsPreview", { projectId }, next);
      } else {
        next = common;
        result = await api("bulkPublishPreview", { projectId }, next);
      }
      setCommand(next);
      setPreview(result);
      setStale(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo revisar el lote.");
    } finally {
      setBusy(false);
    }
  }
  async function confirm() {
    if (!command || !preview || !preview.canConfirm || stale) return;
    setBusy(true);
    setError("");
    try {
      // Keep this exact request after a transport failure: the server owns idempotency.
      const input = { ...command, previewHash: preview.previewHash };
      const result =
        operation === "ASSIGN_AREA"
          ? await api("bulkAreaConfirm", { projectId }, input)
          : operation === "ADD_PARTICIPANTS"
            ? await api("bulkParticipantsConfirm", { projectId }, input)
            : await api("bulkPublishConfirm", { projectId }, input);
      onComplete(result);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "No se pudo confirmar la operación.",
      );
      if (e instanceof ApiFailure && e.status === 409) setStale(true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog
      title={titles[operation]}
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <div className="qe-bulk-dialog" aria-busy={busy}>
        <p>
          {questions.length === 1
            ? "1 pregunta seleccionada."
            : `${questions.length} preguntas seleccionadas.`}{" "}
          El lote se aplica completo o no se aplica.
        </p>
        {error && (
          <div ref={errorBox} tabIndex={-1}>
            <Alert error>{error}</Alert>
          </div>
        )}
        {!preview ? (
          <>
            {operation === "ASSIGN_AREA" && (
              <>
                <h3>Áreas actuales</h3>
                <ul>
                  {[...areaCounts].map(([id, count]) => (
                    <li key={id}>
                      {snapshot.areas.find((a) => a.id === id)?.name ??
                        "Área no disponible"}
                      : {count}
                    </li>
                  ))}
                </ul>
                <fieldset disabled={busy}>
                  <legend>Qué preguntas cambiar</legend>
                  <Radio
                    name="bulk-area-mode"
                    label="Cambiar únicamente las del área origen"
                    checked={!allAreas}
                    onChange={() => setAllAreas(false)}
                  />
                  {!allAreas && (
                    <Select
                      label="Área origen"
                      value={sourceArea}
                      onChange={(e) => setSourceArea(e.target.value)}
                    >
                      <option value="">Selecciona un área</option>
                      {[...areaCounts].map(([id, count]) => (
                        <option key={id} value={id}>
                          {snapshot.areas.find((a) => a.id === id)?.name ??
                            "Área no disponible"}{" "}
                          ({count})
                        </option>
                      ))}
                    </Select>
                  )}
                  <Radio
                    name="bulk-area-mode"
                    label={`Cambiar las ${questions.length} seleccionadas`}
                    checked={allAreas}
                    onChange={() => setAllAreas(true)}
                  />
                  <Select
                    label="Nueva área responsable"
                    value={targetArea}
                    onChange={(e) => setTargetArea(e.target.value)}
                  >
                    <option value="">Selecciona un área</option>
                    {snapshot.areas
                      .filter((a) => a.active)
                      .map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                        </option>
                      ))}
                  </Select>
                </fieldset>
                <p className="hint">
                  Se conserva la prioridad, el contenido y las asignaciones.
                  Elegir un área no asigna personas.
                </p>
              </>
            )}
            {operation === "ADD_PARTICIPANTS" && (
              <>
                <fieldset disabled={busy}>
                  <legend>Participantes a agregar</legend>
                  {participants.map((m) => (
                    <Checkbox
                      key={m.id}
                      label={`${m.displayName}${m.areaName ? ` · ${m.areaName}` : ""}`}
                      checked={members.has(m.id)}
                      onChange={(e) =>
                        setMembers((previous) => {
                          const next = new Set(previous);
                          if (e.target.checked) next.add(m.id);
                          else next.delete(m.id);
                          return next;
                        })
                      }
                    />
                  ))}
                  {!participants.length && (
                    <p>
                      No hay participantes activos disponibles en este proyecto.
                    </p>
                  )}
                  <Select
                    label="Las nuevas asignaciones serán"
                    value={required}
                    onChange={(e) =>
                      setRequired(e.target.value as typeof required)
                    }
                  >
                    <option value="">Elige la obligatoriedad</option>
                    <option value="yes">Obligatorias</option>
                    <option value="no">Opcionales</option>
                  </Select>
                </fieldset>
                <p className="hint">
                  Las asignaciones activas existentes se conservan sin cambiar
                  su obligatoriedad. Las inactivas se reactivan con la opción
                  elegida.
                </p>
              </>
            )}
            {operation === "PUBLISH" && (
              <p>
                Se comprobarán las mismas reglas de publicación individual,
                incluidas las dependencias. Ninguna pregunta externa a tu
                selección se publicará automáticamente.
              </p>
            )}
            <Button
              disabled={!configured || busy}
              onClick={() => void review()}
            >
              {busy ? "Revisando…" : "Revisar lote"}
            </Button>
          </>
        ) : (
          <>
            <h3 ref={heading} tabIndex={-1}>
              Revisión del lote
            </h3>
            <dl className="qe-bulk-counts">
              <div>
                <dt>Seleccionadas</dt>
                <dd>{preview.counts.selected}</dd>
              </div>
              <div>
                <dt>Aplicables</dt>
                <dd>{preview.counts.applicable}</dd>
              </div>
              <div>
                <dt>Sin cambios</dt>
                <dd>{preview.counts.ignored}</dd>
              </div>
              <div>
                <dt>Bloqueadas</dt>
                <dd>{preview.counts.blocked}</dd>
              </div>
              <div>
                <dt>Advertencias</dt>
                <dd>{preview.counts.warnings}</dd>
              </div>
            </dl>
            {preview.counts.warnings > 0 && (
              <div
                className="qe-bulk-warning-summary"
                role="note"
                aria-label="Advertencias del lote"
              >
                <p>Estas advertencias no impiden aplicar el lote:</p>
                <ul>
                  {[
                    ...new Set(
                      preview.items.flatMap((i) =>
                        i.warnings.map((w) => w.message),
                      ),
                    ),
                  ].map((message) => (
                    <li key={message}>
                      {
                        preview.items.filter((i) =>
                          i.warnings.some((w) => w.message === message),
                        ).length
                      }{" "}
                      preguntas: {message}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {operation === "ASSIGN_AREA" && (
              <p>
                Nueva área:{" "}
                <strong>
                  {snapshot.areas.find((a) => a.id === targetArea)?.name}
                </strong>
                .{" "}
                {allAreas
                  ? "Se revisaron todas las seleccionadas."
                  : `Solo cambiarán las del área ${snapshot.areas.find((a) => a.id === sourceArea)?.name}.`}
              </p>
            )}
            {operation === "ADD_PARTICIPANTS" && (
              <>
                <p>
                  Agregar:{" "}
                  {participants
                    .filter((m) => members.has(m.id))
                    .map((m) => m.displayName)
                    .join(", ")}
                  . Nuevas o reactivadas:{" "}
                  {required === "yes" ? "obligatorias" : "opcionales"}.
                </p>
                <p>
                  {preview.counts.newAssignments} asignaciones nuevas ·{" "}
                  {preview.counts.reactivatedAssignments} reactivadas ·{" "}
                  {preview.counts.existingAssignments} existentes sin cambios.
                </p>
              </>
            )}
            {!preview.canConfirm && (
              <Alert error>
                {preview.counts.blocked
                  ? "Hay errores que debes resolver. No se aplicará ningún cambio."
                  : "No hay cambios que aplicar."}
              </Alert>
            )}
            {[
              ...new Map(
                preview.dependencies
                  .filter(
                    (d) =>
                      !d.inSelection &&
                      (d.publication === "DRAFT" ||
                        (operation === "ADD_PARTICIPANTS" &&
                          d.publication === "PUBLISHED" &&
                          preview.items.some((i) =>
                            i.errors.some((e) => e.targetId === d.dependsOnId),
                          ))),
                  )
                  .map((d) => [d.dependsOnId, d]),
              ).values(),
            ].map((d) => (
              <div className="qe-bulk-issue" key={d.dependsOnId}>
                <p>Dependencia fuera del lote: {d.title}.</p>
                <Button
                  tone="secondary"
                  disabled={busy}
                  onClick={() => {
                    onAddDependency(d.dependsOnId);
                    setPreview(null);
                    setCommand(null);
                    setError("");
                  }}
                >
                  Añadir «{d.title}» a la selección
                </Button>
              </div>
            ))}
            <details open={preview.counts.blocked > 0}>
              <summary>Ver resultado por pregunta</summary>
              <ul className="qe-bulk-items">
                {preview.items.map((item) => (
                  <li key={item.questionId}>
                    <div className="ac-bulk-item-heading">
                      <strong>{item.title}</strong>
                      <StatusChip
                        tone={
                          item.state === "BLOCKED"
                            ? "danger"
                            : item.state === "WARNING"
                              ? "warning"
                              : item.state === "READY"
                                ? "success"
                                : "neutral"
                        }
                      >
                        {states[item.state]}
                      </StatusChip>
                    </div>
                    {item.errors.map((e, index) => (
                      <div className="qe-bulk-issue" key={index}>
                        <p>{e.message}</p>
                        <Button
                          tone="secondary"
                          disabled={busy}
                          onClick={() => onCorrect(item.questionId, e.field)}
                        >
                          Ir a corregir: {item.title}
                        </Button>
                      </div>
                    ))}
                    {item.warnings.map((w, index) => (
                      <p key={index}>Advertencia: {w.message}</p>
                    ))}
                  </li>
                ))}
              </ul>
            </details>
            <div className="qe-bulk-footer">
              <Button
                tone="secondary"
                disabled={busy}
                onClick={() => {
                  setPreview(null);
                  setCommand(null);
                  setError("");
                }}
              >
                Volver a configurar
              </Button>
              <Button
                tone="secondary"
                disabled={busy}
                onClick={() => void review(true)}
              >
                Actualizar y revisar nuevamente
              </Button>
              <Button
                disabled={busy || stale || !preview.canConfirm}
                onClick={() => void confirm()}
              >
                {busy
                  ? "Procesando…"
                  : `Confirmar ${preview.counts.applicable} ${preview.counts.applicable === 1 ? "pregunta" : "preguntas"}`}
              </Button>
            </div>
          </>
        )}
        <Button tone="secondary" disabled={busy} onClick={onClose}>
          Cancelar
        </Button>
        {busy && <p role="status">Espera mientras se procesa la solicitud.</p>}
      </div>
    </Dialog>
  );
}
