import type { ReactNode } from "react";
import type { ProjectView } from "@requirements/contracts";
import { Link, useLocation } from "react-router-dom";
import { Brand } from "../branding";
import { workbenchPath } from "../workbench-context";
import { Button } from "../ui";
import { AppShell } from "../ui/semantic";
import { ParticipantIcon } from "../pages/ParticipantIcon";
import {
  closeToolsOnEscape,
  ProjectNavigation,
  ProjectToolsMenu,
  projectDestinations,
} from "./ProjectNavigation";
import "./shell.css";

export function ProjectShell({
  project,
  displayName,
  organizationAdmin,
  onLogout,
  children,
}: {
  project: ProjectView;
  displayName: string;
  organizationAdmin: boolean;
  onLogout: () => void;
  children: ReactNode;
}) {
  const { pathname } = useLocation();
  const canManage = project.role === "ADMIN" || project.role === "ANALYST";
  // The root of the path is the project's home: Attention for the team that
  // works the queue, the published questions for the read-only reader.
  const home = canManage
    ? workbenchPath(project.id, "attention")
    : `/projects/${project.id}`;
  const segment = pathname.split("/")[3];
  const page =
    projectDestinations.find((item) => item.path === segment)?.label ??
    {
      review: "Revisión",
      members: "Miembros",
      import: "Importar estructura",
      export: "Exportar",
      traceability: "Trazabilidad",
      history: "Bitácora",
    }[segment ?? ""] ??
    "Preguntas publicadas";
  const account = (
    <>
      <p className="ac-account-name">{displayName}</p>
      <nav aria-label="Cuenta">
        <Link to="/">Mis proyectos</Link>
        {organizationAdmin && <Link to="/admin">Administración</Link>}
        <Link to="/password">Mi contraseña</Link>
      </nav>
      <Button tone="tertiary" onClick={onLogout}>
        Cerrar sesión
      </Button>
    </>
  );
  const tools = <ProjectToolsMenu projectId={project.id} role={project.role} />;
  return (
    <AppShell
      navigation={
        <aside className="ac-sidebar" aria-label="Espacio del proyecto">
          <Link className="ac-brand" to="/" title="Mis proyectos">
            <Brand short />
          </Link>
          <Link className="ac-project-switch" to="/" title="Mis proyectos">
            <ParticipantIcon name="folder" />
            <span>
              {project.name}
              <small>Mis proyectos</small>
            </span>
          </Link>
          <ProjectNavigation projectId={project.id} role={project.role} />
          {tools}
          <div className="ac-sidebar-account">{account}</div>
        </aside>
      }
      context={
        <>
          <nav className="ac-breadcrumb" aria-label="Contexto de página">
            <Link
              to={home}
              aria-label={`${project.name}: ir a ${canManage ? "Atención" : "Preguntas publicadas"}`}
            >
              {project.name}
            </Link>
            <span aria-hidden="true">›</span>
            <span>{page}</span>
          </nav>
          <details
            className="ac-mobile-account"
            key={pathname}
            onKeyDown={closeToolsOnEscape}
          >
            <summary title="Cuenta y herramientas">
              <ParticipantIcon name="menu" />
              <span>Menú</span>
            </summary>
            <div className="ac-mobile-menu">
              <Link className="ac-brand" to="/">
                <Brand short />
              </Link>
              {tools}
              {account}
            </div>
          </details>
        </>
      }
      mobileNavigation={
        <ProjectNavigation projectId={project.id} role={project.role} />
      }
    >
      {children}
    </AppShell>
  );
}
