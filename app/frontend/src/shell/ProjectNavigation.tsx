import type { KeyboardEvent } from "react";
import type { ProjectView } from "@requirements/contracts";
import { Link, useLocation } from "react-router-dom";
import { useWorkbenchContext } from "../workbench-context";
import { ParticipantIcon } from "../pages/ParticipantIcon";

export const projectDestinations = [
  { view: "attention", path: "dashboard", label: "Atención", icon: "info" },
  {
    view: "questionnaire",
    path: "editor",
    label: "Cuestionario",
    icon: "layers",
  },
  { view: "decisions", path: "decisions", label: "Decisiones", icon: "check" },
  {
    view: "invitations",
    path: "invitations",
    label: "Invitaciones",
    icon: "send",
  },
] as const;

export function closeToolsOnEscape(event: KeyboardEvent<HTMLDetailsElement>) {
  if (event.key !== "Escape") return;
  event.preventDefault();
  event.stopPropagation();
  event.currentTarget.open = false;
  event.currentTarget.querySelector("summary")?.focus();
}

export function ProjectNavigation({
  projectId,
  role,
}: {
  projectId: string;
  role?: ProjectView["role"];
}) {
  const { destination } = useWorkbenchContext(projectId);
  const { pathname } = useLocation();
  const canManage = role === "ADMIN" || role === "ANALYST";
  if (!canManage && role !== "VIEWER") return null;
  return (
    <nav
      className="ac-project-navigation"
      aria-label={
        canManage ? "Navegación del proyecto" : "Navegación de consulta"
      }
    >
      {canManage ? (
        projectDestinations.map(({ view, path, label, icon }) => (
          <Link
            key={view}
            to={destination(view)}
            title={label}
            aria-current={
              pathname === `/projects/${projectId}/${path}` ? "page" : undefined
            }
          >
            <ParticipantIcon name={icon} />
            <span>{label}</span>
          </Link>
        ))
      ) : (
        <Link
          to={`/projects/${projectId}`}
          title="Preguntas publicadas"
          aria-current={
            pathname === `/projects/${projectId}` ? "page" : undefined
          }
        >
          <ParticipantIcon name="layers" />
          <span>Preguntas publicadas</span>
        </Link>
      )}
    </nav>
  );
}

export function ProjectToolsMenu({
  projectId,
  role,
}: {
  projectId: string;
  role?: ProjectView["role"];
}) {
  const { pathname } = useLocation();
  const canManage = role === "ADMIN" || role === "ANALYST";
  if (!canManage && role !== "VIEWER") return null;
  const path = `/projects/${projectId}`;
  return (
    <details
      className="ac-project-tools"
      onKeyDown={closeToolsOnEscape}
      key={pathname}
    >
      <summary title="Más herramientas">
        <ParticipantIcon name="layers" />
        <span>Más herramientas</span>
      </summary>
      <nav aria-label="Otras herramientas del proyecto">
        {canManage && <Link to={path}>Preguntas publicadas</Link>}
        {role === "ADMIN" && <Link to={`${path}/members`}>Miembros</Link>}
        {canManage && (
          <>
            <Link to={`${path}/traceability`}>Trazabilidad</Link>
            <Link to={`${path}/import`}>Importar estructura</Link>
            <Link to={`${path}/history`}>Bitácora</Link>
          </>
        )}
        <Link to={`${path}/export`}>
          {role === "VIEWER" ? "Exportar decisiones vigentes" : "Exportar"}
        </Link>
      </nav>
    </details>
  );
}
