import { StrictMode, useLayoutEffect } from "react";
import { afterEach, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "@testing-library/jest-dom/vitest";
import type { ResponseView } from "@requirements/contracts";
import { api, ApiFailure } from "../api";
import { Respond } from "./Respond";
import { ParticipantNotice } from "./ParticipantFlow";
import { registerConsultationUndo } from "./ConsultationNotice";

vi.mock("../use-draft-autosave", () => ({ useDraftAutosave: () => vi.fn() }));
vi.mock("../api", async (original) => ({
  ...(await original<typeof import("../api")>()),
  api: vi.fn(),
}));
vi.mock("./ParticipantFlow", async (original) => ({
  ...(await original<typeof import("./ParticipantFlow")>()),
  nextParticipantPath: vi.fn(async () => "/projects/p/work"),
}));
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
  vi.useRealTimers();
  sessionStorage.clear();
  localStorage.clear();
});
const response: ResponseView = {
  id: null,
  lockVersion: 0,
  draft: null,
  revisions: [],
  nextQuestionId: null,
  reviewStatus: "NOT_REVIEWED",
  evidencePolicy: { maxBytes: 20971520, maxAttachments: 10 },
  question: {
    id: "q",
    sectionId: "s",
    sectionTitle: "Tema ficticio",
    title: "Cantidad",
    question: "¿Cuántas solicitudes hay?",
    helpText: "",
    type: "NUMBER",
    required: true,
    config: { min: 1, max: 3, integer: true },
    options: [],
    position: 1,
    total: 1,
    applicability: "ENABLED",
  },
};
const saved: ResponseView = {
  ...response,
  id: "r",
  lockVersion: 1,
  draft: {
    id: "d",
    basedOnRevisionId: null,
    lockVersion: 1,
    updatedAt: "2026-11-23T12:00:00Z",
    answer: 2,
    comment: "",
    example: "",
    consultationRequested: false,
    evidence: [],
  },
};

const consulting: ResponseView = {
  ...saved,
  draft: {
    ...saved.draft!,
    consultationRequested: true,
    comment: "Nota ficticia que no debe viajar en el historial",
  },
};
const reverted: ResponseView = {
  ...saved,
  lockVersion: 2,
  draft: { ...consulting.draft!, lockVersion: 2, consultationRequested: false },
};
function open(undo: () => Promise<ResponseView> = async () => reverted) {
  let writes = 0;
  vi.mocked(api).mockImplementation(async (key) => {
    if (key === "getResponse") return response as never;
    if (key === "saveDraft")
      return (++writes === 1 ? consulting : await undo()) as never;
    throw new Error(`Llamada inesperada: ${key}`);
  });
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const router = createMemoryRouter(
    [
      {
        path: "/projects/:projectId/respond/:id",
        element: <Respond userId="persona-ficticia" />,
      },
      {
        path: "/projects/:projectId/work",
        element: (
          <>
            <ParticipantNotice />
            <h1>Mi trabajo ficticio</h1>
          </>
        ),
      },
    ],
    { initialEntries: ["/projects/p/respond/q"] },
  );
  const view = render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { router, client, ...view };
}
async function consult() {
  fireEvent.change(await screen.findByLabelText("Tu respuesta: número"), {
    target: { value: "2" },
  });
  fireEvent.change(screen.getByLabelText("Comentario adicional (opcional)"), {
    target: { value: consulting.draft!.comment },
  });
  const button = screen.getByRole("button", {
    name: "Necesito consultar esto",
  });
  expect(button).not.toHaveClass("primary");
  fireEvent.click(button);
  await screen.findByRole("heading", { name: "Mi trabajo ficticio" });
}
const writes = () =>
  vi.mocked(api).mock.calls.filter(([key]) => key === "saveDraft");

it("identifica la pregunta anterior y deshace con una sola escritura explícita, sin nuevas lecturas ni contenido en historial o almacenamiento", async () => {
  const { router, client } = open();
  const invalidation = vi.spyOn(client, "invalidateQueries");
  await consult();
  expect(screen.getByRole("status")).toHaveTextContent(
    "La pregunta anterior quedó como Por consultar",
  );
  expect(writes()).toHaveLength(1);
  const history = JSON.stringify(router.state.location.state);
  expect(history).not.toContain(consulting.draft!.comment);
  expect(history).not.toContain("answer");
  expect(sessionStorage.length).toBe(0);
  expect(localStorage.length).toBe(0);
  const readsBefore = vi
    .mocked(api)
    .mock.calls.filter(([key]) => key !== "saveDraft").length;
  fireEvent.click(screen.getByRole("button", { name: "Deshacer" }));
  await waitFor(() =>
    expect(
      screen.queryByRole("button", { name: "Deshacer" }),
    ).not.toBeInTheDocument(),
  );
  expect(writes()).toHaveLength(2);
  expect(writes()[0]![2]).toMatchObject({
    answer: 2,
    comment: consulting.draft!.comment,
    consultationRequested: true,
    expectedVersion: 0,
  });
  expect(writes()[1]![1]).toEqual({ projectId: "p", id: "q" });
  expect(writes()[1]![2]).toMatchObject({
    answer: 2,
    comment: consulting.draft!.comment,
    example: "",
    consultationRequested: false,
    expectedVersion: 1,
  });
  expect(
    vi.mocked(api).mock.calls.filter(([key]) => key !== "saveDraft"),
  ).toHaveLength(readsBefore);
  expect(invalidation).toHaveBeenLastCalledWith({ queryKey: ["my-work", "p"] });
});

it("retira el aviso y Deshacer a los ocho segundos sin hacer otra escritura", async () => {
  open();
  fireEvent.change(await screen.findByLabelText("Tu respuesta: número"), {
    target: { value: "2" },
  });
  vi.useFakeTimers();
  await act(async () => {
    fireEvent.click(
      screen.getByRole("button", { name: "Necesito consultar esto" }),
    );
    await vi.advanceTimersByTimeAsync(1);
  });
  expect(screen.getByRole("button", { name: "Deshacer" })).toBeVisible();
  act(() => vi.advanceTimersByTime(7998));
  expect(screen.getByRole("button", { name: "Deshacer" })).toBeVisible();
  act(() => vi.advanceTimersByTime(1));
  expect(
    screen.queryByRole("button", { name: "Deshacer" }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByText(/La pregunta anterior quedó/),
  ).not.toBeInTheDocument();
  expect(writes()).toHaveLength(1);
});

it("no recupera el aviso al recargar aunque el historial conserve el identificador", async () => {
  const { router, unmount, client } = open();
  await consult();
  expect(screen.getByRole("button", { name: "Deshacer" })).toBeVisible();
  const entry = router.state.location;
  unmount();
  const reloaded = createMemoryRouter(
    [{ path: "*", element: <ParticipantNotice /> }],
    { initialEntries: [entry] },
  );
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={reloaded} />
    </QueryClientProvider>,
  );
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Deshacer" }),
  ).not.toBeInTheDocument();
  expect(writes()).toHaveLength(1);
});

it("no mantiene el aviso al pasar a otra pregunta ni al volver con el mismo estado", async () => {
  const { router } = open();
  await consult();
  expect(screen.getByRole("button", { name: "Deshacer" })).toBeVisible();
  const state = router.state.location.state;
  await act(async () => {
    await router.navigate("/projects/p/respond/otra");
  });
  await screen.findByLabelText("Tu respuesta: número");
  await act(async () => {
    await router.navigate("/projects/p/work", { state });
  });
  expect(
    screen.queryByRole("button", { name: "Deshacer" }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByText(/La pregunta anterior quedó/),
  ).not.toBeInTheDocument();
  expect(writes()).toHaveLength(1);
});

it.each(["session-expired", "session-restored", "pagehide"])(
  "retira el aviso y su acción al recibir %s",
  async (event) => {
    open();
    await consult();
    expect(screen.getByRole("button", { name: "Deshacer" })).toBeVisible();
    act(() =>
      window.dispatchEvent(
        new CustomEvent(event, { detail: { userId: "otra-persona" } }),
      ),
    );
    expect(
      screen.queryByRole("button", { name: "Deshacer" }),
    ).not.toBeInTheDocument();
    expect(writes()).toHaveLength(1);
  },
);

it("un conflicto al deshacer conserva la marca y no sobrescribe cambios concurrentes", async () => {
  open(async () => {
    throw new ApiFailure(409, "El borrador cambió en otra sesión.");
  });
  await consult();
  fireEvent.click(screen.getByRole("button", { name: "Deshacer" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "El borrador cambió en otra sesión.",
  );
  expect(screen.getByRole("status")).toHaveTextContent(
    "La pregunta anterior quedó como Por consultar",
  );
  expect(
    screen.getByRole("link", { name: "Revisar la pregunta anterior" }),
  ).toHaveAttribute("href", "/projects/p/respond/q");
  expect(screen.getByRole("button", { name: "Deshacer" })).toBeDisabled();
  expect(writes()).toHaveLength(2);
  expect(writes()[1]![2]).toMatchObject({ expectedVersion: 1 });
});

it("bloquea el doble clic y no actualiza otra pantalla si Deshacer termina después de salir", async () => {
  let finish!: () => void;
  const { router } = open(
    () =>
      new Promise((resolve) => {
        finish = () => resolve(reverted);
      }),
  );
  await consult();
  const button = screen.getByRole("button", { name: "Deshacer" });
  fireEvent.click(button);
  fireEvent.click(button);
  expect(button).toBeDisabled();
  expect(writes()).toHaveLength(2);
  await act(async () => {
    await router.navigate("/projects/p/respond/otra");
  });
  await screen.findByLabelText("Tu respuesta: número");
  await act(async () => finish());
  expect(screen.queryByText(/Deshiciste/)).not.toBeInTheDocument();
  expect(writes()).toHaveLength(2);
});

it("conserva la acción durante el montaje doble de desarrollo y la consume una sola vez", async () => {
  vi.mocked(api).mockResolvedValue(reverted as never);
  const token = registerConsultationUndo("p", "q", consulting);
  const router = createMemoryRouter(
    [{ path: "*", element: <ParticipantNotice /> }],
    {
      initialEntries: [
        { pathname: "/projects/p/work", state: { consultationUndo: token } },
      ],
    },
  );
  render(
    <StrictMode>
      <QueryClientProvider client={new QueryClient()}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </StrictMode>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Deshacer" }));
  await waitFor(() =>
    expect(
      screen.queryByRole("button", { name: "Deshacer" }),
    ).not.toBeInTheDocument(),
  );
  expect(writes()).toHaveLength(1);
});

it("un fallo de conexión conserva el borrador y un reintento explícito reutiliza la misma clave de operación", async () => {
  let attempts = 0;
  open(async () => {
    if (++attempts === 1)
      throw new ApiFailure(0, "No hay conexión con el servicio.");
    return reverted;
  });
  await consult();
  fireEvent.click(screen.getByRole("button", { name: "Deshacer" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "No hay conexión con el servicio.",
  );
  expect(screen.getByRole("button", { name: "Deshacer" })).toBeEnabled();
  expect(writes()).toHaveLength(2);
  fireEvent.click(screen.getByRole("button", { name: "Deshacer" }));
  await waitFor(() =>
    expect(
      screen.queryByRole("button", { name: "Deshacer" }),
    ).not.toBeInTheDocument(),
  );
  expect(writes()).toHaveLength(3);
  expect(writes()[2]![2]).toEqual(writes()[1]![2]);
});

it.each([true, false])(
  "retira el aviso si la página se oculta entre el render y los efectos (evento anterior al aviso: %s)",
  (before) => {
    function PageHideBeforePassiveEffects() {
      useLayoutEffect(() => {
        window.dispatchEvent(new Event("pagehide"));
      }, []);
      return null;
    }
    const token = registerConsultationUndo("p", "q", consulting);
    const router = createMemoryRouter(
      [
        {
          path: "*",
          element: (
            <>
              {before && <PageHideBeforePassiveEffects />}
              <ParticipantNotice />
              {!before && <PageHideBeforePassiveEffects />}
            </>
          ),
        },
      ],
      {
        initialEntries: [
          { pathname: "/projects/p/work", state: { consultationUndo: token } },
        ],
      },
    );
    render(
      <QueryClientProvider client={new QueryClient()}>
        <RouterProvider router={router} />
      </QueryClientProvider>,
    );
    expect(
      screen.queryByRole("button", { name: "Deshacer" }),
    ).not.toBeInTheDocument();
    expect(writes()).toHaveLength(0);
  },
);

it.each(["pagehide", "session-expired", "session-restored", "expiry"])(
  "cancela un registro que todavía no se mostró al ocurrir %s",
  (event) => {
    vi.useFakeTimers();
    const token = registerConsultationUndo("p", "q", consulting);
    if (event === "expiry") act(() => vi.advanceTimersByTime(8000));
    else act(() => window.dispatchEvent(new Event(event)));
    const router = createMemoryRouter(
      [{ path: "*", element: <ParticipantNotice /> }],
      {
        initialEntries: [
          { pathname: "/projects/p/work", state: { consultationUndo: token } },
        ],
      },
    );
    render(
      <QueryClientProvider client={new QueryClient()}>
        <RouterProvider router={router} />
      </QueryClientProvider>,
    );
    expect(
      screen.queryByRole("button", { name: "Deshacer" }),
    ).not.toBeInTheDocument();
    expect(writes()).toHaveLength(0);
  },
);
