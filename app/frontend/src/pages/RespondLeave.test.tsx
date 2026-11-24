import { afterEach, beforeAll, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { createMemoryRouter, Link, RouterProvider } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "@testing-library/jest-dom/vitest";
import type { ResponseView } from "@requirements/contracts";
import { api, ApiFailure } from "../api";
import { Respond } from "./Respond";

const autosave = vi.hoisted(() => ({
  save: async (): Promise<unknown> => null,
  reset: vi.fn(),
}));
vi.mock("../use-draft-autosave", () => ({
  useDraftAutosave: ({ save }: { save: () => Promise<unknown> }) => {
    autosave.save = save;
    return autosave.reset;
  },
}));
vi.mock("../api", async (original) => ({
  ...(await original<typeof import("../api")>()),
  api: vi.fn(),
}));
vi.mock("./ParticipantFlow", async (original) => ({
  ...(await original<typeof import("./ParticipantFlow")>()),
  nextParticipantPath: vi.fn(async () => "/projects/p/work"),
}));
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
    this.querySelector<HTMLElement>("button")?.focus();
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute("open");
  };
});
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
  sessionStorage.clear();
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
function open(save: () => Promise<ResponseView>) {
  vi.mocked(api).mockImplementation(async (key) => {
    if (key === "getResponse") return response as never;
    if (key === "saveDraft") return (await save()) as never;
    throw new Error(`Llamada inesperada: ${key}`);
  });
  const router = createMemoryRouter(
    [
      {
        path: "/projects/:projectId/respond/:id",
        element: (
          <>
            <Link to="/projects/p/work">Volver al listado</Link>
            <Respond userId="persona-ficticia" />
          </>
        ),
      },
      {
        path: "/projects/:projectId/work",
        element: <h1>Mi trabajo ficticio</h1>,
      },
    ],
    { initialEntries: ["/projects/p/respond/q"] },
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
async function edit(value = "2") {
  fireEvent.change(await screen.findByLabelText("Tu respuesta: número"), {
    target: { value },
  });
}
for (const fails of [false, true]) {
  it(`Guardar y salir desde el diálogo usa el mismo guardado y ${fails ? "conserva el borrador y el diálogo si falla" : "continúa a la navegación pendiente"}`, async () => {
    const save = vi.fn(async () => {
      if (fails) throw new ApiFailure(503, "Servicio no disponible.");
      return saved;
    });
    const router = open(save);
    await edit();
    const opener = screen.getByRole("link", { name: "Volver al listado" });
    opener.focus();
    fireEvent.click(opener);
    const dialog = await screen.findByRole("dialog", {
      name: "Tienes cambios sin guardar",
    });
    expect(
      within(dialog).getByRole("button", { name: "Guardar y salir" }),
    ).toHaveFocus();
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Guardar y salir" }),
    );
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    expect(
      vi.mocked(api).mock.calls.find(([key]) => key === "saveDraft")?.[2],
    ).toMatchObject({ answer: 2, expectedVersion: 0 });
    if (fails) {
      await waitFor(() =>
        expect(dialog).toHaveTextContent("Servicio no disponible."),
      );
      expect(router.state.location.pathname).toBe("/projects/p/respond/q");
      expect(screen.getByLabelText("Tu respuesta: número")).toHaveValue("2");
      fireEvent.click(
        within(dialog).getByRole("button", { name: "Volver al borrador" }),
      );
      expect(opener).toHaveFocus();
    } else {
      await screen.findByRole("heading", { name: "Mi trabajo ficticio" });
      expect(router.state.location.pathname).toBe("/projects/p/work");
    }
  });
}

it("cerrar el diálogo durante un guardado no reanuda después una salida que ya se canceló", async () => {
  let finish!: () => void;
  const save = vi.fn(
    () =>
      new Promise<ResponseView>((resolve) => {
        finish = () => resolve(saved);
      }),
  );
  const router = open(save);
  await edit();
  const opener = screen.getByRole("link", { name: "Volver al listado" });
  opener.focus();
  fireEvent.click(opener);
  const dialog = await screen.findByRole("dialog");
  fireEvent.click(
    within(dialog).getByRole("button", { name: "Guardar y salir" }),
  );
  await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
  fireEvent.click(
    within(dialog).getByRole("button", { name: "Volver al borrador" }),
  );
  expect(opener).toHaveFocus();
  await act(async () => finish());
  expect(router.state.location.pathname).toBe("/projects/p/respond/q");
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(screen.getByLabelText("Tu respuesta: número")).toHaveValue("2");
  expect(save).toHaveBeenCalledTimes(1);
});
it("no sale ni pierde una edición más reciente recibida mientras el guardado estaba en vuelo", async () => {
  let finish!: () => void;
  const save = vi.fn(
    () =>
      new Promise<ResponseView>((resolve) => {
        finish = () => resolve(saved);
      }),
  );
  const router = open(save);
  await edit("2");
  fireEvent.click(screen.getByRole("link", { name: "Volver al listado" }));
  const dialog = await screen.findByRole("dialog");
  fireEvent.click(
    within(dialog).getByRole("button", { name: "Guardar y salir" }),
  );
  await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
  // Simula una edición ya encolada; no habilita controles durante la petición.
  fireEvent.change(screen.getByLabelText("Tu respuesta: número"), {
    target: { value: "3" },
  });
  await act(async () => finish());
  expect(router.state.location.pathname).toBe("/projects/p/respond/q");
  expect(screen.getByLabelText("Tu respuesta: número")).toHaveValue("3");
  expect(within(dialog).getByRole("alert")).toHaveTextContent(
    "Hay cambios más recientes. Guárdalos antes de salir.",
  );
  expect(save).toHaveBeenCalledTimes(1);
});

it("Guardar y salir conserva el borrador antes de continuar el cierre de sesión solicitado", async () => {
  const save = vi.fn(async () => saved);
  open(save);
  await edit();
  const proceed = vi.fn();
  const event = new CustomEvent("before-session-logout", {
    cancelable: true,
    detail: { proceed },
  });
  await act(async () => {
    window.dispatchEvent(event);
  });
  expect(event.defaultPrevented).toBe(true);
  const dialog = await screen.findByRole("dialog");
  fireEvent.click(
    within(dialog).getByRole("button", { name: "Guardar y salir" }),
  );
  await waitFor(() => expect(proceed).toHaveBeenCalledTimes(1));
  expect(save).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});
