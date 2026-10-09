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
  return (
    <header
      className={`project-workbench ac-workbench-heading${compact ? " ac-workbench-compact" : ""}`}
    >
      {compact ? (
        <Link className="pw-project-link" to={home}>
          {projectName}
        </Link>
      ) : (
        <h1>{active ? pageTitles[active] : projectName}</h1>
      )}
      {children}
    </header>
  );
}
