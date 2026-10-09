import { Brand } from "../branding";
import { Link, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api";
import { Button } from "../ui";
import { ParticipantIcon } from "./ParticipantIcon";
export function ParticipantHeader({
  displayName,
  onLogout,
}: {
  displayName: string;
  onLogout: () => void;
}) {
  const location = useLocation(),
    match = location.pathname.match(
      /^\/projects\/([^/]+)\/(?:work|respond|clarifications|submitted|receipt)(?:\/([^/]+))?/,
    ),
    projectId = match?.[1] ?? "",
    id = match?.[2];
  const q = useQuery({
    queryKey: ["my-work", projectId],
    queryFn: () => api("personalProject", { projectId }),
    enabled: !!projectId,
  });
  const topic = q.data?.sections.find((s) =>
    s.questions.some((q) => q.id === id),
  );
  const sequence =
    q.data?.sections
      .flatMap((s) => s.questions)
      .filter((q) => q.applicability === "ENABLED") ?? [];
  const position = sequence.findIndex((q) => q.id === id);
  return (
    <header className="participant-topbar">
      {projectId ? (
        <>
          <Link
            className="participant-back"
            to={id ? `/projects/${projectId}/work` : "/"}
          >
            <ParticipantIcon name="back" />
            Mi trabajo
          </Link>
          <span className="participant-project-name">
            {q.data?.projectName}
          </span>
          {topic && position >= 0 && (
            <span className="participant-header-context">
              Pregunta {position + 1} de {sequence.length} · no es el número de
              envíos
            </span>
          )}
        </>
      ) : (
        <Link className="participant-brand" to="/">
          <span>
            <ParticipantIcon />
          </span>
          <Brand short />
        </Link>
      )}
      {!id && (
        <details className="participant-account">
          <summary>
            <span className="participant-avatar">
              {displayName
                .split(" ")
                .map((s) => s[0])
                .slice(0, 2)
                .join("")}
            </span>
            <span>{displayName}</span>
          </summary>
          <div>
            <Link to="/password">Mi contraseña</Link>
            <Button tone="secondary" onClick={onLogout}>
              Cerrar sesión
            </Button>
          </div>
        </details>
      )}
    </header>
  );
}
