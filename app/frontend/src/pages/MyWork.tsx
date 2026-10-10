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
  ParticipantFocus,
  participantCounts,
  participantPath,
} from "./ParticipantFlow";
import { Callout, ProgressCard } from "../ui/semantic";
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
  const waiting = candidates.filter(
    (c) => participantState(c.q) === "clarification",
  );
  return (
    <div className="participant-page">
      <ParticipantFocus />
      <div>
        <h1>Hola, {displayName.split(" ")[0]}</h1>
        <p className="participant-subtitle">Mi trabajo</p>
      </div>
      <Welcome
        items={candidates.map((c) => c.q)}
        progress={{
          sent: entries.reduce((n, p) => n + p.data.progress.sent, 0),
          total: entries.reduce((n, p) => n + p.data.progress.enabled, 0),
          drafts: entries.reduce((n, p) => n + p.data.progress.drafts, 0),
        }}
        href={next ? participantPath(next.projectId, next.q) : undefined}
        waiting={waiting.map((c) => ({
          href: participantPath(c.projectId, c.q),
          question: c.q.question || c.q.title,
          title: c.q.title,
        }))}
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
export function Welcome({
  items,
  href,
  progress,
  waiting,
}: {
  items: PersonalQuestion[];
  href?: string;
  progress: { sent: number; total: number; drafts: number };
  waiting: { href: string; question: string; title: string }[];
}) {
  const counts = participantCounts(items);
  return (
    <section className="participant-welcome" aria-label="Resumen de Mi trabajo">
      <ProgressCard
        sent={progress.sent}
        total={progress.total}
        drafts={progress.drafts}
        noun="preguntas enviadas"
      >
        <p>
          <ParticipantIcon name="info" /> Usa “Guardar y salir” para conservar
          tu borrador y retomarlo después.
        </p>
        {counts.consultation > 0 && (
          <p>
            Requieren atención: {counts.attention} aclaraciones y{" "}
            {counts.consultation} por consultar.
          </p>
        )}
      </ProgressCard>
      {waiting.length > 0 && (
        <Callout
          title={
            waiting.length === 1
              ? "Una aclaración espera tu respuesta"
              : `${waiting.length} aclaraciones esperan tu respuesta`
          }
          action={
            <Link
              to={waiting[0]!.href}
              aria-label={`Responder aclaración: ${waiting[0]!.title}`}
            >
              <ParticipantIcon name="arrow" />
            </Link>
          }
        >
          {waiting[0]!.question}
        </Callout>
      )}
      {href ? (
        <div className="participant-progress-actions">
          <Link className="button primary participant-continue" to={href}>
            Continuar <ParticipantIcon name="arrow" />
          </Link>
        </div>
      ) : (
        <p className="participant-all-done">
          <ParticipantIcon />
          No tienes acciones pendientes por ahora.
        </p>
      )}
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
      <div>
        <h1>Mi trabajo</h1>
        <p className="participant-subtitle">{q.data.projectName}</p>
      </div>
      <Welcome
        items={items}
        progress={{
          sent: q.data.progress.sent,
          total: q.data.progress.enabled,
          drafts: q.data.progress.drafts,
        }}
        href={next ? participantPath(projectId, next) : undefined}
        waiting={items
          .filter((item) => participantState(item) === "clarification")
          .map((item) => ({
            href: participantPath(projectId, item),
            question: item.question || item.title,
            title: item.title,
          }))}
      />
      <ProjectWork projectId={projectId} data={q.data} showHeading={false} />
    </div>
  );
}
export function ProjectWork({
  projectId,
  data,
  showHeading = true,
}: {
  projectId: string;
  data: PersonalProjectView;
  /** The page of a single project already names it; the list keeps an unseen heading. */
  showHeading?: boolean;
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
            (filter === "attention" &&
              ["clarification", "consultation"].includes(state)) ||
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
        <h2 className={showHeading ? undefined : "sr-only"}>
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
          <div
            className="participant-filters"
            role="group"
            aria-label="Filtrar preguntas"
          >
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
