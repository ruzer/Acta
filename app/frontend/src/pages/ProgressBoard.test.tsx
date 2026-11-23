import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import {
  dashboardView,
  reviewStates,
  statusLabels,
  type ParticipationView,
} from "@requirements/contracts";
import fixture from "../../../../tests/fixtures/analyst-visual.json";
import { api, exchangeRequest } from "../api";
import { Dashboard } from "./Visibility";

vi.mock("../api", () => ({ api: vi.fn(), exchangeRequest: vi.fn() }));
vi.mock("./FirstSteps", () => ({ FirstSteps: () => null }));
vi.mock("./ResponseDeadline", () => ({ ResponseDeadline: () => null }));
vi.mock("./ProjectWorkbench", () => ({
  ProjectWorkbench: () => <h1>Atención</h1>,
  ProjectDeliverables: () => null,
}));
// This suite checks the board and the real ParticipationCard together. The
// question list has its own tests; preserve its scroll target and URL here.
vi.mock("./ProjectAttention", () => ({
  ProjectAttention: () => (
    <section aria-label="Preguntas y pendientes">
      <div id="dashboard-questions">
        <h2>Lista filtrada</h2>
      </div>
    </section>
  ),
}));

const counts = {
  NOT_REVIEWED: 4,
  PENDING: 2,
  PARTIAL: 3,
  ANSWERED: 7,
  CLARIFICATION_REQUIRED: 5,
  VALIDATED: 12,
  NOT_APPLICABLE: 2,
  CONFLICT: 1,
};
const base = dashboardView.parse(fixture.dashboard);
const metric = (numerator: number, denominator = 36) => ({
  numerator,
  denominator,
  percentage: denominator
    ? Math.round((numerator / denominator) * 10000) / 100
    : null,
});
const data = {
  ...base,
  metrics: {
    validation: metric(12),
    closure: metric(14),
    submission: metric(30),
  },
  states: reviewStates.map((status) => ({ status, count: counts[status] })),
  breakdowns: [
    {
      dimension: "section" as const,
      key: "s1",
      label: "Recepción",
      metrics: {
        validation: metric(8, 20),
        closure: metric(8, 20),
        submission: metric(18, 20),
      },
    },
    {
      dimension: "section" as const,
      key: "s2",
      label: "Seguimiento",
      metrics: {
        validation: metric(4, 16),
        closure: metric(6, 16),
        submission: metric(12, 16),
      },
    },
    {
      dimension: "area" as const,
      key: "a1",
      label: "Atención al público",
      metrics: {
        validation: metric(12),
        closure: metric(14),
        submission: metric(30),
      },
    },
  ],
};
const participation: ParticipationView = {
  projectName: data.projectName,
  role: "ANALYST",
  participants: [2, 11, 4, 7, 0, 5, 10].map((pending, index) => ({
    memberId: `person-${index}`,
    name: `Persona ficticia ${index + 1}`,
    area: null,
    assigned: 12,
    required: 12,
    drafts: 0,
    sent: 12 - pending,
    pending,
    lastActivity: null,
    state: pending ? "Envió parte" : "Completo",
  })),
};
function Location() {
  return <output aria-label="Filtros actuales">{useLocation().search}</output>;
}
async function setup(
  options: {
    data?: typeof data;
    participation?: ParticipationView;
    search?: string;
    userId?: string;
    projectId?: string;
  } = {},
) {
  const current = options.data ?? data;
  const projectId = options.projectId ?? fixture.projectId;
  vi.mocked(api).mockResolvedValue([
    {
      id: projectId,
      externalId: "DEMO",
      name: current.projectName,
      description: "",
      lifecycle: "ACTIVE",
      role: "ANALYST",
      lockVersion: 0,
      questionCount: 36,
    },
  ]);
  vi.mocked(exchangeRequest).mockImplementation(
    async (_projectId, resource) => {
      if (resource === "dashboard") return current;
      if (resource === "participation")
        return options.participation ?? participation;
      throw new Error(`Consulta inesperada: ${resource}`);
    },
  );
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const view = render(
    <QueryClientProvider client={client}>
      <MemoryRouter
        initialEntries={[
          `/projects/${projectId}/dashboard${options.search ?? ""}`,
        ]}
      >
        <Routes>
          <Route
            path="/projects/:projectId/dashboard"
            element={
              <>
                <Dashboard userId={options.userId ?? "analyst-a"} />
                <Location />
              </>
            }
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  await screen.findByText(/7 personas con acceso activo/);
  return { ...view, client, user: userEvent.setup() };
}
const scrollDescriptor = Object.getOwnPropertyDescriptor(
  Element.prototype,
  "scrollIntoView",
);
beforeEach(() => {
  Object.defineProperty(Element.prototype, "scrollIntoView", {
    configurable: true,
    value: vi.fn(),
  });
});
afterEach(() => {
  if (scrollDescriptor)
    Object.defineProperty(
      Element.prototype,
      "scrollIntoView",
      scrollDescriptor,
    );
  else Reflect.deleteProperty(Element.prototype, "scrollIntoView");
  cleanup();
  localStorage.clear();
  sessionStorage.clear();
  vi.restoreAllMocks();
  vi.resetAllMocks();
});

it("F3.1: muestra las cuatro cifras antes de los pendientes y conserva los números del servidor", async () => {
  await setup();
  const board = screen.getByRole("region", { name: "Avance del proyecto" });
  const controls = within(board).getAllByRole("button");
  expect(controls).toHaveLength(4);
  expect(controls[0]).toHaveAccessibleName(/^Validadas 12 de 36/);
  expect(controls[1]).toHaveAccessibleName(/^Esperando a otras personas 3/);
  expect(controls[2]).toHaveAccessibleName(/^Requieren aclaración 5/);
  expect(controls[3]).toHaveAccessibleName(/^Conflictos 1/);
  expect(
    board.compareDocumentPosition(
      screen.getByRole("region", { name: "Preguntas y pendientes" }),
    ) & Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();
});

it.each([
  ["Validadas", "VALIDATED"],
  ["Esperando a otras personas", "PARTIAL"],
  ["Requieren aclaración", "CLARIFICATION_REQUIRED"],
  ["Conflictos", "CONFLICT"],
])(
  "F3.1: %s conserva parámetros ajenos y reutiliza status=%s",
  async (label, status) => {
    const { user } = await setup({ search: "?task=ready&keep=si" });
    await user.click(
      screen.getByRole("button", { name: new RegExp(`^${label} `) }),
    );
    const params = new URLSearchParams(
      screen.getByLabelText("Filtros actuales").textContent ?? "",
    );
    expect(params.get("status")).toBe(status);
    expect(params.get("keep")).toBe("si");
    expect(params.has("task")).toBe(false);
    expect(Element.prototype.scrollIntoView).toHaveBeenCalledWith({
      behavior: "instant",
      block: "start",
    });
    expect(
      screen.getByRole("button", { name: new RegExp(`^${label} `) }),
    ).toHaveAttribute("aria-pressed", "true");
  },
);

it("F3.2: todos los estados tienen etiqueta y cifra, desde Sin revisar hasta Validada", async () => {
  await setup();
  const legend = screen.getByRole("list", { name: "Estados de las preguntas" });
  const items = within(legend).getAllByRole("listitem");
  expect(items).toHaveLength(8);
  expect(items[0]).toHaveTextContent(statusLabels.NOT_REVIEWED);
  expect(items[7]).toHaveTextContent(statusLabels.VALIDATED);
  for (const status of reviewStates) {
    const item = items.find((li) =>
      li.textContent?.includes(statusLabels[status]),
    );
    expect(item).toHaveTextContent(String(counts[status]));
  }
  expect(
    screen.getByRole("img", { name: /Sin revisar: 4/ }),
  ).toHaveAccessibleName(/Validada: 12/);
});

it("F3.2: conserva los ocho estados en cero sin mostrar porcentajes indefinidos", async () => {
  await setup({
    data: {
      ...data,
      questions: [],
      metrics: {
        validation: metric(0, 0),
        closure: metric(0, 0),
        submission: metric(0, 0),
      },
      states: reviewStates.map((status) => ({ status, count: 0 })),
    },
  });
  expect(screen.getByText("Aún no hay preguntas publicadas.")).toBeVisible();
  const image = screen.getByRole("img", {
    name: /^No hay preguntas publicadas/,
  });
  expect(image).not.toHaveTextContent(/NaN|Infinity/);
  const items = within(
    screen.getByRole("list", { name: "Estados de las preguntas" }),
  ).getAllByRole("listitem");
  expect(items).toHaveLength(8);
  for (const item of items) expect(item).toHaveTextContent("0");
});

it("F3.3: el desglose conserva numerador, denominador y porcentaje, sin inventar filtros", async () => {
  const { user } = await setup();
  await user.click(screen.getByText("Por tema", { selector: "summary" }));
  await user.click(screen.getByText("Por área", { selector: "summary" }));
  const topics = screen.getByRole("region", { name: "Por tema" });
  expect(topics).toHaveTextContent("Recepción");
  expect(topics).toHaveTextContent("8 de 20");
  expect(topics).toHaveTextContent("40 %");
  expect(topics).toHaveTextContent("Seguimiento");
  expect(topics).toHaveTextContent("4 de 16");
  expect(topics).toHaveTextContent("25 %");
  const areas = screen.getByRole("region", { name: "Por área" });
  expect(areas).toHaveTextContent("Atención al público");
  expect(areas).toHaveTextContent("12 de 36");
  for (const region of [topics, areas]) {
    expect(within(region).queryAllByRole("button")).toHaveLength(0);
    expect(within(region).queryAllByRole("link")).toHaveLength(0);
  }
});

it("F3.3: los desgloses nativos empiezan plegados y conservan un control enfocable", async () => {
  const { user } = await setup();
  const summary = screen.getByText("Por tema", { selector: "summary" });
  expect(summary.closest("details")).not.toHaveAttribute("open");
  expect(screen.getByRole("region", { name: "Por tema" })).not.toBeVisible();
  summary.focus();
  expect(summary).toHaveFocus();
  // Native summary keyboard activation is checked in Chromium, not simulated by jsdom.
  await user.click(summary);
  expect(summary.closest("details")).toHaveAttribute("open");
  expect(screen.getByRole("region", { name: "Por tema" })).toBeVisible();
});

it("F3.3: distingue un desglose vacío y un grupo sin preguntas, sin inventar porcentajes", async () => {
  const { user } = await setup({
    data: {
      ...data,
      breakdowns: [
        {
          ...data.breakdowns[0]!,
          metrics: {
            validation: metric(0, 0),
            closure: metric(0, 0),
            submission: metric(0, 0),
          },
        },
      ],
    },
  });
  await user.click(screen.getByText("Por tema", { selector: "summary" }));
  await user.click(screen.getByText("Por área", { selector: "summary" }));
  const topics = screen.getByRole("region", { name: "Por tema" });
  expect(topics).toHaveTextContent("0 de 0 · Sin preguntas");
  expect(topics).not.toHaveTextContent(/NaN|Infinity|100 %/);
  expect(screen.getByRole("region", { name: "Por área" })).toHaveTextContent(
    "No hay áreas con preguntas publicadas.",
  );
});
