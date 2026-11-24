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
afterEach(() => {
  cleanup();
  vi.useRealTimers();
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
        element: <Respond userId="persona-ficticia" />,
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
it("un error de campo no agrega resumen; al corregirlo desaparece y vuelve a Cambios sin guardar", async () => {
  open(async () => {
    throw new ApiFailure(422, "Revisa tu respuesta.", {
      answer: "El número debe estar entre 1 y 3.",
    });
  });
  await edit("8");
  await act(async () => {
    await autosave.save();
  });
  await waitFor(() =>
    expect(screen.getByLabelText("Tu respuesta: número")).toHaveAttribute(
      "aria-invalid",
      "true",
    ),
  );
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  await waitFor(() =>
    expect(screen.getByText(/No se pudo guardar:/)).toHaveTextContent(
      "El número debe estar entre 1 y 3. Tu texto sigue aquí",
    ),
  );
  expect(screen.getByRole("status")).toHaveAttribute(
    "data-save-state",
    "error",
  );
  expect(
    screen.getByRole("status").querySelector('[data-icon="info"]'),
  ).not.toBeNull();
  await edit("2");
  expect(screen.getByLabelText("Tu respuesta: número")).toHaveAttribute(
    "aria-invalid",
    "false",
  );
  expect(
    screen.queryByText("El número debe estar entre 1 y 3."),
  ).not.toBeInTheDocument();
  expect(screen.getByText("Cambios sin guardar")).toBeVisible();
  expect(screen.getByRole("status")).toHaveAttribute(
    "data-save-state",
    "unsaved",
  );
  expect(
    screen.getByRole("status").querySelector('[data-icon="edit"]'),
  ).not.toBeNull();
  expect(
    vi.mocked(api).mock.calls.filter(([key]) => key === "saveDraft"),
  ).toHaveLength(1);
});
it("dos errores muestran un solo resumen, cada campo conserva su explicación", async () => {
  open(async () => {
    throw new ApiFailure(422, "Revisa estos dos campos.", {
      answer: "Corrige el número.",
      comment: "Corrige el comentario.",
    });
  });
  await edit();
  await act(async () => {
    await autosave.save();
  });
  expect(screen.getAllByRole("alert")).toHaveLength(1);
  expect(screen.getByRole("alert")).toHaveTextContent(
    "Revisa estos dos campos.",
  );
  expect(
    screen.getByLabelText("Tu respuesta: número"),
  ).toHaveAccessibleDescription("Corrige el número.");
  expect(
    screen.getByLabelText("Comentario adicional (opcional)"),
  ).toHaveAccessibleDescription("Corrige el comentario.");
});

it("Guardando dura al menos 500 ms sin retrasar la petición ni agregar escrituras", async () => {
  let finish!: () => void;
  const save = vi.fn(
    () =>
      new Promise<ResponseView>((resolve) => {
        finish = () => resolve(saved);
      }),
  );
  open(save);
  await edit();
  expect(screen.getByRole("status")).toHaveTextContent("Cambios sin guardar");
  vi.useFakeTimers();
  await act(async () => {
    void autosave.save();
  });
  expect(save).toHaveBeenCalledTimes(1);
  expect(screen.getByRole("status")).toHaveTextContent("Guardando…");
  await act(async () => {
    await vi.advanceTimersByTimeAsync(100);
    finish();
  });
  expect(screen.getByRole("status")).toHaveTextContent("Guardando…");
  await act(async () => {
    await vi.advanceTimersByTimeAsync(399);
  });
  expect(screen.getByRole("status")).toHaveTextContent("Guardando…");
  await act(async () => {
    await vi.advanceTimersByTimeAsync(1);
  });
  expect(screen.getByRole("status")).toHaveTextContent(
    "Borrador guardado a las",
  );
  expect(screen.getByRole("status")).toHaveAttribute(
    "data-save-state",
    "saved",
  );
  expect(save).toHaveBeenCalledTimes(1);
});
it("Guardar y salir no espera los 500 ms visuales para permitir la navegación exitosa", async () => {
  const save = vi.fn(async () => saved);
  const router = open(save);
  await edit();
  vi.useFakeTimers();
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Guardar y salir" }));
  });
  expect(router.state.location.pathname).toBe("/projects/p/work");
  expect(save).toHaveBeenCalledTimes(1);
});

it("un número editado durante el guardado conserva el cambio reciente y su estado pendiente", async () => {
  let finish!: () => void;
  const save = vi.fn(
    () =>
      new Promise<ResponseView>((resolve) => {
        finish = () => resolve(saved);
      }),
  );
  open(save);
  await edit("2");
  await act(async () => {
    void autosave.save();
  });
  await edit("3");
  await act(async () => {
    finish();
  });
  await waitFor(() =>
    expect(screen.getByRole("status")).toHaveTextContent("Cambios sin guardar"),
  );
  expect(screen.getByLabelText("Tu respuesta: número")).toHaveValue("3");
  const writes = vi
    .mocked(api)
    .mock.calls.filter(([key]) => key === "saveDraft");
  expect(writes).toHaveLength(1);
  expect(writes[0]![2]).toMatchObject({ answer: 2, expectedVersion: 0 });
});
