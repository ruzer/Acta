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
import { MemoryRouter, Route, Routes } from "react-router-dom";
import "@testing-library/jest-dom/vitest";
import { dashboardView, historyView } from "@requirements/contracts";
import fixture from "../../../../tests/fixtures/analyst-visual.json";
import { exchangeRequest } from "../api";
import { History } from "./Visibility";

vi.mock("../api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../api")>()),
  exchangeRequest: vi.fn(),
}));
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});
const dashboard = dashboardView.parse(fixture.dashboard);
const question = dashboard.questions[0]!;
const actor = "00000000-0000-4000-8000-000000000009";
const event = (n: number, extra: Record<string, unknown> = {}) => ({
  id: `00000000-0000-4000-8000-0000000001${String(n).padStart(2, "0")}`,
  actorId: actor,
  actorName: "Analista de ejemplo",
  action: "RESPONSE_VALIDATED",
  objectType: "Question",
  objectId: question.id,
  occurredAt: "2026-10-12T08:21:20.473Z",
  requestId: "req",
  exportType: null,
  scope: null,
  ...extra,
});
function history(items: unknown[], total = items.length) {
  return historyView.parse({
    items,
    total,
    page: 1,
    pageSize: 25,
    actors: [{ id: actor, displayName: "Analista de ejemplo" }],
  });
}
function serve(log: unknown, dashboardFails = false) {
  vi.mocked(exchangeRequest).mockImplementation((async (
    _project: string,
    operation: string,
  ) => {
    if (operation === "history") return log;
    if (dashboardFails) throw new Error("sin acceso");
    return dashboard;
  }) as never);
}
function setup() {
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <MemoryRouter initialEntries={["/projects/project-a/history"]}>
        <Routes>
          <Route path="/projects/:projectId/history" element={<History />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return userEvent.setup();
}

it("una pregunta de la bitácora se nombra y enlaza a su revisión en vez de mostrar su identificador", async () => {
  serve(history([event(1)]));
  setup();
  const link = await screen.findByRole("link", {
    name: `${question.externalId} · ${question.title}`,
  });
  expect(link).toHaveAttribute(
    "href",
    `/projects/project-a/review/${question.id}`,
  );
  expect(screen.queryByText("Identificador")).not.toBeInTheDocument();
});
it("lo que no se puede nombrar conserva su identificador, también si no se carga el proyecto", async () => {
  serve(
    history([
      event(1, { objectType: "Response", action: "RESPONSE_SUBMITTED" }),
      event(2),
    ]),
    true,
  );
  setup();
  await screen.findByRole("table", { name: "Eventos registrados" });
  await waitFor(() =>
    expect(screen.getAllByText("Identificador")).toHaveLength(2),
  );
  expect(screen.queryByRole("link")).not.toBeInTheDocument();
});
it("Objeto y Acción se eligen con nombres en español y piden el código al servidor", async () => {
  serve(history([event(1)]));
  const user = setup();
  const action = await screen.findByLabelText("Acción");
  expect(action.tagName).toBe("SELECT");
  expect(
    within(action).getByRole("option", { name: "Cuestionario importado" }),
  ).toHaveValue("PROJECT_IMPORTED");
  expect(
    within(screen.getByLabelText("Objeto")).getByRole("option", {
      name: "Pregunta",
    }),
  ).toHaveValue("Question");
  await user.selectOptions(action, "Cuestionario importado");
  await waitFor(() =>
    expect(exchangeRequest).toHaveBeenLastCalledWith(
      "project-a",
      "history",
      historyView,
      { query: { action: "PROJECT_IMPORTED" } },
    ),
  );
});
it("la columna Detalle solo aparece si algún evento la usa y la paginación dice cuántas páginas hay", async () => {
  serve(history([event(1)], 60));
  setup();
  await screen.findByRole("table", { name: "Eventos registrados" });
  expect(
    screen.queryByRole("columnheader", { name: "Detalle" }),
  ).not.toBeInTheDocument();
  expect(screen.getByText("Página 1 de 3")).toBeVisible();
  cleanup();
  serve(
    history([
      event(2, {
        action: "EXPORT_CREATED",
        objectType: "Project",
        exportType: "JSON",
        scope: "full",
      }),
    ]),
  );
  setup();
  expect(
    await screen.findByRole("columnheader", { name: "Detalle" }),
  ).toBeVisible();
  expect(screen.getByText("JSON full")).toBeVisible();
});
