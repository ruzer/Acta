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
  LoadingState,
  Select,
  Textarea,
} from "../ui";
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
  onClose,
}: {
  projectId: string;
  questions: QuestionView[];
  areas: QuestionnaireView["areas"];
  onClose: () => void;
}) {
  const policy = useQuery({
    queryKey: ["invitation-policy", projectId],
    queryFn: () => api("invitationPolicy", { projectId }),
    staleTime: 0,
  });
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
  const requestId = useRef(crypto.randomUUID());
  const errorRef = useRef<HTMLDivElement>(null);
  const validScope =
    questions.length > 0 &&
    questions.length <= 500 &&
    questions.every((q) => q.publication === "PUBLISHED");
  const selected = new Set(questions.map((q) => q.id));
  const missingParents = questions.some(
    (q) => q.condition && !selected.has(q.condition.parentQuestionId),
  );
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
      <p>{questions.length} preguntas seleccionadas.</p>
      <details>
        <summary>Revisar preguntas incluidas</summary>
        <ul>
          {questions.map((q) => (
            <li key={q.id}>{q.title || q.question}</li>
          ))}
        </ul>
      </details>
      {!validScope && (
        <Alert error>
          Selecciona entre 1 y 500 preguntas publicadas. Esta acción no publica
          borradores.
        </Alert>
      )}
      {missingParents && (
        <Alert error>
          Faltan preguntas de las que depende una condición. Vuelve a Organizar
          e inclúyelas explícitamente.
        </Alert>
      )}
      {policy.isPending ? (
        <LoadingState />
      ) : policy.error ? (
        <Alert error>{policy.error.message}</Alert>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (busy || !validScope || missingParents) return;
            setBusy(true);
            setError("");
            void api(
              "createInvitation",
              { projectId },
              {
                requestId: requestId.current,
                questionIds: questions.map((question) => question.id),
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
          <div ref={errorRef} tabIndex={-1}>
            {error && <Alert error>{error}</Alert>}
          </div>
          <Input
            label="Referencia de la invitación"
            hint="Una referencia breve para distinguir esta aportación."
            required
            maxLength={200}
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            disabled={busy}
          />
          {policy.data.allowNonNominal &&
            policy.data.identityRequirement === "NONE" && (
              <Checkbox
                label="Invitación no nominal (sin datos personales)"
                checked={nonNominal}
                onChange={(e) => setNonNominal(e.target.checked)}
                disabled={busy}
              />
            )}
          {!nonNominal && (
            <>
              <Input
                label="Nombre de la persona"
                required={["NAME", "BOTH"].includes(
                  policy.data.identityRequirement,
                )}
                value={name}
                maxLength={200}
                onChange={(e) => setName(e.target.value)}
                disabled={busy}
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
                disabled={busy}
              />
              <Input
                label="Organización (opcional)"
                value={organization}
                maxLength={200}
                onChange={(e) => setOrganization(e.target.value)}
                disabled={busy}
              />
              <p className="hint">
                Los datos registrados describen al destinatario previsto; el
                enlace no verifica su identidad ni se envía por correo
                automáticamente.
              </p>
            </>
          )}
          <Select
            label="Área de la aportación"
            value={areaId}
            required
            onChange={(e) => setAreaId(e.target.value)}
            disabled={busy}
          >
            <option value="">Selecciona un área</option>
            {areas
              .filter((a) => a.active)
              .map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
          </Select>
          <Input
            label="Vencimiento (opcional)"
            type="datetime-local"
            value={expiresAt}
            onChange={(e) => setExpiresAt(e.target.value)}
            disabled={busy}
            hint={`Si lo dejas vacío: ${policy.data.defaultDays} días. Máximo: ${policy.data.maxDays} días. La fecha se interpreta en la zona horaria de este navegador.`}
          />
          <Checkbox
            label="Permitir adjuntar y descargar evidencia propia"
            checked={evidence}
            onChange={(e) => setEvidence(e.target.checked)}
            disabled={busy}
          />
          <Button
            type="submit"
            disabled={busy || !validScope || missingParents}
          >
            Crear enlace privado
          </Button>
          <Button tone="secondary" disabled={busy} onClick={onClose}>
            Cancelar
          </Button>
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
        Son aportaciones externas independientes de los participantes con
        cuenta. Para crear una, selecciona preguntas publicadas en Organizar y
        elige «Invitar mediante enlace».
      </p>
      <p>
        «Abrió» registra el uso del enlace, no una comprobación de identidad.
        Renovar cambia el enlace y cierra los accesos anteriores; revocar
        conserva las respuestas enviadas.
      </p>
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
          <p role="status">{filtered.length} invitaciones</p>
          {!items.length && <p>Todavía no hay invitaciones en esta página.</p>}
          <ul className="invitation-management">
            {items.map((row) => (
              <li key={row.id}>
                <h2>{row.label}</h2>
                <p>
                  {row.nonNominal
                    ? "No nominal"
                    : "Destinatario identificado por quien invita"}{" "}
                  · {labels[row.status]}
                </p>
                <p>
                  {row.submitted} de {row.total} preguntas con envío · vence{" "}
                  {formatDate(row.expiresAt)}
                </p>
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
