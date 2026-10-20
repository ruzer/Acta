import { useState, type FormEvent, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation, useParams } from "react-router-dom";
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
  DataTable,
  Textarea,
} from "../ui";
import { Avatar, PageHeader, StatusChip } from "../ui/semantic";
import { ParticipantIcon } from "./ParticipantIcon";
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
  // Coming back from a project's members reopens the list it was reached from.
  const [tab, setTab] = useState(
    (useLocation().state as { tab?: string } | null)?.tab === "projects"
      ? "projects"
      : "users",
  );
  const [reset, setReset] = useState<{ id: string; name: string } | null>(null);
  const [deactivate, setDeactivate] = useState<{
    id: string;
    name: string;
    active: boolean;
  } | null>(null);
  const [editArea, setEditArea] = useState<{ id: string; name: string } | null>(
    null,
  );
  const [areaState, setAreaState] = useState<{
    id: string;
    name: string;
    active: boolean;
  } | null>(null);
  const [showInactive, setShowInactive] = useState(false);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState<
    "users" | "areas" | "projects" | null
  >(null);
  const [saved, setSaved] = useState("");
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
  // Every project of the institution, not only the ones this account belongs to ("Mis proyectos").
  const projects = useQuery({
    queryKey: ["organization-projects"],
    queryFn: () => api("organizationProjects"),
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
      <PageHeader
        overline={me.organization.name}
        title="Administración"
        lead="Gestiona el acceso y los espacios de trabajo de tu institución."
        actions={
          <Button
            onClick={() => setCreating(tab as "users" | "areas" | "projects")}
          >
            <ParticipantIcon name="plus" />
            {
              {
                users: "Crear usuario",
                areas: "Crear área",
                projects: "Crear proyecto",
              }[tab as "users" | "areas" | "projects"]
            }
          </Button>
        }
      />
      <div className="tabs" aria-label="Administración">
        {[
          ["users", "Usuarios"],
          ["areas", "Áreas"],
          ["projects", "Proyectos"],
        ].map(([k, label]) => (
          <button
            key={k}
            aria-pressed={tab === k}
            onClick={() => {
              setTab(k!);
              setSaved("");
            }}
          >
            {label}
          </button>
        ))}
      </div>
      {error && <Alert error>{error}</Alert>}
      {saved && <Alert>{saved}</Alert>}
      {tab === "users" && (
        <>
          {users.isPending ? (
            <LoadingState />
          ) : users.error ? (
            <ErrorState error={users.error} />
          ) : (
            <DataTable
              caption="Usuarios de la institución"
              columns={[
                { label: "Persona / cuenta", bare: true },
                { label: "Estado" },
                { label: "Acciones", bare: true, end: true },
              ]}
              rows={(users.data ?? []).map((u) => ({
                key: u.id,
                cells: [
                  <div className="ac-person" key="p">
                    <Avatar name={u.displayName} />
                    <div>
                      <strong>{u.displayName}</strong>
                      <small>
                        {u.username}
                        {u.isOrganizationAdmin ? " · Administración" : ""}
                      </small>
                    </div>
                  </div>,
                  <span className="ac-cell-status" key="s">
                    <StatusChip
                      tone={u.active ? "success" : "neutral"}
                      icon={u.active ? "check" : "info"}
                    >
                      {u.active ? "Activo" : "Desactivado"}
                    </StatusChip>
                    {u.mustChangePassword && (
                      <small>Debe cambiar contraseña</small>
                    )}
                  </span>,
                  <div className="actions" key="a">
                    <Button
                      tone="tertiary"
                      aria-label={`Restablecer contraseña de ${u.displayName}`}
                      onClick={() =>
                        setReset({ id: u.id, name: u.displayName })
                      }
                    >
                      Restablecer contraseña
                    </Button>
                    {u.id !== me.user.id && (
                      <Button
                        tone="danger"
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
                  </div>,
                ],
              }))}
            />
          )}
        </>
      )}
      {tab === "areas" && (
        <>
          {areas.isPending ? (
            <LoadingState />
          ) : areas.error ? (
            <ErrorState error={areas.error} />
          ) : areas.data?.length ? (
            <>
              {areas.data.some((a) => !a.active) && (
                <Checkbox
                  label={`Mostrar áreas desactivadas (${areas.data.filter((a) => !a.active).length})`}
                  checked={showInactive}
                  onChange={(e) => setShowInactive(e.target.checked)}
                />
              )}
              <DataTable
                caption="Áreas registradas"
                columns={[
                  { label: "Área", bare: true },
                  { label: "Código" },
                  { label: "Estado" },
                  { label: "Acciones", bare: true, end: true },
                ]}
                rows={areas.data
                  .filter((a) => a.active || showInactive)
                  .map((a) => ({
                    key: a.id,
                    cells: [
                      <strong key="n">{a.name}</strong>,
                      a.code,
                      <StatusChip
                        key="s"
                        tone={a.active ? "success" : "neutral"}
                        icon={a.active ? "check" : "info"}
                      >
                        {a.active ? "Activa" : "Desactivada"}
                      </StatusChip>,
                      <div className="actions" key="a">
                        <Button
                          tone="tertiary"
                          aria-label={`Renombrar ${a.name}`}
                          onClick={() =>
                            setEditArea({ id: a.id, name: a.name })
                          }
                        >
                          Renombrar
                        </Button>
                        <Button
                          tone={a.active ? "danger" : "secondary"}
                          aria-label={`${a.active ? "Desactivar" : "Reactivar"} ${a.name}`}
                          onClick={() =>
                            setAreaState({
                              id: a.id,
                              name: a.name,
                              active: !a.active,
                            })
                          }
                        >
                          {a.active ? "Desactivar" : "Reactivar"}
                        </Button>
                      </div>,
                    ],
                  }))}
              />
            </>
          ) : (
            <EmptyState title="Todavía no hay áreas" />
          )}
        </>
      )}
      {tab === "projects" && (
        <>
          {projects.isPending ? (
            <LoadingState />
          ) : projects.error ? (
            <ErrorState error={projects.error} />
          ) : projects.data?.length ? (
            <>
              <DataTable
                caption="Proyectos"
                columns={[
                  { label: "Proyecto", bare: true },
                  { label: "Identificador" },
                  { label: "Administra" },
                  { label: "Tu acceso" },
                  { label: "Acciones", bare: true, end: true },
                ]}
                rows={projects.data.map((p) => ({
                  key: p.id,
                  cells: [
                    <div key="n">
                      <strong>{p.name}</strong>
                      {p.lifecycle === "ARCHIVED" && (
                        <span className="muted"> · Archivado</span>
                      )}
                    </div>,
                    <code key="c">{p.externalId}</code>,
                    p.adminCount ? (
                      <span key="ad">
                        {p.admins.join(", ")}
                        {p.adminCount > p.admins.length
                          ? ` y ${p.adminCount - p.admins.length} más`
                          : ""}
                      </span>
                    ) : (
                      <StatusChip key="ad" tone="warning" icon="info">
                        Sin administrador activo
                      </StatusChip>
                    ),
                    p.myRole ? roleLabels[p.myRole] : "Sin acceso",
                    <div className="table-links" key="a">
                      {p.myRole && (
                        <Link
                          to={`/projects/${p.id}/dashboard`}
                          aria-label={`Abrir ${p.name}`}
                        >
                          Abrir
                        </Link>
                      )}
                      <Link
                        to={`/projects/${p.id}/members`}
                        state={{ from: "administration" }}
                        aria-label={`Miembros de ${p.name}`}
                      >
                        Miembros
                      </Link>
                    </div>,
                  ],
                }))}
              />
              <p className="hint">
                Aquí están todos los proyectos de la institución. Verlos no da
                acceso a sus respuestas, evidencias ni decisiones: para trabajar
                en uno, agrégate o agrega a quien corresponda en «Miembros». El
                identificador es el que debe repetir el archivo de importación.
              </p>
            </>
          ) : (
            <EmptyState title="Todavía no hay proyectos">
              Crea el primero con «Crear proyecto».
            </EmptyState>
          )}
        </>
      )}
      {creating && (
        <Dialog
          title={
            {
              users: "Crear usuario",
              areas: "Crear área",
              projects: "Crear proyecto",
            }[creating]
          }
          onClose={() => setCreating(null)}
        >
          {creating === "users" && (
            <ActionForm
              label="Crear usuario"
              onDone={() => {
                setCreating(null);
                setSaved("Usuario creado.");
                refresh();
              }}
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
          )}
          {creating === "areas" && (
            <ActionForm
              label="Crear área"
              onDone={() => {
                setCreating(null);
                setSaved("Área creada.");
                refresh();
              }}
              onSubmit={(d) => api("createArea", {}, d)}
            >
              <div className="grid2">
                <Input label="Nombre del área" name="name" required />
                <Input label="Código del área" name="code" required />
              </div>
            </ActionForm>
          )}
          {creating === "projects" && (
            <ActionForm
              label="Crear proyecto"
              onDone={() => {
                setCreating(null);
                setSaved("Proyecto creado.");
                refresh();
              }}
              onSubmit={(d) => api("createProject", {}, d)}
            >
              <Input label="Nombre del proyecto" name="name" required />
              <Input
                label="Identificador externo"
                name="externalId"
                required
                hint="Es el código con el que el archivo de importación reconoce este proyecto. Se conservará exactamente como lo escribas."
              />
              <Textarea label="Descripción" name="description" />
            </ActionForm>
          )}
        </Dialog>
      )}
      {reset && (
        <Dialog
          title={"Restablecer contraseña · " + reset.name}
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
      {editArea && (
        <Dialog title="Renombrar área" onClose={() => setEditArea(null)}>
          <ActionForm
            label="Guardar nombre"
            onDone={() => {
              setEditArea(null);
              setSaved("Área actualizada.");
              refresh();
            }}
            onSubmit={(d) =>
              api("updateArea", { id: editArea.id }, { name: d.name })
            }
          >
            <Input
              label="Nombre del área"
              name="name"
              defaultValue={editArea.name}
              required
              maxLength={200}
              hint="El código no cambia: lo usan las importaciones y las exportaciones."
            />
          </ActionForm>
        </Dialog>
      )}
      {areaState && (
        <Dialog
          title={(areaState.active ? "Reactivar" : "Desactivar") + " área"}
          onClose={() => setAreaState(null)}
        >
          <p>
            {areaState.name}.{" "}
            {areaState.active
              ? "Volverá a poder elegirse para preguntas, participantes e invitaciones."
              : "Dejará de poder elegirse para nuevas preguntas, participantes e invitaciones. Lo que ya la usa se conserva y sigue funcionando: preguntas, asignaciones, participantes e invitaciones. Las preguntas en borrador de esta área deberán pasar a otra antes de publicarse. Puedes reactivarla cuando quieras."}
          </p>
          <Button
            tone={areaState.active ? "secondary" : "danger"}
            onClick={() => {
              void api(
                "updateArea",
                { id: areaState.id },
                { active: areaState.active },
              )
                .then(() => {
                  setAreaState(null);
                  setSaved("Área actualizada.");
                  refresh();
                })
                .catch((e) => {
                  setError((e as Error).message);
                  setAreaState(null);
                });
            }}
          >
            Confirmar {areaState.active ? "reactivación" : "desactivación"}
          </Button>
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
  const fromAdministration =
    (useLocation().state as { from?: string } | null)?.from ===
    "administration";
  const qc = useQueryClient();
  const members = useQuery({
    queryKey: ["members", projectId],
    queryFn: () => api("members", { projectId }),
  });
  const users = useQuery({ queryKey: ["users"], queryFn: () => api("users") });
  const areas = useQuery({ queryKey: ["areas"], queryFn: () => api("areas") });
  // Reached from Administración, the administration may not belong to the project: say which one it is.
  const project = useQuery({
    queryKey: ["organization-projects"],
    queryFn: () => api("organizationProjects"),
    enabled: fromAdministration,
  }).data?.find((p) => p.id === projectId);
  if (members.isPending || areas.isPending) return <LoadingState />;
  if (members.error || areas.error)
    return <ErrorState error={(members.error || areas.error)!} />;
  return (
    <>
      {fromAdministration ? (
        <Link to="/admin" state={{ tab: "projects" }} className="back">
          ← Administración
        </Link>
      ) : (
        <Link to={"/projects/" + projectId + "/editor"} className="back">
          ← Cuestionario
        </Link>
      )}
      <PageHeader
        title={
          project ? `Miembros de ${project.name}` : "Miembros del proyecto"
        }
        lead={
          <>
            La membresía da acceso al proyecto. Para que un participante pueda
            responder, asígnale preguntas en{" "}
            <Link to={`/projects/${projectId}/editor`}>Organizar</Link> y
            publícalas. El área no asigna personas automáticamente.
          </>
        }
      />
      <DataTable
        caption="Acceso al proyecto"
        columns={[
          { label: "Miembro", bare: true },
          { label: "Rol" },
          { label: "Área" },
          { label: "Estado" },
        ]}
        rows={members.data.map((m) => ({
          key: m.id,
          cells: [
            <div className="ac-person" key="p">
              <Avatar name={m.displayName} />
              <strong>{m.displayName}</strong>
            </div>,
            roleLabels[m.role],
            m.areaName || "Sin área",
            <StatusChip
              key="s"
              tone={m.active ? "success" : "neutral"}
              icon={m.active ? "check" : "info"}
            >
              {m.active ? "Activo" : "Inactivo"}
            </StatusChip>,
          ],
        }))}
      />
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
              {areas.data
                ?.filter((a) => a.active)
                .map((a) => (
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
