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
    title: "Actividad",
    question: "Describe la actividad.",
    helpText: "",
    type: "LONG_TEXT",
    required: true,
    config: null,
    options: [],
    position: 1,
    total: 1,
    applicability: "ENABLED",
  },
};
for (const action of ["Guardar y salir", "Enviar respuesta"] as const) {
  for (const [inFlight, manualFails] of [
    [true, false],
    [true, true],
    [false, false],
    [false, true],
  ] as const) {
    it(`${action} reintenta una vez tras un autoguardado fallido ${inFlight ? "en vuelo" : "ya terminado"}; falla manual: ${manualFails}`, async () => {
      let fail!: (error: Error) => void;
      const pending = new Promise<ResponseView>((_, reject) => {
        fail = reject;
      });
      let saves = 0;
      const saved: ResponseView = {
        ...response,
        id: "r",
        lockVersion: 1,
        draft: {
          id: "d",
          basedOnRevisionId: null,
          lockVersion: 1,
          updatedAt: new Date().toISOString(),
          answer: "Texto actualizado que debe conservarse",
          comment: "",
          example: "",
          consultationRequested: false,
          evidence: [],
        },
      };
      vi.mocked(api).mockImplementation(async (key) => {
        if (key === "getResponse") return response as never;
        if (key === "saveDraft") {
          if (++saves === 1) return pending as never;
          if (manualFails) throw new ApiFailure(503, "Servicio no disponible.");
          return saved as never;
        }
        if (key === "submitResponse")
          return { ...saved, lockVersion: 2 } as never;
        throw new Error(`Llamada inesperada: ${key}`);
      });
      const router = createMemoryRouter(
        [
          {
            path: "/projects/:projectId/respond/:id",
            element: <Respond userId="participant" />,
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
      fireEvent.change(
        await screen.findByLabelText("Tu respuesta", { exact: true }),
        { target: { value: "Texto que debe conservarse" } },
      );
      await act(async () => {
        void autosave.save();
      });
      expect(saves).toBe(1);
      fireEvent.change(screen.getByLabelText("Tu respuesta", { exact: true }), {
        target: { value: "Texto actualizado que debe conservarse" },
      });
      if (!inFlight)
        await act(async () => {
          fail(new ApiFailure(503, "No se pudo guardar."));
        });
      fireEvent.click(screen.getByRole("button", { name: action }));
      if (inFlight)
        await act(async () => {
          fail(new ApiFailure(503, "No se pudo guardar."));
        });
      await waitFor(() => expect(saves).toBe(2));
      const writes = vi
        .mocked(api)
        .mock.calls.filter(([key]) => key === "saveDraft");
      expect(writes[1]![2]).toMatchObject({
        answer: "Texto actualizado que debe conservarse",
        expectedVersion: 0,
      });
      if (manualFails) {
        await waitFor(() =>
          expect(screen.getByRole("status")).toHaveTextContent(
            "No se pudo guardar. Tu texto sigue aquí",
          ),
        );
        expect(
          screen.getByLabelText("Tu respuesta", { exact: true }),
        ).toHaveValue("Texto actualizado que debe conservarse");
        expect(router.state.location.pathname).toBe("/projects/p/respond/q");
        expect(screen.getByRole("button", { name: action })).toBeEnabled();
      } else {
        await screen.findByRole("heading", { name: "Mi trabajo ficticio" });
      }
      expect(
        vi.mocked(api).mock.calls.filter(([key]) => key === "submitResponse"),
      ).toHaveLength(action === "Enviar respuesta" && !manualFails ? 1 : 0);
    });
  }
}
