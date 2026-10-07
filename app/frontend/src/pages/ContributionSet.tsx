import { useEffect, useId, useRef, useState } from "react";
import type { ReviewDetail } from "@requirements/contracts";
import { Button, EmptyState, Input, Select } from "../ui";
import { answerText } from "./AnswerControl";
import { ContributionComparison } from "./ContributionComparison";
import { SubmittedAnswer } from "./ReviewShared";
import "../next-contributions.css";

type Submission = ReviewDetail["submissions"][number];
type Situation = "" | "clarification" | "conflict";
function signals(data: ReviewDetail, submission: Submission) {
  return {
    threads: data.threads.filter(
      (t) => t.responseRevisionId === submission.id && t.status !== "CLOSED",
    ),
    conflict: data.conflicts.some(
      (c) =>
        c.status === "OPEN" &&
        c.participants.some((p) => p.responseRevisionId === submission.id),
    ),
  };
}
function SubmissionSignals({
  data,
  submission,
}: {
  data: ReviewDetail;
  submission: Submission;
}) {
  const { threads, conflict } = signals(data, submission);
  return (
    <div className="next-contribution-signals">
      <span>Enviada · vigente</span>
      <span>
        {submission.evidence.length
          ? `${submission.evidence.length} ${submission.evidence.length === 1 ? "archivo adjunto" : "archivos adjuntos"}`
          : "Sin archivos adjuntos"}
      </span>
      {threads.length > 0 && (
        <span className="next-contribution-clarification">
          {threads.length}{" "}
          {threads.length === 1
            ? "aclaración abierta"
            : "aclaraciones abiertas"}
          {threads.some((t) => t.status === "WAITING_STAKEHOLDER") &&
            " · espera al participante"}
          {threads.some((t) => t.status === "WAITING_ANALYST") &&
            " · espera al analista"}
        </span>
      )}
      {conflict && (
        <span className="next-contribution-conflict">En conflicto abierto</span>
      )}
    </div>
  );
}

export function ContributionSet({ data }: { data: ReviewDetail }) {
  const current = data.submissions.filter((s) => s.current);
  const historical = data.submissions.filter((s) => !s.current);
  const [selectedId, setSelectedId] = useState("");
  const [comparing, setComparing] = useState(false);
  const comparisonHeading = useRef<HTMLHeadingElement>(null);
  const comparisonTrigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (comparing) comparisonHeading.current?.focus();
  }, [comparing]);
  const [search, setSearch] = useState("");
  const [situation, setSituation] = useState<Situation>("");
  const detailHeading = useRef<HTMLHeadingElement>(null);
  const setHeading = useRef<HTMLHeadingElement>(null);
  const buttons = useRef(new Map<string, HTMLButtonElement>());
  const id = useId();
  const selected =
    current.length === 1
      ? current[0]
      : current.find((s) => s.id === selectedId);
  const displayedId = selected?.id;
  useEffect(() => {
    if (selectedId) {
      if (displayedId) detailHeading.current?.focus();
      else setHeading.current?.focus();
    }
  }, [selectedId, displayedId]);
  const normalize = (text: string) =>
    text
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toLocaleLowerCase();
  const needle = normalize(search.trim());
  const visible = current.filter((s) => {
    const state = signals(data, s);
    return (
      normalize(`${s.respondent.displayName} ${s.area.name}`).includes(
        needle,
      ) &&
      (!situation ||
        (situation === "clarification"
          ? state.threads.length > 0
          : state.conflict))
    );
  });
  function returnToSet() {
    const previous = selectedId;
    setSelectedId("");
    requestAnimationFrame(() =>
      (buttons.current.get(previous) ?? setHeading.current)?.focus(),
    );
  }
  return (
    <section className="next-contributions" aria-labelledby="received">
      <div className="next-contributions-heading">
        <h2 id="received" ref={setHeading} tabIndex={-1}>
          {current.length}{" "}
          {current.length === 1 ? "aportación" : "aportaciones"}
        </h2>
        <p>Envíos vigentes. La cantidad no significa consenso.</p>
      </div>
      {current.length === 0 ? (
        <EmptyState title="Sin aportaciones vigentes">
          {historical.length
            ? "Hay envíos históricos, pero ninguno está vigente en el contexto actual. Puedes consultarlos abajo."
            : data.participants.length
              ? "Sin aportaciones enviadas. Las respuestas aparecerán cuando los participantes las envíen. Los borradores privados no se muestran."
              : data.canReview
                ? "Sin aportaciones enviadas. Esta pregunta no tiene participantes asignados en el contexto actual."
                : "No hay aportaciones vigentes disponibles en esta consulta."}
        </EmptyState>
      ) : comparing ? (
        <div>
          <Button
            tone="secondary"
            onClick={() => {
              setComparing(false);
              requestAnimationFrame(() =>
                (comparisonTrigger.current ?? setHeading.current)?.focus(),
              );
            }}
          >
            ← Volver a {current.length} aportaciones
          </Button>
          <h3 ref={comparisonHeading} tabIndex={-1}>
            Contrastar aportaciones
          </h3>
          <ContributionComparison data={data} />
        </div>
      ) : selected ? (
        <article className="review-submission next-contribution-detail">
          {current.length > 1 && (
            <Button tone="secondary" onClick={returnToSet}>
              ← Volver a {current.length} aportaciones
            </Button>
          )}
          <h3 ref={detailHeading} tabIndex={-1}>
            {selected.respondent.displayName}
          </h3>
          <p>{selected.area.name}</p>
          <SubmissionSignals data={data} submission={selected} />
          <SubmittedAnswer
            revision={selected}
            question={data.question}
            projectId={data.projectId}
          />
        </article>
      ) : (
        <>
          <p>
            Abre una aportación para consultar la respuesta completa, sus
            archivos y su versión.
          </p>
          <Button
            tone="secondary"
            ref={comparisonTrigger}
            onClick={() => setComparing(true)}
          >
            Comparar aportaciones
          </Button>
          {(current.length >= 10 || search || situation) && (
            <div className="next-contribution-filters">
              <Input
                label="Buscar por actor o área"
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <Select
                label="Situación de la aportación"
                value={situation}
                onChange={(e) => setSituation(e.target.value as Situation)}
              >
                <option value="">Todas</option>
                <option value="clarification">Con aclaración abierta</option>
                <option value="conflict">En conflicto abierto</option>
              </Select>
              <p role="status">
                {visible.length} de {current.length} aportaciones
              </p>
            </div>
          )}
          {visible.length ? (
            <ul
              className="next-contribution-list"
              aria-label="Aportaciones vigentes"
            >
              {visible.map((s) => {
                const text = answerText(data.question, s.answer)
                  .replace(/\s+/g, " ")
                  .trim();
                return (
                  <li key={s.id}>
                    <div className="next-contribution-actor">
                      <h3 id={`${id}-${s.id}`}>{s.respondent.displayName}</h3>
                      <p>{s.area.name}</p>
                    </div>
                    <div className="next-contribution-summary">
                      <p>
                        {text.length > 180
                          ? `${text.slice(0, 180).trimEnd()}…`
                          : text}
                      </p>
                      <SubmissionSignals data={data} submission={s} />
                    </div>
                    <Button
                      tone="secondary"
                      aria-label={`Abrir aportación de ${s.respondent.displayName}`}
                      ref={(node) => {
                        if (node) buttons.current.set(s.id, node);
                        else buttons.current.delete(s.id);
                      }}
                      onClick={() => setSelectedId(s.id)}
                    >
                      Abrir aportación
                    </Button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <EmptyState title="Sin aportaciones para estos filtros">
              <Button
                tone="secondary"
                onClick={() => {
                  setSearch("");
                  setSituation("");
                }}
              >
                Limpiar filtros
              </Button>
            </EmptyState>
          )}
        </>
      )}
      {historical.length > 0 && (
        <details className="next-contribution-history">
          <summary>Envíos históricos ({historical.length})</summary>
          <p>No se incluyen en el número de aportaciones vigentes.</p>
          {historical.map((s) => (
            <article className="review-submission" key={s.id}>
              <h3>
                {s.respondent.displayName} · envío #{s.number}
              </h3>
              <p>{s.area.name}</p>
              <SubmittedAnswer
                revision={s}
                question={data.question}
                projectId={data.projectId}
              />
            </article>
          ))}
        </details>
      )}
    </section>
  );
}
