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
it("restaura los filtros y Respuestas desde la URL, sin guardar selección masiva en ella", async () => {
  const router = page(
    "?mode=organize&approach=analyze&q=Consulta&publication=PUBLISHED",
  );
  expect(
    await screen.findByRole("button", { name: "Respuestas" }),
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
  fireEvent.click(screen.getByRole("button", { name: "Respuestas" }));
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
  expect(screen.getByRole("button", { name: "Respuestas" })).toHaveAttribute(
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
  expect(screen.getByRole("button", { name: "Contenido" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await act(async () => {
    await router.navigate(1);
  });
  await waitFor(() => expect(input).toHaveValue("Segunda"));
  expect(screen.getByRole("button", { name: "Respuestas" })).toHaveAttribute(
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

it("abrir y recorrer conserva filtros y casillas; Atrás cierra y devuelve foco", async () => {
  vi.stubGlobal("matchMedia", () => ({
    matches: true,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
  const router = page("?mode=organize");
  const first = data.questions[0]!;
  await screen.findByLabelText("Buscar preguntas");
  const checkbox = screen.getByRole("checkbox", {
    name: `Seleccionar pregunta: ${first.question}`,
  });
  fireEvent.click(checkbox);
  const requestsBeforeOpening = vi.mocked(api).mock.calls.length;
  const contributionRequestsBeforeOpening =
    vi.mocked(exchangeRequest).mock.calls.length;
  const opener = screen.getByRole("button", { name: first.question });
  opener.focus();
  fireEvent.click(opener);
  expect(
    await screen.findByRole("complementary", { name: "Detalle de pregunta" }),
  ).toBeVisible();
  expect(router.state.historyAction).toBe("PUSH");
  expect(
    new URLSearchParams(router.state.location.search).get("question"),
  ).toBe(first.id);
  expect(checkbox).toBeChecked();
  fireEvent.change(screen.getByLabelText("Buscar preguntas"), {
    target: { value: first.question },
  });
  await waitFor(() =>
    expect(new URLSearchParams(router.state.location.search).get("q")).toBe(
      first.question,
    ),
  );
  // Normal filter changes keep their usual selection reset; changing only question does not.
  expect(screen.getByText("1 de 1 resultados")).toBeVisible();
  expect(router.state.location.state.questionInspectorEntry).toBe(true);
  await act(() => router.navigate(-1));
  expect(
    screen.queryByRole("complementary", { name: "Detalle de pregunta" }),
  ).not.toBeInTheDocument();
  await waitFor(() =>
    expect(screen.getByRole("button", { name: first.question })).toHaveFocus(),
  );
  expect(api).toHaveBeenCalledTimes(requestsBeforeOpening);
  expect(exchangeRequest).toHaveBeenCalledTimes(
    contributionRequestsBeforeOpening,
  );
  vi.unstubAllGlobals();
});

it("abre enlace directo en Escribir y retira un id inexistente sin salir del editor", async () => {
  vi.stubGlobal("matchMedia", () => ({
    matches: true,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
  const question = data.questions[0]!;
  const router = page(`?mode=write&question=${question.id}`);
  await waitFor(() => expect(router.state.historyAction).toBe("PUSH"));
  expect(
    screen.getByRole("complementary", { name: "Detalle de pregunta" }),
  ).toBeVisible();
  expect(
    screen.getByRole("button", { name: question.question }),
  ).toHaveAttribute("aria-current", "true");
  await act(() => router.navigate(-1));
  expect(router.state.location.pathname).toContain("/editor");
  expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
  await act(() => router.navigate("?mode=write&question=missing"));
  await waitFor(() =>
    expect(router.state.location.search).not.toContain("question="),
  );
  expect(
    screen.getByText(
      "La pregunta del enlace no está disponible en este cuestionario.",
    ),
  ).toBeVisible();
  vi.unstubAllGlobals();
});
