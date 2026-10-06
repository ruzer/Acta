import { useState, type FormEvent, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { roles, roleLabels, type Me } from "@requirements/contracts";
import { api, formValues } from "../api";
import {
  Alert,
  Button,
  Checkbox,
  Dialog,
  EmptyState,
  ErrorState,
  Input,
  LoadingState,
  Select,
  StatusBadge,
  Table,
  Textarea,
} from "../ui";
export function ActionForm({
  children,
  onSubmit,
  label = "Guardar",
  onDone,
}: {
  children: ReactNode;
  onSubmit: (d: Record<string, string>) => Promise<unknown>;
  label?: string;
  onDone?: () => void;
}) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    setBusy(true);
    setError("");
    setSuccess(false);
    try {
      await onSubmit(formValues(form));
      form.reset();
      setSuccess(true);
      onDone?.();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit}>
      {children}
      {error && <Alert error>{error}</Alert>}
      {success && <Alert>Operación guardada.</Alert>}
      <Button disabled={busy} type="submit">
        {busy ? "Guardando…" : label}
      </Button>
    </form>
  );
}
export function Administration({ me }: { me: Me }) {
  const [tab, setTab] = useState("users");
  const [reset, setReset] = useState<{ id: string; name: string } | null>(null);
  const [deactivate, setDeactivate] = useState<{
    id: string;
    name: string;
    active: boolean;
  } | null>(null);
  const [error, setError] = useState("");
  const qc = useQueryClient();
  const users = useQuery({
    queryKey: ["users"],
    queryFn: () => api("users"),
    enabled: me.user.isOrganizationAdmin,
  });
  const areas = useQuery({
    queryKey: ["areas"],
    queryFn: () => api("areas"),
    enabled: me.user.isOrganizationAdmin,
  });
  const refresh = () => {
    void qc.invalidateQueries();
  };
  if (!me.user.isOrganizationAdmin)
    return (
      <Alert error>No tienes permiso para administrar la institución.</Alert>
    );
  return (
    <>
      <p className="eyebrow">{me.organization.name}</p>
      <h1>Administración</h1>
      <p>Gestiona el acceso y los espacios de trabajo de tu institución.</p>
      <div className="tabs" aria-label="Administración">
        {[
          ["users", "Usuarios"],
          ["areas", "Áreas"],
          ["projects", "Proyectos"],
        ].map(([k, label]) => (
          <button key={k} aria-pressed={tab === k} onClick={() => setTab(k!)}>
            {label}
          </button>
        ))}
      </div>
      {error && <Alert error>{error}</Alert>}
      {tab === "users" && (
        <>
          {users.isPending ? (
            <LoadingState />
          ) : users.error ? (
            <ErrorState error={users.error} />
          ) : (
            <Table caption="Usuarios de la institución">
              <thead>
                <tr>
                  <th>Persona / cuenta</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {users.data?.map((u) => (
                  <tr key={u.id}>
                    <td>
                      {u.displayName}
                      <br />
                      <span className="muted">
                        {u.username}
                        {u.isOrganizationAdmin ? " · Administración" : ""}
                      </span>
                    </td>
                    <td>
                      <StatusBadge>
                        {u.active ? "Activo" : "Desactivado"}
                      </StatusBadge>
                      {u.mustChangePassword && (
                        <p className="hint">Debe cambiar contraseña</p>
                      )}
                    </td>
                    <td>
                      <div className="actions">
                        <Button
                          tone="secondary"
                          onClick={() =>
                            setReset({ id: u.id, name: u.displayName })
                          }
                        >
                          Contraseña temporal
                        </Button>
                        {u.id !== me.user.id && (
                          <Button
                            tone="secondary"
                            onClick={() =>
                              setDeactivate({
                                id: u.id,
                                name: u.displayName,
                                active: !u.active,
                              })
                            }
                          >
                            {u.active ? "Desactivar" : "Activar"}
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
          <details className="panel">
            <summary>Crear usuario</summary>
            <ActionForm
              label="Crear usuario"
              onDone={refresh}
              onSubmit={(d) =>
                api(
                  "createUser",
                  {},
                  { ...d, isOrganizationAdmin: d.isOrganizationAdmin === "on" },
                )
              }
            >
              <div className="grid2">
                <Input
                  label="Nombre para mostrar"
                  name="displayName"
                  required
                />
                <Input
                  label="Usuario"
                  name="username"
                  required
                  pattern="[a-zA-Z0-9._-]{3,64}"
                />
              </div>
              <Input
                label="Contraseña temporal"
                name="temporaryPassword"
                type="password"
                autoComplete="new-password"
                required
                minLength={12}
                maxLength={128}
                hint="Compártela por un canal seguro. Se exigirá cambiarla al entrar."
              />
              <Checkbox
                label="Administrar la institución"
                name="isOrganizationAdmin"
              />
            </ActionForm>
          </details>
        </>
      )}
      {tab === "areas" && (
        <>
          {areas.isPending ? (
            <LoadingState />
          ) : areas.error ? (
            <ErrorState error={areas.error} />
          ) : areas.data?.length ? (
            <Table caption="Áreas registradas">
              <thead>
                <tr>
                  <th>Área</th>
                  <th>Código</th>
                </tr>
              </thead>
              <tbody>
                {areas.data.map((a) => (
                  <tr key={a.id}>
                    <td>{a.name}</td>
                    <td>{a.code}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          ) : (
            <EmptyState title="Todavía no hay áreas" />
          )}
          <section className="panel">
            <h2>Crear área</h2>
            <ActionForm
              label="Crear área"
              onDone={refresh}
              onSubmit={(d) => api("createArea", {}, d)}
            >
              <div className="grid2">
                <Input label="Nombre del área" name="name" required />
                <Input label="Código del área" name="code" required />
              </div>
            </ActionForm>
          </section>
        </>
      )}
      {tab === "projects" && (
        <section className="panel">
          <h2>Crear proyecto</h2>
          <ActionForm
            label="Crear proyecto"
            onDone={refresh}
            onSubmit={(d) => api("createProject", {}, d)}
          >
            <Input label="Nombre del proyecto" name="name" required />
            <Input
              label="Identificador externo"
              name="externalId"
              required
              hint="Se conservará exactamente como lo escribas."
            />
            <Textarea label="Descripción" name="description" />
          </ActionForm>
          <p className="hint">
            Los proyectos disponibles y sus miembros se consultan desde{" "}
            <Link to="/">Mis proyectos</Link>.
          </p>
        </section>
      )}
      {reset && (
        <Dialog
          title={"Contraseña temporal · " + reset.name}
          onClose={() => setReset(null)}
        >
          <ActionForm
            label="Establecer contraseña y cerrar sesiones"
            onDone={() => {
              setReset(null);
              refresh();
            }}
            onSubmit={(d) => api("resetPassword", { id: reset.id }, d)}
          >
            <Alert>
              Esta acción cerrará todas las sesiones de esta cuenta y exigirá
              cambiar su contraseña.
            </Alert>
            <Input
              label="Contraseña temporal"
              name="temporaryPassword"
              type="password"
              autoComplete="new-password"
              minLength={12}
              required
            />
          </ActionForm>
        </Dialog>
      )}
      {deactivate && (
        <Dialog
          title={(deactivate.active ? "Activar" : "Desactivar") + " cuenta"}
          onClose={() => setDeactivate(null)}
        >
          <p>
            {deactivate.name}.{" "}
            {deactivate.active
              ? "Podrá iniciar sesión nuevamente."
              : "Se cerrarán sus sesiones y perderá acceso hasta que se reactive."}
          </p>
          <Button
            tone="danger"
            onClick={() => {
              void api(
                "userState",
                { id: deactivate.id },
                { active: deactivate.active },
              )
                .then(() => {
                  setDeactivate(null);
                  refresh();
                })
                .catch((e) => {
                  setError((e as Error).message);
                  setDeactivate(null);
                });
            }}
          >
            Confirmar {deactivate.active ? "activación" : "desactivación"}
          </Button>
        </Dialog>
      )}
    </>
  );
}
export function Members() {
  const { projectId = "" } = useParams();
  const qc = useQueryClient();
  const members = useQuery({
    queryKey: ["members", projectId],
    queryFn: () => api("members", { projectId }),
  });
  const users = useQuery({ queryKey: ["users"], queryFn: () => api("users") });
  const areas = useQuery({ queryKey: ["areas"], queryFn: () => api("areas") });
  if (members.isPending || areas.isPending) return <LoadingState />;
  if (members.error || areas.error)
    return <ErrorState error={(members.error || areas.error)!} />;
  return (
    <>
      <Link to={"/projects/" + projectId + "/editor"} className="back">
        ← Cuestionario
      </Link>
      <h1>Miembros del proyecto</h1>
      <p>
        La membresía da acceso al proyecto. Para que un participante pueda
        responder, asígnale preguntas en{" "}
        <Link to={`/projects/${projectId}/editor`}>Organizar</Link> y
        publícalas. El área no asigna personas automáticamente.
      </p>
      <Table caption="Acceso al proyecto">
        <thead>
          <tr>
            <th>Miembro</th>
            <th>Rol</th>
            <th>Área</th>
            <th>Estado</th>
          </tr>
        </thead>
        <tbody>
          {members.data.map((m) => (
            <tr key={m.id}>
              <td>{m.displayName}</td>
              <td>{roleLabels[m.role]}</td>
              <td>{m.areaName || "Sin área"}</td>
              <td>{m.active ? "Activo" : "Inactivo"}</td>
            </tr>
          ))}
        </tbody>
      </Table>
      <section className="panel">
        <h2>Asignar o actualizar membresía</h2>
        {users.error && (
          <Alert>
            Para incorporar usuarios nuevos, solicita apoyo a la administración
            de la institución. Puedes actualizar miembros existentes.
          </Alert>
        )}
        <ActionForm
          label="Guardar membresía"
          onDone={() => void qc.invalidateQueries()}
          onSubmit={(d) =>
            api(
              "setMember",
              { projectId },
              {
                userId: d.userId,
                role: d.role,
                areaId: d.areaId || null,
                active: d.active === "on",
              },
            )
          }
        >
          <Select label="Usuario" name="userId" required>
            <option value="">Selecciona una cuenta</option>
            {(
              users.data?.filter((u) => u.active) ||
              members.data.map((m) => ({
                id: m.userId,
                displayName: m.displayName,
              }))
            ).map((u) => (
              <option key={u.id} value={u.id}>
                {u.displayName}
              </option>
            ))}
          </Select>
          <div className="grid2">
            <Select label="Rol" name="role">
              {roles.map((r) => (
                <option key={r} value={r}>
                  {roleLabels[r]}
                </option>
              ))}
            </Select>
            <Select
              label="Área"
              name="areaId"
              hint="Obligatoria para participantes activos."
            >
              <option value="">Sin área</option>
              {areas.data?.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </Select>
          </div>
          <Checkbox label="Membresía activa" name="active" defaultChecked />
        </ActionForm>
      </section>
    </>
  );
}
