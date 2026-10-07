import { useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { roleLabels, type Me } from "@requirements/contracts";
import { api, formValues, setCsrf } from "../api";
import {
  Alert,
  Button,
  EmptyState,
  ErrorState,
  Input,
  LoadingState,
  StatusBadge,
} from "../ui";
import { PersonalProgress, ParticipantHome } from "./MyWork";
import { Brand } from "../branding";
export function Login({
  onLogin,
  notice,
  compact = false,
}: {
  onLogin: (me: Me) => void;
  notice: string;
  compact?: boolean;
}) {
  const context = useQuery({
    queryKey: ["login-context"],
    queryFn: () => api("loginContext"),
  });
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const d = formValues(form);
    setPending(true);
    setError("");
    try {
      const me = await api("login", {}, d);
      setCsrf(me.csrfToken);
      onLogin(me);
    } catch (e) {
      const password = form.elements.namedItem("password");
      if (password instanceof HTMLInputElement) password.value = "";
      setError(
        e instanceof Error ? e.message : "No fue posible iniciar sesión.",
      );
    } finally {
      setPending(false);
    }
  }
  const Container = compact ? "div" : "main";
  if (context.isPending)
    return (
      <Container className="narrow">
        <LoadingState />
      </Container>
    );
  if (context.error)
    return (
      <Container className="narrow">
        <ErrorState
          error={context.error}
          retry={() => void context.refetch()}
        />
      </Container>
    );
  return (
    <Container className={compact ? "reauth" : "access"}>
      <div className="access-intro">
        <h1>{context.data.institutionName}</h1>
        <p>
          <Brand /> · Questions. Evidence. Decisions.
        </p>
      </div>
      <section className="access-form">
        <h2>Iniciar sesión</h2>
        <p>Utiliza la cuenta proporcionada por la administración.</p>
        {notice && <Alert>{notice}</Alert>}
        {error && <Alert error>{error}</Alert>}
        <form onSubmit={submit}>
          <Input
            label="Usuario"
            name="username"
            autoComplete="username"
            required
          />
          <Input
            label="Contraseña"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            maxLength={128}
          />
          <Button type="submit" disabled={pending}>
            {pending ? "Iniciando sesión…" : "Iniciar sesión"}
          </Button>
        </form>
      </section>
    </Container>
  );
}
export function Password({
  onDone,
  required = false,
}: {
  onDone: () => void;
  required?: boolean;
}) {
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const d = formValues(e.currentTarget);
    if (d.newPassword !== d.confirm) {
      setError("Las contraseñas nuevas no coinciden.");
      return;
    }
    setPending(true);
    setError("");
    try {
      await api(
        "password",
        {},
        { currentPassword: d.currentPassword, newPassword: d.newPassword },
      );
      onDone();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPending(false);
    }
  }
  return (
    <section className="narrow">
      <p className="eyebrow">SEGURIDAD DE LA CUENTA</p>
      <h1>
        {required ? "Cambia tu contraseña temporal" : "Cambiar contraseña"}
      </h1>
      <p>
        Usa al menos 12 caracteres. Al guardar se cerrarán tus sesiones y podrás
        entrar con la nueva contraseña.
      </p>
      {error && <Alert error>{error}</Alert>}
      <form onSubmit={submit}>
        <Input
          label="Contraseña actual"
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          required
        />
        <Input
          label="Nueva contraseña"
          name="newPassword"
          type="password"
          minLength={12}
          maxLength={128}
          autoComplete="new-password"
          required
        />
        <Input
          label="Repetir nueva contraseña"
          name="confirm"
          type="password"
          autoComplete="new-password"
          required
        />
        <Button type="submit" disabled={pending}>
          {pending ? "Actualizando…" : "Actualizar contraseña"}
        </Button>
      </form>
    </section>
  );
}
export function Projects({
  displayName = "",
  isOrganizationAdmin = false,
}: {
  displayName?: string;
  isOrganizationAdmin?: boolean;
}) {
  const q = useQuery({
    queryKey: ["projects"],
    queryFn: () => api("projects"),
  });
  if (q.isPending) return <LoadingState />;
  if (q.error)
    return <ErrorState error={q.error} retry={() => void q.refetch()} />;
  if (q.data.length > 0 && q.data.every((p) => p.role === "STAKEHOLDER"))
    return <ParticipantHome projects={q.data} displayName={displayName} />;
  return (
    <>
      <p className="eyebrow">TU ESPACIO DE TRABAJO</p>
      <h1>Mis proyectos</h1>
      <p className="lead">
        Accede al cuestionario, las respuestas y el trabajo de cada proyecto.
      </p>
      {q.data.length === 0 ? (
        <EmptyState title="Aún no tienes proyectos">
          {isOrganizationAdmin ? (
            <>
              Crea tu primer proyecto desde{" "}
              <Link to="/admin">Administración → Proyectos</Link>. Después
              podrás preparar o importar su cuestionario.
            </>
          ) : (
            "La administración debe asignarte una membresía para comenzar."
          )}
        </EmptyState>
      ) : (
        <ul className="project-list">
          {q.data.map((p) => (
            <li key={p.id}>
              <div>
                <StatusBadge>{roleLabels[p.role]}</StatusBadge>
                <h2>{p.name}</h2>
                <p>{p.description}</p>
                <span className="muted">
                  {p.questionCount} preguntas publicadas disponibles
                </span>
                {(p.role === "ADMIN" || p.role === "ANALYST") && (
                  <Link to={`/projects/${p.id}/dashboard`}>
                    Atención del proyecto
                  </Link>
                )}
                {p.role === "VIEWER" && (
                  <Link to={`/projects/${p.id}/export`}>
                    Exportar decisiones vigentes
                  </Link>
                )}
                {p.role === "ANALYST" && (
                  <Link
                    className="button primary"
                    to={`/review?projectId=${p.id}`}
                  >
                    Revisar respuestas
                  </Link>
                )}
                {p.role === "STAKEHOLDER" && (
                  <PersonalProgress projectId={p.id} />
                )}
              </div>
              <Link
                className="button primary"
                to={
                  "/projects/" +
                  p.id +
                  (p.role === "ADMIN" || p.role === "ANALYST"
                    ? "/editor"
                    : p.role === "STAKEHOLDER"
                      ? "/work"
                      : "")
                }
              >
                {p.role === "ADMIN" || p.role === "ANALYST"
                  ? "Editar cuestionario"
                  : p.role === "STAKEHOLDER"
                    ? "Abrir proyecto"
                    : "Consultar preguntas"}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
export function Participant() {
  const { projectId = "" } = useParams();
  const q = useQuery({
    queryKey: ["participant", projectId],
    queryFn: () => api("participant", { projectId }),
  });
  const [section, setSection] = useState("");
  if (q.isPending) return <LoadingState />;
  if (q.error)
    return <ErrorState error={q.error} retry={() => void q.refetch()} />;
  const data = q.data;
  const current =
    data.sections.find((s) => s.key === section) ?? data.sections[0];
  return (
    <>
      <Link className="back" to="/">
        ← Mis proyectos
      </Link>
      <p className="eyebrow">{data.roleLabel}</p>
      <h1>{data.projectName}</h1>
      <Alert>{data.phaseNotice}</Alert>
      {!data.sections.length ? (
        <EmptyState title="No hay preguntas disponibles">
          Cuando se publiquen preguntas para ti, aparecerán aquí.
        </EmptyState>
      ) : (
        <div className="workspace">
          <nav className="section-nav" aria-label="Secciones del proyecto">
            <h2>Secciones</h2>
            {data.sections.map((s) => (
              <button
                key={s.key}
                aria-current={s.key === current?.key ? "page" : undefined}
                onClick={() => setSection(s.key)}
              >
                {s.title}
                <span>{s.questions.length} preguntas</span>
              </button>
            ))}
          </nav>
          <section>
            <h2>{current?.title}</h2>
            {!current?.questions.length ? (
              <EmptyState title="Sin preguntas en esta sección" />
            ) : (
              current.questions.map((x, i) => (
                <article className="participant-question" key={x.key}>
                  <p className="eyebrow">
                    Pregunta {i + 1} de {current.questions.length}
                  </p>
                  <h3>{x.title}</h3>
                  <p className="question-text">{x.question}</p>
                  {x.helpText && <p className="help">{x.helpText}</p>}
                  {x.conditional && (
                    <p className="hint">
                      Pregunta de seguimiento
                      {x.groupTitle ? " de «" + x.groupTitle + "»" : ""}. Su
                      aplicación se determinará al responder.
                    </p>
                  )}
                  {x.options.length > 0 && (
                    <details>
                      <summary>Opciones previstas</summary>
                      <ul>
                        {x.options.map((o) => (
                          <li key={o}>{o}</li>
                        ))}
                      </ul>
                    </details>
                  )}
                  <StatusBadge>{x.statusLabel}</StatusBadge>
                  {x.reviewQuestionId && (
                    <p>
                      <Link
                        to={`/projects/${projectId}/review/${x.reviewQuestionId}`}
                      >
                        Consultar decisión y fuentes
                      </Link>
                    </p>
                  )}
                </article>
              ))
            )}
          </section>
        </div>
      )}
    </>
  );
}
