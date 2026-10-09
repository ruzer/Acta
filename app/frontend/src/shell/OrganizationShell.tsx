import type { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { Brand } from "../branding";
import { Button } from "../ui";
import { AppShell } from "../ui/semantic";
import { ParticipantIcon } from "../pages/ParticipantIcon";
import { closeToolsOnEscape } from "./ProjectNavigation";
import "./shell.css";

const pageNames: Record<string, string> = {
  "/": "Mis proyectos",
  "/admin": "Administración",
  "/password": "Mi contraseña",
  "/review": "Revisar respuestas",
};

/**
 * The frame of every page that is not inside a project (Mis proyectos,
 * Administración, Mi contraseña, the review inbox, an unknown address): the
 * same sidebar, rail and bottom bar as a project, with the destinations of the
 * organization. It carries no project and invents no destination.
 */
export function OrganizationShell({
  displayName,
  organizationAdmin,
  onLogout,
  children,
}: {
  displayName: string;
  organizationAdmin: boolean;
  onLogout: () => void;
  children: ReactNode;
}) {
  const { pathname } = useLocation();
  const destinations = [
    { path: "/", label: "Mis proyectos", icon: "folder" },
    ...(organizationAdmin
      ? [{ path: "/admin", label: "Administración", icon: "building" }]
      : []),
  ];
  const navigation = (
    <nav className="ac-project-navigation" aria-label="Navegación principal">
      {destinations.map(({ path, label, icon }) => (
        <Link
          key={path}
          to={path}
          title={label}
          aria-current={pathname === path ? "page" : undefined}
        >
          <ParticipantIcon name={icon} />
          <span>{label}</span>
        </Link>
      ))}
    </nav>
  );
  const account = (
    <>
      <p className="ac-account-name">{displayName}</p>
      <nav aria-label="Cuenta">
        <Link to="/password">Mi contraseña</Link>
      </nav>
      <Button tone="tertiary" onClick={onLogout}>
        Cerrar sesión
      </Button>
    </>
  );
  const page =
    pageNames[pathname] ??
    (pathname.startsWith("/projects/") ? "Proyecto" : "Página no encontrada");
  return (
    <AppShell
      navigation={
        <aside className="ac-sidebar" aria-label="Espacio de la organización">
          <Link className="ac-brand" to="/" title="Mis proyectos">
            <Brand short />
          </Link>
          {navigation}
          <div className="ac-sidebar-account">{account}</div>
        </aside>
      }
      context={
        <>
          <nav className="ac-breadcrumb" aria-label="Contexto de página">
            <Link to="/">
              <Brand />
            </Link>
            <span aria-hidden="true">›</span>
            <span>{page}</span>
          </nav>
          <details
            className="ac-mobile-account"
            key={pathname}
            onKeyDown={closeToolsOnEscape}
          >
            <summary title="Cuenta">
              <ParticipantIcon name="menu" />
              <span>Menú</span>
            </summary>
            <div className="ac-mobile-menu">{account}</div>
          </details>
        </>
      }
      mobileNavigation={destinations.length > 1 ? navigation : undefined}
    >
      {children}
    </AppShell>
  );
}
