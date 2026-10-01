import { BrandingProvider, Brand } from "./branding";
import { Dashboard, Traceability, History } from "./pages/Visibility";
import { ImportStructure, ExportProject } from "./pages/Exchange";
import { useEffect, useState } from "react";
import {
  createBrowserRouter,
  RouterProvider,
  Link,
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
import { Administration, Members } from "./pages/Administration";
import { Editor } from "./pages/Editor";
import { MyWork } from "./pages/MyWork";
import { ParticipantHeader } from "./pages/ParticipantShell";
import {
  ParticipantNotice,
  SessionReceipt,
  SubmittedResponse,
} from "./pages/ParticipantFlow";
import "./participant.css";
import { Respond } from "./pages/Respond";
import { ReviewInbox } from "./pages/ReviewInbox";
import { ReviewDetail } from "./pages/ReviewDetail";
import { Clarifications } from "./pages/Clarifications";
const client = new QueryClient({
  defaultOptions: {
    queries: { retry: false, refetchOnWindowFocus: false, staleTime: 30000 },
  },
});
function RouteFocus() {
  const location = useLocation();
  useEffect(() => {
    const heading = document.querySelector<HTMLElement>("main h1");
    heading?.setAttribute("tabindex", "-1");
    heading?.focus();
    window.scrollTo(0, 0);
  }, [location.pathname]);
  return null;
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
      <Login
        notice={notice}
        onLogin={(m) => {
          client.clear();
          setMe(m);
          setNotice("");
        }}
      />
    );
  return (
    <div className={participant ? "acta-participant" : undefined}>
      <a className="skip" href="#main">
        Ir al contenido
      </a>
      {participant ? (
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
      <main
        id="main"
        className={participant ? "participant-content" : "container"}
        key={me.user.id}
      >
        {participant && <ParticipantNotice />}
        {error && <Alert error>{error}</Alert>}
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
              element={<Projects displayName={me.user.displayName} />}
            />
            <Route path="/review" element={<ReviewInbox />} />
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
                  <h1>Página no encontrada</h1>
                  <Link to="/">Volver a mis proyectos</Link>
                </>
              }
            />
          </Routes>
        )}
      </main>
      {!participant && (
        <footer className="footer">
          <Brand /> · Questions. Evidence. Decisions.
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
      <RouteFocus />
    </div>
  );
}
const router = createBrowserRouter([{ path: "*", element: <Session /> }]);
export function App() {
  return (
    <QueryClientProvider client={client}>
      <BrandingProvider>
        <RouterProvider router={router} />
      </BrandingProvider>
    </QueryClientProvider>
  );
}
