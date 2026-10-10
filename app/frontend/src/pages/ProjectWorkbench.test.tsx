import type { ComponentProps } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import "@testing-library/jest-dom/vitest";
import { ProjectWorkbench } from "./ProjectWorkbench";
import {
  ProjectNavigation,
  ProjectToolsMenu,
} from "../shell/ProjectNavigation";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
function setup(
  overrides: Partial<ComponentProps<typeof ProjectWorkbench>> = {},
) {
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <MemoryRouter
        initialEntries={[
          overrides.active === "invitations"
            ? "/projects/project-a/invitations"
            : "/projects/project-a/editor",
        ]}
      >
        <ProjectNavigation projectId="project-a" role={overrides.role} />
        <ProjectToolsMenu projectId="project-a" role={overrides.role} />
        <ProjectWorkbench
          projectId="project-a"
          projectName="Proyecto de prueba"
          active="questionnaire"
          {...overrides}
        >
          <p>Contenido del proyecto.</p>
        </ProjectWorkbench>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return userEvent.setup();
}

it.each(["ADMIN", "ANALYST"] as const)(
  "%s tiene navegación estable y acceso permanente a invitaciones",
  async (role) => {
    const user = setup({ role });
    const nav = within(
      screen.getByRole("navigation", { name: "Navegación del proyecto" }),
    );
    expect(nav.getByRole("link", { name: "Atención" })).toHaveAttribute(
      "href",
      "/projects/project-a/dashboard",
    );
    expect(nav.getByRole("link", { name: "Cuestionario" })).toHaveAttribute(
      "href",
      "/projects/project-a/editor",
    );
    expect(nav.getByRole("link", { name: "Decisiones" })).toHaveAttribute(
      "href",
      "/projects/project-a/decisions",
    );
    expect(nav.getByRole("link", { name: "Cuestionario" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "Invitaciones" })).toHaveAttribute(
      "href",
      "/projects/project-a/invitations",
    );
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByText("Contenido del proyecto.")).toBeVisible();
    if (role === "ADMIN") {
      await user.click(screen.getByText("Más herramientas"));
      expect(screen.getByRole("link", { name: "Miembros" })).toHaveAttribute(
        "href",
        "/projects/project-a/members",
      );
    } else
      expect(
        screen.queryByRole("link", { name: "Miembros" }),
      ).not.toBeInTheDocument();
  },
);

it("sin rol verificado no muestra acciones ni destinos privilegiados", () => {
  setup();
  expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
  expect(
    screen.queryAllByRole("link").map((link) => link.getAttribute("href")),
  ).toEqual([]);
});

it("VIEWER conserva consulta y exportación sin acceso al workbench de analistas", async () => {
  const user = setup({ role: "VIEWER", compact: true });
  expect(
    screen.getByRole("link", { name: "Proyecto de prueba" }),
  ).toHaveAttribute("href", "/projects/project-a");
  expect(
    screen.queryByRole("navigation", { name: "Navegación del proyecto" }),
  ).not.toBeInTheDocument();
  await user.click(screen.getByText("Más herramientas"));
  expect(
    screen.getByRole("link", { name: "Preguntas publicadas" }),
  ).toHaveAttribute("href", "/projects/project-a");
  expect(
    screen.getByRole("link", { name: "Exportar decisiones vigentes" }),
  ).toHaveAttribute("href", "/projects/project-a/export");
  for (const label of [
    "Atención",
    "Cuestionario",
    "Decisiones",
    "Invitaciones",
    "Miembros",
    "Importar estructura",
    "Trazabilidad",
    "Bitácora",
  ])
    expect(screen.queryByRole("link", { name: label })).not.toBeInTheDocument();
});

it("compacto mantiene nombre como enlace y no agrega otro h1 al detalle", () => {
  setup({ role: "ANALYST", compact: true });
  expect(
    screen.getByRole("link", { name: "Proyecto de prueba" }),
  ).toHaveAttribute("href", "/projects/project-a/editor");
  expect(screen.queryByRole("heading", { level: 1 })).not.toBeInTheDocument();
  expect(
    screen.queryByRole("link", { name: /Mis proyectos/ }),
  ).not.toBeInTheDocument();
});

it("las herramientas secundarias se cierran con Escape y devuelven el foco", async () => {
  const user = setup({ role: "ADMIN" });
  const summary = screen.getByText("Más herramientas").closest("summary")!;
  await user.click(summary);
  const tool = screen.getByRole("link", { name: "Trazabilidad" });
  expect(tool).toBeVisible();
  tool.focus();
  await user.keyboard("{Escape}");
  expect(summary.closest("details")).not.toHaveAttribute("open");
  expect(summary).toHaveFocus();
});

it("una invitación activa se identifica sin marcar otro destino principal", () => {
  setup({ role: "ANALYST", active: "invitations" });
  expect(screen.getByRole("link", { name: "Invitaciones" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  for (const link of within(
    screen.getByRole("navigation", { name: "Navegación del proyecto" }),
  ).getAllByRole("link"))
    if (link.textContent !== "Invitaciones")
      expect(link).not.toHaveAttribute("aria-current");
});

it.each([
  ["decisions", "Decisiones"],
  ["invitations", "Invitaciones"],
  ["attention", "Atención"],
  ["questionnaire", "Cuestionario"],
] as const)(
  "UX-02: %s tiene un único h1 con el nombre de la página, no el del proyecto",
  (active, title) => {
    setup({ role: "ANALYST", active });
    const headings = screen.getAllByRole("heading", { level: 1 });
    expect(headings).toHaveLength(1);
    expect(headings[0]).toHaveTextContent(title);
    expect(headings[0]).not.toHaveTextContent("Proyecto de prueba");
  },
);
it("CP7: la página puede decir para qué sirve y ofrecer su acción principal sin otro h1", () => {
  setup({
    role: "ANALYST",
    active: "invitations",
    lead: "Enlaces para que personas externas respondan preguntas concretas.",
    actions: <button type="button">Crear invitación</button>,
  });
  const headings = screen.getAllByRole("heading", { level: 1 });
  expect(headings).toHaveLength(1);
  expect(headings[0]).toHaveTextContent("Invitaciones");
  const header = headings[0]!.closest("header")!;
  expect(
    within(header).getByText(
      "Enlaces para que personas externas respondan preguntas concretas.",
    ),
  ).toBeVisible();
  expect(
    within(header).getByRole("button", { name: "Crear invitación" }),
  ).toBeVisible();
});
