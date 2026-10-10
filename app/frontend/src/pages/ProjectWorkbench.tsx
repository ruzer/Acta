import type { ReactNode } from "react";
import type { ProjectView } from "@requirements/contracts";
import { Link } from "react-router-dom";
import { useWorkbenchContext } from "../workbench-context";
import "../project-workbench.css";

export type WorkbenchView =
  "attention" | "questionnaire" | "decisions" | "invitations";

// The project name lives in the shell; the page heading names the page.
const pageTitles: Record<WorkbenchView, string> = {
  attention: "Atención",
  questionnaire: "Cuestionario",
  decisions: "Decisiones",
  invitations: "Invitaciones",
};

export type ProjectWorkbenchProps = {
  projectId: string;
  projectName: string;
  role?: ProjectView["role"];
  active?: WorkbenchView;
  compact?: boolean;
  /** One line that says what the page is for. */
  lead?: ReactNode;
  /** The page's main action, at the end of the heading. */
  actions?: ReactNode;
  children?: ReactNode;
};

export function ProjectWorkbench({
  projectId,
  projectName,
  role,
  active,
  compact = false,
  lead,
  actions,
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
  const heading = active ? pageTitles[active] : projectName;
  return (
    <header
      className={`project-workbench ac-workbench-heading${compact ? " ac-workbench-compact" : ""}${lead || actions ? " ac-page-header" : ""}`}
    >
      {compact ? (
        <Link className="pw-project-link" to={home}>
          {projectName}
        </Link>
      ) : lead || actions ? (
        <div>
          <h1>{heading}</h1>
          {lead && <p className="lead">{lead}</p>}
        </div>
      ) : (
        <h1>{heading}</h1>
      )}
      {actions && <div className="ac-page-actions">{actions}</div>}
      {children}
    </header>
  );
}
