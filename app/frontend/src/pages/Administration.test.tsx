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
  role: "ADMIN",
  lockVersion: 1,
  questionCount: 4,
  ...extra,
});
function mount(projects: unknown[]) {
  vi.spyOn(apiModule, "api").mockImplementation((async (key: string) =>
    key === "projects" ? projects : []) as never);
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
    key === "projects" ? [project("a", "Proyecto A")] : []) as never);
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
