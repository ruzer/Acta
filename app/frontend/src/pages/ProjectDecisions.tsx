import { useQuery } from "@tanstack/react-query";
import {
  Link,
  useLocation,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { dashboardView } from "@requirements/contracts";
import { exchangeRequest } from "../api";
import {
  Button,
  EmptyState,
  ErrorState,
  Input,
  LoadingState,
  Select,
} from "../ui";
import { AnalystStatus } from "./AnalystVisual";
import { ProjectWorkbench } from "./ProjectWorkbench";

export function ProjectDecisions() {
  const { projectId = "" } = useParams();
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const query = useQuery({
    queryKey: ["dashboard", projectId],
    queryFn: () => exchangeRequest(projectId, "dashboard", dashboardView),
    staleTime: 0,
  });
  if (query.isPending) return <LoadingState />;
  if (query.error)
    return (
      <ErrorState error={query.error} retry={() => void query.refetch()} />
    );
  const data = query.data;
  const decisions = data.questions.filter(
    (question) => question.status === "VALIDATED",
  );
  const search = params.get("q") ?? "";
  const area = params.get("area") ?? "";
  const section = params.get("section") ?? "";
  const term = search.trim().toLocaleLowerCase("es");
  const items = decisions.filter(
    (question) =>
      (!area || question.areaId === area) &&
      (!section || question.sectionId === section) &&
      (!term ||
        [
          question.externalId,
          question.title,
          question.sectionTitle,
          question.areaName,
        ].some((text) => text.toLocaleLowerCase("es").includes(term))),
  );
  const areas = [
    ...new Map(
      decisions.map((question) => [question.areaId, question.areaName]),
    ).entries(),
  ];
  const sections = [
    ...new Map(
      decisions.map((question) => [question.sectionId, question.sectionTitle]),
    ).entries(),
  ];
  const hasFilters = !!(search || area || section);
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
  return (
    <ProjectWorkbench
      projectId={projectId}
      projectName={data.projectName}
      role={data.role}
      active="decisions"
    >
      <section aria-labelledby="project-decisions-title">
        <div className="pw-decisions-heading">
          <h2 id="project-decisions-title">Decisiones</h2>
          <p>
            Preguntas con una decisión vigente. Abre una para consultar qué se
            decidió, su alcance y sus fuentes.
          </p>
        </div>
        {decisions.length > 0 && (
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
        {items.length ? (
          <ul className="pw-decisions-list">
            {items.map((question) => (
              <li key={question.id}>
                <div>
                  <p className="pw-decision-reference">{question.externalId}</p>
                  <h3>
                    <Link
                      data-workbench-id={question.id}
                      to={`/projects/${projectId}/review/${question.id}`}
                      state={{
                        workbenchReturn: {
                          view: "decisions",
                          search: location.search,
                        },
                      }}
                    >
                      {question.title}
                    </Link>
                  </h3>
                  <p>
                    {question.sectionTitle} · {question.areaName}
                  </p>
                </div>
                <AnalystStatus status={question.status} />
              </li>
            ))}
          </ul>
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
      </section>
    </ProjectWorkbench>
  );
}
