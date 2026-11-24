import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import {
  focusManager,
  onlineManager,
  QueryClient,
  QueryClientProvider,
  useQuery,
} from "@tanstack/react-query";
import "@testing-library/jest-dom/vitest";
import {
  type PersonalProjectView,
  type ProjectView,
  type ResponseView,
} from "@requirements/contracts";
import { api, exchangeRequest } from "../api";
import { BrandingProvider } from "../branding";
import { ParticipantHome, MyWork, ProjectWork } from "./MyWork";
import { Respond } from "./Respond";
import { SessionReceipt } from "./ParticipantFlow";
import { responseDeadlineQuery, responseDueLabel } from "./ResponseDeadline";

vi.mock("../api", async (original) => ({
  ...(await original<typeof import("../api")>()),
  api: vi.fn(),
  exchangeRequest: vi.fn(),
}));
vi.mock("../use-draft-autosave", () => ({ useDraftAutosave: () => vi.fn() }));
const due = "2031-03-16T05:59:59.999Z";
const timezone = "America/Mexico_City";
const work = (id: string): PersonalProjectView => ({
  projectName: `Proyecto ${id}`,
  continueQuestionId: `${id}-q`,
  progress: {
    total: 1,
    enabled: 1,
    sent: 0,
    drafts: 0,
    pending: 1,
    excluded: 0,
    undetermined: 0,
  },
  sections: [
    {
      id: `${id}-s`,
      title: `Tema ${id}`,
      questions: [
        {
          id: `${id}-q`,
          title: `Actividad ${id}`,
          question: `Describe la actividad ${id}.`,
          currentSubmission: false,
          hasSubmission: false,
          applicability: "ENABLED",
          state: "PENDING",
          updatedAt: null,
          reviewStatus: "NOT_REVIEWED",
          clarificationCount: 0,
          clarificationWaiting: 0,
        },
      ],
    },
  ],
});
const project = (id: string): ProjectView => ({
  id,
  name: `Proyecto ${id}`,
  externalId: id,
  description: "",
  lifecycle: "ACTIVE",
  role: "STAKEHOLDER",
  lockVersion: 0,
  questionCount: 1,
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
    id: "p-q",
    sectionId: "p-s",
    sectionTitle: "Tema p",
    title: "Actividad p",
    question: "Describe la actividad p.",
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
const clients: QueryClient[] = [];
beforeEach(() => {
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  vi.mocked(api).mockImplementation(async (key, params) => {
    if (key === "personalProject")
      return work((params as { projectId: string }).projectId) as never;
    if (key === "getResponse") return response as never;
    throw new Error(`Llamada inesperada: ${key}`);
  });
  vi.mocked(exchangeRequest).mockResolvedValue({
    responseDueAt: due,
    lockVersion: 0,
  } as never);
});
afterEach(() => {
  cleanup();
  clients.splice(0).forEach((client) => client.clear());
  focusManager.setFocused(undefined);
  onlineManager.setOnline(true);
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.resetAllMocks();
  sessionStorage.clear();
});
function ConcurrentDeadlineObserver() {
  useQuery(responseDeadlineQuery("p"));
  return null;
}
function open({
  ids = ["p"],
  path = "/",
  concurrent = false,
  client = new QueryClient({
    defaultOptions: { queries: { retry: 2, retryDelay: 10 } },
  }),
} = {}) {
  clients.push(client);
  client.setQueryData(["public-branding"], {
    appName: "Acta",
    shortName: "Acta",
    organizationName: "Organización ficticia",
    logo: "",
    logoSecondary: "",
    secondaryName: "",
    favicon: "",
    accent: "#2b4d7c",
    locale: "es-MX",
    timezone,
  });
  for (const id of ids) client.setQueryData(["my-work", id], work(id));
  const router = createMemoryRouter(
    [
      {
        path: "/",
        element: (
          <>
            <ParticipantHome
              projects={ids.map(project)}
              displayName="Persona ficticia"
            />
            {concurrent && <ConcurrentDeadlineObserver />}
          </>
        ),
      },
      { path: "/away", element: <h1>Otra pantalla</h1> },
      { path: "/projects/:projectId/work", element: <MyWork /> },
      {
        path: "/projects/:projectId/respond/:id",
        element: <Respond userId="persona" />,
      },
      { path: "/projects/:projectId/receipt", element: <SessionReceipt /> },
      {
        path: "/project-list",
        element: <ProjectWork projectId="p" data={work("p")} />,
      },
    ],
    { initialEntries: [path] },
  );
  const view = render(
    <QueryClientProvider client={client}>
      <BrandingProvider>
        <RouterProvider router={router} />
      </BrandingProvider>
    </QueryClientProvider>,
  );
  return { client, router, ...view };
}
const deadlineCalls = () =>
  vi
    .mocked(exchangeRequest)
    .mock.calls.filter(([, route]) => route === "response-deadline");

it("Hola consulta una vez por proyecto mostrado y presenta el plazo con la zona de la organización", async () => {
  const { container } = open({ ids: ["p", "other"] });
  await waitFor(() =>
    expect(
      screen.getAllByText(/Puedes seguir respondiendo después del plazo/),
    ).toHaveLength(2),
  );
  expect(
    deadlineCalls()
      .map(([id]) => id)
      .sort(),
  ).toEqual(["other", "p"]);
  const expected = `${responseDueLabel(due, timezone)}. Puedes seguir respondiendo después del plazo.`;
  for (const section of container.querySelectorAll(".participant-project")) {
    expect(
      within(section as HTMLElement).getByRole("heading", { level: 2 }),
    ).toBeVisible();
    expect(within(section as HTMLElement).getByText(expected)).toBeVisible();
  }
  expect(vi.mocked(api).mock.calls.map(([key]) => key)).toEqual([
    "personalProject",
    "personalProject",
  ]);
});

it("el plazo pendiente no bloquea Hola y conserva un espacio vacío fuera del árbol accesible", async () => {
  vi.mocked(exchangeRequest).mockReturnValue(new Promise(() => {}) as never);
  const { container } = open();
  expect(
    await screen.findByRole("heading", { name: "Hola, Persona" }),
  ).toBeVisible();
  expect(
    await screen.findByRole("link", { name: "Responder: Actividad p" }),
  ).toBeVisible();
  const slot = container.querySelector(".participant-home-deadline");
  expect(slot).not.toBeNull();
  expect(slot).toBeEmptyDOMElement();
  expect(slot).toHaveAttribute("aria-hidden", "true");
  expect(
    screen.queryByText(/Consultando.*plazo|Consultando.*fecha/),
  ).not.toBeInTheDocument();
  expect(deadlineCalls()).toHaveLength(1);
});

it("una consulta concurrente del mismo plazo se deduplica con la clave existente", async () => {
  let finish!: () => void;
  vi.mocked(exchangeRequest).mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = () => resolve({ responseDueAt: due, lockVersion: 0 } as never);
      }),
  );
  open({ concurrent: true });
  await waitFor(() => expect(deadlineCalls()).toHaveLength(1));
  await act(async () => finish());
  expect(
    await screen.findByText(/Puedes seguir respondiendo después del plazo/),
  ).toBeVisible();
  expect(deadlineCalls()).toHaveLength(1);
  expect(responseDeadlineQuery("p").queryKey).toEqual([
    "response-deadline",
    "p",
  ]);
  expect(responseDeadlineQuery("p").staleTime).toBe(0);
});

it("volver a Hola antes de un minuto reutiliza la caché y después permite una sola lectura nueva", async () => {
  vi.useFakeTimers();
  const { client, router } = open();
  await act(async () => vi.advanceTimersByTimeAsync(1));
  expect(deadlineCalls()).toHaveLength(1);
  const savedAt = client.getQueryState([
    "response-deadline",
    "p",
  ])!.dataUpdatedAt;
  await act(async () => router.navigate("/away"));
  vi.setSystemTime(savedAt + 59999);
  await act(async () => router.navigate("/"));
  expect(deadlineCalls()).toHaveLength(1);
  await act(async () => vi.advanceTimersByTimeAsync(1));
  expect(deadlineCalls()).toHaveLength(1);
  await act(async () => router.navigate("/away"));
  vi.setSystemTime(savedAt + 60001);
  await act(async () => {
    await router.navigate("/");
    await vi.advanceTimersByTimeAsync(1);
  });
  expect(deadlineCalls()).toHaveLength(2);
  await act(async () => vi.advanceTimersByTimeAsync(60001));
  expect(deadlineCalls()).toHaveLength(2);
});

it.each(["empty", "failure"])(
  "%s no muestra contenido ni error y no reintenta por foco, conexión o remontaje",
  async (mode) => {
    vi.useFakeTimers();
    if (mode === "failure")
      vi.mocked(exchangeRequest).mockRejectedValue(
        new Error("Error privado del plazo"),
      );
    else
      vi.mocked(exchangeRequest).mockResolvedValue({
        responseDueAt: null,
        lockVersion: 0,
      } as never);
    const { container, router } = open();
    await act(async () => vi.advanceTimersByTimeAsync(100));
    expect(deadlineCalls()).toHaveLength(1);
    expect(
      screen.getByRole("heading", { name: "Hola, Persona" }),
    ).toBeVisible();
    const slot = container.querySelector(".participant-home-deadline");
    expect(slot).not.toBeNull();
    expect(slot).toBeEmptyDOMElement();
    expect(slot).toHaveAttribute("aria-hidden", "true");
    expect(
      screen.queryByText(
        /Error privado|No se pudo consultar|Sin fecha|Sin plazo|Puedes seguir respondiendo después del plazo/,
      ),
    ).not.toBeInTheDocument();
    await act(async () => {
      focusManager.setFocused(false);
      focusManager.setFocused(true);
      onlineManager.setOnline(false);
      onlineManager.setOnline(true);
      await vi.advanceTimersByTimeAsync(100);
    });
    expect(deadlineCalls()).toHaveLength(1);
    await act(async () => router.navigate("/away"));
    await act(async () => {
      await router.navigate("/");
      await vi.advanceTimersByTimeAsync(100);
    });
    expect(deadlineCalls()).toHaveLength(1);
  },
);

it.each([
  ["/projects/p/respond/p-q", 0],
  ["/projects/p/receipt", 0],
  ["/projects/p/work", 1],
  ["/project-list", 0],
] as const)(
  "%s conserva su cantidad previa de consultas del plazo: %i",
  async (path, count) => {
    vi.useFakeTimers();
    open({ path });
    await act(async () => vi.advanceTimersByTimeAsync(100));
    expect(deadlineCalls()).toHaveLength(count);
    expect(vi.mocked(api).mock.calls.some(([key]) => key === "saveDraft")).toBe(
      false,
    );
  },
);
it("sin proyectos no consulta plazos", async () => {
  open({ ids: [] });
  expect(
    await screen.findByRole("heading", { name: "Hola, Persona" }),
  ).toBeVisible();
  expect(deadlineCalls()).toHaveLength(0);
});

it("un refresco fallido con datos anteriores tampoco reintenta al volver a Hola", async () => {
  vi.useFakeTimers();
  const { router, client } = open();
  await act(async () => vi.advanceTimersByTimeAsync(1));
  expect(deadlineCalls()).toHaveLength(1);
  const savedAt = client.getQueryState([
    "response-deadline",
    "p",
  ])!.dataUpdatedAt;
  await act(async () => router.navigate("/away"));
  vi.mocked(exchangeRequest).mockRejectedValue(
    new Error("Error privado del plazo"),
  );
  vi.setSystemTime(savedAt + 60001);
  await act(async () => router.navigate("/"));
  await act(async () => vi.advanceTimersByTimeAsync(100));
  expect(deadlineCalls()).toHaveLength(2);
  expect(
    screen.queryByText(
      /Puedes seguir respondiendo después del plazo|Error privado/,
    ),
  ).not.toBeInTheDocument();
  await act(async () => router.navigate("/away"));
  await act(async () => router.navigate("/"));
  await act(async () => vi.advanceTimersByTimeAsync(100));
  expect(deadlineCalls()).toHaveLength(2);
});
