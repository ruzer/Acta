import { afterEach, beforeAll, expect, it, vi } from "vitest";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  createMemoryRouter,
  RouterProvider,
  useParams,
} from "react-router-dom";
import { reviewDetailView } from "@requirements/contracts";
import * as apiModule from "../api";
import { ReviewDetail } from "./ReviewDetail";
import { ReviewQueueNav } from "./ReviewQueueNav";
import { queuePath, storeReviewQueue } from "../review-queue";
import { useReviewQueue } from "../use-review-queue";
import fixture from "../../../../tests/fixtures/analyst-visual.json";

const uuid = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const projectId = fixture.projectId;
const ids = [uuid(1), uuid(2), uuid(3)];
const token = uuid(99);
const search = "status=ANSWERED";
const queue = {
  search,
  capturedAt: new Date().toISOString(),
  items: ids.map((id) => ({ id, projectId })),
};
const details = ids.map((id, index) =>
  reviewDetailView.parse({
    ...fixture.conflict,
    question: {
      ...fixture.conflict.question,
      id,
      question: `Pregunta ${index + 1}`,
      title: `Pregunta ${index + 1}`,
    },
    status: "ANSWERED",
    conflicts: [],
    threads: [],
    validations: [],
    partialReviewReason: null,
  }),
);
const list = {
  items: ids.map((questionId) => ({ questionId, projectId })),
  total: 3,
  page: 1,
  pageSize: 100,
};
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute("open");
  };
});
afterEach(() => {
  cleanup();
  sessionStorage.clear();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
function setupDetail(cached = true) {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: /min-width:\s*900px/.test(query),
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
  });
  for (const d of cached ? details : details.slice(0, 1))
    client.setQueryData(["review", projectId, d.question.id], d);
  storeReviewQueue("reviewer", token, queue);
  const api = vi
    .spyOn(apiModule, "api")
    .mockImplementation(async (key, params) => {
      if (key === "projects") return [] as never;
      if (key === "getReviewDetail")
        return details.find((d) => d.question.id === params?.id) as never;
      if (key === "listReviewInbox") return list as never;
      if (key === "validateQuestion") return {} as never;
      throw new Error(`Unexpected ${key}`);
    });
  const router = createMemoryRouter(
    [
      {
        path: "/projects/:projectId/review/:id",
        element: <ReviewDetail userId="reviewer" />,
      },
    ],
    { initialEntries: [queuePath(queue.items[0]!, token, search)] },
  );
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { client, api, router };
}
it.each([true, false])(
  "Guardar y pasar conserva el foco del encabezado, destino en caché: %s",
  async (cached) => {
    const raf: FrameRequestCallback[] = [];
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      raf.push(callback);
      return raf.length;
    });
    const { router } = setupDetail(cached);
    const user = userEvent.setup();
    await user.click(
      screen.getByRole("button", { name: /^Registrar decisión$/ }),
    );
    await user.type(
      screen.getByLabelText("Decisión acordada"),
      "Decisión ficticia",
    );
    await user.type(screen.getByLabelText("Alcance"), "Prueba");
    await user.type(screen.getByLabelText("Comentario interno"), "Revisado");
    await user.click(screen.getByRole("button", { name: "Seleccionar todas" }));
    await user.click(
      screen.getByRole("button", { name: "Guardar y pasar a la siguiente" }),
    );
    await waitFor(() =>
      expect(router.state.location.pathname).toContain(ids[1]),
    );
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    await act(async () => {
      for (const callback of raf.splice(0)) callback(0);
    });
    expect(screen.getByRole("heading", { level: 1 })).toHaveFocus();
  },
);

function QueueScreen() {
  const { projectId = "", id = "" } = useParams();
  return <ReviewQueueNav queue={useReviewQueue("reviewer", projectId, id)} />;
}
it.each([true, false])(
  "volver tras seis minutos conserva la cola sin otra consulta, almacenamiento bloqueado: %s",
  async (storageBlocked) => {
    if (storageBlocked)
      vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
        throw new Error("blocked");
      });
    if (storageBlocked)
      vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
        throw new Error("blocked");
      });
    const api = vi.spyOn(apiModule, "api").mockResolvedValue(list as never);
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const url = queuePath(queue.items[0]!, token, search);
    const router = createMemoryRouter(
      [
        { path: "/projects/:projectId/review/:id", element: <QueueScreen /> },
        { path: "/elsewhere", element: <p>Otra pantalla</p> },
      ],
      { initialEntries: [url] },
    );
    render(
      <QueryClientProvider client={client}>
        <RouterProvider router={router} />
      </QueryClientProvider>,
    );
    await screen.findByText(/Pregunta 1 de 3/);
    expect(api).toHaveBeenCalledTimes(1);
    vi.useFakeTimers();
    await act(async () => router.navigate("/elsewhere"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(360_000);
    });
    vi.useRealTimers();
    api.mockResolvedValue({
      ...list,
      items: [...list.items].reverse(),
    } as never);
    await act(async () => router.navigate(url));
    await screen.findByText(/Pregunta [13] de 3/);
    expect(api).toHaveBeenCalledTimes(1);
  },
);
