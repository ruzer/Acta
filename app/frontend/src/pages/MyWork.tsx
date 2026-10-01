import { useState } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import {
  participantState,
  participantStart,
  participantPriority,
  type PersonalProjectView,
  type PersonalQuestion,
  type ProjectView,
} from "@requirements/contracts";
import { api } from "../api";
import { Button, EmptyState, ErrorState, Input, LoadingState } from "../ui";
import {
  ParticipantBadge,
  ParticipantSummary,
  ParticipantFocus,
  participantPath,
} from "./ParticipantFlow";
import { ParticipantIcon } from "./ParticipantIcon";
// Frontend density heuristic, not a domain limit; tools remain available below it.
const SCALE_THRESHOLD = 20;
export function PersonalProgress({ projectId }: { projectId: string }) {
  const q = useQuery({
    queryKey: ["my-work", projectId],
    queryFn: () => api("personalProject", { projectId }),
    staleTime: 0,
  });
  if (q.isPending) return <p role="status">Consultando tu avance…</p>;
  if (q.error)
    return <ErrorState error={q.error} retry={() => void q.refetch()} />;
  return (
    <p>
      {q.data.progress.sent} de {q.data.progress.enabled} respuestas enviadas
    </p>
  );
}
export function ParticipantHome({
  projects,
  displayName,
}: {
  projects: ProjectView[];
  displayName: string;
}) {
  const results = useQueries({
    queries: projects.map((p) => ({
      queryKey: ["my-work", p.id],
      queryFn: () => api("personalProject", { projectId: p.id }),
      staleTime: 0,
    })),
  });
  if (results.some((q) => q.isPending)) return <LoadingState />;
  const failed = results.find((q) => q.error);
  if (failed)
    return (
      <ErrorState
        error={failed.error!}
        retry={() => {
          results.forEach((q) => void q.refetch());
        }}
      />
    );
  const entries = results.flatMap((q, i) =>
    q.data ? [{ id: projects[i]!.id, data: q.data }] : [],
  );
  const candidates = entries.flatMap((p) =>
    p.data.sections
      .flatMap((s) => s.questions)
      .map((q) => ({ projectId: p.id, q })),
  );
  const next = candidates.reduce<(typeof candidates)[number] | undefined>(
    (best, item) =>
      participantPriority(item.q) <
      (best ? participantPriority(best.q) : Infinity)
        ? item
        : best,
    undefined,
  );
  return (
    <div className="participant-page">
      <ParticipantFocus />
      <h1>Hola, {displayName.split(" ")[0]}</h1>
      <p className="participant-subtitle">Mi trabajo</p>
      <Welcome
        items={candidates.map((c) => c.q)}
        href={next ? participantPath(next.projectId, next.q) : undefined}
      />
      {entries.length ? (
        entries.map((p) => (
          <ProjectWork key={p.id} projectId={p.id} data={p.data} />
        ))
      ) : (
        <EmptyState title="Todavía no tienes preguntas asignadas">
          Aquí aparecerán tus proyectos cuando te inviten a participar.
        </EmptyState>
      )}
    </div>
  );
}
function Welcome({
  items,
  href,
}: {
  items: PersonalQuestion[];
  href?: string;
}) {
  return (
    <section className="participant-welcome" aria-label="Resumen de Mi trabajo">
      <ParticipantSummary items={items} />
      {href ? (
        <Link className="button primary participant-continue" to={href}>
          Continuar <ParticipantIcon name="arrow" />
        </Link>
      ) : (
        <p className="participant-all-done">
          <ParticipantIcon />
          No tienes acciones pendientes por ahora.
        </p>
      )}
      <p className="participant-save-hint">
        <ParticipantIcon name="info" />
        Usa “Guardar y salir” para conservar tu borrador y retomarlo después.
      </p>
    </section>
  );
}
export function MyWork() {
  const { projectId = "" } = useParams();
  const q = useQuery({
    queryKey: ["my-work", projectId],
    queryFn: () => api("personalProject", { projectId }),
    staleTime: 0,
  });
  if (q.isPending) return <LoadingState />;
  if (q.error)
    return <ErrorState error={q.error} retry={() => void q.refetch()} />;
  const items = q.data.sections.flatMap((s) => s.questions),
    next = participantStart(items);
  return (
    <div className="participant-page">
      <ParticipantFocus />
      <h1>Mi trabajo</h1>
      <p className="participant-subtitle">{q.data.projectName}</p>
      <Welcome
        items={items}
        href={next ? participantPath(projectId, next) : undefined}
      />
      <ProjectWork projectId={projectId} data={q.data} />
    </div>
  );
}
export function ProjectWork({
  projectId,
  data,
}: {
  projectId: string;
  data: PersonalProjectView;
}) {
  const [search, setSearch] = useState(""),
    [filter, setFilter] = useState("all"),
    [showTools, setShowTools] = useState(false);
  const large =
    data.progress.total > SCALE_THRESHOLD || data.sections.length > 4;
  const term = search.trim().toLocaleLowerCase("es");
  const groups = data.sections
    .map((s) => ({
      ...s,
      questions: s.questions.filter((q) => {
        const state = participantState(q);
        return (
          (!term ||
            `${q.question} ${q.title} ${s.title}`
              .toLocaleLowerCase("es")
              .includes(term)) &&
          (filter === "all" ||
            (filter === "attention" && state === "clarification") ||
            (filter === "sent" && (q.hasSubmission || q.currentSubmission)) ||
            (filter === "pending" &&
              ["pending", "draft", "consultation"].includes(state)))
        );
      }),
    }))
    .filter((s) => s.questions.length);
  return (
    <section className="participant-project">
      <div className="participant-project-heading">
        <h2>
          <Link to={`/projects/${projectId}/work`}>{data.projectName}</Link>
        </h2>
        {!large && (
          <Button
            className="participant-text-button participant-tools-toggle"
            aria-expanded={showTools}
            onClick={() => setShowTools(!showTools)}
          >
            Buscar y filtrar
          </Button>
        )}
      </div>
      {(large || showTools) && (
        <div className="participant-toolbar">
          <Input
            label="Buscar en Mi trabajo"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="participant-filters" aria-label="Filtrar preguntas">
            {[
              ["all", "Todo"],
              ["pending", "Pendientes"],
              ["attention", "Requiere atención"],
              ["sent", "Enviadas"],
            ].map(([key, label]) => (
              <button
                key={key}
                type="button"
                aria-pressed={filter === key}
                onClick={() => setFilter(key!)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}
      {groups.length ? (
        groups.map((s, i) => (
          <Topic
            key={s.id}
            projectId={projectId}
            section={s}
            initialOpen={!large || i === 0}
            forceOpen={!!term || filter !== "all"}
          />
        ))
      ) : (
        <EmptyState
          title={
            data.progress.total
              ? "No encontramos preguntas con estos filtros."
              : "Todavía no tienes preguntas asignadas."
          }
        >
          {data.progress.total ? (
            <Button
              tone="secondary"
              onClick={() => {
                setSearch("");
                setFilter("all");
              }}
            >
              Limpiar filtros
            </Button>
          ) : (
            "Las preguntas aparecerán cuando estén publicadas para ti."
          )}
        </EmptyState>
      )}
      {data.progress.undetermined > 0 && (
        <p className="hint">
          {data.progress.undetermined} preguntas dependen de una respuesta
          anterior enviada. Aún no sabemos si te corresponden.
        </p>
      )}
    </section>
  );
}
function Topic({
  section,
  projectId,
  initialOpen,
  forceOpen,
}: {
  section: PersonalProjectView["sections"][number];
  projectId: string;
  initialOpen: boolean;
  forceOpen: boolean;
}) {
  const [limit, setLimit] = useState(30);
  const [open, setOpen] = useState(initialOpen),
    expanded = open || forceOpen;
  return (
    <section className="participant-topic">
      <h3>
        <button
          aria-expanded={expanded}
          aria-controls={`topic-${section.id}`}
          aria-label={`${section.title}, ${section.questions.length} preguntas`}
          onClick={() => setOpen(!open)}
          disabled={forceOpen}
        >
          <span
            className={
              expanded ? "participant-chevron open" : "participant-chevron"
            }
          >
            <ParticipantIcon name="chevron" />
          </span>
          {section.title}
          <span className="participant-topic-count">
            {section.questions.length}
          </span>
        </button>
      </h3>
      <div id={`topic-${section.id}`} hidden={!expanded}>
        {expanded && (
          <ul>
            {section.questions.slice(0, limit).map((item) => {
              const state = participantState(item),
                action =
                  state === "clarification"
                    ? "Responder"
                    : state === "draft" || state === "consultation"
                      ? "Continuar"
                      : Number.isFinite(participantPriority(item))
                        ? "Responder"
                        : "Ver";
              return (
                <li key={item.id} className="participant-work-row">
                  <div>
                    <p className="participant-row-question">
                      {item.question || item.title}
                    </p>
                    <ParticipantBadge item={item} />
                    {item.applicability !== "ENABLED" && (
                      <p className="participant-condition-hint">
                        {item.applicability === "DISABLED"
                          ? "Fuera del recorrido actual; tu contenido se conserva."
                          : "Depende de una respuesta anterior."}
                      </p>
                    )}
                  </div>
                  <Link
                    className="button secondary"
                    to={participantPath(projectId, item)}
                    aria-label={`${action}: ${item.title}`}
                  >
                    {action}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
        {expanded && section.questions.length > limit && (
          <Button
            className="participant-text-button participant-more"
            onClick={() => setLimit(limit + 30)}
          >
            Mostrar más preguntas ({section.questions.length - limit} restantes)
          </Button>
        )}
      </div>
    </section>
  );
}
