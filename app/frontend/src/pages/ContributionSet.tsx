import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import type { ReviewDetail } from "@requirements/contracts";
import { Button, EmptyState, Input, Select } from "../ui";
import { ContributionRail, ContributionPane, MetaLine } from "../ui/semantic";
import { answerText } from "./AnswerControl";
import { ContributionComparison } from "./ContributionComparison";
import { relevantSubmissionId } from "./review-turn";
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
/**
 * What is pending around a submission. In the list it also says whether it has
 * files; next to the open contribution the evidence section already says it,
 * so only the situation (clarification, conflict) is repeated there.
 */
function SubmissionSignals({
  data,
  submission,
  inList = false,
}: {
  data: ReviewDetail;
  submission: Submission;
  inList?: boolean;
}) {
  const { threads, conflict } = signals(data, submission);
  if (!inList && !threads.length && !conflict) return null;
  return (
    <span className="next-contribution-signals">
      {inList && (
        <span>
          {submission.evidence.length
            ? `${submission.evidence.length} ${submission.evidence.length === 1 ? "archivo adjunto" : "archivos adjuntos"}`
            : "Sin archivos adjuntos"}
        </span>
      )}
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
  renderActions,
  openId,
}: {
  data: ReviewDetail;
  onCompare?: () => void;
  renderThreads?: (submissionId: string) => ReactNode;
  /** Actions about the open contribution, next to it. */
  renderActions?: (submissionId: string) => ReactNode;
  /** Contribution a link asked to open (for example from a decision's grounds). */
  openId?: string;
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
  // UX-06: open on the contribution the pending clarification or the open
  // conflict points to; otherwise keep the server order. Asking for the list
  // (narrow screens) is respected and not undone by the preference.
  const [listRequested, setListRequested] = useState(false);
  // A new request to open a contribution replaces what was chosen before.
  const [seenOpenId, setSeenOpenId] = useState(openId);
  if (openId !== seenOpenId) {
    setSeenOpenId(openId);
    setSelectedId("");
    setListRequested(false);
  }
  const relevant = relevantSubmissionId(data);
  const requested = openId
    ? (visible.find((s) => s.id === openId) ??
      current.find((s) => s.id === openId))
    : undefined;
  const preferred =
    requested ??
    visible.find((s) => s.id === relevant) ??
    (wide ? visible[0] : undefined);
  const selected =
    current.length === 1
      ? current[0]
      : selectedId
        ? current.find((s) => s.id === selectedId)
        : listRequested
          ? wide
            ? visible[0]
            : undefined
          : preferred;
  const displayedId = selected?.id;
  useEffect(() => {
    if (selectedId) {
      if (displayedId) detailHeading.current?.focus();
      else setHeading.current?.focus();
    }
  }, [selectedId, displayedId]);
  function returnToSet() {
    const previous = selectedId || selected?.id || "";
    setListRequested(true);
    setSelectedId("");
    requestAnimationFrame(() =>
      (buttons.current.get(previous) ?? setHeading.current)?.focus(),
    );
  }
  const listVisible = current.length > 1 && (wide || !selected);
  // On a narrow screen the open contribution replaces the list: the count is
  // already in "← Volver a N aportaciones", so the heading only stays for
  // assistive technology and as the section's name.
  const headingHidden =
    current.length === 0 ||
    (!wide && current.length > 1 && !!selected && !comparing);
  const heading = (
    <div
      className={`next-contributions-heading${headingHidden ? " sr-only" : ""}`}
    >
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
          {data.canReview && !historical.length && (
            <p className="ac-empty-next">
              {!data.participants.length && (
                <Link
                  className="button secondary"
                  to={`/projects/${data.projectId}/editor`}
                >
                  Asignar participantes en el cuestionario
                </Link>
              )}
              <Link
                className="button secondary"
                to={`/projects/${data.projectId}/invitations`}
              >
                Crear invitación
              </Link>
            </p>
          )}
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
                          <SubmissionSignals
                            data={data}
                            submission={s}
                            inList
                          />
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
                actions={renderActions?.(selected.id)}
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
