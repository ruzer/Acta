import { ProjectWorkbench } from "./ProjectWorkbench";
import { expiringInvitations, invitationQueryOptions } from "./invitation-data";
import { useEffect, useRef, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import type {
  InvitationView,
  QuestionView,
  QuestionnaireView,
} from "@requirements/contracts";
import { api } from "../api";
import { formatDate } from "../branding";
import {
  Alert,
  Button,
  Checkbox,
  Dialog,
  Input,
  ErrorState,
  LoadingState,
  Select,
  Textarea,
} from "../ui";
import "../next-invitations.css";
const labels: Record<InvitationView["status"], string> = {
  PENDING: "Pendiente",
  OPENED: "Abrió el enlace",
  DRAFT: "Borrador",
  PARTIALLY_SUBMITTED: "Envío parcial",
  SUBMITTED: "Enviado",
  EXPIRED: "Expirado",
  REVOKED: "Revocado",
};
export function InvitationLink({
  url,
  onClose,
}: {
  url: string;
  onClose: () => void;
}) {
  const [message, setMessage] = useState("");
  return (
    <Dialog title="Enlace privado de respuesta" onClose={onClose}>
      <p>
        Compártelo únicamente con la persona invitada. Quien tenga este enlace
        podrá acceder a sus preguntas y respuestas; no comprueba quién es la
        persona.
      </p>
      <p>
        Para otra persona, crea otra invitación. Si pierdes este enlace, puedes
        renovarlo; el anterior dejará de funcionar.
      </p>
      <Textarea
        label="Enlace privado"
        readOnly
        value={url}
        onFocus={(e) => e.target.select()}
      />
      <Button
        onClick={() => {
          void navigator.clipboard
            .writeText(url)
            .then(() => setMessage("Enlace copiado."))
            .catch(() =>
              setMessage("Selecciona y copia el enlace manualmente."),
            );
        }}
      >
        Copiar enlace
      </Button>
      <Button tone="secondary" onClick={onClose}>
        Listo
      </Button>
      {message && <p role="status">{message}</p>}
    </Dialog>
  );
}
export function CreateInvitation({
  projectId,
  questions,
  areas,
  selectable = false,
  onClose,
}: {
  projectId: string;
  questions: QuestionView[];
  areas: QuestionnaireView["areas"];
  selectable?: boolean;
  onClose: () => void;
}) {
  const policy = useQuery({
    queryKey: ["invitation-policy", projectId],
    queryFn: () => api("invitationPolicy", { projectId }),
    staleTime: 0,
  });
  const [step, setStep] = useState(0);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus();
  }, [step, policy.isPending]);
  const [label, setLabel] = useState(""),
    [name, setName] = useState(""),
    [email, setEmail] = useState(""),
    [organization, setOrganization] = useState("");
  const [areaId, setAreaId] = useState(""),
    [expiresAt, setExpiresAt] = useState(""),
    [nonNominal, setNonNominal] = useState(false),
    [evidence, setEvidence] = useState(false);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [url, setUrl] = useState("");
  const [search, setSearch] = useState("");
  const [selection, setSelection] = useState<Set<string>>(new Set());
  const requestId = useRef(crypto.randomUUID());
  const errorRef = useRef<HTMLDivElement>(null);
  const selectedQuestions = selectable
    ? questions.filter((q) => selection.has(q.id))
    : questions;
  const candidates = questions.filter((q) => q.publication === "PUBLISHED");
  const query = search
    .toLocaleLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
  const visible = candidates.filter((q) =>
    `${q.externalId} ${q.title} ${q.question}`
      .toLocaleLowerCase()
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .includes(query),
  );
  const validScope =
    selectedQuestions.length > 0 &&
    selectedQuestions.length <= 500 &&
    selectedQuestions.every((q) => q.publication === "PUBLISHED");
  const selected = new Set(selectedQuestions.map((q) => q.id));
  const missingParents = selectedQuestions.some(
    (q) => q.condition && !selected.has(q.condition.parentQuestionId),
  );
  const steps = ["Destinatario", "Preguntas", "Vigencia", "Resumen"];
  if (url) return <InvitationLink url={url} onClose={onClose} />;
  return (
    <Dialog
      title="Invitar mediante enlace"
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <p>
        Una invitación para una persona, sin cuenta ni contraseña. Su respuesta
        será independiente de las demás.
      </p>
      {policy.isPending ? (
        <LoadingState />
      ) : policy.error ? (
        <ErrorState error={policy.error} retry={() => void policy.refetch()} />
      ) : (
        <form
          className="next-invitation-create"
          onSubmit={(event) => {
            event.preventDefault();
            if (busy) return;
            if (step < 3) {
              if (step === 1 && (!validScope || missingParents)) return;
              setError("");
              setStep(step + 1);
              return;
            }
            if (!validScope || missingParents) return;
            setBusy(true);
            setError("");
            void api(
              "createInvitation",
              { projectId },
              {
                requestId: requestId.current,
                questionIds: selectedQuestions.map((q) => q.id),
                label,
                areaId,
                nonNominal,
                allowEvidence: evidence,
                identity: nonNominal
                  ? {}
                  : {
                      ...(name.trim() ? { name: name.trim() } : {}),
                      ...(email.trim() ? { email: email.trim() } : {}),
                      ...(organization.trim()
                        ? { organization: organization.trim() }
                        : {}),
                    },
                ...(expiresAt
                  ? { expiresAt: new Date(expiresAt).toISOString() }
                  : {}),
              },
            )
              .then((v) => setUrl(v.url))
              .catch((e: Error) => {
                setError(e.message);
                requestAnimationFrame(() => errorRef.current?.focus());
              })
              .finally(() => setBusy(false));
          }}
        >
          <ol
            className="next-invitation-steps"
            aria-label="Pasos de la invitación"
          >
            {steps.map((title, index) => (
              <li
                key={title}
                aria-current={index === step ? "step" : undefined}
              >
                {index + 1}. {title}
              </li>
            ))}
          </ol>
          <h3 ref={heading} tabIndex={-1}>
            {steps[step]}
          </h3>
          <div ref={errorRef} tabIndex={-1}>
            {error && <Alert error>{error}</Alert>}
          </div>
          {step === 0 && (
            <>
              <Input
                label="Referencia de la invitación"
                hint="Una referencia breve para distinguir esta aportación."
                required
                maxLength={200}
                value={label}
                onChange={(e) => setLabel(e.target.value)}
              />
              {policy.data.allowNonNominal &&
                policy.data.identityRequirement === "NONE" && (
                  <Checkbox
                    label="Invitación no nominal (sin datos personales)"
                    checked={nonNominal}
                    onChange={(e) => setNonNominal(e.target.checked)}
                  />
                )}
              {!nonNominal && (
                <>
                  <Input
                    label="Nombre de la persona"
                    required={
                      ["NAME", "BOTH"].includes(
                        policy.data.identityRequirement,
                      ) || !email.trim()
                    }
                    value={name}
                    maxLength={200}
                    onChange={(e) => setName(e.target.value)}
                  />
                  <Input
                    label="Correo"
                    type="email"
                    required={["EMAIL", "BOTH"].includes(
                      policy.data.identityRequirement,
                    )}
                    value={email}
                    maxLength={254}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                  <Input
                    label="Organización (opcional)"
                    value={organization}
                    maxLength={200}
                    onChange={(e) => setOrganization(e.target.value)}
                  />
                </>
              )}
              <p className="hint">
                Los datos describen al destinatario previsto. El enlace no
                verifica su identidad ni se envía por correo automáticamente.
              </p>
            </>
          )}
          {step === 1 && (
            <>
              {selectable ? (
                <>
                  <Input
                    type="search"
                    label="Buscar preguntas publicadas"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                  <p role="status">
                    {selectedQuestions.length} seleccionadas · {visible.length}{" "}
                    resultados publicados
                  </p>
                  <div className="actions">
                    <Button
                      tone="secondary"
                      disabled={
                        !visible.length ||
                        new Set([...selection, ...visible.map((q) => q.id)])
                          .size > 500
                      }
                      onClick={() =>
                        setSelection(
                          new Set([...selection, ...visible.map((q) => q.id)]),
                        )
                      }
                    >
                      Seleccionar {visible.length}{" "}
                      {visible.length === 1 ? "resultado" : "resultados"}
                    </Button>
                    <Button
                      tone="secondary"
                      disabled={!selection.size}
                      onClick={() => setSelection(new Set())}
                    >
                      Limpiar selección
                    </Button>
                  </div>
                  <div
                    className="next-invitation-question-picker"
                    role="group"
                    aria-label="Preguntas disponibles"
                  >
                    {visible.map((q) => (
                      <Checkbox
                        key={q.id}
                        label={`${q.externalId} · ${q.question}`}
                        checked={selection.has(q.id)}
                        onChange={(e) =>
                          setSelection((previous) => {
                            const next = new Set(previous);
                            if (e.target.checked) next.add(q.id);
                            else next.delete(q.id);
                            return next;
                          })
                        }
                      />
                    ))}
                    {!visible.length && (
                      <p>No hay preguntas publicadas para este filtro.</p>
                    )}
                  </div>
                  {selectedQuestions.some((q) => !visible.includes(q)) && (
                    <p className="hint">
                      {
                        selectedQuestions.filter((q) => !visible.includes(q))
                          .length
                      }{" "}
                      seleccionadas fuera del filtro. Se conservarán en el
                      alcance.
                    </p>
                  )}
                </>
              ) : (
                <p>
                  {selectedQuestions.length} preguntas seleccionadas en
                  Organizar. La selección se conserva al cerrar.
                </p>
              )}
              <details>
                <summary>
                  Revisar preguntas incluidas ({selectedQuestions.length})
                </summary>
                <ul>
                  {selectedQuestions.map((q) => (
                    <li key={q.id}>
                      {q.externalId} · {q.question}
                    </li>
                  ))}
                </ul>
              </details>
              {!validScope && (
                <Alert error>
                  Selecciona entre 1 y 500 preguntas publicadas. Esta acción no
                  publica borradores.
                </Alert>
              )}
              {missingParents && (
                <Alert error>
                  Faltan preguntas de las que depende una condición.{" "}
                  {selectable
                    ? "Inclúyelas explícitamente en la selección."
                    : "Vuelve a Organizar e inclúyelas explícitamente."}
                </Alert>
              )}
              <Select
                label="Área de la aportación"
                required
                value={areaId}
                onChange={(e) => setAreaId(e.target.value)}
              >
                <option value="">Selecciona un área</option>
                {areas
                  .filter((a) => a.active)
                  .map((a) => (
                    <option value={a.id} key={a.id}>
                      {a.name}
                    </option>
                  ))}
              </Select>
            </>
          )}
          {step === 2 && (
            <>
              <Input
                label="Vencimiento (opcional)"
                type="datetime-local"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                hint={`Si lo dejas vacío: ${policy.data.defaultDays} días desde crear el enlace. Máximo: ${policy.data.maxDays} días. La fecha se interpreta en la zona horaria de este navegador.`}
              />
              <Checkbox
                label="Permitir adjuntar y descargar evidencia propia"
                checked={evidence}
                onChange={(e) => setEvidence(e.target.checked)}
              />
              <p className="hint">
                El servidor verifica la vigencia y el alcance antes de crear el
                enlace.
              </p>
            </>
          )}
          {step === 3 && (
            <>
              <dl className="next-invitation-summary">
                <dt>Referencia</dt>
                <dd>{label}</dd>
                <dt>Destinatario previsto</dt>
                <dd>
                  {nonNominal ? (
                    "No nominal"
                  ) : (
                    <>
                      {name && <span>{name}</span>}
                      {email && <span>{email}</span>}
                      {organization && <span>{organization}</span>}
                    </>
                  )}
                </dd>
                <dt>Preguntas</dt>
                <dd>
                  <span>
                    {selectedQuestions.length}{" "}
                    {selectedQuestions.length === 1
                      ? "pregunta publicada"
                      : "preguntas publicadas"}
                  </span>
                  <details>
                    <summary>Revisar preguntas incluidas</summary>
                    <ul>
                      {selectedQuestions.map((q) => (
                        <li key={q.id}>
                          {q.externalId} · {q.question}
                        </li>
                      ))}
                    </ul>
                  </details>
                </dd>
                <dt>Área de la aportación</dt>
                <dd>
                  {areas.find((a) => a.id === areaId)?.name ??
                    "Área no disponible"}
                </dd>
                <dt>Vigencia</dt>
                <dd>
                  {expiresAt
                    ? `Hasta ${formatDate(new Date(expiresAt).toISOString())}`
                    : `${policy.data.defaultDays} días desde crear el enlace`}
                </dd>
                <dt>Evidencia propia</dt>
                <dd>
                  {evidence
                    ? "Adjuntar y descargar permitidos"
                    : "Sin acceso a archivos"}
                </dd>
              </dl>
              <p>
                Se creará un enlace privado para compartir manualmente con esta
                persona. No se enviará ningún correo.
              </p>
              {(!validScope || missingParents) && (
                <Alert error>
                  Cambió el alcance disponible. Vuelve a Preguntas antes de
                  crear.
                </Alert>
              )}
            </>
          )}
          <div className="actions next-invitation-step-actions">
            {step > 0 && (
              <Button
                tone="secondary"
                disabled={busy}
                onClick={() => {
                  setError("");
                  setStep(step - 1);
                }}
              >
                Atrás
              </Button>
            )}
            <Button
              type="submit"
              disabled={
                busy ||
                ((step === 1 || step === 3) && (!validScope || missingParents))
              }
            >
              {busy
                ? "Creando enlace…"
                : step === 3
                  ? "Crear enlace privado"
                  : "Continuar"}
            </Button>
            <Button tone="secondary" disabled={busy} onClick={onClose}>
              Cancelar
            </Button>
          </div>
        </form>
      )}
    </Dialog>
  );
}
export function Invitations() {
  const { projectId = "" } = useParams();
  const [error, setError] = useState("");
  const [command, setCommand] = useState<{
    kind: "revoke" | "renew";
    row: InvitationView;
  }>();
  const [busy, setBusy] = useState(false),
    [url, setUrl] = useState("");
  const [params, setParams] = useSearchParams();
  const expires = params.get("expiresWithin") === "7";
  const requestedPage = Number(params.get("page") ?? 1);
  const page =
    Number.isSafeInteger(requestedPage) && requestedPage > 0
      ? requestedPage
      : 1;
  function setPage(value: number) {
    const next = new URLSearchParams(params);
    if (value > 1) next.set("page", String(value));
    else next.delete("page");
    setParams(next);
  }
  const rows = useQuery(invitationQueryOptions(projectId));
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60000);
    return () => window.clearInterval(timer);
  }, []);
  const filtered = expires
    ? expiringInvitations(rows.data ?? [], now)
    : (rows.data ?? []);
  const currentPage = Math.min(
    page,
    Math.max(1, Math.ceil(filtered.length / 25)),
  );
  const items = filtered.slice((currentPage - 1) * 25, currentPage * 25);
  const policy = useQuery({
    queryKey: ["invitation-policy", projectId],
    queryFn: () => api("invitationPolicy", { projectId }),
    staleTime: 0,
  });
  const projects = useQuery({
    queryKey: ["projects"],
    queryFn: () => api("projects"),
  });
  const project = projects.data?.find((p) => p.id === projectId);
  const admin = project?.role === "ADMIN";
  const canCreate =
    project?.lifecycle === "ACTIVE" && (admin || project?.role === "ANALYST");
  const [creating, setCreating] = useState(false);
  const createTrigger = useRef<HTMLButtonElement>(null);
  const questionnaire = useQuery({
    queryKey: ["questionnaire", projectId],
    queryFn: () => api("questionnaire", { projectId }),
    enabled: creating && canCreate,
    staleTime: 0,
  });
  function closeCreation() {
    setCreating(false);
    void rows.refetch();
    requestAnimationFrame(() => createTrigger.current?.focus());
  }
  return (
    <>
      <ProjectWorkbench
        projectId={projectId}
        projectName={project?.name ?? "Proyecto"}
        role={project?.role}
        active="invitations"
      />
      <h2>Invitaciones mediante enlace</h2>
      <p>
        Una invitación reúne preguntas para una persona externa. Sus envíos se
        conservan por separado de otras invitaciones y de participantes con
        cuenta.
      </p>
      <p>
        «Abrió» registra el uso del enlace, no una comprobación de identidad.
        Renovar cambia el enlace y cierra los accesos anteriores; revocar
        conserva las respuestas enviadas.
      </p>
      {canCreate && (
        <Button
          className="next-invitation-create-trigger"
          ref={createTrigger}
          onClick={() => setCreating(true)}
        >
          Crear invitación
        </Button>
      )}
      {error && <Alert error>{error}</Alert>}
      {admin && policy.data && (
        <section aria-label="Permiso para invitaciones no nominales">
          <h2>Invitaciones no nominales</h2>
          <p>
            La instalación exige:{" "}
            {
              {
                NONE: "ningún dato obligatorio",
                NAME: "nombre",
                EMAIL: "correo",
                BOTH: "nombre y correo",
              }[policy.data.identityRequirement]
            }
            .
          </p>
          <Checkbox
            label="Permitir invitaciones sin datos personales en este proyecto"
            checked={policy.data.allowNonNominal}
            disabled={busy || policy.data.identityRequirement !== "NONE"}
            onChange={(e) => {
              setBusy(true);
              setError("");
              void api(
                "setInvitationPolicy",
                { projectId },
                {
                  expectedVersion: policy.data.expectedVersion,
                  allowNonNominal: e.target.checked,
                },
              )
                .then(() => policy.refetch())
                .catch((e: Error) => setError(e.message))
                .finally(() => setBusy(false));
            }}
          />
        </section>
      )}
      <Select
        label="Vigencia"
        value={expires ? "7" : ""}
        onChange={(e) => {
          const next = new URLSearchParams(params);
          if (e.target.value) next.set("expiresWithin", "7");
          else next.delete("expiresWithin");
          next.delete("page");
          setParams(next);
        }}
      >
        <option value="">Todas las invitaciones</option>
        <option value="7">Vencen en los próximos 7 días</option>
      </Select>
      {rows.isPending ? (
        <LoadingState />
      ) : rows.error ? (
        <Alert error>{rows.error.message}</Alert>
      ) : (
        <>
          <p role="status">
            {filtered.length}{" "}
            {filtered.length === 1 ? "invitación" : "invitaciones"}
          </p>
          {!items.length && <p>Todavía no hay invitaciones en esta página.</p>}
          <ul className="invitation-management">
            {items.map((row) => (
              <li key={row.id}>
                <div className="next-invitation-recipient">
                  <h3>
                    {row.nonNominal
                      ? "Invitación no nominal"
                      : row.identity.name ||
                        row.identity.email ||
                        "Destinatario previsto"}
                  </h3>
                  <p>{row.label}</p>
                  {row.identity.name && row.identity.email && (
                    <p>{row.identity.email}</p>
                  )}
                  {row.identity.organization && (
                    <p>{row.identity.organization}</p>
                  )}
                </div>
                <dl>
                  <dt>Preguntas</dt>
                  <dd>{row.total} incluidas</dd>
                  <dt>Envíos</dt>
                  <dd>
                    {row.submitted} de {row.total} preguntas con envío
                  </dd>
                </dl>
                <dl>
                  <dt>Vigencia</dt>
                  <dd>{formatDate(row.expiresAt)}</dd>
                  <dt>Estado del enlace</dt>
                  <dd>
                    {row.revokedAt
                      ? "Revocado"
                      : new Date(row.expiresAt).getTime() <= now
                        ? "Expirado"
                        : "Activo"}
                  </dd>
                </dl>
                <dl>
                  <dt>Actividad</dt>
                  <dd>{labels[row.status]}</dd>
                  <dt>Primer acceso</dt>
                  <dd>
                    {row.firstOpenedAt
                      ? formatDate(row.firstOpenedAt)
                      : "Sin aperturas registradas"}
                  </dd>
                </dl>
                {row.status !== "REVOKED" && (
                  <div className="actions">
                    <Button
                      tone="secondary"
                      onClick={() => setCommand({ kind: "renew", row })}
                    >
                      Renovar enlace
                    </Button>
                    <Button
                      tone="danger"
                      onClick={() => setCommand({ kind: "revoke", row })}
                    >
                      Revocar
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
          <div className="actions">
            <Button
              tone="secondary"
              disabled={currentPage === 1}
              onClick={() => setPage(currentPage - 1)}
            >
              Anterior
            </Button>
            <span>Página {currentPage}</span>
            <Button
              tone="secondary"
              disabled={currentPage * 25 >= filtered.length}
              onClick={() => setPage(currentPage + 1)}
            >
              Siguiente
            </Button>
          </div>
        </>
      )}
      {creating &&
        (questionnaire.isPending ? (
          <Dialog title="Preparar invitación" onClose={closeCreation}>
            <LoadingState />
          </Dialog>
        ) : questionnaire.error ? (
          <Dialog title="Preparar invitación" onClose={closeCreation}>
            <ErrorState
              error={questionnaire.error}
              retry={() => void questionnaire.refetch()}
            />
          </Dialog>
        ) : (
          questionnaire.data && (
            <CreateInvitation
              projectId={projectId}
              questions={questionnaire.data.questions}
              areas={questionnaire.data.areas}
              selectable
              onClose={closeCreation}
            />
          )
        ))}
      {command && (
        <Dialog
          title={
            command.kind === "revoke"
              ? "Revocar invitación"
              : "Renovar enlace privado"
          }
          onClose={() => {
            if (!busy) setCommand(undefined);
          }}
        >
          <p>{command.row.label}</p>
          <p>
            {command.kind === "revoke"
              ? "El enlace dejará de permitir acceso. Las respuestas enviadas se conservan. Esta revocación no se puede deshacer."
              : "El enlace anterior y sus sesiones dejarán de funcionar. Se conserva el avance de esta misma invitación y se aplicará el plazo predeterminado de la instalación."}
          </p>
          <Button
            disabled={busy}
            onClick={() => {
              setBusy(true);
              setError("");
              const result =
                command.kind === "revoke"
                  ? api(
                      "revokeInvitation",
                      { projectId, id: command.row.id },
                      { expectedVersion: command.row.lockVersion },
                    )
                  : api(
                      "renewInvitation",
                      { projectId, id: command.row.id },
                      { expectedVersion: command.row.lockVersion },
                    );
              void result
                .then((v) => {
                  setCommand(undefined);
                  if ("url" in v) setUrl(v.url);
                  return rows.refetch();
                })
                .catch((e: Error) => {
                  setCommand(undefined);
                  setError(e.message);
                  void rows.refetch();
                })
                .finally(() => setBusy(false));
            }}
          >
            Confirmar
          </Button>
          <Button
            tone="secondary"
            disabled={busy}
            onClick={() => setCommand(undefined)}
          >
            Cancelar
          </Button>
        </Dialog>
      )}
      {url && <InvitationLink url={url} onClose={() => setUrl("")} />}
    </>
  );
}
