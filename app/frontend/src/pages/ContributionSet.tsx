import { useEffect, useRef, useState, type ReactNode } from "react";
import type { ReviewDetail } from "@requirements/contracts";
import { Button, EmptyState, Input, Select } from "../ui";
import { ContributionRail, ContributionPane, MetaLine } from "../ui/semantic";
import { answerText } from "./AnswerControl";
import { ContributionComparison } from "./ContributionComparison";
import { dateText, SubmittedAnswer } from "./ReviewShared";
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
    <span className="next-contribution-signals">
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
    </span>
  );
}

export function ContributionSet({
  data,
  onCompare,
  renderThreads,
}: {
  data: ReviewDetail;
  onCompare?: () => void;
  renderThreads?: (submissionId: string) => ReactNode;
}) {
  const current = data.submissions.filter((s) => s.current);
  const historical = data.submissions.filter((s) => !s.current);
  const [wide, setWide] = useState(
    () =>
      typeof matchMedia === "function" &&
      matchMedia("(min-width:900px)").matches,
  );
  useEffect(() => {
    const media = window.matchMedia?.("(min-width:900px)");
    if (!media) return;
    const update = () => setWide(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
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
  const selected =
    current.length === 1
      ? current[0]
      : selectedId
        ? current.find((s) => s.id === selectedId)
        : wide
          ? visible[0]
          : undefined;
  const displayedId = selected?.id;
  useEffect(() => {
    if (selectedId) {
      if (displayedId) detailHeading.current?.focus();
      else setHeading.current?.focus();
    }
  }, [selectedId, displayedId]);
  function returnToSet() {
    const previous = selectedId;
    setSelectedId("");
    requestAnimationFrame(() =>
      (buttons.current.get(previous) ?? setHeading.current)?.focus(),
    );
  }
  const listVisible = current.length > 1 && (wide || !selected);
  const heading = (
    <div className="next-contributions-heading">
      <h2 id="received" ref={setHeading} tabIndex={-1}>
        {current.length} {current.length === 1 ? "aportación" : "aportaciones"}
      </h2>
      <p>Envíos vigentes. La cantidad no significa consenso.</p>
    </div>
  );
  return (
    <section className="next-contributions" aria-labelledby="received">
      {!(listVisible && wide) && heading}
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
      ) : (
        <div
          className={`ac-contribution-workspace${listVisible ? " ac-contribution-multiple" : ""}`}
        >
          {listVisible && (
            <div className="ac-contribution-list-panel">
              {wide && heading}
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
                    <option value="clarification">
                      Con aclaración abierta
                    </option>
                    <option value="conflict">En conflicto abierto</option>
                  </Select>
                </div>
              )}
              <p className="ac-contribution-count" role="status">
                {visible.length} de {current.length} aportaciones
              </p>
              {visible.length ? (
                <ContributionRail
                  label="Aportaciones vigentes"
                  selected={selected?.id ?? null}
                  onSelect={setSelectedId}
                  items={visible.map((s) => {
                    const text = answerText(data.question, s.answer)
                      .replace(/\s+/g, " ")
                      .trim();
                    return {
                      id: s.id,
                      label: `Abrir aportación de ${s.respondent.displayName}`,
                      buttonRef: (node) => {
                        if (node) buttons.current.set(s.id, node);
                        else buttons.current.delete(s.id);
                      },
                      content: (
                        <>
                          <strong className="ac-contribution-person">
                            {s.respondent.displayName}
                          </strong>
                          <span className="ac-contribution-area">
                            {s.area.name}
                          </span>
                          <span className="ac-contribution-excerpt">
                            {text.length > 180
                              ? `${text.slice(0, 180).trimEnd()}…`
                              : text}
                          </span>
                          <SubmissionSignals data={data} submission={s} />
                        </>
                      ),
                    };
                  })}
                />
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
              <Button
                tone="secondary"
                ref={comparisonTrigger}
                onClick={() => (onCompare ? onCompare() : setComparing(true))}
              >
                Comparar aportaciones
              </Button>
            </div>
          )}
          {selected && (
            <div className="ac-contribution-selected">
              {!wide && current.length > 1 && (
                <Button tone="secondary" onClick={returnToSet}>
                  ← Volver a {current.length} aportaciones
                </Button>
              )}
              <ContributionPane
                headingRef={detailHeading}
                title={selected.respondent.displayName}
                metadata={
                  <>
                    <MetaLine
                      items={[
                        selected.area.name,
                        `Envío #${selected.number}`,
                        dateText(selected.createdAt),
                        selected.current ? "Vigente" : "Histórico",
                      ]}
                    />
                    <SubmissionSignals data={data} submission={selected} />
                  </>
                }
              >
                <SubmittedAnswer
                  revision={selected}
                  question={data.question}
                  projectId={data.projectId}
                  contribution
                />
                {renderThreads?.(selected.id)}
              </ContributionPane>
            </div>
          )}
        </div>
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
              <MetaLine
                items={[s.area.name, dateText(s.createdAt), "Histórico"]}
              />
              <SubmittedAnswer
                revision={s}
                question={data.question}
                projectId={data.projectId}
                contribution
              />
              {renderThreads?.(s.id)}
            </article>
          ))}
        </details>
      )}
    </section>
  );
}
