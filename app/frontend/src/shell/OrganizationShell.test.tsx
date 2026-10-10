import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";
import { MemoryRouter } from "react-router-dom";
import { OrganizationShell } from "./OrganizationShell";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
function setup(path: string, organizationAdmin: boolean) {
  const logout = vi.fn();
  render(
    <MemoryRouter initialEntries={[path]}>
      <OrganizationShell
        displayName="Elena"
        organizationAdmin={organizationAdmin}
        onLogout={logout}
      >
        <main>
          <h1>Contenido</h1>
        </main>
      </OrganizationShell>
    </MemoryRouter>,
  );
  return logout;
}
const destinations = () =>
  within(
    screen.getAllByRole("navigation", { name: "Navegación principal" })[0]!,
  );

it("CP7: quien administra ve Mis proyectos y Administración, y la página actual queda marcada", () => {
  setup("/admin", true);
  const links = destinations().getAllByRole("link");
  expect(links.map((link) => link.textContent)).toEqual([
    "Mis proyectos",
    "Administración",
  ]);
  expect(
    destinations().getByRole("link", { name: "Administración" }),
  ).toHaveAttribute("aria-current", "page");
  expect(
    destinations().getByRole("link", { name: "Mis proyectos" }),
  ).not.toHaveAttribute("aria-current");
});
it("CP7: sin administración solo existe el destino de proyectos; no se inventa otro", () => {
  setup("/", false);
  expect(destinations().getAllByRole("link")).toHaveLength(1);
  expect(
    screen.queryByRole("link", { name: "Administración" }),
  ).not.toBeInTheDocument();
});
it("CP7: el contexto de página nombra la pantalla sin llevar el nombre de un proyecto", () => {
  setup("/review", false);
  const context = within(
    screen.getByRole("navigation", { name: "Contexto de página" }),
  );
  expect(context.getByText("Revisar respuestas")).toBeVisible();
});
it("CP7: una dirección desconocida se nombra como tal y la cuenta sigue disponible", async () => {
  const logout = setup("/no-existe", false);
  const context = within(
    screen.getByRole("navigation", { name: "Contexto de página" }),
  );
  expect(context.getByText("Página no encontrada")).toBeVisible();
  expect(
    screen.getAllByRole("link", { name: "Mi contraseña" })[0],
  ).toHaveAttribute("href", "/password");
  await userEvent.click(
    screen.getAllByRole("button", { name: "Cerrar sesión" })[0]!,
  );
  expect(logout).toHaveBeenCalledOnce();
});
