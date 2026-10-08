import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
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
});
function page(detail: ReviewDetail, search = "") {
  const api = vi
    .spyOn(apiModule, "api")
    .mockImplementation(
      async (key) => (key === "projects" ? [] : detail) as never,
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
