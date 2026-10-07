import { ContributionComparison } from "./ContributionComparison";
import { Link } from "react-router-dom";
import type {
  ReviewDetail,
  dashboardView,
  reviewStates,
} from "@requirements/contracts";
import type { z } from "zod";
import { ParticipantIcon } from "./ParticipantIcon";
import { dateText, reviewLabels, SubmittedAnswer } from "./ReviewShared";
import "../analyst-visual.css";

type State = (typeof reviewStates)[number];
const statePresentation: Record<State, { icon: string; tone: string }> = {
  NOT_REVIEWED: { icon: "info", tone: "neutral" },
  PENDING: { icon: "clock", tone: "neutral" },
  PARTIAL: { icon: "edit", tone: "amber" },
  ANSWERED: { icon: "send", tone: "teal" },
  CLARIFICATION_REQUIRED: { icon: "help", tone: "amber" },
  VALIDATED: { icon: "check", tone: "forest" },
  NOT_APPLICABLE: { icon: "info", tone: "neutral" },
  CONFLICT: { icon: "flag", tone: "conflict" },
};
export function AnalystStatus({ status }: { status: State }) {
  const presentation = statePresentation[status];
  return (
    <span className={`av-status av-${presentation.tone}`}>
      <ParticipantIcon name={presentation.icon} />
      <span>{reviewLabels[status]}</span>
    </span>
  );
}
export function DecisionRecord({
  data,
  validation: v,
}: {
  data: ReviewDetail;
  validation: ReviewDetail["validations"][number];
}) {
  const historical = !!v.invalidatedAt;
  return (
    <article
      className={`av-decision ${historical ? "av-historical" : "av-current"}`}
      aria-label={historical ? "Decisión histórica" : "Decisión vigente"}
    >
      <header>
        {historical ? (
          <p className="av-kicker">
            <ParticipantIcon name="clock" />
            Antecedente
          </p>
        ) : (
          <AnalystStatus status="VALIDATED" />
        )}
        <h3>{historical ? "Decisión histórica" : "Decisión vigente"}</h3>
        <p className="next-decision-reference">
          Referencia del registro: {v.id}
        </p>
        <div className="av-decision-author">
          <p>
            Validada por <strong>{v.validatedBy.displayName}</strong>
          </p>
          <p>Fecha: {dateText(v.validatedAt)}</p>
        </div>
        {historical && (
          <p className="av-secondary">
            Se conserva como antecedente. Ya no es la decisión vigente.
          </p>
        )}
      </header>
      <div className="next-decision-question">
        <h4>Pregunta</h4>
        <p className="answer-text">{data.question.question}</p>
      </div>
      <h4>Qué se decidió</h4>
      <p className="av-decision-text">{v.decisionText}</p>
      <div className="av-decision-scope">
        <div>
          <h4>Alcance</h4>
          <p className="answer-text">{v.scope}</p>
        </div>
        <div>
          <h4>Excepciones</h4>
          <p className="answer-text">
            {v.exceptions || "No se registraron excepciones."}
          </p>
        </div>
      </div>
      <h4>Fuentes utilizadas</h4>
      {v.sources.length + v.messages.length + v.resolutions.length === 0 ? (
        <p>Sin fuentes disponibles para mostrar.</p>
      ) : (
        <ul className="av-sources">
          {v.sources.map((source) => {
            const s = data.submissions.find(
              (s) => s.id === source.responseRevisionId,
            );
            return (
              <li key={source.id}>
                {s ? (
                  <details>
                    <summary>
                      Respuesta de {s.respondent.displayName} · {s.area.name} ·
                      envío #{s.number}
                    </summary>
                    <SubmittedAnswer
                      revision={s}
                      question={data.question}
                      projectId={data.projectId}
                    />
                  </details>
                ) : (
                  "Respuesta vinculada; detalle no disponible."
                )}
              </li>
            );
          })}
          {v.messages.map((source) => {
            const m = data.threads
              .flatMap((t) => t.messages)
              .find((m) => m.id === source.clarificationMessageId);
            return (
              <li key={source.id}>
                {m
                  ? `Aclaración de ${m.author.displayName}: ${m.body}`
                  : "Aclaración vinculada; detalle no disponible."}
              </li>
            );
          })}
          {v.resolutions.map((source) => (
            <li key={source.id}>
              Resolución:{" "}
              {data.conflicts.find(
                (c) => c.resolution?.id === source.conflictResolutionId,
              )?.resolution?.resolutionText ?? "Detalle no disponible."}
            </li>
          ))}
        </ul>
      )}
      {historical && (
        <p className="av-history-reason">
          Volvió a revisión: {v.invalidationReason || "Sin motivo disponible."}{" "}
          · {dateText(v.invalidatedAt)}
        </p>
      )}
      {v.validationComment && (
        <details>
          <summary>Comentario interno</summary>
          <p className="answer-text">{v.validationComment}</p>
        </details>
      )}
    </article>
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
