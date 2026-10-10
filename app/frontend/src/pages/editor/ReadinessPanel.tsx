import { Button, EmptyState, Alert } from "../../ui";
import { FactGrid } from "../../ui/semantic";
import { type EditorProps } from "./EditorWorkspace";
import { readiness, type ReadinessIssue } from "./readiness";
export function ReadinessPanel(
  props: EditorProps & {
    onInspect: (id: string) => void;
    onOrganize: () => void;
  },
) {
  const { data } = props,
    issues = readiness(data);
  const published = issues.filter((i) => i.field === "publication").length;
  function correct(issue: ReadinessIssue) {
    const q = data.questions.find(
      (q) => q.id === (issue.targetId ?? issue.questionId),
    );
    if (!q) return;
    if (issue.targetId && issue.level === "ADVERTENCIA") {
      props.onOrganize();
      return;
    }
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
      <p className="lead">
        Revisa la definición del cuestionario. Las respuestas de participantes
        se revisan en la bandeja de revisión.
      </p>
      <FactGrid
        facts={[
          {
            id: "drafts",
            icon: "edit",
            label: "En borrador",
            value: data.questions.filter((q) => q.publication === "DRAFT")
              .length,
          },
          {
            id: "published",
            icon: "check",
            label: "Publicadas",
            value: data.questions.filter((q) => q.publication === "PUBLISHED")
              .length,
          },
          {
            id: "errors",
            icon: "flag",
            label: "Errores",
            value: issues.filter(
              (i) => i.level === "ERROR" && i.field !== "publication",
            ).length,
          },
          {
            id: "warnings",
            icon: "info",
            label: "Advertencias",
            value: issues.filter((i) => i.level === "ADVERTENCIA").length,
          },
        ]}
      />
      <details className="ac-help">
        <summary>Cómo se publica</summary>
        <p>
          Esta revisión orienta sobre el contenido. Para publicar varias
          preguntas, selecciónalas en Organizar y revisa el conjunto antes de
          confirmar. Si alguna está bloqueada, no se publica ninguna del
          conjunto.
        </p>
      </details>
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
        const items = issues.filter(
          (i) => i.level === level && i.field !== "publication",
        );
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
                      {issue.targetId && level === "ADVERTENCIA"
                        ? "Revisar publicación conjunta"
                        : level === "INFORMACIÓN"
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
      {published > 0 && (
        <p className="hint">
          {published} preguntas publicadas. Su contenido está protegido; puedes
          consultar su detalle en Organizar.
        </p>
      )}
      <section className="qe-publication">
        <h4>Publicar preguntas</h4>
        <p>
          Para publicar varias a la vez, selecciónalas en Organizar. También
          puedes publicar una pregunta por separado: cada confirmación conserva
          las publicaciones anteriores.
        </p>
        {data.questions.some((q) => q.publication === "DRAFT") ? (
          <ul className="qe-drafts">
            {data.questions
              .filter((q) => q.publication === "DRAFT")
              .map((q) => (
                <li key={q.id}>
                  <span>{q.question}</span>
                  <Button
                    tone="secondary"
                    disabled={issues.some(
                      (i) =>
                        i.questionId === q.id &&
                        (i.level === "ERROR" ||
                          (!!i.targetId &&
                            (i.field === "groupParentId" ||
                              i.field === "condition"))),
                    )}
                    onClick={() => props.onAction("publish", q)}
                    aria-label={"Publicar: " + q.title}
                  >
                    Publicar
                  </Button>
                </li>
              ))}
          </ul>
        ) : (
          <p className="hint">No hay preguntas en borrador.</p>
        )}
        <Button tone="secondary" onClick={props.onOrganize}>
          Seleccionar preguntas en Organizar
        </Button>
      </section>
    </section>
  );
}
