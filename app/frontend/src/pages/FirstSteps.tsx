import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import type { QuestionnaireView } from "@requirements/contracts";
import { api } from "../api";
import { ErrorState, LoadingState } from "../ui";

export function pendingFirstSteps(data: QuestionnaireView, started: boolean) {
  const questions = data.questions.filter((q) => q.publication !== "ARCHIVED");
  const participants = new Set(
    data.members
      .filter((m) => m.active && m.role === "STAKEHOLDER")
      .map((m) => m.id),
  );
  return {
    questions: !questions.length,
    people: !participants.size,
    assignments:
      !questions.length ||
      questions.some(
        (q) =>
          !q.assignments.some(
            (a) => a.active && participants.has(a.projectMemberId),
          ),
      ),
    publish:
      !questions.length || questions.some((q) => q.publication === "DRAFT"),
    participation: !started,
  };
}
export function FirstSteps({
  projectId,
  role,
  started,
}: {
  projectId: string;
  role: "ADMIN" | "ANALYST";
  started: boolean;
}) {
  const client = useQueryClient();
  const organize = () =>
    client.setQueryData(
      ["questionnaire-context", projectId],
      (previous: { mode?: number } | undefined) => ({ ...previous, mode: 1 }),
    );
  const query = useQuery({
    queryKey: ["questionnaire", projectId],
    queryFn: () => api("questionnaire", { projectId }),
    enabled: !started,
    staleTime: 0,
  });
  // La primera respuesta enviada marca el comienzo del trabajo; la tarjeta deja paso a la revisión.
  if (started) return null;
  const base = `/projects/${projectId}`;
  const pending = query.data && pendingFirstSteps(query.data, started);
  return (
    <details open className="pw-metrics">
      <summary>Primeros pasos</summary>
      <p>
        Ya abriste el proyecto. Completa los pasos pendientes; los terminados
        dejan de aparecer.
      </p>
      {query.isPending ? (
        <LoadingState />
      ) : query.error ? (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      ) : (
        pending && (
          <ol>
            {pending.questions && (
              <li>
                Carga las preguntas:{" "}
                <Link to={`${base}/import`}>Importar cuestionario</Link> o
                escribe en <Link to={`${base}/editor`}>Cuestionario</Link>.
              </li>
            )}
            {pending.people && (
              <li>
                Da acceso a las personas.{" "}
                {role === "ADMIN" ? (
                  <Link to={`${base}/members`}>Miembros</Link>
                ) : (
                  <>
                    Solicita el acceso a la administración; consulta{" "}
                    <Link to="/help">Ayuda</Link>.
                  </>
                )}
              </li>
            )}
            {pending.assignments && (
              <li>
                Asigna las preguntas a quienes responderán en{" "}
                <Link to={`${base}/editor`} onClick={organize}>
                  Organizar
                </Link>
                .
              </li>
            )}
            {pending.publish && (
              <li>
                Revisa y publica solo las preguntas autorizadas en{" "}
                <Link to={`${base}/editor`} onClick={organize}>
                  Organizar
                </Link>
                .
              </li>
            )}
            {pending.participation && (
              <li>
                Avisa al equipo y consulta{" "}
                <Link to={`${base}/participation`}>Participación</Link>.
              </li>
            )}
          </ol>
        )
      )}
    </details>
  );
}
