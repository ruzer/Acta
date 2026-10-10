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
import {
  EvidenceFile,
  NextSteps,
  StatusChip,
  type StatusTone,
} from "../ui/semantic";
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
const tones: Record<keyof typeof participantLabels, StatusTone> = {
  pending: "neutral",
  draft: "info",
  consultation: "warning",
  clarification: "warning",
  sent: "info",
  review: "info",
  validated: "success",
  notApplicable: "neutral",
};
/** The same glyph + word chip as the rest of the product; never colour alone. */
export function ParticipantBadge({ item }: { item: PersonalQuestion }) {
  const state = participantState(item);
  return (
    <StatusChip tone={tones[state]} icon={icons[state]}>
      {participantLabels[state]}
    </StatusChip>
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
type Step = Parameters<typeof NextSteps>[0]["steps"][number];
/**
 * "Qué sigue": only states that exist (the review status and the clarification
 * counts the server already returns). It never promises a decision or a date.
 */
export function submittedSteps(
  d: ResponseView,
  clarifications: { waiting: number; total: number },
): Step[] {
  const sentAt = d.revisions[0]?.createdAt;
  const steps: Step[] = [
    {
      id: "sent",
      state: "done",
      title: "Enviaste tu respuesta",
      detail: sentAt ? dateText(sentAt) : undefined,
    },
  ];
  if (d.reviewStatus === "NOT_APPLICABLE")
    return [
      ...steps,
      {
        id: "not-applicable",
        state: "done",
        title: "Marcada como No aplica",
        detail: "Tu respuesta se conserva.",
      },
    ];
  if (clarifications.waiting > 0)
    steps.push({
      id: "clarification",
      state: "current",
      title: "Pidieron una aclaración",
      detail: "Te toca responder.",
    });
  else if (clarifications.total > 0)
    steps.push({
      id: "clarification",
      state: "done",
      title: "Se pidió una aclaración",
      detail: "Ya no está pendiente de tu parte.",
    });
  if (d.reviewStatus !== "VALIDATED" && clarifications.waiting === 0)
    steps.push({
      id: "review",
      state: "current",
      title: "El equipo analista revisa tu respuesta",
    });
  steps.push(
    d.reviewStatus === "VALIDATED"
      ? {
          id: "decision",
          state: "done",
          title: "Decisión validada",
          detail: "Existe una decisión para esta pregunta.",
        }
      : {
          id: "decision",
          state: "todo",
          title: "Decisión validada",
          detail: "Verás el estado «Validada» en esta pregunta.",
        },
  );
  return steps;
}
export function ParticipantStatus({
  review,
  waiting,
  hasRevision,
}: {
  review: ResponseView["reviewStatus"];
  waiting: boolean;
  hasRevision: boolean;
}) {
  if (waiting)
    return (
      <StatusChip tone="warning" icon="help">
        Aclaración pendiente de tu parte
      </StatusChip>
    );
  if (review === "VALIDATED")
    return (
      <StatusChip tone="success" icon="check">
        Validada
      </StatusChip>
    );
  if (review === "NOT_APPLICABLE")
    return (
      <StatusChip tone="neutral" icon="info">
        No aplica
      </StatusChip>
    );
  return hasRevision ? (
    <StatusChip tone="info" icon="send">
      En revisión
    </StatusChip>
  ) : (
    <StatusChip tone="neutral" icon="clock">
      Pendiente
    </StatusChip>
  );
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
  const mine = personal.data?.sections
    .flatMap((s) => s.questions)
    .find((q) => q.id === d.question.id);
  const clarifications = {
    waiting: mine?.clarificationWaiting ?? 0,
    total: mine?.clarificationCount ?? 0,
  };
  return (
    <section className="participant-page participant-readonly participant-wide">
      <ParticipantFocus />
      <div>
        <p className="participant-overline">
          {d.question.sectionTitle} · Solo lectura
        </p>
        <h1>{d.question.question}</h1>
        <h2 className="sr-only">Estado actual</h2>
        <ParticipantStatus
          review={d.reviewStatus}
          waiting={clarifications.waiting > 0}
          hasRevision={d.revisions.length > 0}
        />
      </div>
      <div className="participant-columns">
        <div className="participant-main">
          {d.question.applicability !== "ENABLED" && (
            <Alert>
              Esta pregunta depende de respuestas anteriores enviadas. Tu
              contenido se conserva; por ahora no está habilitada para
              responder.
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
              <p className="participant-answer">
                {answerText(d.question, d.draft.answer)}
              </p>
              <p className="participant-comment">{d.draft.comment}</p>
            </section>
          ) : (
            <EmptyState title="No has enviado una respuesta" />
          )}
          {d.reviewStatus === "VALIDATED" && (
            <Alert>
              Existe una decisión validada para esta pregunta. Tu respuesta
              original se conserva. Esto no significa que cada aportación
              individual haya sido validada.
            </Alert>
          )}
          {clarifications.total > 0 && (
            <p>
              <Link
                to={`/projects/${projectId}/clarifications/${d.question.id}`}
              >
                Consultar aclaraciones
              </Link>
            </p>
          )}
        </div>
        {d.revisions.length > 0 && (
          <NextSteps steps={submittedSteps(d, clarifications)}>
            <p>Vuelve a esta página para ver novedades.</p>
          </NextSteps>
        )}
      </div>
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
      <div className="participant-submission-head">
        <h2>Tu respuesta</h2>
        <p>
          Tú · Envío {r.number} · {dateText(r.createdAt)}
          {!r.current && " · Histórico"}
        </p>
      </div>
      <p className="participant-answer">
        {answerText(data.question, r.answer)}
      </p>
      {r.comment && (
        <>
          <h3 className="participant-aside-label">Comentario</h3>
          <p className="participant-comment">{r.comment}</p>
        </>
      )}
      {r.example && (
        <>
          <h3 className="participant-aside-label">Ejemplo</h3>
          <p className="participant-comment">{r.example}</p>
        </>
      )}
      <h3 className="participant-aside-label">Archivos enviados</h3>
      {r.evidence.length > 0 ? (
        r.evidence.map(({ id, evidence: e }) => (
          <EvidenceFile
            key={id}
            name={e.originalName}
            size={`${(e.byteSize / 1024).toFixed(1)} KB`}
            disabled={e.status !== "READY"}
            onDownload={() => void download(e.id, e.originalName)}
          />
        ))
      ) : (
        <p className="hint">Sin evidencias adjuntas.</p>
      )}
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
