import { afterEach, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { questionnaireView, dashboardView } from "@requirements/contracts";
import fixture from "../../../../tests/fixtures/analyst-visual.json";
import { api, exchangeRequest } from "../api";
import { Editor } from "./Editor";
vi.mock("../api", () => ({ api: vi.fn(), exchangeRequest: vi.fn() }));
vi.mock("./ProjectWorkbench", () => ({
  ProjectWorkbench: ({ children }: { children: React.ReactNode }) => (
    <main>{children}</main>
  ),
}));
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.resetAllMocks();
});
const data = questionnaireView.parse(fixture.questionnaire);
function page(search = "") {
  vi.mocked(api).mockImplementation(
    async (key) => (key === "questionnaire" ? data : []) as never,
  );
  vi.mocked(exchangeRequest).mockResolvedValue(
    dashboardView.parse(fixture.dashboard),
  );
  const router = createMemoryRouter(
    [
      { path: "/projects/:projectId/editor", element: <Editor /> },
      { path: "/other", element: <p>Otra vista</p> },
    ],
    { initialEntries: [`/projects/${fixture.projectId}/editor${search}`] },
  );
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return router;
}
it("restaura los filtros y Analizar desde la URL, sin guardar selección masiva en ella", async () => {
  const router = page(
    "?mode=organize&approach=analyze&q=Consulta&publication=PUBLISHED",
  );
  expect(
    await screen.findByRole("button", { name: "Analizar" }),
  ).toHaveAttribute("aria-pressed", "true");
  expect(screen.getByLabelText("Buscar preguntas")).toHaveValue("Consulta");
  expect(screen.getByLabelText("Estado de publicación")).toHaveValue(
    "PUBLISHED",
  );
  expect(router.state.location.search).not.toMatch(/selected|collapsed/);
});
it("editar filtros conserva foco, sobrevive recarga y volver, sin consultas por filtro", async () => {
  const router = page();
  const search = await screen.findByLabelText("Buscar preguntas");
  search.focus();
  const calls = vi.mocked(api).mock.calls.length;
  fireEvent.change(search, { target: { value: "Recepción" } });
  fireEvent.click(screen.getByRole("button", { name: "Analizar" }));
  await waitFor(() =>
    expect(new URLSearchParams(router.state.location.search).get("q")).toBe(
      "Recepción",
    ),
  );
  expect(
    new URLSearchParams(router.state.location.search).get("approach"),
  ).toBe("analyze");
  expect(api).toHaveBeenCalledTimes(calls);
  const url = router.state.location.search;
  await act(async () => {
    await router.navigate("/other");
  });
  await act(async () => {
    await router.navigate(-1);
  });
  expect(await screen.findByLabelText("Buscar preguntas")).toHaveValue(
    "Recepción",
  );
  cleanup();
  page(url);
  expect(await screen.findByLabelText("Buscar preguntas")).toHaveValue(
    "Recepción",
  );
  expect(screen.getByRole("button", { name: "Analizar" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});

it("Atrás y Adelante restauran filtros en el editor que sigue montado", async () => {
  const router = page("?mode=organize&approach=prepare&q=Primera");
  const input = await screen.findByLabelText("Buscar preguntas");
  expect(input).toHaveValue("Primera");
  await act(async () => {
    await router.navigate("?mode=organize&approach=analyze&q=Segunda");
  });
  await waitFor(() => expect(input).toHaveValue("Segunda"));
  await act(async () => {
    await router.navigate(-1);
  });
  await waitFor(() => expect(input).toHaveValue("Primera"));
  expect(screen.getByRole("button", { name: "Preparar" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await act(async () => {
    await router.navigate(1);
  });
  await waitFor(() => expect(input).toHaveValue("Segunda"));
  expect(screen.getByRole("button", { name: "Analizar" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});

it("los controles normales limpian la selección al cambiar q", async () => {
  page("?mode=organize&approach=prepare&q=Recepción");
  const checkbox = await screen.findByRole("checkbox", {
    name: /Seleccionar pregunta:/,
  });
  fireEvent.click(checkbox);
  expect(screen.getByText("1 pregunta seleccionada")).toBeVisible();
  fireEvent.change(screen.getByLabelText("Buscar preguntas"), {
    target: { value: "Comunicación" },
  });
  await waitFor(() =>
    expect(
      screen.queryByText("1 pregunta seleccionada"),
    ).not.toBeInTheDocument(),
  );
});
it("Atrás no mantiene selección oculta cuando restaura otro filtro", async () => {
  const router = page("?mode=organize&approach=prepare&q=Recepción");
  await screen.findByLabelText("Buscar preguntas");
  await act(async () => {
    await router.navigate("?mode=organize&approach=prepare&q=Comunicación");
  });
  await waitFor(() =>
    expect(screen.getByLabelText("Buscar preguntas")).toHaveValue(
      "Comunicación",
    ),
  );
  fireEvent.click(
    screen.getByRole("checkbox", { name: /Seleccionar pregunta:/ }),
  );
  expect(screen.getByText("1 pregunta seleccionada")).toBeVisible();
  await act(async () => {
    await router.navigate(-1);
  });
  await waitFor(() =>
    expect(screen.getByLabelText("Buscar preguntas")).toHaveValue("Recepción"),
  );
  expect(
    screen.getByRole("checkbox", { name: /Seleccionar pregunta:/ }),
  ).not.toBeChecked();
  expect(screen.queryByText("1 pregunta seleccionada")).not.toBeInTheDocument();
});

it("Atrás restaura el editor sin filtros cuando la entrada original no tenía query", async () => {
  const router = page();
  expect(await screen.findByLabelText("Buscar preguntas")).toHaveValue("");
  await act(async () => {
    await router.navigate("?mode=organize&approach=prepare&q=Recepción");
  });
  await waitFor(() =>
    expect(screen.getByLabelText("Buscar preguntas")).toHaveValue("Recepción"),
  );
  await act(async () => {
    await router.navigate(-1);
  });
  expect(router.state.location.search).toBe("");
  expect(screen.getByLabelText("Buscar preguntas")).toHaveValue("");
});
