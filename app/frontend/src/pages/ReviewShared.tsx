import { formatDate } from "../branding";
import { useState } from "react";
import type {
  ClarificationThreadView,
  EvidenceView,
  ResponseQuestionView,
  ResponseView,
} from "@requirements/contracts";
import { downloadEvidence } from "../api";
import { Alert, Button } from "../ui";
import {
  EvidenceFile,
  StatusChip,
  ThreadMessage,
  type StatusTone,
} from "../ui/semantic";
import { answerText } from "./AnswerControl";
export const reviewLabels = {
  NOT_REVIEWED: "Sin revisar",
  PENDING: "Pendiente",
  PARTIAL: "Respuesta parcial",
  ANSWERED: "Respondida",
  CLARIFICATION_REQUIRED: "Requiere aclaración",
  VALIDATED: "Validada",
  NOT_APPLICABLE: "No aplica",
  CONFLICT: "Conflicto",
};
export const threadLabels = {
  WAITING_STAKEHOLDER: "Espera aclaración del participante",
  WAITING_ANALYST: "Lista para revisar",
  CLOSED: "Aclaración cerrada",
};
export const dateText = (date: string | null) =>
  date ? formatDate(date) : "Sin aportaciones";
/** Downloads one evidence file through the authenticated API; errors stay next to the files. */
function useEvidenceDownload(projectId: string) {
  const [error, setError] = useState("");
  async function download(e: EvidenceView) {
    try {
      setError("");
      const url = URL.createObjectURL(await downloadEvidence(projectId, e.id));
      const a = document.createElement("a");
      a.href = url;
      a.download = e.originalName;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return { error, download };
}

/** Evidence of one submission: name, size and download, inside the answer it supports. */
export function EvidenceList({
  revision,
  projectId,
  empty = "Sin evidencia adjunta.",
}: {
  revision: ResponseView["revisions"][number];
  projectId: string;
  empty?: string;
}) {
  const { error, download } = useEvidenceDownload(projectId);
  return (
    <>
      {revision.evidence.length ? (
        revision.evidence.map(({ id, evidence: e }) => (
          <EvidenceFile
            key={id}
            name={e.originalName}
            size={`${e.byteSize.toLocaleString()} bytes`}
            disabled={e.status !== "READY"}
            onDownload={() => void download(e)}
          />
        ))
      ) : (
        <p className="hint">{empty}</p>
      )}
      {error && <Alert error>{error}</Alert>}
    </>
  );
}
export function SubmittedAnswer({
  revision: r,
  question,
  projectId,
  participant = false,
  contribution = false,
}: {
  participant?: boolean;
  contribution?: boolean;
  revision: ResponseView["revisions"][number];
  question: ResponseQuestionView;
  projectId: string;
}) {
  const { error, download } = useEvidenceDownload(projectId);
  if (contribution)
    return (
      <div className="ac-submitted-answer">
        <h3>Respuesta</h3>
        <p
          className={
            "ac-answer" +
            (["NUMBER", "YES_NO", "DATE"].includes(question.type)
              ? " ac-value"
              : "")
          }
        >
          {answerText(question, r.answer)}
        </p>
        {r.comment && (
          <section className="ac-answer-context">
            <h3>Comentario</h3>
            <p className="answer-text">{r.comment}</p>
          </section>
        )}
        {r.example && (
          <section className="ac-answer-context">
            <h3>Ejemplo</h3>
            <p className="answer-text">{r.example}</p>
          </section>
        )}
        <section className="ac-answer-evidence">
          <h3>Evidencia</h3>
          {r.evidence.length ? (
            r.evidence.map(({ id, evidence: e }) => (
              <EvidenceFile
                key={id}
                name={e.originalName}
                size={`${e.byteSize.toLocaleString()} bytes`}
                disabled={e.status !== "READY"}
                onDownload={() => void download(e)}
              />
            ))
          ) : (
            <p className="hint">Sin evidencia adjunta.</p>
          )}
        </section>
        {error && <Alert error>{error}</Alert>}
      </div>
    );
  return (
    <>
      <p className="hint">
        {participant ? (
          `Tú · ${dateText(r.createdAt)}`
        ) : (
          <>
            Envío #{r.number} · {dateText(r.createdAt)} ·{" "}
            {r.current ? "Vigente" : "Histórico"}
          </>
        )}
      </p>
      <p className="answer-text">{answerText(question, r.answer)}</p>
      {r.comment && (
        <p className="answer-text">
          <strong>Comentario: </strong>
          {r.comment}
        </p>
      )}
      {r.example && (
        <p className="answer-text">
          <strong>Ejemplo: </strong>
          {r.example}
        </p>
      )}
      {r.evidence.length > 0 && (
        <ul className="evidence-list">
          {r.evidence.map(({ id, evidence: e }) => (
            <li key={id}>
              <span>{e.originalName}</span>
              <Button
                tone="secondary"
                disabled={e.status !== "READY"}
                onClick={() => void download(e)}
              >
                Descargar {e.originalName}
              </Button>
            </li>
          ))}
        </ul>
      )}
      {error && <Alert error>{error}</Alert>}
    </>
  );
}
const threadTone: Record<ClarificationThreadView["status"], StatusTone> = {
  WAITING_STAKEHOLDER: "warning",
  WAITING_ANALYST: "info",
  CLOSED: "neutral",
};
const threadIcon: Record<ClarificationThreadView["status"], string> = {
  WAITING_STAKEHOLDER: "help",
  WAITING_ANALYST: "chat",
  CLOSED: "check",
};
export function ThreadStatus({
  status,
}: {
  status: ClarificationThreadView["status"];
}) {
  return (
    <StatusChip tone={threadTone[status]} icon={threadIcon[status]}>
      {threadLabels[status]}
    </StatusChip>
  );
}
/** Messages in order. The side that asks is told apart from the side that answers by word, not by colour. */
export function ThreadMessages({
  thread: t,
}: {
  thread: ClarificationThreadView;
}) {
  return (
    <>
      <ThreadStatus status={t.status} />
      <ol className="ac-thread-messages">
        {t.messages.map((m) => (
          <ThreadMessage
            key={m.id}
            from={m.author.id === t.respondentId ? "answers" : "asks"}
            author={m.author.displayName}
            date={dateText(m.createdAt)}
            dateTime={m.createdAt}
          >
            {m.body}
          </ThreadMessage>
        ))}
      </ol>
      {t.closedAt && (
        <p className="hint">
          Cerrada por {t.closedBy?.displayName} · {dateText(t.closedAt)}.{" "}
          {t.closeReason}
        </p>
      )}
    </>
  );
}
