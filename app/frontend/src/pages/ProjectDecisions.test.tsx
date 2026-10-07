import { afterEach, expect, it, vi } from "vitest";
import {
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import "@testing-library/jest-dom/vitest";
import { dashboardView } from "@requirements/contracts";
import fixture from "../../../../tests/fixtures/analyst-visual.json";
import { exchangeRequest } from "../api";
import { ProjectDecisions } from "./ProjectDecisions";

vi.mock("../api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../api")>()),
  exchangeRequest: vi.fn(),
}));
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});
const source = dashboardView.parse(fixture.dashboard);
const first = source.questions.find(
  (question) => question.status === "VALIDATED",
)!;
const second = {
  ...first,
  id: "9e45438f-ef07-4a12-b1e4-d289cf7eb9d0",
  externalId: "DEC-2",
  title: "Seguimiento de respuesta",
  areaId: "1a2e222c-ddb9-49b4-8132-b0ad8dd2a2ba",
  areaName: "Equipo de seguimiento",
  sectionId: "f220b3ec-a73d-48d8-af11-2e76d3b80fbc",
  sectionTitle: "Seguimiento",
};
const data = { ...source, questions: [...source.questions, second] };
function LocationProbe() {
  const location = useLocation();
  return (
    <span data-testid="location">
      {JSON.stringify({
        pathname: location.pathname,
        search: location.search,
        state: location.state,
      })}
    </span>
  );
}
function setup(search = "") {
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <MemoryRouter initialEntries={["/projects/project-a/decisions" + search]}>
        <LocationProbe />
        <Routes>
          <Route
            path="/projects/:projectId/decisions"
            element={<ProjectDecisions />}
          />
          <Route
            path="/projects/:projectId/review/:id"
            element={<p>Detalle de la decisión.</p>}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return userEvent.setup();
}

it("lista solo VALIDATED desde la proyección existente y enlaza el detalle real", async () => {
  vi.mocked(exchangeRequest).mockResolvedValue(data);
  setup();
  expect(
    await screen.findByRole("link", { name: first.title }),
  ).toHaveAttribute("href", `/projects/project-a/review/${first.id}`);
  expect(screen.getByRole("link", { name: first.title })).toHaveAttribute(
    "data-workbench-id",
    first.id,
  );
  expect(screen.getByRole("link", { name: second.title })).toBeVisible();
  expect(screen.getByRole("status")).toHaveTextContent("2 decisiones");
  for (const question of source.questions.filter(
    (question) => question.status !== "VALIDATED",
  ))
    expect(
      screen.queryByRole("link", { name: question.title }),
    ).not.toBeInTheDocument();
  expect(exchangeRequest).toHaveBeenCalledExactlyOnceWith(
    "project-a",
    "dashboard",
    dashboardView,
  );
});

it("combina los filtros de URL y conserva su contexto completo al abrir una decisión", async () => {
  vi.mocked(exchangeRequest).mockResolvedValue(data);
  const search = `?q=DEC-2&area=${second.areaId}&section=${second.sectionId}`;
  const user = setup(search);
  const link = await screen.findByRole("link", { name: second.title });
  expect(
    screen.queryByRole("link", { name: first.title }),
  ).not.toBeInTheDocument();
  expect(screen.getByLabelText("Buscar decisiones")).toHaveValue("DEC-2");
  expect(screen.getByLabelText("Área responsable")).toHaveValue(second.areaId);
  expect(screen.getByLabelText("Tema")).toHaveValue(second.sectionId);
  await user.click(link);
  expect(JSON.parse(screen.getByTestId("location").textContent!)).toEqual({
    pathname: `/projects/project-a/review/${second.id}`,
    search: "",
    state: { workbenchReturn: { view: "decisions", search } },
  });
});

it("cambiar y limpiar filtros usa la URL sin otra petición ni eliminar parámetros ajenos", async () => {
  vi.mocked(exchangeRequest).mockResolvedValue(data);
  const user = setup("?source=test");
  await screen.findByRole("link", { name: first.title });
  await user.type(screen.getByLabelText("Buscar decisiones"), "DEC-2");
  expect(
    screen.queryByRole("link", { name: first.title }),
  ).not.toBeInTheDocument();
  expect(screen.getByRole("status")).toHaveTextContent("1 decisión de 2");
  await user.selectOptions(
    screen.getByLabelText("Área responsable"),
    second.areaId,
  );
  await user.click(screen.getByRole("button", { name: "Limpiar filtros" }));
  expect(screen.getByRole("link", { name: first.title })).toBeVisible();
  expect(screen.getByRole("status")).toHaveTextContent("2 decisiones");
  expect(JSON.parse(screen.getByTestId("location").textContent!).search).toBe(
    "?source=test",
  );
  expect(exchangeRequest).toHaveBeenCalledTimes(1);
});

it("distingue ausencia de decisiones de ausencia de coincidencias", async () => {
  vi.mocked(exchangeRequest).mockResolvedValue({
    ...data,
    questions: data.questions.filter(
      (question) => question.status !== "VALIDATED",
    ),
  });
  setup();
  expect(
    await screen.findByRole("heading", {
      name: "Todavía no hay decisiones vigentes.",
    }),
  ).toBeVisible();
  expect(screen.queryByLabelText("Buscar decisiones")).not.toBeInTheDocument();
  cleanup();
  vi.mocked(exchangeRequest).mockResolvedValue(data);
  setup("?area=missing");
  expect(
    await screen.findByRole("heading", {
      name: "No encontramos decisiones con estos filtros.",
    }),
  ).toBeVisible();
  expect(
    within(screen.getByLabelText("Área responsable")).getByRole("option", {
      name: "Área no disponible",
    }),
  ).toHaveProperty("selected", true);
  expect(screen.getByRole("button", { name: "Limpiar filtros" })).toBeVisible();
});

it("un error de carga no se presenta como cero decisiones ni expone navegación privilegiada", async () => {
  vi.mocked(exchangeRequest).mockRejectedValue(
    new Error("No se pudo consultar el proyecto."),
  );
  setup();
  await waitFor(() =>
    expect(screen.getByRole("alert")).toHaveTextContent(
      "No se pudo consultar el proyecto.",
    ),
  );
  expect(screen.queryByText("0 decisiones")).not.toBeInTheDocument();
  expect(
    screen.queryByRole("navigation", { name: "Navegación del proyecto" }),
  ).not.toBeInTheDocument();
});
