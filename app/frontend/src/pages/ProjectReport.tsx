import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import {
  answerText,
  validatedDecisionsExportDocument,
} from "@requirements/contracts";
import { exchangeRequest } from "../api";
import { formatDate, InstitutionMarks, useBranding } from "../branding";
import { Button, EmptyState, ErrorState, LoadingState } from "../ui";
import "../project-report.css";

export function ProjectReport() {
  const { projectId = "" } = useParams();
  const branding = useBranding();
  const query = useQuery({
    queryKey: ["project-report", projectId],
    queryFn: () =>
      exchangeRequest(projectId, "exports", validatedDecisionsExportDocument, {
        input: {
          format: "JSON",
          scope: "validated-decisions",
          requestId: crypto.randomUUID(),
        },
      }),
    retry: false,
    staleTime: 0,
    gcTime: 0,
    refetchOnWindowFocus: false,
  });
  if (query.isPending) return <LoadingState />;
  if (query.error)
    return (
      <ErrorState error={query.error} retry={() => void query.refetch()} />
    );
  const data = query.data;
  const decisions = data.decisions.filter(
    (item) =>
      item.status === "VALIDATED" &&
      item.validations.some((v) => !v.invalidatedAt),
  );
  return (
    <div className="project-report">
      <div className="report-actions">
        <Link to={`/projects/${projectId}/decisions`}>Volver a decisiones</Link>
        <Button onClick={() => window.print()} disabled={!decisions.length}>
          Imprimir o guardar como PDF
        </Button>
      </div>
      <header className="report-heading">
        <InstitutionMarks />
        <p>
          {branding.appName} · {branding.organizationName}
        </p>
        <h1>Informe de decisiones</h1>
        <h2>{String(data.project.name)}</h2>
        <p>Generado el {formatDate(data.exportedAt)}</p>
        <p>
          Decisiones vigentes y fuentes seleccionadas. No incluye borradores ni
          preguntas sin decisión.
        </p>
      </header>
      {!decisions.length && (
        <EmptyState title="Todavía no hay decisiones vigentes">
          El informe estará disponible cuando se registre una decisión sobre una
          pregunta publicada.
        </EmptyState>
      )}
      {decisions.map((item) => {
        const decision = item.validations.find((v) => !v.invalidatedAt)!;
        const resolutions = item.conflicts.flatMap((c) =>
          c.resolution &&
          decision.resolutions.some(
            (r) => r.conflictResolutionId === c.resolution!.id,
          )
            ? [c.resolution]
            : [],
        );
        const sourceIds = new Set([
          ...decision.sources.map((s) => s.responseRevisionId),
          ...resolutions.flatMap((r) =>
            r.sources.map((s) => s.responseRevisionId),
          ),
        ]);
        const sources = item.submissions.filter((s) => sourceIds.has(s.id));
        const messages = item.threads
          .flatMap((t) => t.messages)
          .filter((m) =>
            decision.messages.some(
              (selected) => selected.clarificationMessageId === m.id,
            ),
          );
        return (
          <article
            key={item.question.id}
            aria-label={item.question.question}
            className="report-decision"
          >
            <p className="report-theme">{item.question.sectionTitle}</p>
            <h2>{item.question.question}</h2>
            <h3>Respuesta final</h3>
            <p className="report-text">{decision.decisionText}</p>
            <p>
              <strong>Registrada por:</strong>{" "}
              {decision.validatedBy.displayName} ·{" "}
              {formatDate(decision.validatedAt)}
            </p>
            <p>
              <strong>Alcance:</strong> {decision.scope}
            </p>
            {decision.exceptions && (
              <p>
                <strong>Excepciones:</strong> {decision.exceptions}
              </p>
            )}
            <h3>Fuentes de la decisión</h3>
            <ol className="report-sources">
              {sources.map((source) => (
                <li key={source.id}>
                  <p>
                    <strong>{source.respondent.displayName}</strong> ·{" "}
                    {source.area.name} · Envío {source.number} ·{" "}
                    {formatDate(source.createdAt)}
                  </p>
                  <p className="report-text">
                    {answerText(item.question, source.answer)}
                  </p>
                  {source.comment && (
                    <p className="report-text">
                      <strong>Comentario:</strong> {source.comment}
                    </p>
                  )}
                  {source.example && (
                    <p className="report-text">
                      <strong>Ejemplo:</strong> {source.example}
                    </p>
                  )}
                  {source.evidence.length > 0 && (
                    <p>
                      <strong>Evidencia:</strong>{" "}
                      {source.evidence
                        .map((link) => link.evidence.originalName)
                        .join(", ")}
                    </p>
                  )}
                </li>
              ))}
            </ol>
            {messages.map((message) => (
              <section key={message.id}>
                <h3>Aclaración utilizada</h3>
                <p>
                  {message.author.displayName} · {formatDate(message.createdAt)}
                </p>
                <p className="report-text">{message.body}</p>
              </section>
            ))}
            {resolutions.map((resolution) => (
              <section key={resolution.id}>
                <h3>Resolución utilizada</h3>
                <p>
                  {resolution.resolvedBy.displayName} ·{" "}
                  {formatDate(resolution.resolvedAt)}
                </p>
                <p className="report-text">{resolution.resolutionText}</p>
              </section>
            ))}
          </article>
        );
      })}
      <p className="report-footer">
        Este informe refleja la información autorizada al generarlo. Los
        archivos de evidencia se consultan en Acta con los permisos
        correspondientes.
      </p>
    </div>
  );
}
