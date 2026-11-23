import { afterEach, expect, it, vi } from "vitest";
import {
  cleanup,
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  createMemoryRouter,
  RouterProvider,
  useParams,
} from "react-router-dom";
import { reviewInboxView } from "@requirements/contracts";
import { api } from "../api";
import { queuePath } from "../review-queue";
import { clearSessionPresentation } from "../session-presentation";
import { useReviewQueue } from "../use-review-queue";
import { ReviewQueueNav } from "./ReviewQueueNav";

vi.mock("../api", () => ({ api: vi.fn() }));
const projectId = "00000000-0000-4000-8000-000000000001";
const ids = [2, 3, 4].map(
  (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`,
);
const token = "00000000-0000-4000-8000-000000000005";
const list = reviewInboxView.parse({
  items: ids.map((questionId) => ({
    questionId,
    projectId,
    projectName: "Ejemplo",
    sectionId: projectId,
    sectionTitle: "Tema",
    question: "No se debe guardar el enunciado",
    status: "ANSWERED",
    priority: "P1",
    areaId: projectId,
    areaName: "Equipo",
    respondents: [],
    lastContributionAt: null,
    hasEvidence: false,
    openClarifications: 0,
  })),
  page: 1,
  pageSize: 100,
  total: 3,
  filters: { projects: [], sections: [], areas: [], participants: [] },
});
afterEach(() => {
  cleanup();
  sessionStorage.clear();
  vi.resetAllMocks();
  vi.restoreAllMocks();
});
function Screen() {
  const { projectId = "", id = "" } = useParams();
  return <ReviewQueueNav queue={useReviewQueue("persona", projectId, id)} />;
}
function open(
  url = queuePath({ projectId, id: ids[0]! }, token, "status=ANSWERED"),
) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const router = createMemoryRouter(
    [{ path: "/projects/:projectId/review/:id", element: <Screen /> }],
    { initialEntries: [url] },
  );
  return {
    ...render(
      <QueryClientProvider client={client}>
        <RouterProvider router={router} />
      </QueryClientProvider>,
    ),
    router,
    client,
  };
}
it("recorre la lista congelada en ambos sentidos sin volver a consultarla", async () => {
  vi.mocked(api).mockResolvedValue(list as never);
  const { router } = open();
  expect(await screen.findByText(/Pregunta 1 de 3 en/)).toBeVisible();
  expect(
    screen.queryByRole("link", { name: /Anterior:/ }),
  ).not.toBeInTheDocument();
  fireEvent.click(
    screen.getByRole("link", { name: /Siguiente: pregunta 2 de 3/ }),
  );
  expect(await screen.findByText(/Pregunta 2 de 3 en/)).toBeVisible();
  expect(router.state.location.pathname).toContain(ids[1]);
  fireEvent.click(
    screen.getByRole("link", { name: /Siguiente: pregunta 3 de 3/ }),
  );
  expect(await screen.findByText(/Pregunta 3 de 3 en/)).toBeVisible();
  expect(
    screen.queryByRole("link", { name: /Siguiente:/ }),
  ).not.toBeInTheDocument();
  fireEvent.click(
    screen.getByRole("link", { name: /Anterior: pregunta 2 de 3/ }),
  );
  expect(await screen.findByText(/Pregunta 2 de 3 en/)).toBeVisible();
  expect(api).toHaveBeenCalledTimes(1);
});
it("recupera la misma posición al recargar sin una nueva lectura de la lista", async () => {
  vi.mocked(api).mockResolvedValue(list as never);
  const first = open();
  await screen.findByText(/Pregunta 1 de 3 en/);
  fireEvent.click(screen.getByRole("link", { name: /Siguiente:/ }));
  await screen.findByText(/Pregunta 2 de 3 en/);
  const url =
    first.router.state.location.pathname + first.router.state.location.search;
  first.unmount();
  open(url);
  expect(await screen.findByText(/Pregunta 2 de 3 en/)).toBeVisible();
  expect(api).toHaveBeenCalledTimes(1);
  clearSessionPresentation();
  expect(sessionStorage.length).toBe(0);
});
it("no consulta ni muestra cola en una entrada ajena a la bandeja", async () => {
  open(`/projects/${projectId}/review/${ids[0]}`);
  expect(
    screen.queryByRole("region", { name: "Lista de revisión" }),
  ).not.toBeInTheDocument();
  expect(api).not.toHaveBeenCalled();
});
it("si falla la lectura ofrece volver, sin inventar otra cola ni reintentar sola", async () => {
  vi.mocked(api).mockRejectedValue(
    new Error("No tienes acceso a este proyecto."),
  );
  open();
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "No tienes acceso a este proyecto.",
  );
  expect(
    screen.getByRole("link", { name: "Volver a la bandeja" }),
  ).toHaveAttribute("href", "/review?status=ANSWERED");
  expect(
    screen.queryByRole("link", { name: /Siguiente:/ }),
  ).not.toBeInTheDocument();
  expect(api).toHaveBeenCalledTimes(1);
});
it("no sustituye una pregunta que salió del filtro mientras se abría", async () => {
  vi.mocked(api).mockResolvedValue({ ...list, items: [], total: 0 } as never);
  open();
  expect(await screen.findByText(/Esta pregunta ya no estaba/)).toBeVisible();
  expect(
    screen.queryByRole("link", { name: /Siguiente:/ }),
  ).not.toBeInTheDocument();
});
it("si el navegador bloquea sessionStorage la navegación funciona con la memoria de la sesión", async () => {
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new Error("no");
  });
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
    throw new Error("no");
  });
  vi.mocked(api).mockResolvedValue(list as never);
  open();
  await screen.findByText(/Pregunta 1 de 3 en/);
  fireEvent.click(screen.getByRole("link", { name: /Siguiente:/ }));
  await waitFor(() =>
    expect(screen.getByText(/Pregunta 2 de 3 en/)).toBeVisible(),
  );
  expect(api).toHaveBeenCalledTimes(1);
});

it("una lectura que termina después de cerrar la sesión no vuelve a guardar la cola", async () => {
  let resolve!: (value: never) => void;
  vi.mocked(api).mockImplementation(
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  const view = open();
  await screen.findByRole("status");
  view.unmount();
  view.client.clear();
  clearSessionPresentation();
  await act(async () => resolve(list as never));
  expect(sessionStorage.length).toBe(0);
});
