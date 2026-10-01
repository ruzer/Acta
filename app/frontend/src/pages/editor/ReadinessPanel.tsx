import { Button, EmptyState, Alert } from "../../ui";
import { type EditorProps } from "./EditorWorkspace";
import { readiness, type ReadinessIssue } from "./readiness";
export function ReadinessPanel(
  props: EditorProps & { onInspect: (id: string) => void },
) {
  const { data } = props,
    issues = readiness(data);
  function correct(issue: ReadinessIssue) {
    const q = data.questions.find(
      (q) => q.id === (issue.targetId ?? issue.questionId),
    );
    if (!q) return;
    if (issue.field === "assignments") props.onAction("assign", q);
    else if (issue.targetId && q.publication === "DRAFT")
      props.onAction("publish", q);
    else if (q.publication === "DRAFT")
      props.onEdit(q, q.sectionId, issue.field);
    else if (issue.field === "responsibleAreaId") props.onAction("metadata", q);
    else props.onInspect(q.id);
  }
  return (
    <section className="qe-readiness" aria-label="Revisar antes de publicar">
      <h3>Revisar antes de publicar</h3>
      <p>
        Revisa la definición del cuestionario. Las respuestas de participantes
        se revisan en la bandeja de revisión.
      </p>
      <p className="hint">
        Comprobaciones sobre la información cargada. El servidor vuelve a
        validar permisos, versiones y reglas al publicar cada pregunta; no es
        una publicación atómica del cuestionario.
      </p>
      {data.questions.length >= 2000 && (
        <Alert>
          El cuestionario puede superar el límite de información cargada. Esta
          revisión no certifica el conjunto completo.
        </Alert>
      )}
      {!issues.length && (
        <EmptyState title="Sin incidencias detectadas.">
          La publicación mantiene las comprobaciones del servidor.
        </EmptyState>
      )}
      {(["ERROR", "ADVERTENCIA", "INFORMACIÓN"] as const).map((level) => {
        const items = issues.filter((i) => i.level === level);
        return (
          items.length > 0 && (
            <section key={level}>
              <h4>
                {
                  {
                    ERROR: "Errores · resuelve antes de publicar",
                    ADVERTENCIA: "Advertencias · revisa",
                    INFORMACIÓN: "Información · no bloquea",
                  }[level]
                }{" "}
                ({items.length})
              </h4>
              {items.map((issue, index) => {
                const q = data.questions.find(
                  (q) => q.id === issue.questionId,
                )!;
                return (
                  <article
                    className={"qe-issue qe-issue-" + level.toLowerCase()}
                    key={q.id + issue.field + index}
                  >
                    <div>
                      <p className="hint">
                        {data.sections.find((s) => s.id === q.sectionId)?.title}
                      </p>
                      <h5>{q.question}</h5>
                      <p>{issue.message}</p>
                    </div>
                    <Button tone="secondary" onClick={() => correct(issue)}>
                      {level === "INFORMACIÓN"
                        ? "Ver pregunta"
                        : "Ir a corregir"}
                    </Button>
                  </article>
                );
              })}
            </section>
          )
        );
      })}
      <section className="qe-publication">
        <h4>Publicar preguntas</h4>
        <p>
          Confirma cada pregunta por separado. Un fallo no revierte
          publicaciones anteriores.
        </p>
        {data.questions
          .filter((q) => q.publication === "DRAFT")
          .map((q) => (
            <div key={q.id}>
              <span>{q.question}</span>
              <Button
                disabled={issues.some(
                  (i) => i.questionId === q.id && i.level === "ERROR",
                )}
                onClick={() => props.onAction("publish", q)}
                aria-label={"Publicar: " + q.title}
              >
                Publicar
              </Button>
            </div>
          ))}
        {!data.questions.some((q) => q.publication === "DRAFT") && (
          <p className="hint">No hay preguntas en borrador.</p>
        )}
      </section>
    </section>
  );
}
