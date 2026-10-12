import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import type { Me } from "@requirements/contracts";
import * as apiModule from "../api";
import { Administration } from "./Administration";

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
