import { formatDate } from "../branding";
import { useState } from "react";
import type {
  ClarificationThreadView,
  EvidenceView,
  ResponseQuestionView,
  ResponseView,
} from "@requirements/contracts";
import { downloadEvidence } from "../api";
import { Alert, Button, StatusBadge } from "../ui";
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
export function SubmittedAnswer({
  revision: r,
  question,
  projectId,
  participant = false,
  comparison = false,
}: {
  participant?: boolean;
  comparison?: boolean;
  revision: ResponseView["revisions"][number];
  question: ResponseQuestionView;
  projectId: string;
}) {
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
      {comparison && <h5>Respuesta</h5>}
      <p className="answer-text">{answerText(question, r.answer)}</p>
      {comparison && !r.comment && (
        <p className="av-secondary">Sin comentario adicional.</p>
      )}
      {r.comment && (
        <p className="answer-text">
          <strong>Comentario: </strong>
          {r.comment}
        </p>
      )}
      {comparison && !r.example && (
        <p className="av-secondary">Sin ejemplo adicional.</p>
      )}
      {r.example && (
        <p className="answer-text">
          <strong>Ejemplo: </strong>
          {r.example}
        </p>
      )}
      {comparison && <h5>Evidencia</h5>}
      {comparison && r.evidence.length === 0 && (
        <p className="av-secondary">Sin evidencia adjunta.</p>
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
export function ThreadMessages({
  thread: t,
}: {
  thread: ClarificationThreadView;
}) {
  return (
    <>
      <StatusBadge>{threadLabels[t.status]}</StatusBadge>
      <ol className="thread-messages">
        {t.messages.map((m) => (
          <li key={m.id}>
            <p>
              <strong>{m.author.displayName}</strong> · {dateText(m.createdAt)}
            </p>
            <p className="answer-text">{m.body}</p>
          </li>
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
