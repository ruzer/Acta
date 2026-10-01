import { useState } from "react";
import { type QuestionnaireView, type ResponseContent } from "@requirements/contracts";
import { Button, Select, Alert, EmptyState } from "../../ui";
import { AnswerControl } from "../AnswerControl";
import {
  applicability,
  applySimulation,
  type SimulatedAnswers,
} from "./simulation";
export function Preview({
  data,
  onClose,
}: {
  data: QuestionnaireView;
  onClose: () => void;
}) {
  const [member, setMember] = useState("");
  const [scope, setScope] = useState("all");
  const [id, setId] = useState("");
  const [values, setValues] = useState<SimulatedAnswers>({});
  const [applied, setApplied] = useState<SimulatedAnswers>({});
  const questions = data.questions
    .filter(
      (q) =>
        q.publication !== "ARCHIVED" &&
        (scope === "all" || q.publication === "PUBLISHED") &&
        (!member ||
          q.assignments.some((a) => a.active && a.projectMemberId === member)),
    )
    .sort(
      (a, b) =>
        (data.sections.find((s) => s.id === a.sectionId)?.order ?? 0) -
          (data.sections.find((s) => s.id === b.sectionId)?.order ?? 0) ||
        a.order - b.order,
    );
  const q = questions.find((q) => q.id === id) ?? questions[0];
  const state = q ? applicability(q.id, questions, applied) : "UNDETERMINED";
  const reset = () => {
    setId("");
    setValues({});
    setApplied({});
  };
  function apply(answer: ResponseContent["answer"]) {
    if (q) setApplied(applySimulation(q.id, answer, questions, applied));
  }
  return (
    <section className="qe-preview" aria-label="Vista previa">
      <header className="qe-heading">
        <div>
          <h2>Vista previa</h2>
          <p>Simulación local · no crea respuestas ni borradores.</p>
        </div>
        <Button tone="secondary" onClick={onClose}>
          Volver al cuestionario
        </Button>
      </header>
      <div className="qe-filters">
        <Select
          label="Contenido de la vista previa"
          value={scope}
          onChange={(e) => {
            setScope(e.target.value);
            reset();
          }}
        >
          <option value="all">Incluir borradores</option>
          <option value="published">Solo publicadas</option>
        </Select>
        <Select
          label="Simular asignaciones de"
          value={member}
          onChange={(e) => {
            setMember(e.target.value);
            reset();
          }}
        >
          <option value="">Todas las preguntas (sin persona)</option>
          {data.members
            .filter((m) => m.active && m.role === "STAKEHOLDER")
            .map((m) => (
              <option key={m.id} value={m.id}>
                {m.displayName}
              </option>
            ))}
        </Select>
      </div>
      {!q ? (
        <EmptyState title="No hay preguntas en este contexto.">
          Revisa las asignaciones o incluye borradores.
        </EmptyState>
      ) : (
        <>
          <Select
            label="Pregunta de la vista previa"
            value={q.id}
            onChange={(e) => setId(e.target.value)}
          >
            {questions.map((x, i) => (
              <option key={x.id} value={x.id}>
                {i + 1}. {x.title}
              </option>
            ))}
          </Select>
          <article className="qe-preview-question">
            <p className="hint">
              {data.sections.find((s) => s.id === q.sectionId)?.title} ·{" "}
              {questions.indexOf(q) + 1} de {questions.length}
            </p>
            <h3>{q.question}</h3>
            {q.helpText && <p>{q.helpText}</p>}
            {state !== "ENABLED" ? (
              <Alert>
                {state === "DISABLED"
                  ? "Esta pregunta está oculta por su condición en el contexto simulado."
                  : "Aplica primero un valor simulado en la pregunta principal para evaluar esta condición."}
              </Alert>
            ) : (
              <>
                <AnswerControl
                  compact
                  question={{
                    ...q,
                    sectionTitle:
                      data.sections.find((s) => s.id === q.sectionId)?.title ??
                      "",
                    position: questions.indexOf(q) + 1,
                    total: questions.length,
                    applicability: state,
                  }}
                  value={values[q.id] ?? null}
                  onChange={(value) => setValues({ ...values, [q.id]: value })}
                />
                <div className="actions">
                  <Button onClick={() => apply(values[q.id] ?? null)}>
                    Aplicar valor a la simulación
                  </Button>
                  <Button
                    tone="secondary"
                    onClick={() => {
                      const next = questions[questions.indexOf(q) + 1];
                      if (next) setId(next.id);
                    }}
                    disabled={questions.indexOf(q) === questions.length - 1}
                  >
                    Siguiente pregunta
                  </Button>
                </div>
                <p role="status" className="hint">
                  {Object.hasOwn(applied, q.id)
                    ? "Valor aplicado solo en esta vista previa."
                    : "Los valores no se envían ni se conservan al salir."}
                </p>
              </>
            )}
          </article>
        </>
      )}
    </section>
  );
}
