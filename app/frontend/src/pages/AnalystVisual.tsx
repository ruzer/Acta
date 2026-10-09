import { useState } from "react";
import { ContributionComparison } from "./ContributionComparison";
import { Link } from "react-router-dom";
import type {
  ReviewDetail,
  dashboardView,
  reviewStates,
} from "@requirements/contracts";
import type { z } from "zod";
import { Button } from "../ui";
import { DecisionSheet, StatusChip, type StatusTone } from "../ui/semantic";
import { ParticipantIcon } from "./ParticipantIcon";
import { answerText } from "./AnswerControl";
import {
  dateText,
  EvidenceList,
  reviewLabels,
  SubmittedAnswer,
} from "./ReviewShared";
import "../analyst-visual.css";

type State = (typeof reviewStates)[number];
const statePresentation: Record<State, { icon: string; tone: StatusTone }> = {
  NOT_REVIEWED: { icon: "info", tone: "neutral" },
  PENDING: { icon: "clock", tone: "neutral" },
  PARTIAL: { icon: "edit", tone: "warning" },
  ANSWERED: { icon: "send", tone: "info" },
  CLARIFICATION_REQUIRED: { icon: "help", tone: "warning" },
  VALIDATED: { icon: "check", tone: "success" },
  NOT_APPLICABLE: { icon: "info", tone: "neutral" },
  CONFLICT: { icon: "flag", tone: "danger" },
};
export function AnalystStatus({ status }: { status: State }) {
  const presentation = statePresentation[status];
  return (
    <StatusChip tone={presentation.tone} icon={presentation.icon}>
      {reviewLabels[status]}
    </StatusChip>
  );
}
const excerptLimit = 320;
function CopyRecord({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <>
      <Button
        tone="tertiary"
        onClick={() => {
          void navigator.clipboard
            ?.writeText(value)
            .then(() => setCopied(true))
            .catch(() => setCopied(false));
        }}
      >
        Copiar referencia
      </Button>
      <span role="status" className="ac-copy-status">
        {copied ? "Referencia copiada" : ""}
      </span>
    </>
  );
}
/**
 * A decision as a document: the result is the content (serif, dominant), scope
 * and exceptions follow, then the numbered grounds with their verifiable
 * sources. The record identifier is only in the foot. It documents the review;
 * it does not create any legal effect.
 */
export function DecisionRecord({
  data,
  validation: v,
  onReopen,
  onOpenContribution,
}: {
  data: ReviewDetail;
  validation: ReviewDetail["validations"][number];
  /** Present only when the viewer may reopen the question (`canReview`). */
  onReopen?: () => void;
  /** Opens a source contribution in the Aportaciones tab. */
  onOpenContribution?: (submissionId: string) => void;
}) {
  const historical = !!v.invalidatedAt;
  const grounds = [
    ...v.sources.map((source) => ({
      id: source.id,
      node: (() => {
        const s = data.submissions.find(
          (s) => s.id === source.responseRevisionId,
        );
        if (!s)
          return (
            <p className="ac-foundation-text">
              Respuesta vinculada; detalle no disponible.
            </p>
          );
        const text = answerText(data.question, s.answer).replace(/\s+/g, " ");
        return (
          <>
            <p className="ac-foundation-byline">
              <strong>{s.respondent.displayName}</strong> · {s.area.name} ·
              envío #{s.number} · {dateText(s.createdAt)}
            </p>
            <p className="ac-foundation-text">
              {text.length > excerptLimit
                ? `${text.slice(0, excerptLimit).trimEnd()}…`
                : text}
            </p>
            {(text.length > excerptLimit || s.comment || s.example) && (
              <details>
                <summary>
                  Respuesta completa de {s.respondent.displayName}
                </summary>
                <SubmittedAnswer
                  revision={s}
                  question={data.question}
                  projectId={data.projectId}
                />
              </details>
            )}
            <EvidenceList
              revision={s}
              projectId={data.projectId}
              empty="Sin evidencia adjunta."
            />
            {onOpenContribution && (
              <Button
                tone="tertiary"
                className="button tertiary ac-foundation-open"
                aria-label={`Abrir la aportación de ${s.respondent.displayName}, envío #${s.number}`}
                onClick={() => onOpenContribution(s.id)}
              >
                Abrir la aportación
              </Button>
            )}
          </>
        );
      })(),
    })),
    ...v.messages.map((source) => {
      const m = data.threads
        .flatMap((t) => t.messages)
        .find((m) => m.id === source.clarificationMessageId);
      return {
        id: source.id,
        node: (
          <p className="ac-foundation-text">
            {m
              ? `Aclaración de ${m.author.displayName}: ${m.body}`
              : "Aclaración vinculada; detalle no disponible."}
          </p>
        ),
      };
    }),
    ...v.resolutions.map((source) => ({
      id: source.id,
      node: (
        <p className="ac-foundation-text">
          Resolución:{" "}
          {data.conflicts.find(
            (c) => c.resolution?.id === source.conflictResolutionId,
          )?.resolution?.resolutionText ?? "Detalle no disponible."}
        </p>
      ),
    })),
  ];
  return (
    <DecisionSheet
      label={historical ? "Decisión histórica" : "Decisión vigente"}
      kicker={historical ? "Decisión histórica" : "Decisión validada"}
      header={
        <>
          {historical ? (
            <StatusChip tone="neutral" icon="clock">
              Antecedente
            </StatusChip>
          ) : (
            <StatusChip tone="success" icon="check">
              Vigente
            </StatusChip>
          )}
          <p className="ac-decision-by">
            Validada por <strong>{v.validatedBy.displayName}</strong> ·{" "}
            {dateText(v.validatedAt)}
          </p>
        </>
      }
      footer={
        <>
          <p className="ac-decision-record">
            <span>
              Referencia del registro: <code>{v.id}</code>
            </span>
            <CopyRecord value={v.id} />
          </p>
          <p>
            Documenta el resultado de la revisión del equipo analista. No
            equivale a una firma electrónica ni tiene un efecto jurídico
            adicional. Esto no significa que cada aportación individual haya
            sido validada.
          </p>
          {onReopen && !historical && (
            <div>
              <Button tone="tertiary" onClick={onReopen}>
                Reabrir pregunta
              </Button>
            </div>
          )}
        </>
      }
    >
      {historical && (
        <p className="av-secondary">
          Se conserva como antecedente. Ya no es la decisión vigente.
        </p>
      )}
      <div className="ac-decision-quote">
        <p className="ac-decision-label">Pregunta</p>
        <p>{data.question.question}</p>
      </div>
      <h3 className="ac-decision-label ac-decision-label-result">Se decide</h3>
      <p className="ac-decision-result">{v.decisionText}</p>
      <div className="ac-decision-grid">
        <div>
          <h3 className="ac-decision-label">Alcance</h3>
          <p>{v.scope}</p>
        </div>
        <div>
          <h3 className="ac-decision-label">Excepciones</h3>
          <p>{v.exceptions || "No se registraron excepciones."}</p>
        </div>
      </div>
      <section className="ac-decision-section">
        <h3 className="ac-decision-label">Fundamentos</h3>
        {grounds.length === 0 ? (
          <p>Sin fuentes disponibles para mostrar.</p>
        ) : (
          <ol className="ac-foundations">
            {grounds.map((ground, index) => (
              <li key={ground.id}>
                <span className="ac-foundation-index" aria-hidden="true">
                  [{index + 1}]
                </span>
                <div>{ground.node}</div>
              </li>
            ))}
          </ol>
        )}
      </section>
      {historical && (
        <p className="av-history-reason">
          Volvió a revisión: {v.invalidationReason || "Sin motivo disponible."}{" "}
          · {dateText(v.invalidatedAt)}
        </p>
      )}
      {v.validationComment && (
        <details className="ac-decision-section">
          <summary>Comentario interno</summary>
          <p className="answer-text">{v.validationComment}</p>
        </details>
      )}
    </DecisionSheet>
  );
}
/** A "No aplica" disposition keeps the same document grammar as a decision. */
export function DispositionRecord({
  disposition: n,
}: {
  disposition: ReviewDetail["dispositions"][number];
}) {
  const historical = !!n.revokedAt;
  return (
    <DecisionSheet
      label={historical ? "Decisión histórica" : "No aplica vigente"}
      kicker={historical ? "Decisión histórica" : "Marcada como No aplica"}
      header={
        <p className="ac-decision-by">
          <strong>{n.markedBy.displayName}</strong> · {dateText(n.markedAt)}
        </p>
      }
    >
      <h3 className="ac-decision-label ac-decision-label-result">Motivo</h3>
      <p className="ac-decision-result">{n.reason}</p>
      <div className="ac-decision-grid">
        <div>
          <h3 className="ac-decision-label">Alcance</h3>
          <p>{n.scope}</p>
        </div>
      </div>
      {n.revokedAt && (
        <p className="av-history-reason">
          Reabierta: {n.revokeReason} · {dateText(n.revokedAt)}
        </p>
      )}
    </DecisionSheet>
  );
}
export function ConflictComparison({
  data,
  conflict,
}: {
  data: ReviewDetail;
  conflict: ReviewDetail["conflicts"][number];
}) {
  return (
    <ContributionComparison
      data={data}
      revisionIds={conflict.participants.map((p) => p.responseRevisionId)}
    />
  );
}

const attentionCopy: Partial<
  Record<State, { reason: string; action: string }>
> = {
  CONFLICT: {
    reason:
      "Hay un conflicto registrado entre aportaciones que necesita revisión.",
    action: "Revisar conflicto",
  },
  CLARIFICATION_REQUIRED: {
    reason:
      "Hay aclaraciones abiertas. Consulta el hilo para saber a quién corresponde continuar.",
    action: "Ver aclaración",
  },
  ANSWERED: {
    reason:
      "Se recibieron respuestas; todavía no hay una decisión validada vigente.",
    action: "Revisar respuestas",
  },
  PARTIAL: {
    reason: "La información recibida todavía está incompleta.",
    action: "Revisar información faltante",
  },
  PENDING: {
    reason: "La pregunta continúa pendiente.",
    action: "Revisar pendiente",
  },
  NOT_REVIEWED: {
    reason: "Esta pregunta todavía no se ha revisado.",
    action: "Revisar pregunta",
  },
};
export function AttentionPanel({
  data,
  projectId,
}: {
  data: z.infer<typeof dashboardView>;
  projectId: string;
}) {
  // Preserve the server's order. No new urgency ranking or SLA is inferred.
  const attention = data.questions.filter((q) => attentionCopy[q.status]);
  return (
    <section className="av-attention" aria-labelledby="attention-title">
      <div className="av-section-heading">
        <h2 id="attention-title">Qué requiere atención</h2>
        <span>
          {attention.length} {attention.length === 1 ? "pregunta" : "preguntas"}
        </span>
      </div>
      {attention.length ? (
        <>
          <p className="av-secondary">
            {attention.length > 3 ? "Primeras 3 preguntas" : "Preguntas"} en el
            orden del cuestionario. Abre cada caso para revisar sus fuentes y
            contexto.
          </p>
          <ul>
            {attention.slice(0, 3).map((q) => (
              <li key={q.id}>
                <div>
                  <AnalystStatus status={q.status} />
                  <h3>{q.title}</h3>
                  <p>{attentionCopy[q.status]!.reason}</p>
                  <p className="av-secondary">
                    {q.sectionTitle} · {q.areaName}
                  </p>
                  {q.conditionalWithoutCase && (
                    <p className="av-secondary">
                      Condicional · aún sin caso aplicable
                    </p>
                  )}
                </div>
                <Link
                  className="button secondary"
                  to={`/projects/${projectId}/review/${q.id}`}
                  aria-label={`${attentionCopy[q.status]!.action}: ${q.title}`}
                >
                  {attentionCopy[q.status]!.action}
                  <ParticipantIcon name="arrow" />
                </Link>
              </li>
            ))}
          </ul>
          <a href="#dashboard-questions">
            Ver todas las preguntas y filtrar por estado
          </a>
        </>
      ) : (
        <p>
          {data.questions.length
            ? "No hay preguntas pendientes de revisión en este proyecto."
            : "Todavía no hay preguntas publicadas para revisar."}
        </p>
      )}
    </section>
  );
}
