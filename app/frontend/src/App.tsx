import { ProjectShell } from "./shell/ProjectShell";
import { OrganizationShell } from "./shell/OrganizationShell";
import { PageHeader } from "./ui/semantic";
import { InvitedResponse } from "./pages/InvitedResponse";
import { BrandingProvider, Brand } from "./branding";
import { lazy, Suspense, useEffect, useState } from "react";
import {
  createBrowserRouter,
  RouterProvider,
  Link,
  Navigate,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";
import {
  useQuery,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import type { Me } from "@requirements/contracts";
import { api, setCsrf } from "./api";
import { Alert, Button, LoadingState, Dialog } from "./ui";
import { Login, Password, Participant, Projects } from "./pages/Access";
import { Setup } from "./pages/Setup";
import { MyWork } from "./pages/MyWork";
import { ParticipantHeader } from "./pages/ParticipantShell";
import {
  ParticipantNotice,
  SessionReceipt,
  SubmittedResponse,
} from "./pages/ParticipantFlow";
import "./participant.css";
import { Respond } from "./pages/Respond";
import { Clarifications } from "./pages/Clarifications";
const ProjectDecisions = lazy(() =>
  import("./pages/ProjectDecisions").then((module) => ({
    default: module.ProjectDecisions,
  })),
);
const Invitations = lazy(() =>
  import("./pages/Invitations").then((module) => ({
    default: module.Invitations,
  })),
);
const Dashboard = lazy(() =>
  import("./pages/Visibility").then((module) => ({
    default: module.Dashboard,
  })),
);
const Traceability = lazy(() =>
  import("./pages/Visibility").then((module) => ({
    default: module.Traceability,
  })),
);
const History = lazy(() =>
  import("./pages/Visibility").then((module) => ({ default: module.History })),
);
const ImportStructure = lazy(() =>
  import("./pages/Exchange").then((module) => ({
    default: module.ImportStructure,
  })),
);
const ExportProject = lazy(() =>
  import("./pages/Exchange").then((module) => ({
    default: module.ExportProject,
  })),
);
const Administration = lazy(() =>
  import("./pages/Administration").then((module) => ({
    default: module.Administration,
  })),
);
const Members = lazy(() =>
  import("./pages/Administration").then((module) => ({
    default: module.Members,
  })),
);
const Settings = lazy(() =>
  import("./pages/Settings").then((module) => ({ default: module.Settings })),
);
const Editor = lazy(() =>
  import("./pages/Editor").then((module) => ({ default: module.Editor })),
);
const ReviewInbox = lazy(() =>
  import("./pages/ReviewInbox").then((module) => ({
    default: module.ReviewInbox,
  })),
);
const ReviewDetail = lazy(() =>
  import("./pages/ReviewDetail").then((module) => ({
    default: module.ReviewDetail,
  })),
);
const client = new QueryClient({
  defaultOptions: {
    queries: { retry: false, refetchOnWindowFocus: false, staleTime: 30000 },
  },
});
// Presentation context lasts for this authenticated session; logout clears it.
client.setQueryDefaults(["questionnaire-context"], { gcTime: Infinity });
client.setQueryDefaults(["workbench-context"], { gcTime: Infinity });
export function RouteFocus() {
  const location = useLocation();
  useEffect(() => {
    const main = document.querySelector("main");
    if (!main) return;
    const focusHeading = () => {
      const heading = main.querySelector<HTMLElement>("h1");
      if (!heading) return false;
      heading.setAttribute("tabindex", "-1");
      heading.focus();
      window.scrollTo(0, 0);
      return true;
    };
    if (focusHeading()) return;
    function stopWaiting() {
      observer.disconnect();
      window.clearTimeout(timeout);
    }
    const observer = new MutationObserver(() => {
      const active = document.activeElement;
      if (
        (active &&
          active !== main &&
          active !== document.body &&
          main.contains(active)) ||
        focusHeading()
      )
        stopWaiting();
    });
    const timeout = window.setTimeout(stopWaiting, 5000);
    observer.observe(main, { childList: true, subtree: true });
    return stopWaiting;
  }, [location.pathname]);
  return null;
}
/**
 * What a visitor without a session sees. A new installation offers the guided
 * setup; anything else, including a setup check that fails, shows the sign-in:
 * Acta never depends on the wizard to be usable.
 */
function SignedOut({
  notice,
  onLogin,
}: {
  notice: string;
  onLogin: (me: Me) => void;
}) {
  const setup = useQuery({
    queryKey: ["setup-status"],
    queryFn: () => api("setupStatus"),
    staleTime: 0,
  });
  const [finished, setFinished] = useState(false);
  if (setup.isPending) return <LoadingState />;
  if (setup.data?.state === "PENDING" && !finished)
    return <Setup onFinished={() => setFinished(true)} />;
  return (
    <Login
      notice={
        finished
          ? "La instalación quedó configurada. Inicia sesión con la cuenta de administración que creaste."
          : notice
      }
      onLogin={onLogin}
    />
  );
}
function Session() {
  const location = useLocation();
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const [expired, setExpired] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    void api("me")
      .then((m) => {
        if (active) {
          setCsrf(m.csrfToken);
          setMe(m);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false);
      });
    const expired = () => {
      setExpired(true);
      setCsrf("");
    };
    window.addEventListener("session-expired", expired);
    return () => {
      active = false;
      window.removeEventListener("session-expired", expired);
    };
  }, []);
  const projects = useQuery({
    queryKey: ["projects"],
    queryFn: () => api("projects"),
    enabled: !!me && !me.user.mustChangePassword,
  });
  const participantRoute =
    /^\/projects\/[^/]+\/(work|respond|submitted|clarifications|receipt)(\/|$)/.test(
      location.pathname,
    );
  const participantHome =
    location.pathname === "/" &&
    !!projects.data?.length &&
    projects.data.every((p) => p.role === "STAKEHOLDER");
  const participant =
    !me?.user.mustChangePassword && (participantRoute || participantHome);
  function logout() {
    const proceed = () => {
      void api("logout")
        .then(() => signedOut("Sesión cerrada."))
        .catch((e) => setError((e as Error).message));
    };
    if (
      window.dispatchEvent(
        new CustomEvent("before-session-logout", {
          cancelable: true,
          detail: { proceed },
        }),
      )
    )
      proceed();
  }
  function signedOut(message: string) {
    setExpired(false);
    setMe(null);
    setCsrf("");
    client.clear();
    setNotice(message);
  }
  if (loading) return <LoadingState />;
  if (!me)
    return (
      <SignedOut
        notice={notice}
        onLogin={(m) => {
          client.clear();
          setMe(m);
          setNotice("");
        }}
      />
    );
  const currentProject = projects.data?.find(
    (item) =>
      location.pathname === `/projects/${item.id}` ||
      location.pathname.startsWith(`/projects/${item.id}/`),
  );
  const project =
    !participant &&
    !me.user.mustChangePassword &&
    currentProject &&
    ["ADMIN", "ANALYST", "VIEWER"].includes(currentProject.role)
      ? currentProject
      : undefined;
  // The page mounts once, inside the shell. Without the project list the
  // content would first mount in the legacy layout and remount (losing what
  // was typed or chosen) the moment the shell appears.
  if (
    !participant &&
    !me.user.mustChangePassword &&
    projects.isLoading &&
    location.pathname.startsWith("/projects/")
  )
    return <LoadingState />;
  // Every page outside a project shares the same frame as the project pages.
  // Only the forced password change (no navigation until it is done) keeps the
  // minimal legacy header.
  const organizationPage =
    !participant && !project && !me.user.mustChangePassword;
  const content = (
    <main
      id="main"
      aria-label="Contenido principal"
      className={participant ? "participant-content" : "container"}
      key={me.user.id}
    >
      {participant && <ParticipantNotice />}
      {error && <Alert error>{error}</Alert>}
      <Suspense fallback={<LoadingState />}>
        {me.user.mustChangePassword ? (
          <Password
            required
            onDone={() =>
              signedOut(
                "Contraseña actualizada. Inicia sesión con tu nueva contraseña.",
              )
            }
          />
        ) : (
          <Routes>
            <Route
              path="/"
              element={
                <Projects
                  displayName={me.user.displayName}
                  isOrganizationAdmin={me.user.isOrganizationAdmin}
                />
              }
            />
            <Route path="/review" element={<ReviewInbox />} />
            <Route
              path="/projects/:projectId/decisions"
              element={<ProjectDecisions />}
            />
            <Route
              path="/projects/:projectId/invitations"
              element={<Invitations />}
            />
            <Route
              path="/projects/:projectId/dashboard"
              element={<Dashboard />}
            />
            <Route
              path="/projects/:projectId/traceability"
              element={<Traceability />}
            />
            <Route path="/projects/:projectId/history" element={<History />} />
            <Route
              path="/projects/:projectId/import"
              element={<ImportStructure />}
            />
            <Route
              path="/projects/:projectId/export"
              element={<ExportProject />}
            />
            <Route
              path="/projects/:projectId/review/:id"
              element={<ReviewDetail />}
            />
            <Route
              path="/projects/:projectId/clarifications/:id"
              element={<Clarifications />}
            />
            <Route
              path="/password"
              element={
                <Password
                  onDone={() =>
                    signedOut(
                      "Contraseña actualizada. Inicia sesión con tu nueva contraseña.",
                    )
                  }
                />
              }
            />
            <Route path="/admin" element={<Administration me={me} />} />
            <Route
              path="/admin/settings"
              element={<Navigate to="/admin/settings/general" replace />}
            />
            <Route
              path="/admin/settings/:section"
              element={<Settings me={me} />}
            />
            <Route
              path="/projects/:projectId/receipt"
              element={<SessionReceipt />}
            />
            <Route
              path="/projects/:projectId/submitted/:id"
              element={<SubmittedResponse />}
            />
            <Route path="/projects/:projectId/work" element={<MyWork />} />
            <Route
              path="/projects/:projectId/respond/:id"
              element={<Respond />}
            />
            <Route path="/projects/:projectId" element={<Participant />} />
            <Route path="/projects/:projectId/editor" element={<Editor />} />
            <Route path="/projects/:projectId/members" element={<Members />} />
            <Route
              path="*"
              element={
                <>
                  <PageHeader
                    title="Página no encontrada"
                    lead="La dirección no existe o no tienes acceso a ella."
                  />
                  <p>
                    <Link className="button primary" to="/">
                      Volver a mis proyectos
                    </Link>
                  </p>
                </>
              }
            />
          </Routes>
        )}
        <RouteFocus key={location.pathname} />
      </Suspense>
    </main>
  );
  return (
    <div className={participant ? "acta-participant" : undefined}>
      <a className="skip" href="#main">
        Ir al contenido
      </a>
      {project || organizationPage ? null : participant ? (
        <ParticipantHeader
          displayName={me.user.displayName}
          onLogout={logout}
        />
      ) : (
        <header className="topbar">
          <Link className="brand" to="/">
            <Brand />
          </Link>
          <nav aria-label="Navegación principal">
            <Link to="/">Mis proyectos</Link>
            {me.user.isOrganizationAdmin && !me.user.mustChangePassword && (
              <Link to="/admin">Administración</Link>
            )}
            <Link to="/password">Mi contraseña</Link>
          </nav>
          <div className="account">
            <span>{me.user.displayName}</span>
            <Button
              tone="secondary"
              onClick={() => {
                const proceed = () => {
                  void api("logout")
                    .then(() => signedOut("Sesión cerrada."))
                    .catch((e) => setError((e as Error).message));
                };
                if (
                  window.dispatchEvent(
                    new CustomEvent("before-session-logout", {
                      cancelable: true,
                      detail: { proceed },
                    }),
                  )
                )
                  proceed();
              }}
            >
              Cerrar sesión
            </Button>
          </div>
        </header>
      )}
      {project ? (
        <ProjectShell
          project={project}
          displayName={me.user.displayName}
          organizationAdmin={me.user.isOrganizationAdmin}
          onLogout={logout}
        >
          {content}
        </ProjectShell>
      ) : organizationPage ? (
        <OrganizationShell
          displayName={me.user.displayName}
          organizationAdmin={me.user.isOrganizationAdmin}
          onLogout={logout}
        >
          {content}
        </OrganizationShell>
      ) : (
        content
      )}
      {!participant && !project && !organizationPage && (
        <footer className="footer">
          <Brand /> · Preguntas. Evidencia. Decisiones.
        </footer>
      )}
      {expired && (
        <Dialog title="Recuperar sesión" onClose={() => setExpired(false)}>
          <Login
            compact
            notice="Tu sesión terminó. Tus cambios siguen en esta pestaña. Inicia sesión para continuar."
            onLogin={(m) => {
              if (m.user.id !== me.user.id) client.clear();
              setMe(m);
              setExpired(false);
            }}
          />
        </Dialog>
      )}
    </div>
  );
}
const router = createBrowserRouter([
  { path: "/invite", element: <InvitedResponse /> },
  { path: "*", element: <Session /> },
]);
export function App() {
  return (
    <QueryClientProvider client={client}>
      <BrandingProvider>
        {/* URL-backed controlled inputs must update before the next input event. */}
        <RouterProvider router={router} useTransitions={false} />
      </BrandingProvider>
    </QueryClientProvider>
  );
}
