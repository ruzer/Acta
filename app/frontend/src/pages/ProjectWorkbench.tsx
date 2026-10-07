import type { ReactNode } from "react";
import type { ProjectView } from "@requirements/contracts";
import { Link } from "react-router-dom";
import { useWorkbenchContext } from "../workbench-context";
import "../project-workbench.css";

export type WorkbenchView =
  "attention" | "questionnaire" | "decisions" | "invitations";

export type ProjectWorkbenchProps = {
  projectId: string;
  projectName: string;
  role?: ProjectView["role"];
  active?: WorkbenchView;
  compact?: boolean;
  children?: ReactNode;
};

export function ProjectWorkbench({
  projectId,
  projectName,
  role,
  active,
  compact = false,
  children,
}: ProjectWorkbenchProps) {
  const { destination } = useWorkbenchContext(projectId, active);
  const canManage = role === "ADMIN" || role === "ANALYST";
  const projectPath = `/projects/${projectId}`;
  const home = canManage
    ? destination("questionnaire")
    : role === "STAKEHOLDER"
      ? `${projectPath}/work`
      : projectPath;
  const destinations = [
    { view: "attention", label: "Atención" },
    { view: "questionnaire", label: "Cuestionario" },
    { view: "decisions", label: "Decisiones" },
  ] as const;
  return (
    <div className="project-workbench">
      <header className={`pw-header${compact ? " pw-header-compact" : ""}`}>
        <div className="pw-project-row">
          <div className="pw-project-name">
            {compact ? (
              <Link className="pw-project-link" to={home}>
                {projectName}
              </Link>
            ) : (
              <h1>{projectName}</h1>
            )}
          </div>
          {(canManage || role === "VIEWER") && (
            <nav className="pw-secondary" aria-label="Accesos del proyecto">
              {canManage && (
                <Link
                  to={destination("invitations")}
                  aria-current={active === "invitations" ? "page" : undefined}
                >
                  Invitaciones
                </Link>
              )}
              {role === "ADMIN" && (
                <Link to={`${projectPath}/members`}>Miembros</Link>
              )}
              <details
                className="pw-tools"
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    event.preventDefault();
                    event.currentTarget.open = false;
                    event.currentTarget.querySelector("summary")?.focus();
                  }
                }}
              >
                <summary>Más herramientas</summary>
                <nav aria-label="Otras herramientas del proyecto">
                  <Link to={projectPath}>Preguntas publicadas</Link>
                  {canManage && (
                    <>
                      <Link to={`${projectPath}/traceability`}>
                        Trazabilidad
                      </Link>
                      <Link to={`${projectPath}/import`}>
                        Importar estructura
                      </Link>
                      <Link to={`${projectPath}/history`}>Bitácora</Link>
                    </>
                  )}
                  <Link to={`${projectPath}/export`}>
                    {role === "VIEWER"
                      ? "Exportar decisiones vigentes"
                      : "Exportar"}
                  </Link>
                </nav>
              </details>
            </nav>
          )}
        </div>
        {canManage && (
          <nav className="pw-navigation" aria-label="Navegación del proyecto">
            {destinations.map(({ view, label }) => (
              <Link
                key={view}
                to={destination(view)}
                aria-current={active === view ? "page" : undefined}
              >
                {label}
              </Link>
            ))}
          </nav>
        )}
      </header>
      {children}
    </div>
  );
}
