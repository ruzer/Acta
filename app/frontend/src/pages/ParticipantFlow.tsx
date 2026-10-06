import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams, useLocation } from "react-router-dom";
import {
  participantState,
  participantStart,
  participantNext,
  type PersonalQuestion,
  type PersonalProjectView,
  type ResponseView,
} from "@requirements/contracts";
import { ParticipantIcon } from "./ParticipantIcon";
import { api, downloadEvidence } from "../api";
import { Alert, EmptyState, ErrorState, LoadingState } from "../ui";
import { dateText } from "./ReviewShared";
import { answerText } from "./AnswerControl";
import { Button } from "../ui";
export const participantLabels = {
  pending: "Pendiente",
  draft: "Borrador",
  consultation: "Por consultar",
  clarification: "Requiere tu aclaración",
  sent: "Enviada",
  review: "En revisión",
  validated: "Validada",
  notApplicable: "No aplica",
};
const icons = {
  pending: "clock",
  draft: "edit",
  consultation: "flag",
  clarification: "help",
  sent: "send",
  review: "send",
  validated: "check",
  notApplicable: "info",
};
export function ParticipantBadge({ item }: { item: PersonalQuestion }) {
  const state = participantState(item);
  return (
    <span className={"participant-badge " + state}>
      <ParticipantIcon name={icons[state]} />
      {participantLabels[state]}
    </span>
  );
}
export function participantPath(projectId: string, item: PersonalQuestion) {
  const state = participantState(item);
  const page =
    state === "clarification"
      ? "clarifications"
      : item.hasSubmission ||
          item.currentSubmission ||
          state === "validated" ||
          state === "notApplicable" ||
          item.applicability !== "ENABLED"
        ? "submitted"
        : "respond";
  return `/projects/${projectId}/${page}/${item.id}`;
}
export async function nextParticipantPath(projectId: string, id: string) {
  const fresh = await api("personalProject", { projectId });
  const next = participantNext(
    fresh.sections.flatMap((s) => s.questions),
    id,
  );
  return next
    ? participantPath(projectId, next)
    : `/projects/${projectId}/receipt`;
}
export function participantCounts(items: PersonalQuestion[]) {
  const states = items
    .filter(
      (q) =>
        q.applicability === "ENABLED" ||
        q.hasSubmission ||
        q.clarificationWaiting > 0,
    )
    .map(participantState);
  return {
    pending: states.filter((s) => s === "pending").length,
    drafts: states.filter((s) => s === "draft").length,
    consultation: states.filter((s) => s === "consultation").length,
    attention: states.filter((s) => s === "clarification").length,
    sent: items.filter(
      (q) => q.hasSubmission || q.currentSubmission || q.state === "SENT",
    ).length,
  };
}
export function ParticipantSummary({ items }: { items: PersonalQuestion[] }) {
  const c = participantCounts(items);
  return (
    <>
      <dl className="participant-summary">
        <div>
          <dt>Pendientes</dt>
          <dd>{c.pending}</dd>
        </div>
        <div>
          <dt>Borradores</dt>
          <dd>{c.drafts}</dd>
        </div>
        <div>
          <dt>Requieren atención</dt>
          <dd>{c.attention + c.consultation}</dd>
        </div>
        <div>
          <dt>Enviadas</dt>
          <dd>{c.sent}</dd>
        </div>
      </dl>
      {c.consultation > 0 && (
        <p className="hint">
          Requieren atención: {c.attention} aclaraciones y {c.consultation} por
          consultar.
        </p>
      )}
    </>
  );
}
export function ParticipantFocus() {
  useEffect(() => {
    const h = document.querySelector<HTMLElement>("main h1");
    h?.setAttribute("tabindex", "-1");
    h?.focus();
    window.scrollTo(0, 0);
  }, []);
  return null;
}
export function SessionReceipt() {
  const { projectId = "" } = useParams();
  const q = useQuery({
    queryKey: ["my-work", projectId],
    queryFn: () => api("personalProject", { projectId }),
    staleTime: 0,
  });
  if (q.isPending) return <LoadingState />;
  if (q.error)
    return <ErrorState error={q.error} retry={() => void q.refetch()} />;
  return <Receipt projectId={projectId} data={q.data} />;
}
function Receipt({
  projectId,
  data,
}: {
  projectId: string;
  data: PersonalProjectView;
}) {
  const items = data.sections.flatMap((s) => s.questions),
    c = participantCounts(items),
    next = participantStart(items);
  const complete =
    !next && data.progress.undetermined === 0 && items.length > 0;
  return (
    <section className="participant-page participant-receipt">
      <ParticipantFocus />
      <div className="participant-success">
        <span className="participant-success-icon">
          <ParticipantIcon />
        </span>
        <h1>{complete ? "Terminaste tus preguntas" : "Listo por ahora"}</h1>
        <p className="participant-subtitle">
          Así queda tu trabajo en «{data.projectName}» por ahora.
        </p>
      </div>
      <div className="receipt-card">
        <ul>
          <li>
            <ParticipantIcon name="send" />
            {c.sent} respuestas enviadas en el proyecto.
          </li>
          <li>
            <ParticipantIcon name="clock" />
            {c.pending + c.drafts} pendientes o en borrador.
          </li>
          <li>
            <ParticipantIcon name="flag" />
            {c.consultation} por consultar.
          </li>
          <li>
            <ParticipantIcon name="help" />
            {c.attention} aclaraciones pendientes de tu parte.
          </li>
        </ul>
      </div>
      {data.progress.undetermined > 0 && (
        <Alert>
          Hay {data.progress.undetermined} preguntas cuya aplicación depende de
          respuestas anteriores.
        </Alert>
      )}
      {data.progress.excluded > 0 && (
        <p className="hint">
          {data.progress.excluded} fuera del recorrido actual. Esto no equivale
          a una decisión de “No aplica”.
        </p>
      )}
      <div className="actions">
        {next && (
          <Link
            className="button secondary"
            to={participantPath(projectId, next)}
          >
            Continuar con pendientes
          </Link>
        )}
        <Link className="button primary" to={`/projects/${projectId}/work`}>
          Volver a Mi trabajo
        </Link>
      </div>
    </section>
  );
}
export function SubmittedResponse() {
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
  return <SubmittedResponseContent data={q.data} projectId={projectId} />;
}
export function SubmittedResponseContent({
  data: d,
  projectId,
}: {
  data: ResponseView;
  projectId: string;
}) {
  const personal = useQuery({
    queryKey: ["my-work", projectId],
    queryFn: () => api("personalProject", { projectId }),
    staleTime: 0,
  });
  const hasClarifications = personal.data?.sections
    .flatMap((s) => s.questions)
    .find((q) => q.id === d.question.id)?.clarificationCount;
  const label =
    d.reviewStatus === "VALIDATED"
      ? "Validada"
      : d.reviewStatus === "NOT_APPLICABLE"
        ? "No aplica"
        : d.reviewStatus === "CONFLICT" ||
            d.reviewStatus === "CLARIFICATION_REQUIRED"
          ? "En revisión"
          : d.revisions.length
            ? "Enviada"
            : "Pendiente";
  return (
    <section className="participant-page participant-readonly">
      <ParticipantFocus />
      <p className="view-meta">
        <ParticipantIcon name="layers" />
        Tema: {d.question.sectionTitle} · Solo lectura
      </p>
      <h1>{d.question.question}</h1>
      {d.question.applicability !== "ENABLED" && (
        <Alert>
          Esta pregunta depende de respuestas anteriores enviadas. Tu contenido
          se conserva; por ahora no está habilitada para responder.
        </Alert>
      )}
      {d.draft && d.revisions.length > 0 && (
        <Alert>
          Existe un borrador anterior conservado. La edición posterior a un
          envío no está disponible en esta experiencia.
        </Alert>
      )}
      {d.revisions.length ? (
        d.revisions.map((r, i) =>
          i === 0 ? (
            <Sent key={r.id} data={d} revision={r} projectId={projectId} />
          ) : (
            <details className="participant-disclosure" key={r.id}>
              <summary>Envío anterior · {dateText(r.createdAt)}</summary>
              <Sent data={d} revision={r} projectId={projectId} />
            </details>
          ),
        )
      ) : d.draft ? (
        <section className="participant-submission">
          <h2>Borrador privado conservado</h2>
          <p className="answer-text">
            {answerText(d.question, d.draft.answer)}
          </p>
          <p>{d.draft.comment}</p>
        </section>
      ) : (
        <EmptyState title="No has enviado una respuesta" />
      )}
      <h2>Estado actual</h2>
      <p
        className={
          "participant-badge " +
          (label === "Validada"
            ? "validated"
            : label === "No aplica"
              ? "notApplicable"
              : "review")
        }
      >
        <ParticipantIcon name={label === "Validada" ? "check" : "send"} />
        {label === "Enviada" ? "En revisión" : label}
      </p>
      {d.reviewStatus === "VALIDATED" && (
        <Alert>
          Existe una decisión validada para esta pregunta. Tu respuesta original
          se conserva. Esto no significa que cada aportación individual haya
          sido validada.
        </Alert>
      )}
      {!!hasClarifications && (
        <p>
          <Link to={`/projects/${projectId}/clarifications/${d.question.id}`}>
            Consultar aclaraciones
          </Link>
        </p>
      )}
    </section>
  );
}
function Sent({
  data,
  revision: r,
  projectId,
}: {
  data: ResponseView;
  revision: ResponseView["revisions"][number];
  projectId: string;
}) {
  const [error, setError] = useState("");
  async function download(id: string, name: string) {
    try {
      const url = URL.createObjectURL(await downloadEvidence(projectId, id));
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <section className="participant-submission">
      <h2>Tu respuesta</h2>
      <p className="answer-text">{answerText(data.question, r.answer)}</p>
      {r.comment && <p className="hint">Comentario: {r.comment}</p>}
      {r.example && <p className="hint">Ejemplo: {r.example}</p>}
      {r.evidence.length > 0 ? (
        <ul className="evidence-list">
          {r.evidence.map(({ id, evidence: e }) => (
            <li key={id}>
              <Button
                tone="secondary"
                disabled={e.status !== "READY"}
                onClick={() => void download(e.id, e.originalName)}
              >
                <ParticipantIcon name="paperclip" />
                Descargar {e.originalName}
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="hint">Sin evidencias adjuntas.</p>
      )}
      <p className="view-meta">Enviada el {dateText(r.createdAt)}</p>
      {!r.current && (
        <p className="hint">
          Envío histórico; no está vigente en el contexto actual.
        </p>
      )}
      {error && <Alert error>{error}</Alert>}
    </section>
  );
}
export function ParticipantNotice() {
  const location = useLocation();
  const notice = (location.state as { participantNotice?: string } | null)
    ?.participantNotice;
  return notice ? <Notice key={location.key} text={notice} /> : null;
}
function Notice({ text }: { text: string }) {
  return (
    <p role="status" className="participant-feedback">
      <ParticipantIcon />
      {text}
    </p>
  );
}
