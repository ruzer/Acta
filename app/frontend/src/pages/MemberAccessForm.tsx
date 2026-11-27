import { useId, useRef, useState, type FormEvent } from "react";
import { roles, roleLabels, type MemberView } from "@requirements/contracts";
import { api } from "../api";
import { sessionPresentationUserId } from "../session-presentation";
import { Alert, Button, Checkbox, Dialog, Select } from "../ui";

type Role = MemberView["role"];
type Access = {
  userId: string;
  role: Role;
  areaId: string | null;
  active: boolean;
};
type Selection = Omit<Access, "role"> & { role: Role | "" };
type Account = { id: string; displayName: string; active: boolean };
type Area = { id: string; name: string; active: boolean };
type Confirmation = { access: Access; summary: string; reasons: string[] };
const empty: Selection = { userId: "", role: "", areaId: null, active: true };

export function MemberAccessForm({
  projectId,
  members,
  users,
  areas,
  onDone,
}: {
  projectId: string;
  members: MemberView[];
  users?: Account[];
  areas: Area[];
  onDone: () => void;
}) {
  const [selection, setSelection] = useState<Selection>(empty);
  const [savedMembers, setSavedMembers] = useState<
    Record<
      string,
      {
        value: MemberView;
        previousMembers: MemberView[];
      }
    >
  >({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const saveButton = useRef<HTMLButtonElement>(null);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const summaryId = useId();
  // A successful command returns the new member before the directory refetch.
  function currentMember(userId: string) {
    const saved = savedMembers[userId];
    return saved?.previousMembers === members
      ? saved.value
      : members.find((m) => m.userId === userId);
  }
  const member = currentMember(selection.userId);
  const areaName = (id: string | null) =>
    id
      ? areas.find((a) => a.id === id)?.name ||
        (member?.areaId === id ? member.areaName : null) ||
        "Área no disponible"
      : "Sin área";
  const changes = member
    ? [
        member.role !== selection.role &&
          `Rol: ${roleLabels[member.role]} → ${selection.role ? roleLabels[selection.role] : "Sin seleccionar"}`,
        member.areaId !== selection.areaId &&
          `Área: ${areaName(member.areaId)} → ${areaName(selection.areaId)}`,
        member.active !== selection.active &&
          `Estado: ${member.active ? "Activo" : "Inactivo"} → ${selection.active ? "Activo" : "Inactivo"}`,
      ].filter(Boolean)
    : [];
  const unchanged = !!member && changes.length === 0;
  const summary = !selection.userId
    ? "Selecciona una cuenta."
    : member
      ? changes.join(" · ") || "Sin cambios"
      : selection.role
        ? `Se agregará con rol ${roleLabels[selection.role]} en el área ${areaName(selection.areaId)}.`
        : "Selecciona un rol para agregar esta cuenta.";
  const accounts =
    users?.filter((u) => u.active) ||
    members.map((m) => ({
      id: m.userId,
      displayName: m.displayName,
      active: true,
    }));
  const shownAreas = areas.filter((a) => a.active || a.id === member?.areaId);

  function choose(userId: string) {
    const current = currentMember(userId);
    setSelection(
      current
        ? {
            userId,
            role: current.role,
            areaId: current.areaId,
            active: current.active,
          }
        : { ...empty, userId },
    );
    setErrors({});
    setError("");
    setSuccess(false);
  }
  function update<K extends keyof Selection>(key: K, value: Selection[K]) {
    setSelection((old) => ({ ...old, [key]: value }));
    setErrors((old) => ({ ...old, [key]: "" }));
    setError("");
    setSuccess(false);
  }
  async function save(access: Access) {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError("");
    setSuccess(false);
    try {
      const updated = await api("setMember", { projectId }, access);
      setSavedMembers((old) => ({
        ...old,
        [updated.userId]: { value: updated, previousMembers: members },
      }));
      setSuccess(true);
      setConfirmation(null);
      onDone();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busyRef.current || unchanged) return;
    const nextErrors: Record<string, string> = {};
    if (!selection.userId) nextErrors.userId = "Selecciona una cuenta.";
    if (!selection.role) nextErrors.role = "Selecciona un rol.";
    if (
      selection.active &&
      selection.role === "STAKEHOLDER" &&
      !selection.areaId
    )
      nextErrors.areaId = "Selecciona un área para el participante.";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      (
        event.currentTarget.elements.namedItem(
          Object.keys(nextErrors)[0]!,
        ) as HTMLElement | null
      )?.focus();
      return;
    }
    const access = selection as Access;
    const reasons: string[] = [];
    if (access.role === "ADMIN" && member?.role !== "ADMIN")
      reasons.push("Esta persona tendrá Administración en el proyecto.");
    if (member?.areaId && !access.areaId)
      reasons.push("Esta persona quedará sin área en el proyecto.");
    if (member?.active && !access.active)
      reasons.push("Esta persona dejará de tener acceso al proyecto.");
    // Presentation only: the existing session already knows the account.
    // The backend remains the authority for every permission and command.
    if (
      member?.userId === sessionPresentationUserId() &&
      member?.role === "ADMIN" &&
      member.active &&
      (access.role !== "ADMIN" || !access.active)
    ) {
      reasons.push("Estás quitando tu propio acceso de administración");
      if (
        !members.some(
          (m) => m.userId !== member.userId && m.active && m.role === "ADMIN",
        )
      )
        reasons.push(
          members.length >= 500
            ? "La lista puede estar incompleta. No podemos confirmar si hay otra administración activa; consulta a la administración de la institución antes de continuar."
            : "Eres la única administración activa de este proyecto; después solo la administración de la institución podrá devolverla",
        );
    }
    if (reasons.length) {
      saveButton.current?.focus();
      setConfirmation({ access, summary, reasons });
    } else void save(access);
  }
  const closeConfirmation = () => {
    if (!busyRef.current) {
      setConfirmation(null);
      setError("");
    }
  };
  return (
    <>
      <form onSubmit={submit} noValidate>
        <Select
          label="Usuario"
          name="userId"
          required
          value={selection.userId}
          error={errors.userId}
          disabled={busy}
          onChange={(e) => choose(e.target.value)}
        >
          <option value="">Selecciona una cuenta</option>
          {accounts.map((u) => (
            <option key={u.id} value={u.id}>
              {u.displayName}
              {users && members.some((m) => m.userId === u.id)
                ? " · ya está en el proyecto"
                : ""}
            </option>
          ))}
        </Select>
        <div className="grid2">
          <Select
            label="Rol"
            name="role"
            required
            value={selection.role}
            error={errors.role}
            disabled={busy}
            onChange={(e) =>
              update("role", e.target.value as Selection["role"])
            }
          >
            <option value="">Selecciona un rol</option>
            {roles.map((role) => (
              <option key={role} value={role}>
                {roleLabels[role]}
              </option>
            ))}
          </Select>
          <Select
            label="Área"
            name="areaId"
            hint="Obligatoria para participantes activos."
            value={selection.areaId || ""}
            error={errors.areaId}
            disabled={busy}
            onChange={(e) => update("areaId", e.target.value || null)}
          >
            <option value="">Sin área</option>
            {shownAreas.map((area) => (
              <option key={area.id} value={area.id}>
                {area.name}
              </option>
            ))}
          </Select>
        </div>
        <Checkbox
          label="Acceso al proyecto activo"
          name="active"
          checked={selection.active}
          disabled={busy}
          onChange={(e) => update("active", e.target.checked)}
        />
        <p id={summaryId} aria-live="polite" aria-atomic="true">
          {summary}
        </p>
        {error && !confirmation && <Alert error>{error}</Alert>}
        {success && <Alert>Operación guardada.</Alert>}
        {/* Keep the opener focusable so Dialog can return focus even after saving. */}
        <Button
          ref={saveButton}
          type="submit"
          aria-disabled={busy || unchanged}
          aria-describedby={summaryId}
        >
          {busy ? "Guardando…" : "Guardar acceso al proyecto"}
        </Button>
      </form>
      {confirmation && (
        <Dialog title="Confirmar cambio de acceso" onClose={closeConfirmation}>
          <p>
            {
              accounts.find((u) => u.id === confirmation.access.userId)
                ?.displayName
            }
          </p>
          <p>{confirmation.summary}</p>
          {confirmation.reasons.map((reason) => (
            <p key={reason}>{reason}</p>
          ))}
          {error && <Alert error>{error}</Alert>}
          <Button
            tone="secondary"
            data-autofocus
            disabled={busy}
            onClick={closeConfirmation}
          >
            Cancelar
          </Button>
          <Button
            aria-disabled={busy}
            onClick={() => void save(confirmation.access)}
          >
            {busy ? "Guardando…" : "Confirmar cambio de acceso"}
          </Button>
        </Dialog>
      )}
    </>
  );
}
