import { FilterBar } from "../ui/FilterBar";
import { ParticipationPeople } from "./ParticipationPeople";
import { plural } from "../ui/plural";
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams, useSearchParams } from "react-router-dom";
import {
  participationStates,
  participationView,
  responseDueLabel,
  type ParticipationView,
} from "@requirements/contracts";
import { exchangeRequest } from "../api";
import { useBranding } from "../branding";
import {
  Button,
  EmptyState,
  ErrorState,
  LoadingState,
  Select,
  Textarea,
} from "../ui";
import { PageHeader } from "../ui/semantic";
export const participationQuery = (projectId: string) => ({
  queryKey: ["participation", projectId],
  queryFn: () => exchangeRequest(projectId, "participation", participationView),
  staleTime: 0,
});
export function participationReminder(
  data: ParticipationView,
  origin: string,
  timezone = "UTC",
) {
  const pending = data.participants.filter((person) => person.pending > 0);
  return `Hola. Te recordamos las respuestas pendientes del proyecto «${data.projectName}»:\n${pending.map((person) => `• ${person.name}: ${person.pending} ${person.pending === 1 ? "pregunta obligatoria pendiente" : "preguntas obligatorias pendientes"}.`).join("\n")}${data.responseDueAt ? `\n${responseDueLabel(data.responseDueAt, timezone)}.` : ""}\nEntra a ${origin} y abre Mi trabajo. Si necesitas ayuda, avisa a quien coordina el proyecto. Gracias.`;
}
export function ParticipationCard({ projectId }: { projectId: string }) {
  const query = useQuery(participationQuery(projectId));
  return (
    <section aria-labelledby="participation-card">
      <h2 id="participation-card">Participación</h2>
      {query.isPending ? (
        <LoadingState />
      ) : query.error ? (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      ) : (
        <p>
          {plural(query.data.participants.length, "persona")} con acceso activo
          ·{" "}
          {query.data.participants.filter((p) => p.state === "Completo").length}{" "}
          completaron sus preguntas obligatorias.
        </p>
      )}
      <Link
        className="button secondary"
        to={`/projects/${projectId}/participation`}
      >
        Ver participación
      </Link>
    </section>
  );
}
export function Participation() {
  const { timezone } = useBranding();
  const { projectId = "" } = useParams();
  const query = useQuery(participationQuery(projectId));
  const [params, setParams] = useSearchParams();
  const state = params.get("state") ?? "";
  const order = params.get("order") ?? "name";
  const search = params.get("q") ?? "";
  function filter(key: string, value: string) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true, preventScrollReset: true });
  }
  function clearFilters() {
    const next = new URLSearchParams(params);
    for (const key of ["state", "order", "q"]) next.delete(key);
    setParams(next, { replace: true, preventScrollReset: true });
  }
  const [notice, setNotice] = useState("");
  const [fallback, setFallback] = useState("");
  const copy = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (fallback) {
      copy.current?.focus();
      copy.current?.select();
    }
  }, [fallback]);
  if (query.isPending) return <LoadingState skeleton />;
  if (query.error)
    return (
      <ErrorState error={query.error} retry={() => void query.refetch()} />
    );
  const data = query.data;
  const term = search.trim().toLocaleLowerCase("es-MX");
  const pendingPeople = data.participants.filter(
    (person) => person.pending > 0,
  ).length;
  const people = data.participants
    .filter(
      (person) =>
        (!state || person.state === state) &&
        (!term ||
          [person.name, person.area ?? ""].some((text) =>
            text.toLocaleLowerCase("es-MX").includes(term),
          )),
    )
    .sort((a, b) => {
      const result =
        order === "pending"
          ? b.pending - a.pending
          : order === "activity"
            ? (b.lastActivity ?? "").localeCompare(a.lastActivity ?? "")
            : order === "state"
              ? participationStates.indexOf(a.state) -
                participationStates.indexOf(b.state)
              : 0;
      return result || a.name.localeCompare(b.name, "es-MX");
    });
  async function remind(person?: ParticipationView["participants"][number]) {
    const text = participationReminder(
      person ? { ...data, participants: [person] } : data,
      window.location.origin,
      timezone,
    );
    setFallback("");
    try {
      await navigator.clipboard.writeText(text);
      setNotice(
        "Recordatorio copiado. Puedes pegarlo en el medio que uses con el equipo.",
      );
    } catch {
      setFallback(text);
      setNotice(
        "No se pudo copiar. Selecciona el texto y cópialo con tu teclado o el menú del dispositivo.",
      );
    }
  }
  return (
    <>
      <PageHeader title="Participación" lead={data.projectName} />
      {data.responseDueAt && (
        <p>
          {responseDueLabel(data.responseDueAt, timezone)} ·{" "}
          {plural(
            new Date(data.responseDueAt).getTime() < Date.now()
              ? data.participants.filter((p) => p.pending > 0).length
              : 0,
            "persona",
          )}{" "}
          con plazo vencido y pendientes.
        </p>
      )}
      <p>
        <Link to={`/projects/${projectId}/dashboard`}>Volver a Atención</Link>
      </p>
      <p>
        Se cuentan preguntas publicadas, asignadas y aplicables. Completo
        significa que se enviaron todas las obligatorias; no significa que ya
        estén revisadas. Las preguntas que dependan de otra respuesta pueden
        aparecer después.
      </p>
      <FilterBar
        search={{
          label: "Buscar participantes",
          value: search,
          onChange: (value) => filter("q", value),
        }}
        summary={`${people.length} de ${data.participants.length} personas`}
        hasFilters={!!(state || order !== "name" || search)}
        onClear={clearFilters}
      >
        <Select
          label="Filtrar participación"
          value={state}
          onChange={(e) => filter("state", e.target.value)}
        >
          <option value="">Todos los estados</option>
          {participationStates.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </Select>
        <Select
          label="Ordenar participación"
          value={order}
          onChange={(e) => filter("order", e.target.value)}
        >
          <option value="name">Nombre (A a Z)</option>
          <option value="pending">Más pendientes primero</option>
          <option value="activity">Actividad más reciente</option>
          <option value="state">Estado (por avance)</option>
        </Select>
      </FilterBar>
      <Button disabled={pendingPeople === 0} onClick={() => void remind()}>
        Copiar recordatorio ({plural(pendingPeople, "persona")} con pendientes)
      </Button>
      {notice && <p role="status">{notice}</p>}
      {fallback && (
        <Textarea
          ref={copy}
          label="Texto del recordatorio para copiar"
          value={fallback}
          readOnly
          rows={7}
        />
      )}
      {!people.length ? (
        <EmptyState
          title={
            data.participants.length
              ? "Sin personas para este filtro"
              : "Aún no hay participantes"
          }
        >
          {data.participants.length ? (
            "Cambia o limpia los filtros para ver al equipo."
          ) : (
            <>
              Da acceso a participantes y asígnales preguntas.{" "}
              {data.role === "ADMIN" ? (
                <Link to={`/projects/${projectId}/members`}>
                  Abrir Miembros
                </Link>
              ) : (
                "Pide a la administración que dé acceso al equipo."
              )}{" "}
              <Link to={`/projects/${projectId}/editor`}>
                Abrir Cuestionario
              </Link>
            </>
          )}
        </EmptyState>
      ) : (
        <ParticipationPeople
          people={people}
          remind={(person) => void remind(person)}
        />
      )}
    </>
  );
}
