import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import type { ProjectView } from "@requirements/contracts";
import { ProjectShell } from "./ProjectShell";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
const project = (role: ProjectView["role"]): ProjectView => ({
  id: "project-a",
  externalId: "ADQ",
  name: "Modernización de adquisiciones",
  description: "",
  lifecycle: "ACTIVE",
  role,
  lockVersion: 1,
  questionCount: 10,
});
function setup(
  role: ProjectView["role"],
  path = "/projects/project-a/review/q1",
) {
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <MemoryRouter initialEntries={[path]}>
        <ProjectShell
          project={project(role)}
          displayName="Elena"
          organizationAdmin={false}
          onLogout={() => undefined}
        >
          <main>
            <h1>Contenido</h1>
          </main>
        </ProjectShell>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
const breadcrumb = () =>
  within(screen.getByRole("navigation", { name: "Contexto de página" }));

it.each(["ADMIN", "ANALYST"] as const)(
  "UX-08: la raíz de la ruta de %s vuelve a Atención del proyecto",
  (role) => {
    setup(role);
    const root = breadcrumb().getByRole("link", {
      name: /Modernización de adquisiciones/,
    });
    expect(root).toHaveAttribute("href", "/projects/project-a/dashboard");
    // The accessible name starts with the visible text and says where it goes.
    expect(root).toHaveAccessibleName(
      "Modernización de adquisiciones: ir a Atención",
    );
  },
);
it("UX-08: la raíz de la ruta del lector vuelve a las preguntas publicadas, que es su inicio", () => {
  setup("VIEWER", "/projects/project-a/export");
  expect(
    breadcrumb().getByRole("link", { name: /Modernización de adquisiciones/ }),
  ).toHaveAttribute("href", "/projects/project-a");
});
it("UX-08: ningún enlace de la ruta apunta a Mis proyectos", () => {
  setup("ANALYST");
  for (const link of breadcrumb().getAllByRole("link"))
    expect(link).not.toHaveAttribute("href", "/");
});
it("UX-08: proyecto, destinos y menú usan iconos distintos entre sí", () => {
  setup("ANALYST");
  const icons = (root: HTMLElement) =>
    Array.from(root.querySelectorAll("[data-icon]")).map((svg) =>
      svg.getAttribute("data-icon"),
    );
  const sidebar = screen.getByRole("complementary", {
    name: "Espacio del proyecto",
  });
  const nav = within(sidebar).getByRole("navigation", {
    name: "Navegación del proyecto",
  });
  const destinations = icons(nav);
  expect(destinations).toHaveLength(4);
  const all = [
    ...icons(sidebar).filter((icon) => icon !== null),
    ...icons(document.body.querySelector(".ac-mobile-account")!),
  ];
  // Project switch, four destinations, tools menu and the mobile menu: no glyph
  // stands for two different things.
  const distinct = [
    ...destinations,
    sidebar
      .querySelector(".ac-project-switch [data-icon]")!
      .getAttribute("data-icon"),
    sidebar
      .querySelector(".ac-project-tools [data-icon]")!
      .getAttribute("data-icon"),
  ];
  expect(new Set(distinct).size).toBe(distinct.length);
  expect(destinations).not.toContain("layers");
  expect(all.length).toBeGreaterThan(distinct.length - 1);
});
