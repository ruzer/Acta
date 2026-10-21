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
import { historyView } from "@requirements/contracts";
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
const question = {
  kind: "QUESTION",
  id: "00000000-0000-4000-8000-0000000000aa",
  reference: "Q-011",
  label: "Requisito ficticio 11",
};
const invitation = {
  kind: "INVITATION",
  id: "00000000-0000-4000-8000-0000000000bb",
  reference: null,
  label: "Aportación A-12",
};
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
  subject: question,
  ...extra,
});
function history(
  items: unknown[],
  total = items.length,
  extra: Record<string, unknown> = {},
) {
  return historyView.parse({
    items,
    total,
    page: 1,
    pageSize: 25,
    actors: [{ id: actor, displayName: "Analista de ejemplo" }],
    invitationActors: 0,
    ...extra,
  });
}
function serve(log: unknown) {
  vi.mocked(exchangeRequest).mockResolvedValue(log as never);
}
function StateProbe() {
  return <p data-testid="state">{JSON.stringify(useLocation().state)}</p>;
}
function setup(search = "") {
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <MemoryRouter initialEntries={["/projects/project-a/history" + search]}>
        <Routes>
          <Route path="/projects/:projectId/history" element={<History />} />
          <Route
            path="/projects/:projectId/review/:id"
            element={<StateProbe />}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return userEvent.setup();
}

it("lo que el servidor puede nombrar se muestra con su nombre y una pregunta enlaza a su revisión", async () => {
  serve(
    history([
      event(1),
      event(2, {
        action: "RESPONSE_SUBMITTED",
        objectType: "Response",
        objectId: "00000000-0000-4000-8000-0000000000cc",
      }),
      event(3, {
        action: "INVITATION_CREATED",
        objectType: "ResponseInvitation",
        subject: invitation,
      }),
    ]),
  );
  setup();
  const links = await screen.findAllByRole("link", {
    name: `${question.reference} · ${question.label}`,
  });
  // The validation and the submitted response name the same question.
  expect(links).toHaveLength(2);
  expect(links[0]).toHaveAttribute(
    "href",
    `/projects/project-a/review/${question.id}`,
  );
  expect(screen.getByText("Aportación A-12")).toBeVisible();
  expect(screen.queryByText("Identificador")).not.toBeInTheDocument();
});
it("lo que no se puede nombrar conserva su identificador: no se inventa nada", async () => {
  serve(
    history([
      event(1, {
        objectType: "Response",
        action: "RESPONSE_SUBMITTED",
        subject: null,
      }),
    ]),
  );
  setup();
  await screen.findByRole("table", { name: "Eventos registrados" });
  expect(screen.getByText("Identificador")).toBeVisible();
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
it("el filtro Actor lista las cuentas y una sola opción para todas las invitaciones", async () => {
  serve(history([event(1)], 1, { invitationActors: 63 }));
  const user = setup();
  await screen.findByRole("table", { name: "Eventos registrados" });
  const select = screen.getByLabelText("Actor");
  const options = within(select)
    .getAllByRole("option")
    .map((option) => option.textContent);
  expect(options).toEqual([
    "Todos",
    "Invitaciones externas (63)",
    "Analista de ejemplo",
  ]);
  await user.selectOptions(select, "Invitaciones externas (63)");
  await waitFor(() =>
    expect(exchangeRequest).toHaveBeenLastCalledWith(
      "project-a",
      "history",
      historyView,
      { query: { actorKind: "INVITATION" } },
    ),
  );
  // Choosing an account replaces the kind instead of adding to it.
  await user.selectOptions(select, "Analista de ejemplo");
  await waitFor(() =>
    expect(exchangeRequest).toHaveBeenLastCalledWith(
      "project-a",
      "history",
      historyView,
      { query: { actorId: actor } },
    ),
  );
});
it("sin invitaciones no se ofrece la opción, y una invitación ya filtrada se ve elegida", async () => {
  serve(history([event(1)]));
  setup();
  await screen.findByRole("table", { name: "Eventos registrados" });
  const select = screen.getByLabelText("Actor");
  expect(
    within(select).queryByRole("option", { name: /Invitaciones externas/ }),
  ).not.toBeInTheDocument();
  cleanup();
  const invited = "00000000-0000-4000-8000-0000000000dd";
  serve(
    history([event(1)], 1, {
      actors: [
        { id: actor, displayName: "Analista de ejemplo" },
        { id: invited, displayName: "Invitación: Aportación A-12" },
      ],
      invitationActors: 1,
    }),
  );
  setup(`?actorId=${invited}`);
  await screen.findByRole("table", { name: "Eventos registrados" });
  expect(screen.getByLabelText("Actor")).toHaveDisplayValue(
    "Invitación: Aportación A-12",
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
        subject: null,
      }),
    ]),
  );
  setup();
  expect(
    await screen.findByRole("columnheader", { name: "Detalle" }),
  ).toBeVisible();
  expect(screen.getByText("JSON full")).toBeVisible();
});
it("al abrir una pregunta desde la Bitácora se conserva el filtro para volver", async () => {
  serve(history([event(1)]));
  const user = setup("?action=RESPONSE_VALIDATED&page=2");
  await user.click(
    await screen.findByRole("link", {
      name: `${question.reference} · ${question.label}`,
    }),
  );
  expect(JSON.parse(screen.getByTestId("state").textContent!)).toEqual({
    logReturn: "/projects/project-a/history?action=RESPONSE_VALIDATED&page=2",
  });
});
