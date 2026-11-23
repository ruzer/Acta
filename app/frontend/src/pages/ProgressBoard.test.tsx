import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
  waitFor,
} from "@testing-library/react";
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
    screen.getByRole("button", { name: new RegExp(`^${label} `) }).focus();
    await user.keyboard("{Enter}");
    const params = new URLSearchParams(
      screen.getByLabelText("Filtros actuales").textContent ?? "",
    );
    expect(params.get("status")).toBe(status);
    expect(params.get("keep")).toBe("si");
    expect(params.has("task")).toBe(false);
    await waitFor(() =>
      expect(Element.prototype.scrollIntoView).toHaveBeenCalledWith({
        behavior: "instant",
        block: "start",
      }),
    );
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

it("F3.4: aclara la métrica de envío, conserva la tabla y no inventa una cifra de respuestas completas", async () => {
  const { user } = await setup();
  const board = screen.getByRole("region", { name: "Avance del proyecto" });
  const label = within(board).getByText("Con al menos una respuesta");
  expect(label.closest("p")).toHaveTextContent("30 de 36");
  expect(label.closest("p")).toHaveTextContent("83.33 %");
  expect(
    screen.queryByText(/Completas \(todas las personas del área\)/),
  ).not.toBeInTheDocument();
  await user.click(
    screen.getByText("Tabla de métricas", { selector: "summary" }),
  );
  const table = screen.getByRole("table");
  expect(table).toBeVisible();
  expect(
    within(table).getByRole("columnheader", {
      name: "Con al menos una respuesta",
    }),
  ).toBeVisible();
  expect(
    within(table).getByRole("cell", { name: "18 / 20 · 90 %" }),
  ).toBeVisible();
  expect(
    screen.queryByText("Con respuestas", { exact: true }),
  ).not.toBeInTheDocument();
});

it("F3.5: reutiliza una sola consulta de Participación y ordena las cinco personas con más pendientes", async () => {
  await setup();
  const blockers = screen.getByRole("region", { name: "Qué me bloquea" });
  const rows = within(blockers).getAllByRole("listitem");
  expect(rows).toHaveLength(5);
  expect(rows.map((row) => row.textContent)).toEqual([
    expect.stringContaining("Persona ficticia 2"),
    expect.stringContaining("Persona ficticia 7"),
    expect.stringContaining("Persona ficticia 4"),
    expect.stringContaining("Persona ficticia 6"),
    expect.stringContaining("Persona ficticia 3"),
  ]);
  expect(
    within(blockers).queryByText("Persona ficticia 5"),
  ).not.toBeInTheDocument();
  expect(
    within(blockers).getByRole("link", { name: "Ver participación" }),
  ).toHaveAttribute("href", `/projects/${fixture.projectId}/participation`);
  expect(
    vi
      .mocked(exchangeRequest)
      .mock.calls.filter(([, resource]) => resource === "participation"),
  ).toHaveLength(1);
});

it("F3.5: no inventa bloqueos cuando todas las personas completaron sus preguntas", async () => {
  await setup({
    participation: {
      ...participation,
      participants: participation.participants.map((person) => ({
        ...person,
        pending: 0,
        state: "Completo",
      })),
    },
  });
  const blockers = screen.getByRole("region", { name: "Qué me bloquea" });
  expect(within(blockers).queryAllByRole("listitem")).toHaveLength(0);
  expect(blockers).toHaveTextContent(
    "Nadie tiene preguntas obligatorias pendientes.",
  );
});

it("F3.6: el nombre accesible contiene el rótulo visible completo de cada cifra", async () => {
  await setup();
  const group = screen.getByRole("group", { name: "Preguntas por estado" });
  for (const button of within(group).getAllByRole("button")) {
    const visible = button.textContent?.replace(/\s+/g, " ").trim();
    expect(visible).toBeTruthy();
    expect(button.getAttribute("aria-label")).toContain(visible);
  }
});

function motionObserver() {
  const descriptor = Object.getOwnPropertyDescriptor(
    Element.prototype,
    "animate",
  );
  const calls: {
    element: Element;
    frames: Keyframe[];
    options: KeyframeAnimationOptions;
  }[] = [];
  Object.defineProperty(Element.prototype, "animate", {
    configurable: true,
    value: function (
      this: Element,
      frames: Keyframe[],
      options: KeyframeAnimationOptions,
    ) {
      calls.push({ element: this, frames, options });
      return {
        cancel: vi.fn(),
        finished: Promise.resolve(),
        onfinish: null,
      } as unknown as Animation;
    },
  });
  let nextId = 0;
  const pending = new Map<number, FrameRequestCallback>();
  const raf = vi
    .spyOn(window, "requestAnimationFrame")
    .mockImplementation((callback) => {
      const id = ++nextId;
      pending.set(id, callback);
      return id;
    });
  const cancel = vi
    .spyOn(window, "cancelAnimationFrame")
    .mockImplementation((id) => {
      pending.delete(id);
    });
  return {
    calls,
    flush: (time = 0) => {
      const callbacks = [...pending.values()];
      pending.clear();
      act(() => {
        for (const callback of callbacks) callback(time);
      });
    },
    restore: () => {
      raf.mockRestore();
      cancel.mockRestore();
      if (descriptor)
        Object.defineProperty(Element.prototype, "animate", descriptor);
      else Reflect.deleteProperty(Element.prototype, "animate");
    },
  };
}
const changedData = {
  ...data,
  metrics: { ...data.metrics, validation: metric(13) },
  states: data.states.map((state) => ({
    ...state,
    count:
      state.status === "VALIDATED"
        ? 13
        : state.status === "NOT_REVIEWED"
          ? 3
          : state.count,
  })),
  breakdowns: data.breakdowns.map((row) =>
    row.key === "s1"
      ? { ...row, metrics: { ...row.metrics, validation: metric(9, 20) } }
      : row,
  ),
};

it("F3.7: primera visita y segunda sin cambios guardan solo cifras y no animan", async () => {
  const motion = motionObserver();
  try {
    const first = await setup();
    motion.flush();
    expect(motion.calls).toHaveLength(0);
    const key = `acta-ux:analyst-a:${fixture.projectId}:progress`;
    const saved = sessionStorage.getItem(key);
    expect(saved).not.toBeNull();
    expect(saved).not.toMatch(/Persona ficticia|Recepción|password|"answer"/i);
    first.unmount();
    await setup();
    motion.flush();
    expect(motion.calls).toHaveLength(0);
  } finally {
    motion.restore();
  }
});

it("F3.7: un cambio real anima cifras250ms y barras380ms usando solo transform y opacity", async () => {
  const motion = motionObserver();
  try {
    const first = await setup();
    motion.flush();
    first.unmount();
    await setup({ data: changedData });
    motion.flush();
    expect(motion.calls.length).toBeGreaterThan(0);
    expect(motion.calls.some((call) => call.options.duration === 250)).toBe(
      true,
    );
    expect(motion.calls.some((call) => call.options.duration === 380)).toBe(
      true,
    );
    for (const call of motion.calls) {
      expect([250, 380]).toContain(call.options.duration);
      expect(call.options.easing).toBe("cubic-bezier(0.22,1,0.36,1)");
      for (const frame of call.frames)
        expect(
          Object.keys(frame).every((key) =>
            ["transform", "opacity"].includes(key),
          ),
        ).toBe(true);
    }
    expect(
      motion.calls.filter((call) =>
        call.element.closest('[data-pb-breakdown="s2"]'),
      ),
    ).toHaveLength(0);
  } finally {
    motion.restore();
  }
});

it.each([{ userId: "analyst-b" }, { projectId: "project-b" }])(
  "F3.7: otro usuario o proyecto no hereda animaciones (%j)",
  async (options) => {
    const motion = motionObserver();
    try {
      const first = await setup();
      motion.flush();
      first.unmount();
      await setup({ ...options, data: changedData });
      motion.flush();
      expect(motion.calls).toHaveLength(0);
    } finally {
      motion.restore();
    }
  },
);

it("F3.7: reduced-motion actualiza sin animar y resalta durante600ms", async () => {
  const motion = motionObserver();
  try {
    const first = await setup();
    motion.flush();
    first.unmount();
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: query === "(prefers-reduced-motion: reduce)",
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
    await setup({ data: changedData });
    vi.useFakeTimers();
    motion.flush();
    expect(motion.calls).toHaveLength(0);
    expect(document.querySelectorAll(".pb-changed").length).toBeGreaterThan(0);
    act(() => {
      vi.advanceTimersByTime(599);
    });
    expect(document.querySelectorAll(".pb-changed").length).toBeGreaterThan(0);
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(document.querySelectorAll(".pb-changed")).toHaveLength(0);
  } finally {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    motion.restore();
  }
});

it("F3.7: una actualización recibida mientras se usa teclado no anima", async () => {
  const motion = motionObserver();
  try {
    const { client } = await setup();
    motion.flush();
    fireEvent.keyDown(window, { key: "Tab" });
    await act(async () => {
      client.setQueryData(["dashboard", fixture.projectId], changedData);
    });
    await screen.findByRole("button", { name: /^Validadas 13 de 36/ });
    motion.flush();
    expect(motion.calls).toHaveLength(0);
  } finally {
    motion.restore();
  }
});

it("F3.7: el ratón desplaza en250ms y el contorno solo anima opacidad800ms", async () => {
  const motion = motionObserver();
  const scroll = vi
    .spyOn(window, "scrollTo")
    .mockImplementation(() => undefined);
  const oldHeight = Object.getOwnPropertyDescriptor(
    document.documentElement,
    "scrollHeight",
  );
  Object.defineProperty(document.documentElement, "scrollHeight", {
    configurable: true,
    value: 3000,
  });
  try {
    await setup();
    motion.flush();
    vi.spyOn(
      document.getElementById("dashboard-questions")!,
      "getBoundingClientRect",
    ).mockReturnValue({ top: 900 } as DOMRect);
    fireEvent.click(screen.getByRole("button", { name: /^Validadas 12/ }), {
      detail: 1,
    });
    motion.flush(0); // React has applied the filtered list.
    motion.flush(0); // First scroll frame.
    expect(scroll).toHaveBeenLastCalledWith({
      top: expect.closeTo(0, 5),
      behavior: "instant",
    });
    motion.flush(125);
    const middle = scroll.mock.lastCall![0] as ScrollToOptions;
    expect(middle.top).toBeGreaterThan(450); // ease-out, not linear.
    expect(middle.top).toBeLessThan(900);
    motion.flush(250);
    expect(scroll).toHaveBeenLastCalledWith({ top: 900, behavior: "instant" });
    const count = scroll.mock.calls.length;
    motion.flush(500);
    expect(scroll).toHaveBeenCalledTimes(count);
    const outline = motion.calls.find((call) =>
      call.element.classList.contains("pb-list-outline"),
    )!;
    expect(outline.options.duration).toBe(800);
    expect(outline.frames).toEqual([{ opacity: 1 }, { opacity: 0 }]);
    expect(outline.element).toHaveAttribute("aria-hidden", "true");
  } finally {
    if (oldHeight)
      Object.defineProperty(
        document.documentElement,
        "scrollHeight",
        oldHeight,
      );
    else Reflect.deleteProperty(document.documentElement, "scrollHeight");
    motion.restore();
  }
});

it("F3.7: teclado desplaza de inmediato sin contorno animado", async () => {
  const motion = motionObserver();
  try {
    await setup();
    motion.flush();
    fireEvent.keyDown(window, { key: "Enter" });
    fireEvent.click(screen.getByRole("button", { name: /^Conflictos 1/ }), {
      detail: 0,
    });
    motion.flush();
    expect(Element.prototype.scrollIntoView).toHaveBeenCalledWith({
      behavior: "instant",
      block: "start",
    });
    expect(motion.calls).toHaveLength(0);
    expect(document.querySelector(".pb-list-outline")).toBeNull();
  } finally {
    motion.restore();
  }
});

it("F3.7: memoria ilegible o bloqueada conserva el tablero sin animaciones", async () => {
  const motion = motionObserver();
  try {
    sessionStorage.setItem(
      `acta-ux:analyst-a:${fixture.projectId}:progress`,
      "contenido incompleto",
    );
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("No disponible", "SecurityError");
    });
    await setup();
    motion.flush();
    expect(
      screen.getByRole("button", { name: /^Validadas 12 de 36/ }),
    ).toBeVisible();
    expect(motion.calls).toHaveLength(0);
  } finally {
    motion.restore();
  }
});

it("F3.7: el foco programático del título de ruta no se confunde con una acción de teclado", async () => {
  const motion = motionObserver();
  try {
    const first = await setup();
    motion.flush();
    first.unmount();
    await setup({ data: changedData });
    const heading = screen.getByRole("heading", { name: "Atención" });
    heading.tabIndex = -1;
    heading.focus();
    expect(heading).toHaveFocus();
    expect(heading.matches(":focus-visible")).toBe(true);
    motion.flush();
    expect(motion.calls.some((call) => call.options.duration === 250)).toBe(
      true,
    );
  } finally {
    motion.restore();
  }
});

it("F3.7: un estado que llega a cero conserva el segmento para completar scaleX(0)", async () => {
  const motion = motionObserver();
  try {
    const first = await setup();
    motion.flush();
    first.unmount();
    await setup({
      data: {
        ...data,
        states: data.states.map((state) =>
          state.status === "CONFLICT"
            ? { ...state, count: 0 }
            : state.status === "VALIDATED"
              ? { ...state, count: 13 }
              : state,
        ),
      },
    });
    motion.flush();
    const segment = motion.calls.find(
      (call) =>
        call.element.getAttribute("data-pb-motion") === "bar:state:CONFLICT",
    );
    expect(segment?.frames.at(-1)?.transform).toMatch(/scaleX\(0\)$/);
  } finally {
    motion.restore();
  }
});
