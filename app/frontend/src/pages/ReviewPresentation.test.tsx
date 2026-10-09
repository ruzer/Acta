import { afterEach, expect, it, vi } from "vitest";
import {
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { reviewDetailView, type ReviewDetail } from "@requirements/contracts";
import fixture from "../../../../tests/fixtures/analyst-visual.json";
import * as apiModule from "../api";
import { ReviewDetail as ReviewPage } from "./ReviewDetail";
const conflict = reviewDetailView.parse(fixture.conflict),
  decision = reviewDetailView.parse(fixture.decision);
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
/** Desktop layout: the contribution rail (with its compare button) is always shown. */
function wideViewport() {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: /min-width:\s*900px/.test(query),
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
}
function page(detail: ReviewDetail, search = "", projects: unknown[] = []) {
  const api = vi
    .spyOn(apiModule, "api")
    .mockImplementation(
      async (key) => (key === "projects" ? projects : detail) as never,
    );
  const router = createMemoryRouter(
    [{ path: "/projects/:projectId/review/:id", element: <ReviewPage /> }],
    {
      initialEntries: [
        {
          pathname: `/projects/${detail.projectId}/review/${detail.question.id}`,
          search,
          state: {
            workbenchReturn: { view: "attention", search: "status=CONFLICT" },
          },
        },
      ],
    },
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
  return { router, api };
}
it("C: pregunta completa como h1; conflicto abre Contraste sin consultas adicionales", async () => {
  const { api } = page(conflict);
  expect(await screen.findByRole("heading", { level: 1 })).toHaveTextContent(
    conflict.question.question,
  );
  expect(screen.getByRole("tab", { name: "Contraste" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  expect(
    screen.getByText(conflict.question.title, { exact: false }),
  ).toBeVisible();
  expect([...new Set(api.mock.calls.map(([key]) => key))].sort()).toEqual([
    "getReviewDetail",
    "projects",
  ]);
});
it("C: pestañas conservan URL y regreso; teclado cambia panel y mantiene el foco", async () => {
  const { router } = page(conflict, "?tab=contributions&source=reference");
  const user = userEvent.setup();
  await screen.findByRole("heading", { level: 1 });
  const first = screen.getByRole("tab", { name: /^Aportaciones/ });
  expect(first).toHaveAttribute("aria-selected", "true");
  first.focus();
  await user.keyboard("{ArrowRight}");
  expect(screen.getByRole("tab", { name: "Contraste" })).toHaveFocus();
  expect(router.state.location.search).toContain("tab=contrast");
  expect(router.state.location.search).toContain("source=reference");
  expect(screen.getByRole("link", { name: "← Atención" })).toHaveAttribute(
    "href",
    `/projects/${conflict.projectId}/dashboard?status=CONFLICT`,
  );
  await user.keyboard("{End}");
  expect(screen.getByRole("tab", { name: "Historial" })).toHaveFocus();
  expect(
    screen.getByRole("heading", { name: "Historial de la pregunta" }),
  ).toBeVisible();
});
it.each(["ADMIN", "ANALYST_ARCHIVED"])(
  "C: %s mantiene información completa pero sin acciones ni turno del analista",
  async () => {
    page({ ...conflict, canReview: false });
    expect(await screen.findByText("Consulta de solo lectura.")).toBeVisible();
    expect(screen.queryByText("Te toca a ti")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("combobox", { name: "Otras acciones" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", {
        name: /Resolver conflicto|Registrar decisión|Cerrar aclaración|Preguntar nuevamente/,
      }),
    ).not.toBeInTheDocument();
    expect(
      screen.getAllByRole("region", { name: /Postura [AB]/ }),
    ).toHaveLength(2);
  },
);
it("C: VIEWER abre la decisión vigente y usa solo las fuentes entregadas por el servidor", async () => {
  const current = decision.validations.filter((v) => !v.invalidatedAt);
  const sourceIds = new Set(
    current.flatMap((v) => v.sources.map((s) => s.responseRevisionId)),
  );
  const filtered = {
    ...decision,
    canReview: false,
    validations: current,
    submissions: decision.submissions.filter((s) => sourceIds.has(s.id)),
    threads: [],
    conflicts: [],
    participants: [],
  };
  page(filtered);
  await screen.findByRole("heading", { level: 1 });
  expect(screen.getByRole("tab", { name: "Decisión" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  expect(
    screen.getByRole("article", { name: "Decisión vigente" }),
  ).toBeVisible();
  expect(
    screen.queryByRole("button", { name: "Reabrir pregunta" }),
  ).not.toBeInTheDocument();
  const user = userEvent.setup();
  await user.click(screen.getByRole("tab", { name: /^Aportaciones/ }));
  expect(
    within(screen.getByRole("tabpanel")).getByRole("heading", {
      name: "1 aportación",
    }),
  ).toBeVisible();
});

// Regression coverage for the v0.5.0 behaviours that the Direction C review
// restructuring had dropped (audit findings F1 and F2).
const uuid = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
function copy<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
/** A third current contribution that no conflict links to. */
function withUnlinkedContribution(detail: ReviewDetail): ReviewDetail {
  const third = copy(detail.submissions[0]!);
  third.id = uuid(3);
  third.number = 9;
  third.answer = "Respuesta de la tercera persona.";
  third.respondent = { id: uuid(30), displayName: "Tercera Persona" };
  return reviewDetailView.parse({
    ...detail,
    submissions: [...detail.submissions, third],
    participants: [
      ...detail.participants,
      {
        memberId: uuid(31),
        person: third.respondent,
        area: third.area.name,
        required: true,
        applicability: "ENABLED",
        currentRevisionId: third.id,
      },
    ],
  });
}
function resolved(detail: ReviewDetail): ReviewDetail {
  const [first] = detail.conflicts;
  return reviewDetailView.parse({
    ...detail,
    status: "ANSWERED",
    conflicts: [
      {
        ...first!,
        status: "RESOLVED",
        resolution: {
          id: uuid(40),
          resolutionText: "Se adopta el criterio de la primera aportación.",
          resolvedAt: "2026-10-01T10:00:00.000Z",
          resolvedBy: first!.openedBy,
          sources: [
            {
              id: uuid(41),
              responseRevisionId: first!.participants[0]!.responseRevisionId,
            },
          ],
        },
      },
    ],
  });
}
function thread(
  detail: ReviewDetail,
  status: "WAITING_STAKEHOLDER" | "WAITING_ANALYST",
  index: number,
) {
  const submission = detail.submissions[index]!;
  return {
    id: uuid(50 + index),
    responseRevisionId: submission.id,
    respondentId: submission.respondent.id,
    status,
    lockVersion: 1,
    createdAt: "2026-10-01T10:00:00.000Z",
    closedAt: null,
    closedBy: null,
    closeReason: null,
    messages: [],
  };
}
function withThreads(
  detail: ReviewDetail,
  statuses: ("WAITING_STAKEHOLDER" | "WAITING_ANALYST")[],
): ReviewDetail {
  return reviewDetailView.parse({
    ...detail,
    status: "CLARIFICATION_REQUIRED",
    conflicts: [],
    threads: statuses.map((status, index) => thread(detail, status, index)),
  });
}
const otherActionLabels = () =>
  Array.from(
    (
      screen.getByRole("combobox", {
        name: "Otras acciones",
      }) as HTMLSelectElement
    ).options,
  ).map((option) => option.textContent);
const comparisonOptions = (panel: HTMLElement) =>
  Array.from(
    (
      within(panel).getByLabelText(
        /Aportación para postura A/,
      ) as HTMLSelectElement
    ).options,
  ).map((option) => option.textContent ?? "");

it("F1 (PROBE-1): con un conflicto abierto, «Comparar aportaciones» permite elegir una aportación ajena al conflicto", async () => {
  wideViewport();
  const detail = withUnlinkedContribution(conflict);
  expect(detail.conflicts[0]!.participants).toHaveLength(2);
  expect(detail.submissions.filter((s) => s.current)).toHaveLength(3);
  page(detail);
  const user = userEvent.setup();
  await user.click(await screen.findByRole("tab", { name: /^Aportaciones/ }));
  await user.click(
    screen.getByRole("button", { name: "Comparar aportaciones" }),
  );
  const panel = screen.getByRole("tabpanel", { name: "Contraste" });
  // The conflict comparison stays visible…
  expect(
    within(panel).getByRole("heading", { name: "Conflicto abierto" }),
  ).toBeVisible();
  // …and any current pair can be compared, including the unlinked contribution.
  expect(
    comparisonOptions(panel).filter((text) => text.includes("Tercera Persona")),
  ).toHaveLength(1);
  expect(
    within(panel).getByLabelText(/Aportación para postura A/),
  ).toBeVisible();
  const postureB = within(panel).getByLabelText(/Aportación para postura B/);
  await user.selectOptions(
    postureB,
    within(postureB).getByRole("option", { name: /Tercera Persona/ }),
  );
  expect(
    within(panel).getByText("Respuesta de la tercera persona.", {
      exact: false,
    }),
  ).toBeVisible();
  // Both comparisons can be open together without duplicating landmark names.
  const regions = within(panel)
    .getAllByRole("region", { name: /Postura [AB]/ })
    .map((region) => region.getAttribute("aria-label"));
  expect(regions).toHaveLength(4);
  expect(new Set(regions).size).toBe(4);
  // Comparing never records a conflict or a decision.
  expect(
    within(panel).getByRole("heading", { name: "Conflicto abierto" }),
  ).toBeVisible();
});
it("F1: al llegar directamente a Contraste el conflicto va primero y la comparación libre está disponible", async () => {
  page(withUnlinkedContribution(conflict));
  const user = userEvent.setup();
  expect(await screen.findByRole("tab", { name: "Contraste" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  const panel = screen.getByRole("tabpanel", { name: "Contraste" });
  expect(
    within(panel).getByRole("heading", { name: "Conflicto abierto" }),
  ).toBeVisible();
  const summary = within(panel).getByText(
    /Comparar otras aportaciones vigentes \(3\)/,
  );
  expect(summary.closest("details")).not.toHaveAttribute("open");
  await user.click(summary);
  expect(
    within(panel).getByLabelText(/Aportación para postura A/),
  ).toBeVisible();
  expect(
    comparisonOptions(panel).some((text) => text.includes("Tercera Persona")),
  ).toBe(true);
});
it("F1: con un conflicto resuelto también se pueden comparar aportaciones vigentes ajenas a él", async () => {
  wideViewport();
  const detail = resolved(withUnlinkedContribution(conflict));
  expect(detail.conflicts.every((item) => item.status === "RESOLVED")).toBe(
    true,
  );
  page(detail);
  const user = userEvent.setup();
  await user.click(await screen.findByRole("tab", { name: /^Aportaciones/ }));
  await user.click(
    screen.getByRole("button", { name: "Comparar aportaciones" }),
  );
  const panel = screen.getByRole("tabpanel", { name: "Contraste" });
  expect(
    within(panel).getByRole("heading", { name: "Conflicto resuelto" }),
  ).toBeVisible();
  expect(
    within(panel).getByLabelText(/Aportación para postura A/),
  ).toBeVisible();
  expect(
    comparisonOptions(panel).some((text) => text.includes("Tercera Persona")),
  ).toBe(true);
});
it("F1: si el conflicto ya abarca todas las aportaciones vigentes no se duplica la comparación", async () => {
  page(conflict);
  const panel = await screen.findByRole("tabpanel", { name: "Contraste" });
  expect(
    within(panel).getByRole("heading", { name: "Conflicto abierto" }),
  ).toBeVisible();
  expect(
    within(panel).queryByText(/Comparar otras aportaciones vigentes/),
  ).not.toBeInTheDocument();
  expect(
    within(panel).getAllByRole("region", { name: /Postura [AB]/ }),
  ).toHaveLength(2);
});
it("F1: sin conflictos la comparación libre sigue mostrándose directamente, como en v0.5.0", async () => {
  page(
    reviewDetailView.parse({
      ...withUnlinkedContribution(conflict),
      status: "ANSWERED",
      conflicts: [],
    }),
    "?tab=contrast",
  );
  const panel = await screen.findByRole("tabpanel", { name: "Contraste" });
  expect(
    within(panel).queryByText(/Comparar otras aportaciones vigentes/),
  ).not.toBeInTheDocument();
  expect(
    within(panel).getByLabelText(/Aportación para postura A/),
  ).toBeVisible();
  expect(comparisonOptions(panel)).toHaveLength(3);
});
it("F1: en solo lectura la comparación libre está disponible sin ninguna acción de revisión", async () => {
  wideViewport();
  page({ ...withUnlinkedContribution(conflict), canReview: false });
  const user = userEvent.setup();
  await user.click(await screen.findByRole("tab", { name: /^Aportaciones/ }));
  await user.click(
    screen.getByRole("button", { name: "Comparar aportaciones" }),
  );
  const panel = screen.getByRole("tabpanel", { name: "Contraste" });
  expect(
    comparisonOptions(panel).some((text) => text.includes("Tercera Persona")),
  ).toBe(true);
  expect(
    screen.queryByRole("combobox", { name: "Otras acciones" }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole("button", {
      name: /Resolver conflicto|Registrar decisión|Cerrar aclaración|Preguntar nuevamente/,
    }),
  ).not.toBeInTheDocument();
});

it("F2 (PROBE-2): con una aclaración esperando al participante no se ofrece «Registrar decisión»", async () => {
  page(withThreads(conflict, ["WAITING_STAKEHOLDER"]));
  await screen.findByRole("heading", { level: 1 });
  expect(
    screen.getByText(/Esperando la aclaración/, { selector: "h2" }),
  ).toBeVisible();
  expect(
    screen.queryByRole("button", { name: "Registrar decisión" }),
  ).not.toBeInTheDocument();
  // Exactly the secondary actions that v0.5.0 offered in this state.
  expect(otherActionLabels()).toEqual([
    "Selecciona una acción",
    "Solicitar aclaración",
    "Marcar respuesta parcial",
    "Marcar pendiente",
    "Marcar conflicto",
    "Marcar no aplica",
  ]);
});
it("F2: con una aclaración esperando al participante y otra al analista, la acción principal es cerrar la aclaración", async () => {
  page(withThreads(conflict, ["WAITING_STAKEHOLDER", "WAITING_ANALYST"]));
  const card = (
    await screen.findByText("Llegó una respuesta a la aclaración", {
      selector: "h2",
    })
  ).closest("section")!;
  expect(
    within(card).getByRole("button", { name: "Cerrar aclaración" }),
  ).toBeVisible();
  expect(
    within(card).queryByRole("button", { name: "Registrar decisión" }),
  ).not.toBeInTheDocument();
  expect(otherActionLabels()).not.toContain("Registrar decisión");
});
it("F2: sin aclaraciones pendientes «Registrar decisión» sigue disponible (principal o en Otras acciones)", async () => {
  // ANSWERED: it is the state's primary action and is not duplicated in the menu.
  const answered = reviewDetailView.parse({
    ...conflict,
    status: "ANSWERED",
    conflicts: [],
    threads: [],
  });
  page(answered);
  const card = (
    await screen.findByText("Lista para decidir", { selector: "h2" })
  ).closest("section")!;
  expect(
    within(card).getByRole("button", { name: "Registrar decisión" }),
  ).toBeVisible();
  expect(otherActionLabels()).not.toContain("Registrar decisión");
  cleanup();
  // PARTIAL with a required person still missing: v0.5.0 kept it as a primary
  // action; Direction C keeps it reachable from «Otras acciones».
  const partial = reviewDetailView.parse({
    ...answered,
    status: "PARTIAL",
    participants: [
      ...answered.participants,
      {
        memberId: uuid(60),
        person: { id: uuid(61), displayName: "Persona pendiente" },
        area: "Fictional team",
        required: true,
        applicability: "ENABLED",
        currentRevisionId: null,
      },
    ],
  });
  page(partial);
  await screen.findByRole("heading", { level: 1 });
  expect(otherActionLabels()).toContain("Registrar decisión");
});

/**
 * Models what Chromium does and jsdom does not: an element inside a hidden
 * panel cannot take focus, and a frame can fire before React has committed the
 * tab change. Returns every focus request with whether its panel was hidden.
 */
function earlyFrameWithBrowserFocus() {
  const realFocus = HTMLElement.prototype.focus;
  const requested: { text: string; hidden: boolean }[] = [];
  vi.spyOn(HTMLElement.prototype, "focus").mockImplementation(function (
    this: HTMLElement,
    options?: FocusOptions,
  ) {
    const hidden = !!this.closest("[hidden]");
    requested.push({ text: this.textContent ?? "", hidden });
    if (!hidden) realFocus.call(this, options);
  });
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    callback(0);
    return 0;
  });
  return requested;
}
it("F3: «Comparar aportaciones» traslada el foco al encabezado de Contraste ya visible", async () => {
  wideViewport();
  page(withUnlinkedContribution(conflict), "?tab=contributions");
  const user = userEvent.setup();
  await user.click(
    await screen.findByRole("button", { name: "Comparar aportaciones" }),
  );
  const heading = await screen.findByRole("heading", {
    name: "Contrastar aportaciones",
  });
  await waitFor(() => expect(heading).toHaveFocus());
  expect(heading.closest("[role=tabpanel]")).not.toHaveAttribute("hidden");
  expect(screen.getByRole("tab", { name: "Contraste" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
});
it("F3: el foco no se solicita mientras el panel de Contraste sigue oculto", async () => {
  wideViewport();
  const requested = earlyFrameWithBrowserFocus();
  try {
    page(withUnlinkedContribution(conflict), "?tab=contributions");
    const user = userEvent.setup();
    await user.click(
      await screen.findByRole("button", { name: "Comparar aportaciones" }),
    );
    const heading = await screen.findByRole("heading", {
      name: "Contrastar aportaciones",
    });
    await waitFor(() => expect(heading).toHaveFocus());
    const asked = requested.filter((r) => r.text === "Contrastar aportaciones");
    expect(asked.length).toBeGreaterThan(0);
    expect(asked.every((r) => !r.hidden)).toBe(true);
  } finally {
    vi.unstubAllGlobals();
  }
});
it("F3: el traslado de foco ocurre una sola vez y no se apropia de cambios de pestaña posteriores", async () => {
  wideViewport();
  page(withUnlinkedContribution(conflict), "?tab=contributions");
  const user = userEvent.setup();
  await user.click(
    await screen.findByRole("button", { name: "Comparar aportaciones" }),
  );
  const heading = await screen.findByRole("heading", {
    name: "Contrastar aportaciones",
  });
  await waitFor(() => expect(heading).toHaveFocus());
  await user.click(screen.getByRole("tab", { name: "Historial" }));
  await user.click(screen.getByRole("tab", { name: "Contraste" }));
  expect(screen.getByRole("tab", { name: "Contraste" })).toHaveFocus();
  expect(heading).not.toHaveFocus();
});
it("F4: cada comparación describe su propio alcance sin atribuir el conflicto a todas las aportaciones", async () => {
  wideViewport();
  page(withUnlinkedContribution(conflict), "?tab=contributions");
  const user = userEvent.setup();
  await user.click(
    await screen.findByRole("button", { name: "Comparar aportaciones" }),
  );
  const panel = await screen.findByRole("tabpanel", { name: "Contraste" });
  expect(
    within(panel)
      .getAllByRole("status")
      .map((status) => status.textContent),
  ).toEqual([
    "Comparando 2 de 2 fuentes registradas en este conflicto.",
    "Comparando 2 de 3 aportaciones vigentes.",
  ]);
});

const backButton = () =>
  screen.findByRole("button", { name: /^← Volver a \d+ aportaciones/ });
it("F5: «← Volver a N aportaciones» devuelve el foco a «Comparar aportaciones» ya visible", async () => {
  wideViewport();
  page(withUnlinkedContribution(conflict), "?tab=contrast");
  const user = userEvent.setup();
  await user.click(await backButton());
  const compare = await screen.findByRole("button", {
    name: "Comparar aportaciones",
  });
  await waitFor(() => expect(compare).toHaveFocus());
  expect(compare.closest("[role=tabpanel]")).not.toHaveAttribute("hidden");
  expect(screen.getByRole("tab", { name: /^Aportaciones/ })).toHaveAttribute(
    "aria-selected",
    "true",
  );
});
it("F5: con teclado, Enter en «← Volver» también devuelve el foco al botón de comparar", async () => {
  wideViewport();
  page(withUnlinkedContribution(conflict), "?tab=contrast");
  const user = userEvent.setup();
  const back = await backButton();
  back.focus();
  await user.keyboard("{Enter}");
  const compare = await screen.findByRole("button", {
    name: "Comparar aportaciones",
  });
  await waitFor(() => expect(compare).toHaveFocus());
});
it("F5: el foco no se solicita mientras el panel de Aportaciones sigue oculto", async () => {
  wideViewport();
  const requested = earlyFrameWithBrowserFocus();
  try {
    page(withUnlinkedContribution(conflict), "?tab=contrast");
    const user = userEvent.setup();
    await user.click(await backButton());
    const compare = await screen.findByRole("button", {
      name: "Comparar aportaciones",
    });
    await waitFor(() => expect(compare).toHaveFocus());
    const asked = requested.filter((r) => r.text === "Comparar aportaciones");
    expect(asked.length).toBeGreaterThan(0);
    expect(asked.every((r) => !r.hidden)).toBe(true);
  } finally {
    vi.unstubAllGlobals();
  }
});
it("F5: sin botón de comparar (una sola aportación) el foco vuelve a la pestaña Aportaciones", async () => {
  page(reviewDetailView.parse(decision), "?tab=contrast");
  expect(decision.submissions.filter((s) => s.current)).toHaveLength(1);
  const user = userEvent.setup();
  await user.click(await backButton());
  const tab = screen.getByRole("tab", { name: /^Aportaciones/ });
  await waitFor(() => expect(tab).toHaveFocus());
  expect(tab).toHaveAttribute("aria-selected", "true");
});
it("F5: ida y vuelta a Contraste no deja peticiones de foco pendientes que roben cambios de pestaña posteriores", async () => {
  wideViewport();
  page(withUnlinkedContribution(conflict), "?tab=contributions");
  const user = userEvent.setup();
  await user.click(
    await screen.findByRole("button", { name: "Comparar aportaciones" }),
  );
  const heading = await screen.findByRole("heading", {
    name: "Contrastar aportaciones",
  });
  await waitFor(() => expect(heading).toHaveFocus());
  await user.click(await backButton());
  const compare = await screen.findByRole("button", {
    name: "Comparar aportaciones",
  });
  await waitFor(() => expect(compare).toHaveFocus());
  await user.click(screen.getByRole("tab", { name: "Historial" }));
  expect(screen.getByRole("tab", { name: "Historial" })).toHaveFocus();
  await user.click(screen.getByRole("tab", { name: "Contraste" }));
  expect(screen.getByRole("tab", { name: "Contraste" })).toHaveFocus();
  expect(heading).not.toHaveFocus();
});

// ---- UX-06 / UX-07 / UX-09 -------------------------------------------------
function narrowViewport() {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: /max-width:\s*759px/.test(query),
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
}
const tabNames = () =>
  screen.getAllByRole("tab").map((tab) => tab.textContent?.trim());

it("UX-06: con un conflicto abierto la pestaña Contraste lo avisa desde cualquier pestaña, sin cambiar su nombre", async () => {
  page(conflict, "?tab=contributions");
  const tab = await screen.findByRole("tab", { name: "Contraste" });
  expect(tab.querySelector('[data-icon="flag"]')).toBeInTheDocument();
  expect(tab).toHaveAttribute("aria-description", "Conflicto abierto");
  expect(tab).toHaveAttribute("aria-selected", "false");
  cleanup();
  // Without an open conflict there is no cue.
  page(
    reviewDetailView.parse({ ...conflict, status: "ANSWERED", conflicts: [] }),
    "?tab=contributions",
  );
  const plain = await screen.findByRole("tab", { name: "Contraste" });
  expect(plain.querySelector("[data-icon]")).not.toBeInTheDocument();
  expect(plain).not.toHaveAttribute("aria-description");
});

it("UX-09: quien revisa conserva siempre las cuatro pestañas, aunque alguna esté vacía", async () => {
  page(
    reviewDetailView.parse({ ...conflict, status: "ANSWERED", conflicts: [] }),
  );
  await screen.findByRole("heading", { level: 1 });
  expect(tabNames()).toEqual([
    "Aportaciones (2)",
    "Contraste",
    "Decisión",
    "Historial",
  ]);
});

const asViewer = () => {
  const current = decision.validations.filter((v) => !v.invalidatedAt);
  const sourceIds = new Set(
    current.flatMap((v) => v.sources.map((s) => s.responseRevisionId)),
  );
  return reviewDetailView.parse({
    ...decision,
    canReview: false,
    validations: current,
    submissions: decision.submissions.filter((s) => sourceIds.has(s.id)),
    threads: [],
    conflicts: [],
    participants: [],
    dispositions: [],
    references: [],
  });
};
it("UX-09: el lector solo ve las pestañas con contenido y la decisión vigente sigue siendo la predeterminada", async () => {
  page(asViewer());
  await screen.findByRole("heading", { level: 1 });
  expect(tabNames()).toEqual(["Aportaciones (1)", "Decisión"]);
  expect(screen.getByRole("tab", { name: "Decisión" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  expect(
    screen.getByRole("article", { name: "Decisión vigente" }),
  ).toBeVisible();
  // Every shown tab controls a panel that exists; hidden ones have none.
  for (const tab of screen.getAllByRole("tab"))
    expect(
      document.getElementById(tab.getAttribute("aria-controls")!),
    ).toBeInTheDocument();
  expect(screen.getAllByRole("tabpanel", { hidden: true })).toHaveLength(2);
});
it("UX-09: pedir por URL una pestaña sin contenido para el lector cae en la predeterminada", async () => {
  page(asViewer(), "?tab=history");
  await screen.findByRole("heading", { level: 1 });
  expect(screen.getByRole("tab", { name: "Decisión" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  expect(
    screen.queryByRole("tab", { name: "Historial" }),
  ).not.toBeInTheDocument();
});
it("UX-09: ADMIN conserva todo lo que el servidor le entrega: conflicto, aportaciones y comparación, sin controles", async () => {
  page({ ...conflict, canReview: false });
  await screen.findByRole("heading", { level: 1 });
  expect(tabNames()).toEqual(["Aportaciones (2)", "Contraste"]);
  expect(screen.getByRole("tab", { name: "Contraste" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  expect(screen.getAllByRole("region", { name: /Postura [AB]/ })).toHaveLength(
    2,
  );
  expect(
    screen.queryByRole("combobox", { name: "Otras acciones" }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: /Resolver conflicto|Más acciones/ }),
  ).not.toBeInTheDocument();
});
it("UX-09: la tarjeta de estado dice por qué no hay acciones: equipo analista para ADMIN/VIEWER, archivo para un analista", async () => {
  page(asViewer(), "", [
    { id: asViewer().projectId, role: "VIEWER", lifecycle: "ACTIVE" },
  ]);
  expect(
    await screen.findByText(
      /Las acciones de revisión corresponden al equipo analista\./,
    ),
  ).toBeVisible();
  expect(screen.getByText("Consulta de solo lectura.")).toBeVisible();
  cleanup();
  page({ ...conflict, canReview: false }, "", [
    { id: conflict.projectId, role: "ANALYST", lifecycle: "ARCHIVED" },
  ]);
  expect(
    await screen.findByText(
      /El proyecto está archivado: no admite acciones de revisión\./,
    ),
  ).toBeVisible();
  expect(screen.queryByText(/equipo analista/)).not.toBeInTheDocument();
  expect(screen.queryByText("Te toca a ti")).not.toBeInTheDocument();
});

it("UX-07: en pantallas estrechas el CTA principal queda a la vista y las demás acciones van en «Más acciones»", async () => {
  narrowViewport();
  page(
    reviewDetailView.parse({ ...conflict, status: "ANSWERED", conflicts: [] }),
  );
  await screen.findByRole("heading", { level: 1 });
  expect(
    screen.getByRole("button", { name: "Registrar decisión" }),
  ).toBeVisible();
  expect(
    screen.queryByRole("combobox", { name: "Otras acciones" }),
  ).not.toBeInTheDocument();
  const user = userEvent.setup();
  await user.click(screen.getByText("Más acciones"));
  // Same actions, same labels as the desktop select (primary excluded).
  expect(
    screen
      .getAllByRole("button")
      .map((b) => b.textContent)
      .filter(
        (text) =>
          /aclaración|parcial|pendiente|conflicto|aplica/i.test(text ?? "") &&
          !/Resolver/.test(text ?? ""),
      ),
  ).toEqual([
    "Solicitar aclaración",
    "Marcar respuesta parcial",
    "Marcar pendiente",
    "Marcar conflicto",
    "Marcar no aplica",
  ]);
});
it("UX-07: elegir una acción del menú abre su diálogo y, al cancelar, el foco vuelve a «Más acciones»", async () => {
  // jsdom has no modal dialogs; the app code under test is unchanged.
  for (const [name, open] of [
    ["showModal", true],
    ["close", false],
  ] as const)
    Object.defineProperty(HTMLDialogElement.prototype, name, {
      configurable: true,
      value(this: HTMLDialogElement) {
        if (open) this.setAttribute("open", "");
        else this.removeAttribute("open");
      },
    });
  narrowViewport();
  page(
    reviewDetailView.parse({ ...conflict, status: "ANSWERED", conflicts: [] }),
  );
  await screen.findByRole("heading", { level: 1 });
  const user = userEvent.setup();
  const trigger = screen.getByText("Más acciones");
  await user.click(trigger);
  await user.click(
    screen.getByRole("button", { name: "Solicitar aclaración" }),
  );
  const dialog = await screen.findByRole("dialog");
  expect(within(dialog).getByText("Solicitar aclaración")).toBeVisible();
  await user.click(within(dialog).getByRole("button", { name: "Cancelar" }));
  await waitFor(() => expect(trigger).toHaveFocus());
});
it("UX-07: en escritorio sigue el selector «Otras acciones» y no aparece el menú móvil", async () => {
  wideViewport();
  page(
    reviewDetailView.parse({ ...conflict, status: "ANSWERED", conflicts: [] }),
  );
  await screen.findByRole("heading", { level: 1 });
  expect(
    screen.getByRole("combobox", { name: "Otras acciones" }),
  ).toBeVisible();
  expect(screen.queryByText("Más acciones")).not.toBeInTheDocument();
});
it("UX-07: solo lectura no ofrece menú de acciones en pantallas estrechas", async () => {
  narrowViewport();
  page({ ...conflict, canReview: false });
  await screen.findByRole("heading", { level: 1 });
  expect(screen.queryByText("Más acciones")).not.toBeInTheDocument();
});
