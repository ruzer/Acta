import { useQuery } from "@tanstack/react-query";
import {
  Link,
  useLocation,
  useParams,
  useSearchParams,
} from "react-router-dom";
import {
  dashboardView,
  decisionRegisterView,
  type DecisionRegisterEntry,
} from "@requirements/contracts";
import { exchangeRequest } from "../api";
import {
  Button,
  EmptyState,
  ErrorState,
  Input,
  LoadingState,
  Select,
} from "../ui";
import { RegisterRow } from "../ui/semantic";
import { ProjectWorkbench } from "./ProjectWorkbench";
import { dateText } from "./ReviewShared";
import { plural } from "../ui/plural";

export function ProjectDecisions() {
  const { projectId = "" } = useParams();
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const query = useQuery({
    queryKey: ["dashboard", projectId],
    queryFn: () => exchangeRequest(projectId, "dashboard", dashboardView),
    staleTime: 0,
  });
  // The excerpts are a convenience: without them the register is the same list
  // of questions it always was.
  const register = useQuery({
    queryKey: ["decisions", projectId],
    queryFn: () =>
      exchangeRequest(projectId, "decisions", decisionRegisterView),
    staleTime: 0,
    retry: false,
  });
  if (query.isPending) return <LoadingState />;
  if (query.error)
    return (
      <ErrorState error={query.error} retry={() => void query.refetch()} />
    );
  const data = query.data;
  const entries = new Map<string, DecisionRegisterEntry>(
    (register.data?.entries ?? []).map((entry) => [entry.questionId, entry]),
  );
  // What is in force follows the question's own status; the register only adds
  // the text. A question whose decision stopped being in force is listed apart.
  const decisions = data.questions.filter(
    (question) => question.status === "VALIDATED",
  );
  const reopened = data.questions.filter(
    (question) =>
      entries.get(question.id)?.state === "REOPENED" &&
      question.status !== "VALIDATED" &&
      question.status !== "NOT_APPLICABLE",
  );
  const undecided =
    data.questions.filter(
      (question) =>
        question.status !== "VALIDATED" && question.status !== "NOT_APPLICABLE",
    ).length - reopened.length;
  const search = params.get("q") ?? "";
  const area = params.get("area") ?? "";
  const section = params.get("section") ?? "";
  const term = search.trim().toLocaleLowerCase("es");
  const matches = (question: (typeof data.questions)[number]) => {
    const entry = entries.get(question.id);
    return (
      (!area || question.areaId === area) &&
      (!section || question.sectionId === section) &&
      (!term ||
        [
          question.externalId,
          question.title,
          question.sectionTitle,
          question.areaName,
          entry?.excerpt ?? "",
          entry?.scope ?? "",
        ].some((text) => text.toLocaleLowerCase("es").includes(term)))
    );
  };
  const items = decisions.filter(matches);
  const reopenedItems = reopened.filter(matches);
  const areas = [
    ...new Map(
      [...decisions, ...reopened].map((question) => [
        question.areaId,
        question.areaName,
      ]),
    ).entries(),
  ];
  const sections = [
    ...new Map(
      [...decisions, ...reopened].map((question) => [
        question.sectionId,
        question.sectionTitle,
      ]),
    ).entries(),
  ];
  const hasFilters = !!(search || area || section);
  // With a second list the first one needs its own heading, and the rows sit one level down.
  const grouped = reopenedItems.length > 0;
  const reopenedText = plural(
    reopened.length,
    "con decisión anterior",
    "con decisión anterior",
  );
  function filter(key: string, value: string) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  }
  function clearFilters() {
    const next = new URLSearchParams(params);
    for (const key of ["q", "area", "section"]) next.delete(key);
    setParams(next, { replace: true });
  }
  const row = (
    question: (typeof data.questions)[number],
    level: 2 | 3,
    ended: boolean,
  ) => {
    const entry = entries.get(question.id);
    return (
      <RegisterRow
        key={question.id}
        level={level}
        reference={question.externalId}
        title={
          <Link
            data-workbench-id={question.id}
            // A decision that is no longer in force opens on its record, not on the contributions.
            to={`/projects/${projectId}/review/${question.id}${ended ? "?tab=decision" : ""}`}
            state={{
              workbenchReturn: {
                view: "decisions",
                search: location.search,
              },
            }}
          >
            {question.title}
          </Link>
        }
        meta={`${question.sectionTitle} · ${question.areaName}`}
        summary={
          entry &&
          (ended ? (
            <>
              <strong>Decisión anterior:</strong> {entry.excerpt}
            </>
          ) : (
            entry.excerpt
          ))
        }
        detail={entry && decisionDetail(entry)}
      />
    );
  };
  return (
    <ProjectWorkbench
      projectId={projectId}
      projectName={data.projectName}
      role={data.role}
      active="decisions"
    >
      <section aria-label="Decisiones vigentes">
        <div className="pw-decisions-heading">
          <p>
            Preguntas con una decisión vigente. Cada línea muestra el inicio de
            lo decidido; abre la pregunta para leerlo completo con su alcance y
            sus fuentes.
          </p>
        </div>
        {decisions.length + reopened.length > 0 && (
          <div className="pw-decision-filters">
            <Input
              label="Buscar decisiones"
              type="search"
              value={search}
              onChange={(event) => filter("q", event.target.value)}
            />
            <Select
              label="Área responsable"
              value={area}
              onChange={(event) => filter("area", event.target.value)}
            >
              <option value="">Todas las áreas</option>
              {area && !areas.some(([id]) => id === area) && (
                <option value={area}>Área no disponible</option>
              )}
              {areas.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </Select>
            <Select
              label="Tema"
              value={section}
              onChange={(event) => filter("section", event.target.value)}
            >
              <option value="">Todos los temas</option>
              {section && !sections.some(([id]) => id === section) && (
                <option value={section}>Tema no disponible</option>
              )}
              {sections.map(([id, title]) => (
                <option key={id} value={id}>
                  {title}
                </option>
              ))}
            </Select>
          </div>
        )}
        <div className="pw-decision-results">
          <p role="status">
            {items.length === 1 ? "1 decisión" : `${items.length} decisiones`}
            {hasFilters ? ` de ${decisions.length}` : ""}
          </p>
          {hasFilters && (
            <Button tone="secondary" onClick={clearFilters}>
              Limpiar filtros
            </Button>
          )}
        </div>
        {reopened.length + undecided > 0 && (
          <p className="pw-decision-aside">
            Sin decisión vigente:{" "}
            {reopenedItems.length > 0 && (
              <a
                href="#reopened-decisions"
                onClick={(event) => {
                  // The group sits after a long list: take the reader to it.
                  event.preventDefault();
                  const heading = document.getElementById("reopened-decisions");
                  heading?.scrollIntoView();
                  heading?.focus();
                }}
              >
                {reopenedText}
              </a>
            )}
            {reopenedItems.length === 0 && reopened.length > 0 && reopenedText}
            {reopened.length > 0 && undecided > 0 && " · "}
            {undecided > 0 &&
              plural(
                undecided,
                "pregunta por decidir",
                "preguntas por decidir",
              )}
            .{" "}
            {undecided > 0 && (
              <Link to={`/projects/${projectId}/dashboard`}>
                Ver en Atención
              </Link>
            )}
          </p>
        )}
        {items.length ? (
          <>
            {grouped && (
              <h2 className="pw-decision-group pw-decision-group-first">
                Decisiones vigentes ({items.length})
              </h2>
            )}
            <ul className="ac-register ac-register-compact">
              {items.map((question) => row(question, grouped ? 3 : 2, false))}
            </ul>
          </>
        ) : (
          <EmptyState
            title={
              decisions.length
                ? "No encontramos decisiones con estos filtros."
                : "Todavía no hay decisiones vigentes."
            }
          >
            {decisions.length
              ? "Cambia la búsqueda, el área o el tema para ver otras decisiones."
              : "Las preguntas validadas aparecerán aquí con acceso a su decisión y sus fuentes."}
          </EmptyState>
        )}
        {reopenedItems.length > 0 && (
          <section aria-labelledby="reopened-decisions">
            <h2
              id="reopened-decisions"
              className="pw-decision-group"
              tabIndex={-1}
            >
              Sin decisión vigente ({reopenedItems.length})
            </h2>
            <p className="hint">
              Tuvieron una decisión que dejó de estar vigente: se reabrió la
              pregunta o cambió lo que la sustentaba. Se conserva como
              antecedente.
            </p>
            <ul className="ac-register ac-register-compact">
              {reopenedItems.map((question) => row(question, 3, true))}
            </ul>
          </section>
        )}
      </section>
    </ProjectWorkbench>
  );
}
/** Small print of one decision: scope, when and by whom, and what else the record keeps. */
function decisionDetail(entry: DecisionRegisterEntry) {
  const ended = entry.state === "REOPENED";
  return [
    ended && entry.endedAt
      ? `Dejó de estar vigente el ${dateText(entry.endedAt)}${entry.endedReason ? `: ${entry.endedReason}` : ""}`
      : null,
    `Alcance: ${entry.scope}`,
    `${dateText(entry.decidedAt)} · ${entry.decidedBy}`,
    entry.hasExceptions ? "Con excepciones" : null,
    entry.previous > 0
      ? plural(entry.previous, "decisión anterior", "decisiones anteriores")
      : null,
  ]
    .filter(Boolean)
    .join(" · ");
}
