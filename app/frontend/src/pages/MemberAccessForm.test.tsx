import { afterEach, beforeAll, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { Members } from "./Administration";
import { MemberAccessForm } from "./MemberAccessForm";
import type { MemberView } from "@requirements/contracts";
import {
  sessionPresentationUserId,
  usePresentationSession,
} from "../session-presentation";
import * as apiModule from "../api";

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute("open");
  };
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
it("precarga el rol, área y estado vigentes al elegir un miembro", async () => {
  vi.spyOn(apiModule, "api").mockImplementation((async (key: string) => {
    if (key === "members")
      return [
        {
          id: "member",
          userId: "carla",
          displayName: "Carla",
          username: "carla",
          role: "ANALYST",
          areaId: "area",
          areaName: "Área revisora",
          active: false,
        },
      ];
    if (key === "areas")
      return [{ id: "area", name: "Área revisora", active: true }];
    if (key === "users")
      throw new Error("Esta acción requiere administración de la institución.");
    return [];
  }) as never);
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <MemoryRouter initialEntries={["/projects/project/members"]}>
        <Routes>
          <Route path="/projects/:projectId/members" element={<Members />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  const user = userEvent.setup();
  await user.selectOptions(await screen.findByLabelText("Usuario"), "carla");
  expect(screen.getByLabelText("Rol")).toHaveValue("ANALYST");
  expect(screen.getByLabelText("Área")).toHaveValue("area");
  expect(screen.getByLabelText("Acceso al proyecto activo")).not.toBeChecked();
});

const reviewer = {
  id: "member-carla",
  userId: "carla",
  displayName: "Carla",
  username: "carla",
  role: "ANALYST" as const,
  areaId: "area",
  areaName: "Área revisora",
  active: true,
};
const administrator = {
  ...reviewer,
  id: "member-ana",
  userId: "ana",
  displayName: "Ana",
  username: "ana",
  role: "ADMIN" as const,
};
const accounts = [reviewer, administrator]
  .map((m) => ({ id: m.userId, displayName: m.displayName, active: true }))
  .concat([{ id: "bruno", displayName: "Bruno", active: true }]);
const areas = [
  { id: "area", name: "Área revisora", active: true },
  { id: "other-area", name: "Área de apoyo", active: true },
];
function SessionProbe({ userId }: { userId?: string }) {
  usePresentationSession(userId, false, false);
  return null;
}
function mountForm(
  members: MemberView[] = [administrator, reviewer],
  currentUser = "ana",
) {
  const onDone = vi.fn();
  const command = vi.spyOn(apiModule, "api").mockImplementation((async (
    _key: string,
    _params: unknown,
    payload: Record<string, unknown>,
  ) => ({
    id: "saved",
    username: payload.userId,
    displayName: accounts.find((a) => a.id === payload.userId)?.displayName,
    areaName: areas.find((a) => a.id === payload.areaId)?.name ?? null,
    ...payload,
  })) as never);
  const view = render(
    <>
      <SessionProbe userId={currentUser} />
      <MemberAccessForm
        projectId="project"
        members={members}
        users={accounts}
        areas={areas}
        onDone={onDone}
      />
    </>,
  );
  return { user: userEvent.setup(), command, onDone, ...view };
}
const save = () =>
  screen.getByRole("button", { name: "Guardar acceso al proyecto" });
const confirm = () =>
  within(screen.getByRole("dialog")).getByRole("button", {
    name: "Confirmar cambio de acceso",
  });

it("una cuenta nueva exige elegir rol y explica el error con su campo", async () => {
  const { user, command } = mountForm();
  await user.selectOptions(screen.getByLabelText("Usuario"), "bruno");
  const role = screen.getByLabelText("Rol");
  expect(role).toHaveValue("");
  expect(screen.getByLabelText("Área")).toHaveValue("");
  await user.click(save());
  expect(command).not.toHaveBeenCalled();
  expect(role).toHaveAttribute("aria-invalid", "true");
  expect(role).toHaveAccessibleDescription("Selecciona un rol.");
  expect(role).toHaveFocus();
  await user.selectOptions(role, "VIEWER");
  expect(role).toHaveAttribute("aria-invalid", "false");
  expect(
    screen.getByText("Se agregará con rol Consulta en el área Sin área."),
  ).toBeVisible();
  await user.click(save());
  expect(command).toHaveBeenCalledWith(
    "setMember",
    { projectId: "project" },
    { userId: "bruno", role: "VIEWER", areaId: null, active: true },
  );
});

it("sin cambios bloquea clic, Enter y envío directo sin perder el foco del botón", async () => {
  const { user, command } = mountForm();
  await user.selectOptions(screen.getByLabelText("Usuario"), "carla");
  expect(screen.getByText("Sin cambios")).toHaveAttribute(
    "aria-live",
    "polite",
  );
  expect(save()).toHaveAttribute("aria-disabled", "true");
  expect(save()).toHaveAccessibleDescription("Sin cambios");
  await user.click(save());
  await user.keyboard("{Enter}");
  fireEvent.submit(save().closest("form")!);
  expect(command).not.toHaveBeenCalled();
  expect(save()).toHaveFocus();
});

it("el directorio identifica miembros existentes y cambiar de cuenta carga los tres valores", async () => {
  const { user } = mountForm([{ ...reviewer, active: false }, administrator]);
  expect(
    screen.getByRole("option", { name: "Carla · ya está en el proyecto" }),
  ).toBeVisible();
  expect(screen.getByRole("option", { name: "Bruno" })).toBeVisible();
  await user.selectOptions(screen.getByLabelText("Usuario"), "carla");
  expect(screen.getByLabelText("Acceso al proyecto activo")).not.toBeChecked();
  await user.selectOptions(screen.getByLabelText("Usuario"), "ana");
  expect(screen.getByLabelText("Rol")).toHaveValue("ADMIN");
  expect(screen.getByLabelText("Área")).toHaveValue("area");
  expect(screen.getByLabelText("Acceso al proyecto activo")).toBeChecked();
});

it("el resumen enumera solo diferencias efectivas y vuelve a Sin cambios al deshacer", async () => {
  const { user } = mountForm();
  await user.selectOptions(screen.getByLabelText("Usuario"), "carla");
  await user.selectOptions(screen.getByLabelText("Rol"), "ADMIN");
  await user.selectOptions(screen.getByLabelText("Área"), "");
  expect(
    screen.getByText(
      "Rol: Analista → Administración · Área: Área revisora → Sin área",
    ),
  ).toHaveAttribute("aria-live", "polite");
  await user.selectOptions(screen.getByLabelText("Rol"), "ANALYST");
  await user.selectOptions(screen.getByLabelText("Área"), "area");
  expect(screen.getByText("Sin cambios")).toBeVisible();
});

it.each([
  [
    "ascenso",
    "Rol",
    "ADMIN",
    "Esta persona tendrá Administración en el proyecto.",
  ],
  ["quitar área", "Área", "", "Esta persona quedará sin área en el proyecto."],
])(
  "%s pide confirmación y cancelar conserva datos y devuelve foco",
  async (_case, label, value, warning) => {
    const { user, command } = mountForm();
    await user.selectOptions(screen.getByLabelText("Usuario"), "carla");
    await user.selectOptions(screen.getByLabelText(label), value);
    await user.click(save());
    expect(screen.getByRole("dialog")).toBeVisible();
    expect(screen.getByText(warning)).toBeVisible();
    expect(screen.getByRole("button", { name: "Cancelar" })).toHaveFocus();
    expect(command).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(save()).toHaveFocus();
    expect(command).not.toHaveBeenCalled();
  },
);

it("desactivar pide confirmación antes de guardar el acceso inactivo", async () => {
  const { user, command } = mountForm();
  await user.selectOptions(screen.getByLabelText("Usuario"), "carla");
  await user.click(screen.getByLabelText("Acceso al proyecto activo"));
  await user.click(save());
  expect(
    screen.getByText("Esta persona dejará de tener acceso al proyecto."),
  ).toBeVisible();
  expect(command).not.toHaveBeenCalled();
  await user.click(confirm());
  expect(command).toHaveBeenCalledWith(
    "setMember",
    { projectId: "project" },
    { userId: "carla", role: "ANALYST", areaId: "area", active: false },
  );
  expect(await screen.findByText("Operación guardada.")).toBeVisible();
  expect(save()).toHaveFocus();
  expect(save()).toHaveAttribute("aria-disabled", "true");
});

it.each([false, true])(
  "quitarse Administración avisa; otra administración activa: %s",
  async (another) => {
    const members: MemberView[] = [administrator, reviewer];
    if (another)
      members.push({
        ...administrator,
        id: "member-dora",
        userId: "dora",
        displayName: "Dora",
      });
    const { user, command } = mountForm(members);
    await user.selectOptions(screen.getByLabelText("Usuario"), "ana");
    await user.selectOptions(screen.getByLabelText("Rol"), "VIEWER");
    await user.click(save());
    expect(
      screen.getByText("Estás quitando tu propio acceso de administración"),
    ).toBeVisible();
    const last = screen.queryByText(
      "Eres la única administración activa de este proyecto; después solo la administración de la institución podrá devolverla",
    );
    if (another) expect(last).toBeNull();
    else expect(last).toBeVisible();
    expect(command).not.toHaveBeenCalled();
  },
);

it("desactivar el propio acceso avisa aunque se conserve el rol Administración", async () => {
  const { user } = mountForm([
    administrator,
    { ...administrator, id: "inactive", userId: "other", active: false },
  ]);
  await user.selectOptions(screen.getByLabelText("Usuario"), "ana");
  await user.click(screen.getByLabelText("Acceso al proyecto activo"));
  await user.click(save());
  expect(
    screen.getByText("Estás quitando tu propio acceso de administración"),
  ).toBeVisible();
  expect(screen.getByText(/Eres la única administración activa/)).toBeVisible();
});

it("cambiar área a otra válida guarda sin confirmación y conserva el rol", async () => {
  const { user, command } = mountForm();
  await user.selectOptions(screen.getByLabelText("Usuario"), "carla");
  await user.selectOptions(screen.getByLabelText("Área"), "other-area");
  await user.click(save());
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(command).toHaveBeenCalledWith(
    "setMember",
    { projectId: "project" },
    { userId: "carla", role: "ANALYST", areaId: "other-area", active: true },
  );
  expect(await screen.findByText("Sin cambios")).toBeVisible();
});

it("la validación de área para participante activo sigue impidiendo el envío", async () => {
  const { user, command } = mountForm();
  await user.selectOptions(screen.getByLabelText("Usuario"), "bruno");
  await user.selectOptions(screen.getByLabelText("Rol"), "STAKEHOLDER");
  await user.click(save());
  expect(screen.getByLabelText("Área")).toHaveAccessibleDescription(
    "Selecciona un área para el participante.",
  );
  expect(screen.getByLabelText("Área")).toHaveFocus();
  expect(command).not.toHaveBeenCalled();
});

it("un error del servidor conserva el cambio propuesto y permite cerrar el diálogo", async () => {
  const { user, command } = mountForm();
  command.mockRejectedValueOnce(
    new Error("Retira primero las asignaciones activas de este participante."),
  );
  await user.selectOptions(screen.getByLabelText("Usuario"), "carla");
  await user.selectOptions(screen.getByLabelText("Rol"), "ADMIN");
  await user.click(save());
  await user.click(confirm());
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Retira primero las asignaciones activas",
  );
  expect(screen.getByRole("dialog")).toBeVisible();
  await user.click(screen.getByRole("button", { name: "Cerrar" }));
  expect(save()).toHaveFocus();
  expect(screen.getByLabelText("Rol")).toHaveValue("ADMIN");
});

it("la identidad de presentación se limpia al cerrar o cambiar de sesión sin consultas", () => {
  const view = render(<SessionProbe userId="ana" />);
  expect(sessionPresentationUserId()).toBe("ana");
  view.rerender(<SessionProbe userId="carla" />);
  expect(sessionPresentationUserId()).toBe("carla");
  view.rerender(<SessionProbe />);
  expect(sessionPresentationUserId()).toBeNull();
  view.unmount();
  expect(sessionPresentationUserId()).toBeNull();
});

it("una actualización de members prevalece sobre el resultado anterior del guardado", async () => {
  const { user, rerender, onDone } = mountForm();
  await user.selectOptions(screen.getByLabelText("Usuario"), "carla");
  await user.selectOptions(screen.getByLabelText("Área"), "other-area");
  await user.click(save());
  expect(await screen.findByText("Sin cambios")).toBeVisible();
  rerender(
    <>
      <SessionProbe userId="ana" />
      <MemberAccessForm
        projectId="project"
        members={[
          administrator,
          {
            ...reviewer,
            role: "VIEWER",
            areaId: "other-area",
            areaName: "Área de apoyo",
          },
        ]}
        users={accounts}
        areas={areas}
        onDone={onDone}
      />
    </>,
  );
  expect(screen.getByText("Rol: Consulta → Analista")).toBeVisible();
  await user.selectOptions(screen.getByLabelText("Usuario"), "ana");
  await user.selectOptions(screen.getByLabelText("Usuario"), "carla");
  expect(screen.getByLabelText("Rol")).toHaveValue("VIEWER");
  expect(screen.getByText("Sin cambios")).toBeVisible();
});

it("confirmar dos veces mientras se guarda envía una sola operación", async () => {
  const { user, command } = mountForm();
  let finish!: (member: MemberView) => void;
  command.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }) as never,
  );
  await user.selectOptions(screen.getByLabelText("Usuario"), "carla");
  await user.selectOptions(screen.getByLabelText("Rol"), "ADMIN");
  await user.click(save());
  const confirmationButton = confirm();
  await user.click(confirmationButton);
  await user.click(confirmationButton);
  expect(command).toHaveBeenCalledTimes(1);
  expect(confirmationButton).toHaveAttribute("aria-disabled", "true");
  finish({ ...reviewer, role: "ADMIN" });
  expect(await screen.findByText("Operación guardada.")).toBeVisible();
});

it("con 500 miembros no afirma que la propia administración es la única", async () => {
  const many: MemberView[] = [
    administrator,
    ...Array.from({ length: 499 }, (_, index) => ({
      ...reviewer,
      id: `member-${index}`,
      userId: `person-${index}`,
    })),
  ];
  const { user, command } = mountForm(many);
  await user.selectOptions(screen.getByLabelText("Usuario"), "ana");
  await user.selectOptions(screen.getByLabelText("Rol"), "VIEWER");
  await user.click(save());
  expect(
    screen.getByText("Estás quitando tu propio acceso de administración"),
  ).toBeVisible();
  expect(
    screen.getByText(
      "La lista puede estar incompleta. No podemos confirmar si hay otra administración activa; consulta a la administración de la institución antes de continuar.",
    ),
  ).toBeVisible();
  expect(screen.queryByText(/Eres la única administración activa/)).toBeNull();
  expect(command).not.toHaveBeenCalled();
});

it("volver a una cuenta recién guardada conserva lo confirmado mientras tarda la recarga", async () => {
  const { user } = mountForm();
  await user.selectOptions(screen.getByLabelText("Usuario"), "carla");
  await user.selectOptions(screen.getByLabelText("Área"), "other-area");
  await user.click(save());
  expect(await screen.findByText("Operación guardada.")).toBeVisible();
  await user.selectOptions(screen.getByLabelText("Usuario"), "ana");
  await user.selectOptions(screen.getByLabelText("Usuario"), "carla");
  expect(screen.getByLabelText("Área")).toHaveValue("other-area");
  expect(screen.getByLabelText("Rol")).toHaveValue("ANALYST");
  expect(screen.getByText("Sin cambios")).toBeVisible();
  expect(save()).toHaveAttribute("aria-disabled", "true");
});
