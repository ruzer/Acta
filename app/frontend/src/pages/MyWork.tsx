import { participantProgress } from "./participant-progress";
import {
  ResponseDeadline,
  responseDeadlineQuery,
  responseDueLabel,
} from "./ResponseDeadline";
import { useState, type ReactNode } from "react";
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
import { useBranding } from "../branding";
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
  const progress = participantProgress(
    q.data.sections.flatMap((s) => s.questions),
  );
  return (
    <p>
      {progress.sent} de {progress.total} respuestas enviadas
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
  if (results.some((q) => q.isPending)) return <LoadingState skeleton />;
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
        refreshing={results.some((q) => q.isFetching)}
        items={candidates.map((c) => c.q)}
        progress={participantProgress(candidates.map((c) => c.q))}
        href={next ? participantPath(next.projectId, next.q) : undefined}
        waiting={waiting.map((c) => ({
          href: participantPath(c.projectId, c.q),
          question: c.q.question || c.q.title,
          title: c.q.title,
        }))}
      />
      {entries.length ? (
        entries.map((p) => (
          <ProjectWork key={p.id} projectId={p.id} data={p.data}>
            <HomeResponseDeadline projectId={p.id} />
          </ProjectWork>
        ))
      ) : (
        <EmptyState title="Todavía no tienes preguntas asignadas">
          Aquí aparecerán tus proyectos cuando te inviten a participar.
        </EmptyState>
      )}
    </div>
  );
}
function HomeResponseDeadline({ projectId }: { projectId: string }) {
  const query = useQuery({
    ...responseDeadlineQuery(projectId),
    staleTime: 60_000,
    retry: false,
    retryOnMount: false,
    refetchOnMount: (query) => query.state.status !== "error",
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  const { timezone } = useBranding();
  const due = query.error ? null : query.data?.responseDueAt;
  return (
    <p className="participant-home-deadline" aria-hidden={!due || undefined}>
      {due && (
        <>
          {responseDueLabel(due, timezone)}. Puedes seguir respondiendo después
          del plazo.
        </>
      )}
    </p>
  );
}
export function Welcome({
  refreshing = false,
  items,
  href,
  progress,
  projectId,
  waiting,
}: {
  refreshing?: boolean;
  projectId?: string;
  items: PersonalQuestion[];
  href?: string;
  progress: {
    sent: number;
    total: number;
    drafts: number;
    overlappingDrafts?: number;
    notApplicable?: number;
  };
  waiting: { href: string; question: string; title: string }[];
}) {
  const counts = participantCounts(items);
  const undetermined = items.filter(
    (q) => q.applicability === "UNDETERMINED",
  ).length;
  const excluded = items.filter((q) => q.applicability === "DISABLED").length;
  return (
    <section className="participant-welcome" aria-label="Resumen de Mi trabajo">
      <ProgressCard
        memoryKey={projectId ? { projectId, bar: "mywork" } : undefined}
        sent={progress.sent}
        total={progress.total}
        drafts={progress.drafts}
        noun="preguntas enviadas"
      >
        <p>
          <ParticipantIcon name="info" /> Usa “Guardar y salir” para conservar
          tu borrador y retomarlo después.
        </p>
        {!!progress.notApplicable && (
          <p>
            {progress.notApplicable === 1
              ? "1 pregunta marcada como No aplica no se cuenta en el avance."
              : `${progress.notApplicable} preguntas marcadas como No aplica no se cuentan en el avance.`}
          </p>
        )}
        {!!progress.overlappingDrafts && (
          <p>
            {progress.overlappingDrafts === 1
              ? "1 borrador corresponde a una pregunta que ya enviaste; no se suma de nuevo en la barra."
              : `${progress.overlappingDrafts} borradores corresponden a preguntas que ya enviaste; no se suman de nuevo en la barra.`}
          </p>
        )}
        {undetermined > 0 && (
          <p>
            {undetermined === 1
              ? "1 pregunta adicional depende de tus respuestas."
              : `${undetermined} preguntas adicionales dependen de tus respuestas.`}
          </p>
        )}
        {excluded > 0 && (
          <p>
            {excluded === 1
              ? "1 pregunta queda fuera del recorrido según tus respuestas."
              : `${excluded} preguntas quedan fuera del recorrido según tus respuestas.`}
          </p>
        )}
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
              Responder aclaración <ParticipantIcon name="arrow" />
            </Link>
          }
        >
          {waiting[0]!.question}
        </Callout>
      )}
      {refreshing ? (
        <p role="status">Actualizando tu avance…</p>
      ) : href ? (
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
  if (q.isPending) return <LoadingState skeleton />;
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
        <ResponseDeadline projectId={projectId} />
      </div>
      <Welcome
        projectId={projectId}
        refreshing={q.isFetching}
        items={items}
        progress={participantProgress(items)}
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
  children,
}: {
  projectId: string;
  data: PersonalProjectView;
  /** The page of a single project already names it; the list keeps an unseen heading. */
  showHeading?: boolean;
  children?: ReactNode;
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
      {children}
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
          {data.progress.undetermined === 1
            ? "1 pregunta depende de una respuesta anterior enviada. Aún no sabemos si te corresponde."
            : `${data.progress.undetermined} preguntas dependen de una respuesta anterior enviada. Aún no sabemos si te corresponden.`}
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
        <Button
          className=""
          aria-expanded={expanded}
          aria-controls={`topic-${section.id}`}
          onClick={() => setOpen(!open)}
          unavailable={
            forceOpen && {
              reason:
                "Los temas se muestran abiertos mientras filtras las preguntas. Limpia los filtros para contraerlos.",
              describedBy: `topic-${section.id}-reason`,
            }
          }
        >
          <span
            className={
              expanded ? "participant-chevron open" : "participant-chevron"
            }
          >
            <ParticipantIcon name="chevron" />
          </span>
          {section.title}{" "}
          <span className="participant-topic-count">
            {section.questions.length}
            <span className="sr-only">
              {" "}
              {section.questions.length === 1 ? "pregunta" : "preguntas"}
            </span>
          </span>
        </Button>
      </h3>
      {forceOpen && (
        <p id={`topic-${section.id}-reason`} className="hint">
          Los temas se muestran abiertos mientras filtras las preguntas. Limpia
          los filtros para contraerlos.
        </p>
      )}
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
