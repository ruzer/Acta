import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { reviewDetailView } from "@requirements/contracts";
import fixture from "../../../../tests/fixtures/analyst-visual.json";
import { api } from "../api";
import { ReviewDetail } from "./ReviewDetail";
vi.mock("../api", () => ({ api: vi.fn() }));
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.resetAllMocks();
  sessionStorage.clear();
});
const detail = reviewDetailView.parse(fixture.conflict);
const filters = `projectId=${detail.projectId}&status=CLARIFICATION_REQUIRED&page=3`;
function page(search = "", state: unknown = null) {
  vi.mocked(api).mockImplementation(
    async (key) => (key === "projects" ? [] : detail) as never,
  );
  const router = createMemoryRouter(
    [{ path: "/projects/:projectId/review/:id", element: <ReviewDetail /> }],
    {
      initialEntries: [
        {
          pathname: `/projects/${detail.projectId}/review/${detail.question.id}`,
          search,
          state,
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
  return router;
}
it("un enlace directo conserva estado, proyecto y página al cambiar de pestaña y recargar", async () => {
  const router = page(`?reviewSearch=${encodeURIComponent(filters)}`);
  await screen.findByRole("heading", { level: 1 });
  expect(
    screen.getByRole("link", { name: "← Revisar respuestas" }),
  ).toHaveAttribute("href", "/review?" + filters);
  await userEvent.setup().click(screen.getByRole("tab", { name: "Historial" }));
  const search = router.state.location.search;
  expect(new URLSearchParams(search).get("reviewSearch")).toBe(filters);
  cleanup();
  page(search);
  await screen.findByRole("heading", { level: 1 });
  expect(
    screen.getByRole("link", { name: "← Revisar respuestas" }),
  ).toHaveAttribute("href", "/review?" + filters);
  expect(api).toHaveBeenCalledTimes(4);
});
it("conserva el retorno existente desde la bandeja sin agregar consultas", async () => {
  page("", { reviewSearch: filters });
  await screen.findByRole("heading", { level: 1 });
  expect(
    screen.getByRole("link", { name: "← Revisar respuestas" }),
  ).toHaveAttribute("href", "/review?" + filters);
  expect(api).toHaveBeenCalledTimes(2);
});
