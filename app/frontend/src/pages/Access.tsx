import { useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { roleLabels, statusLabels, type Me } from "@requirements/contracts";
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
import { PageHeader } from "../ui/semantic";
import { AnalystStatus } from "./AnalystVisual";
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
        <p className="access-institution">{context.data.institutionName}</p>
        <p>
          <Brand /> · Questions. Evidence. Decisions.
        </p>
      </div>
      <section className="access-form">
        {compact ? <h2>Iniciar sesión</h2> : <h1>Iniciar sesión</h1>}
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
      <PageHeader
        overline="TU ESPACIO DE TRABAJO"
        title="Mis proyectos"
        lead="Accede al cuestionario, las respuestas y el trabajo de cada proyecto."
      />
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
          {q.data.map((p) => {
            const manages = p.role === "ADMIN" || p.role === "ANALYST";
            return (
              <li key={p.id}>
                <div className="project-card-main">
                  <StatusBadge>{roleLabels[p.role]}</StatusBadge>
                  <h2>{p.name}</h2>
                  <p>{p.description}</p>
                  <span className="muted">
                    {p.questionCount} preguntas publicadas disponibles
                  </span>
                  {p.role === "STAKEHOLDER" && (
                    <PersonalProgress projectId={p.id} />
                  )}
                </div>
                {/* One main action per project: where the work starts. The rest are quiet. */}
                <div className="project-card-actions">
                  <Link
                    className="button primary"
                    to={
                      manages
                        ? `/projects/${p.id}/dashboard`
                        : p.role === "STAKEHOLDER"
                          ? `/projects/${p.id}/work`
                          : `/projects/${p.id}`
                    }
                  >
                    {manages
                      ? "Atención del proyecto"
                      : p.role === "STAKEHOLDER"
                        ? "Abrir proyecto"
                        : "Consultar preguntas"}
                  </Link>
                  {manages && (
                    <Link
                      className="button secondary"
                      to={`/projects/${p.id}/editor`}
                    >
                      Editar cuestionario
                    </Link>
                  )}
                  {p.role === "ANALYST" && (
                    <Link
                      className="button secondary"
                      to={`/review?projectId=${p.id}`}
                    >
                      Revisar respuestas
                    </Link>
                  )}
                  {p.role === "VIEWER" && (
                    <Link
                      className="button secondary"
                      to={`/projects/${p.id}/export`}
                    >
                      Exportar decisiones vigentes
                    </Link>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
/** The review state a question was published with, as the same chip the analyst sees. */
function ReviewStatusChip({ label }: { label: string }) {
  const status = (
    Object.keys(statusLabels) as (keyof typeof statusLabels)[]
  ).find((key) => statusLabels[key] === label);
  return status ? (
    <AnalystStatus status={status} />
  ) : (
    <StatusBadge>{label}</StatusBadge>
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
      <PageHeader
        overline={`${data.roleLabel} · ${data.projectName}`}
        title="Preguntas publicadas"
      />
      <Alert>{data.phaseNotice}</Alert>
      {!data.sections.length ? (
        <EmptyState title="No hay preguntas disponibles">
          Cuando se publiquen preguntas para ti, aparecerán aquí.
        </EmptyState>
      ) : (
        <div className="ac-viewer">
          <nav
            className="ac-viewer-sections"
            aria-label="Secciones del proyecto"
          >
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
              <ul className="ac-viewer-list">
                {current.questions.map((x, i) => (
                  <li key={x.key}>
                    <article>
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
                      <div className="ac-viewer-foot">
                        <ReviewStatusChip label={x.statusLabel} />
                        {x.reviewQuestionId && (
                          <Link
                            className="button secondary"
                            to={`/projects/${projectId}/review/${x.reviewQuestionId}`}
                          >
                            Consultar decisión y fuentes
                          </Link>
                        )}
                      </div>
                    </article>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </>
  );
}
