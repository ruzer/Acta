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
import {
  dashboardView,
  decisionRegisterView,
  type DecisionRegisterEntry,
} from "@requirements/contracts";
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
const entry = (
  questionId: string,
  extra: Partial<DecisionRegisterEntry> = {},
): DecisionRegisterEntry => ({
  questionId,
  state: "CURRENT",
  excerpt: "Se adopta el registro único el mismo día.",
  truncated: false,
  scope: "Procedimiento general",
  hasExceptions: false,
  decidedAt: "2026-10-10T12:00:00.000Z",
  decidedBy: "Analista de ejemplo",
  endedAt: null,
  endedReason: null,
  previous: 0,
  ...extra,
});
/** Answers each operation of the page: the project's questions and the decisions' excerpts. */
function serve(
  dashboard: unknown,
  entries: DecisionRegisterEntry[] | Error = [],
) {
  vi.mocked(exchangeRequest).mockImplementation((async (
    _project: string,
    operation: string,
  ) => {
    if (operation === "decisions") {
      if (entries instanceof Error) throw entries;
      return { entries };
    }
    return dashboard;
  }) as never);
}
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
  serve(data);
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
  expect(exchangeRequest).toHaveBeenCalledTimes(2);
  expect(exchangeRequest).toHaveBeenCalledWith(
    "project-a",
    "dashboard",
    dashboardView,
  );
  expect(exchangeRequest).toHaveBeenCalledWith(
    "project-a",
    "decisions",
    decisionRegisterView,
  );
});

it("combina los filtros de URL y conserva su contexto completo al abrir una decisión", async () => {
  serve(data);
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
  serve(data);
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
  // One request per resource on opening; filtering never asks again.
  expect(exchangeRequest).toHaveBeenCalledTimes(2);
});

it("distingue ausencia de decisiones de ausencia de coincidencias", async () => {
  serve({
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
  serve(data);
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

it("UX-02: la página tiene un único h1 «Decisiones» y no repite el título como h2 ni usa el nombre del proyecto", async () => {
  serve(data);
  setup();
  await screen.findByLabelText("Buscar decisiones");
  const h1 = screen.getAllByRole("heading", { level: 1 });
  expect(h1).toHaveLength(1);
  expect(h1[0]).toHaveTextContent("Decisiones");
  expect(h1[0]).not.toHaveTextContent(source.projectName);
  expect(
    screen.queryByRole("heading", { level: 2, name: "Decisiones" }),
  ).not.toBeInTheDocument();
  expect(
    screen.getByRole("region", { name: "Decisiones vigentes" }),
  ).toBeVisible();
});

it("CP5: cada decisión es una línea de registro: referencia, título como enlace y tema · área, sin repetir «Vigente» en cada fila", async () => {
  serve(data);
  setup();
  await screen.findByRole("link", { name: first.title });
  const items = screen.getAllByRole("listitem");
  expect(items.length).toBeGreaterThan(0);
  const entry = items[0]!;
  expect(within(entry).getByRole("link")).toBeVisible();
  // Every row is a current decision, which the page already says once.
  expect(screen.queryByText("Vigente")).not.toBeInTheDocument();
  expect(screen.getByRole("list")).toHaveClass("ac-register-compact");
  expect(entry.querySelector(".ac-register-reference")).not.toBeNull();
  // Technical identifiers are secondary: smaller and never above the title.
  expect(
    entry
      .querySelector(".ac-register-reference")!
      .compareDocumentPosition(entry.querySelector(".ac-register-title")!) &
      Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();
});

const pending = source.questions.find(
  (question) =>
    question.status !== "VALIDATED" && question.status !== "NOT_APPLICABLE",
)!;
const undecidedOthers = data.questions.filter(
  (question) =>
    question.status !== "VALIDATED" &&
    question.status !== "NOT_APPLICABLE" &&
    question.id !== pending.id,
).length;

it("cada decisión muestra el inicio de lo decidido con su alcance, fecha y autor, y la búsqueda lo encuentra", async () => {
  serve(data, [
    entry(first.id, {
      excerpt: "Se centraliza la información en una sola hoja compartida.",
      hasExceptions: true,
      previous: 2,
    }),
    entry(second.id),
  ]);
  const user = setup();
  const row = (await screen.findByRole("link", { name: first.title })).closest(
    "li",
  )!;
  expect(row).toHaveTextContent(
    "Se centraliza la información en una sola hoja",
  );
  expect(row).toHaveTextContent("Alcance: Procedimiento general");
  expect(row).toHaveTextContent("Analista de ejemplo");
  expect(row).toHaveTextContent("Con excepciones");
  expect(row).toHaveTextContent("2 decisiones anteriores");
  expect(screen.queryByText("Vigente")).not.toBeInTheDocument();
  // The register is searchable by what was decided, not only by title.
  await user.type(
    screen.getByLabelText("Buscar decisiones"),
    "hoja compartida",
  );
  expect(screen.getByRole("link", { name: first.title })).toBeVisible();
  expect(
    screen.queryByRole("link", { name: second.title }),
  ).not.toBeInTheDocument();
});

it("una decisión que dejó de estar vigente se separa de las vigentes, dice por qué y abre su registro", async () => {
  serve(data, [
    entry(first.id),
    entry(pending.id, {
      state: "REOPENED",
      excerpt: "Se mantiene el procedimiento actual.",
      endedAt: "2026-10-11T09:00:00.000Z",
      endedReason: "Se solicitó una aclaración.",
      previous: 1,
    }),
  ]);
  setup();
  const heading = await screen.findByRole("heading", {
    name: "Sin decisión vigente (1)",
  });
  const group = heading.closest("section")!;
  const row = within(group).getByRole("link", { name: pending.title });
  expect(row).toHaveAttribute(
    "href",
    `/projects/project-a/review/${pending.id}?tab=decision`,
  );
  const item = row.closest("li")!;
  expect(item).toHaveTextContent(
    "Decisión anterior: Se mantiene el procedimiento actual.",
  );
  expect(item).toHaveTextContent("Dejó de estar vigente el");
  expect(item).toHaveTextContent("Se solicitó una aclaración.");
  // Two lists: each has its own heading and the entries sit one level below it.
  expect(
    screen.getByRole("heading", {
      level: 2,
      name: /^Decisiones vigentes \(\d+\)$/,
    }),
  ).toBeVisible();
  expect(
    screen.getByRole("heading", { level: 3, name: first.title }),
  ).toBeVisible();
  expect(
    within(group).getByRole("heading", { level: 3, name: pending.title }),
  ).toBeVisible();
  // Current decisions stay in their own list, unmarked, and are not repeated here.
  expect(within(group).queryByRole("link", { name: first.title })).toBeNull();
  expect(screen.getByRole("link", { name: first.title })).toHaveAttribute(
    "href",
    `/projects/project-a/review/${first.id}`,
  );
  // The whole picture in one line: reopened, still to decide, and where to go.
  const jump = screen.getByRole("link", { name: "1 con decisión anterior" });
  expect(jump.closest("p")).toHaveTextContent(
    `Sin decisión vigente: 1 con decisión anterior · ${undecidedOthers} ${undecidedOthers === 1 ? "pregunta por decidir" : "preguntas por decidir"}`,
  );
  expect(screen.getByRole("link", { name: "Ver en Atención" })).toHaveAttribute(
    "href",
    "/projects/project-a/dashboard",
  );
  // The group sits after the long list: the count takes the reader there.
  heading.scrollIntoView = vi.fn();
  await userEvent.click(jump);
  expect(heading.scrollIntoView).toHaveBeenCalled();
  expect(heading).toHaveFocus();
});

it("sin decisiones reabiertas no hay grupos ni encabezados añadidos", async () => {
  serve(data, [entry(first.id), entry(second.id)]);
  setup();
  await screen.findByRole("link", { name: first.title });
  expect(
    screen.queryByRole("heading", {
      name: /Sin decisión vigente|Decisiones vigentes \(/,
    }),
  ).not.toBeInTheDocument();
  expect(
    screen.getByRole("heading", { level: 2, name: first.title }),
  ).toBeVisible();
});

it("si los extractos no cargan, el registro sigue siendo la lista de preguntas con decisión", async () => {
  serve(data, new Error("sin extractos"));
  setup();
  expect(await screen.findByRole("link", { name: first.title })).toBeVisible();
  expect(screen.getByRole("status")).toHaveTextContent("2 decisiones");
  expect(screen.queryByText(/Alcance:/)).not.toBeInTheDocument();
});
