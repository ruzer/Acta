import { afterEach, beforeAll, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import type { Me } from "@requirements/contracts";
import * as apiModule from "../api";
import { Administration, Members } from "./Administration";

beforeAll(() => {
  // jsdom has no modal dialogs; the app code under test is unchanged.
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
const me = {
  user: { isOrganizationAdmin: true },
  organization: { name: "Organización de ejemplo" },
} as unknown as Me;
const project = (id: string, name: string, extra = {}) => ({
  id,
  externalId: `EXT-${id}`,
  name,
  description: "",
  lifecycle: "ACTIVE",
  myRole: "ADMIN",
  admins: ["Ana Admin"],
  adminCount: 1,
  memberCount: 3,
  ...extra,
});
function mount(projects: unknown[]) {
  vi.spyOn(apiModule, "api").mockImplementation((async (key: string) =>
    key === "organizationProjects" ? projects : []) as never);
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <MemoryRouter>
        <Administration me={me} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return userEvent.setup();
}
it("Proyectos lista cada proyecto con su identificador y accesos directos a abrirlo y a sus miembros", async () => {
  const user = mount([
    project("a", "Proyecto A"),
    project("b", "Proyecto B", { lifecycle: "ARCHIVED" }),
  ]);
  await user.click(screen.getByRole("button", { name: "Proyectos" }));
  const table = await screen.findByRole("table", { name: "Proyectos" });
  expect(table).toBeVisible();
  expect(screen.getByText("EXT-a", { selector: "code" })).toBeVisible();
  expect(
    screen.getByRole("link", { name: "Abrir Proyecto A" }),
  ).toHaveAttribute("href", "/projects/a/dashboard");
  expect(
    screen.getByRole("link", { name: "Miembros de Proyecto A" }),
  ).toHaveAttribute("href", "/projects/a/members");
  expect(screen.getByText(/Archivado/)).toBeVisible();
});
it("Proyectos muestra los de toda la institución, también los ajenos y los sin administrador, sin ofrecer abrirlos", async () => {
  const user = mount([
    project("a", "Proyecto mío"),
    project("b", "Proyecto ajeno", {
      myRole: null,
      admins: ["Beto Admin", "Carla Admin"],
      adminCount: 7,
    }),
    project("c", "Proyecto huérfano", {
      myRole: null,
      admins: [],
      adminCount: 0,
    }),
  ]);
  await user.click(screen.getByRole("button", { name: "Proyectos" }));
  await screen.findByRole("table", { name: "Proyectos" });
  // The other administrator's project is there, with who runs it and no access of mine.
  expect(screen.getByText("Proyecto ajeno")).toBeVisible();
  expect(screen.getByText("Beto Admin, Carla Admin y 5 más")).toBeVisible();
  expect(screen.getAllByText("Sin acceso")).toHaveLength(2);
  // Listing it does not open it: only its members page is offered.
  expect(
    screen.queryByRole("link", { name: "Abrir Proyecto ajeno" }),
  ).not.toBeInTheDocument();
  expect(
    screen.getByRole("link", { name: "Miembros de Proyecto ajeno" }),
  ).toHaveAttribute("href", "/projects/b/members");
  // A project nobody runs is flagged so it can be given an administrator.
  expect(screen.getByText("Sin administrador activo")).toBeVisible();
  expect(
    screen.getByRole("link", { name: "Miembros de Proyecto huérfano" }),
  ).toBeVisible();
  expect(screen.getByText(/no da acceso a sus respuestas/)).toBeVisible();
});
it("sin proyectos, la pestaña dice cómo crear el primero", async () => {
  const user = mount([]);
  await user.click(screen.getByRole("button", { name: "Proyectos" }));
  expect(
    await screen.findByRole("heading", { name: "Todavía no hay proyectos" }),
  ).toBeVisible();
  expect(screen.getByText(/Crea el primero con/)).toBeVisible();
});
it("la acción de cada cuenta dice qué hace y a quién: restablecer su contraseña", async () => {
  vi.spyOn(apiModule, "api").mockImplementation((async (key: string) =>
    key === "users"
      ? [
          {
            id: "u1",
            username: "analista",
            displayName: "Analista de ejemplo",
            active: true,
            mustChangePassword: false,
            isOrganizationAdmin: false,
            areaName: null,
          },
        ]
      : []) as never);
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <MemoryRouter>
        <Administration me={me} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  const user = userEvent.setup();
  await user.click(
    await screen.findByRole("button", {
      name: "Restablecer contraseña de Analista de ejemplo",
    }),
  );
  expect(
    screen.getByRole("dialog", {
      name: "Restablecer contraseña · Analista de ejemplo",
    }),
  ).toBeVisible();
});

function mountApp(
  entries: Parameters<typeof MemoryRouter>[0]["initialEntries"],
) {
  vi.spyOn(apiModule, "api").mockImplementation((async (key: string) =>
    key === "organizationProjects"
      ? [project("a", "Proyecto A")]
      : []) as never);
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <MemoryRouter initialEntries={entries}>
        <Routes>
          <Route path="/admin" element={<Administration me={me} />} />
          <Route path="/projects/:projectId/members" element={<Members />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return userEvent.setup();
}
it("los miembros de un proyecto abierto desde Administración vuelven a esa lista de proyectos", async () => {
  const user = mountApp(["/admin"]);
  await user.click(screen.getByRole("button", { name: "Proyectos" }));
  await user.click(
    await screen.findByRole("link", { name: "Miembros de Proyecto A" }),
  );
  const back = await screen.findByRole("link", { name: "← Administración" });
  expect(back).toHaveAttribute("href", "/admin");
  // The administration may not belong to the project, so the page says which one it is.
  expect(
    await screen.findByRole("heading", { name: "Miembros de Proyecto A" }),
  ).toBeVisible();
  expect(
    screen.queryByRole("link", { name: "← Cuestionario" }),
  ).not.toBeInTheDocument();
  await user.click(back);
  // Back on the list it was opened from, not on the first tab.
  expect(await screen.findByRole("table", { name: "Proyectos" })).toBeVisible();
});
it("los miembros abiertos desde el proyecto siguen volviendo al cuestionario", async () => {
  mountApp(["/projects/a/members"]);
  expect(
    await screen.findByRole("link", { name: "← Cuestionario" }),
  ).toHaveAttribute("href", "/projects/a/editor");
  expect(
    screen.queryByRole("link", { name: "← Administración" }),
  ).not.toBeInTheDocument();
});

const area = (id: string, name: string, active = true) => ({
  id,
  code: `COD-${id}`,
  name,
  active,
});
function mountAreas(areas: unknown[]) {
  const calls: unknown[][] = [];
  vi.spyOn(apiModule, "api").mockImplementation((async (
    key: string,
    ...rest: unknown[]
  ) => {
    if (key === "areas") return areas;
    if (key === "updateArea") {
      calls.push(rest);
      return areas[0];
    }
    return [];
  }) as never);
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <MemoryRouter>
        <Administration me={me} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return { user: userEvent.setup(), calls };
}

it("Áreas muestra las activas y deja consultar las desactivadas sin mezclarlas", async () => {
  const { user } = mountAreas([
    area("a", "Recursos Humanos"),
    area("b", "Área anterior", false),
  ]);
  await user.click(screen.getByRole("button", { name: "Áreas" }));
  expect(await screen.findByText("Recursos Humanos")).toBeVisible();
  expect(screen.getByText("Activa")).toBeVisible();
  expect(screen.queryByText("Área anterior")).not.toBeInTheDocument();
  await user.click(
    screen.getByRole("checkbox", { name: "Mostrar áreas desactivadas (1)" }),
  );
  expect(screen.getByText("Área anterior")).toBeVisible();
  expect(screen.getByText("Desactivada")).toBeVisible();
  // A deactivated area offers its way back, an active one its way out.
  expect(
    screen.getByRole("button", { name: "Reactivar Área anterior" }),
  ).toBeVisible();
  expect(
    screen.getByRole("button", { name: "Desactivar Recursos Humanos" }),
  ).toBeVisible();
});

it("renombrar un área envía solo el nombre, sin tocar el código", async () => {
  const { user, calls } = mountAreas([area("a", "Por confirmar")]);
  await user.click(screen.getByRole("button", { name: "Áreas" }));
  await user.click(
    await screen.findByRole("button", { name: "Renombrar Por confirmar" }),
  );
  const name = screen.getByLabelText("Nombre del área");
  expect(name).toHaveValue("Por confirmar");
  await user.clear(name);
  await user.type(name, "Dirección de Recursos Humanos");
  await user.click(screen.getByRole("button", { name: "Guardar nombre" }));
  await vi.waitFor(() => expect(calls).toHaveLength(1));
  expect(calls[0]).toEqual([
    { id: "a" },
    { name: "Dirección de Recursos Humanos" },
  ]);
});

it("desactivar explica que lo existente se conserva y reactivar la devuelve", async () => {
  const { user, calls } = mountAreas([area("a", "Finanzas")]);
  await user.click(screen.getByRole("button", { name: "Áreas" }));
  await user.click(
    await screen.findByRole("button", { name: "Desactivar Finanzas" }),
  );
  expect(
    screen.getByText(/se conserva y sigue funcionando/, { exact: false }),
  ).toBeVisible();
  expect(calls).toHaveLength(0);
  await user.click(
    screen.getByRole("button", { name: "Confirmar desactivación" }),
  );
  await vi.waitFor(() => expect(calls).toHaveLength(1));
  expect(calls[0]).toEqual([{ id: "a" }, { active: false }]);
});

it("reactivar un área desactivada envía solo el estado", async () => {
  const { user, calls } = mountAreas([area("a", "Finanzas", false)]);
  await user.click(screen.getByRole("button", { name: "Áreas" }));
  await user.click(
    await screen.findByRole("checkbox", {
      name: "Mostrar áreas desactivadas (1)",
    }),
  );
  await user.click(screen.getByRole("button", { name: "Reactivar Finanzas" }));
  await user.click(
    screen.getByRole("button", { name: "Confirmar reactivación" }),
  );
  await vi.waitFor(() => expect(calls).toHaveLength(1));
  expect(calls[0]).toEqual([{ id: "a" }, { active: true }]);
});
