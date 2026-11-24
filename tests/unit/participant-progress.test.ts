import { createElement } from "react";
import { randomUUID } from "node:crypto";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "@testing-library/jest-dom/vitest";
import type {
  PersonalProjectView,
  ResponseView,
  ProjectView,
} from "@requirements/contracts";
import {
  ResponseGraph,
  type FullQuestion,
  type FullResponse,
} from "../../app/backend/src/responses/response-graph.js";
import { summarizeParticipation } from "../../app/backend/src/visibility/participation.js";
import { api, exchangeRequest } from "../../app/frontend/src/api";
import {
  MyWork,
  ParticipantHome,
  PersonalProgress,
} from "../../app/frontend/src/pages/MyWork";
import { Participation } from "../../app/frontend/src/pages/Participation";
import { Respond } from "../../app/frontend/src/pages/Respond";
import { ParticipantHeader } from "../../app/frontend/src/pages/ParticipantShell";

vi.mock("../../app/frontend/src/api", async (original) => ({
  ...(await original<typeof import("../../app/frontend/src/api")>()),
  api: vi.fn(),
  exchangeRequest: vi.fn(),
}));
vi.mock("../../app/frontend/src/use-draft-autosave", () => ({
  useDraftAutosave: () => vi.fn(),
}));
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
  sessionStorage.clear();
});

function fixture() {
  const sectionId = randomUUID();
  const kinds = [
    "sent",
    "not-applicable",
    "draft",
    "sent-draft",
    "pending",
    "historical",
    "disabled",
    "undetermined",
  ];
  // Solo los campos leídos por las dos proyecciones reales; no se escribe en la base.
  const questions = kinds.map((kind, i) => ({
    id: randomUUID(),
    sectionId,
    section: { id: sectionId, title: "Tema ficticio" },
    status: kind === "not-applicable" ? "NOT_APPLICABLE" : "NOT_REVIEWED",
    QuestionCondition_child: null,
    QuestionRevision_questionRecord: [
      { id: randomUUID(), title: kind, question: `Pregunta ficticia ${i + 1}` },
    ],
  })) as unknown as FullQuestion[];
  const responses = questions.map((q, i) => {
    const sent = [0, 1, 3, 5, 6].includes(i);
    const draft = [2, 3].includes(i);
    return {
      questionId: q.id,
      ResponseDraft_response: draft
        ? {
            consultationRequested: false,
            updatedAt: new Date("2026-11-23T12:00:00Z"),
          }
        : null,
      ResponseRevision_response: sent
        ? [
            {
              id: randomUUID(),
              questionRevisionId:
                i === 5 ? "previous" : q.QuestionRevision_questionRecord[0]!.id,
              answer: true,
              conditionContext: {},
            },
          ]
        : [],
    };
  }) as unknown as FullResponse[];
  questions[6]!.QuestionCondition_child = {
    parentQuestionId: questions[0]!.id,
    operator: "EQUALS",
    value: false,
  } as FullQuestion["QuestionCondition_child"];
  questions[7]!.QuestionCondition_child = {
    parentQuestionId: questions[4]!.id,
    operator: "EQUALS",
    value: true,
  } as FullQuestion["QuestionCondition_child"];
  const personal = new ResponseGraph(questions, responses).personal(
    "Proyecto ficticio",
  );
  // ResponsesService.personal agrega el estado ya existente a cada pregunta.
  for (const section of personal.sections)
    for (const question of section.questions) {
      question.reviewStatus = questions.find(
        (q) => q.id === question.id,
      )!.status;
    }
  const person = summarizeParticipation({
    memberId: "persona",
    name: "Persona ficticia",
    area: null,
    questions: questions.map((q, i) => ({
      ...q,
      required: i !== 5,
      draftAt:
        responses[i]!.ResponseDraft_response?.updatedAt.toISOString() ?? null,
      submittedAt: responses[i]!.ResponseRevision_response.length
        ? "2026-11-23T12:00:00Z"
        : null,
      response: responses[i]!,
    })),
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
      id: questions[4]!.id,
      sectionId,
      sectionTitle: "Tema ficticio",
      title: "Pregunta pendiente",
      question: "Escribe una respuesta ficticia.",
      helpText: "",
      type: "SHORT_TEXT",
      required: true,
      config: null,
      options: [],
      position: 5,
      total: 6,
      applicability: "ENABLED",
    },
  };
  return { personal, person, response };
}
function setup(
  element: React.ReactNode,
  path: string,
  data: PersonalProjectView,
  response?: ResponseView,
  cached = false,
) {
  vi.mocked(api).mockImplementation(async (key) => {
    if (key === "personalProject") return data as never;
    if (key === "getResponse" && response) return response as never;
    throw new Error(`Lectura inesperada: ${key}`);
  });
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  if (cached) client.setQueryData(["my-work", "p"], data);
  const router = createMemoryRouter(
    [{ path: "/projects/:projectId/:view/:id?", element }],
    { initialEntries: [path] },
  );
  return render(
    createElement(
      QueryClientProvider,
      { client },
      createElement(RouterProvider, { router }),
    ),
  );
}

it("Mi trabajo y Participación coinciden con el mismo conjunto: No aplica con envío no cuenta y un borrador puede solaparse con un envío", async () => {
  const { personal, person } = fixture();
  expect(person).toMatchObject({ assigned: 5, sent: 2, drafts: 2 });
  vi.mocked(exchangeRequest).mockImplementation(async (_project, resource) =>
    resource === "participation"
      ? ({
          projectName: personal.projectName,
          role: "ANALYST",
          responseDueAt: null,
          participants: [person],
        } as never)
      : ({ responseDueAt: null } as never),
  );
  setup(
    createElement(
      "div",
      null,
      createElement(MyWork),
      createElement(Participation),
    ),
    "/projects/p/work",
    personal,
  );
  const table = await screen.findByRole("table", {
    name: "Participación por persona",
  });
  const cells = within(within(table).getAllByRole("row")[1]!).getAllByRole(
    "cell",
  );
  expect(cells[2]).toHaveTextContent(/^5$/);
  expect(cells[3]).toHaveTextContent(/^2$/);
  expect(cells[4]).toHaveTextContent(/^2$/);
  expect(
    screen.getByRole("img", {
      name: "2 de 5 preguntas enviadas; 1 en borrador",
    }),
  ).toBeVisible();
  const legend = screen.getByRole("list", { name: "Estados del avance" });
  expect(legend).toHaveTextContent("Enviadas: 2");
  expect(legend).toHaveTextContent("Borradores sin enviar: 1");
  expect(legend).toHaveTextContent("Pendientes sin borrador: 2");
  expect(
    screen.getByText(
      "1 borrador corresponde a una pregunta que ya enviaste; no se suma de nuevo en la barra.",
    ),
  ).toBeVisible();
  expect(
    screen.getByText(
      "1 pregunta marcada como No aplica no se cuenta en el avance.",
    ),
  ).toBeVisible();
  expect(vi.mocked(api).mock.calls.map(([key]) => key)).toEqual([
    "personalProject",
  ]);
});

it("Hola usa las mismas cifras y consulta el plazo una vez por proyecto", async () => {
  vi.mocked(exchangeRequest).mockResolvedValue({
    responseDueAt: null,
    lockVersion: 0,
  } as never);
  const { personal } = fixture();
  const project: ProjectView = {
    id: "p",
    externalId: "FICTICIO",
    name: personal.projectName,
    description: "",
    lifecycle: "ACTIVE",
    role: "STAKEHOLDER",
    lockVersion: 0,
    questionCount: 8,
  };
  setup(
    createElement(ParticipantHome, {
      projects: [project],
      displayName: "Persona ficticia",
    }),
    "/projects/p/home",
    personal,
  );
  expect(
    await screen.findByRole("img", {
      name: "2 de 5 preguntas enviadas; 1 en borrador",
    }),
  ).toBeVisible();
  expect(vi.mocked(api).mock.calls.map(([key]) => key)).toEqual([
    "personalProject",
  ]);
  expect(exchangeRequest).toHaveBeenCalledTimes(1);
  expect(vi.mocked(exchangeRequest).mock.calls[0]?.slice(0, 2)).toEqual([
    "p",
    "response-deadline",
  ]);
});

it("el resumen compacto también excluye No aplica", async () => {
  const { personal } = fixture();
  setup(
    createElement(PersonalProgress, { projectId: "p" }),
    "/projects/p/work",
    personal,
  );
  expect(await screen.findByText("2 de 5 respuestas enviadas")).toBeVisible();
});

it("sin preguntas aplicables muestra cero y ninguna barra de avance", async () => {
  const { personal } = fixture();
  const allExcluded = {
    ...personal,
    sections: personal.sections.map((s) => ({
      ...s,
      questions: s.questions.map((q) => ({
        ...q,
        reviewStatus: "NOT_APPLICABLE" as const,
      })),
    })),
  };
  setup(
    createElement(ParticipantHome, {
      projects: [
        {
          id: "p",
          externalId: "FICTICIO",
          name: personal.projectName,
          description: "",
          lifecycle: "ACTIVE",
          role: "STAKEHOLDER",
          lockVersion: 0,
          questionCount: 8,
        },
      ],
      displayName: "Persona ficticia",
    }),
    "/projects/p/home",
    allExcluded,
  );
  await screen.findByRole("heading", { name: "Hola, Persona" });
  expect(
    screen.queryByRole("img", { name: /preguntas enviadas/ }),
  ).not.toBeInTheDocument();
  expect(
    screen.getByText("No hay preguntas que cuenten en el avance por ahora."),
  ).toBeVisible();
});

it("la cabecera conserva la posición sobre las mismas cinco preguntas aplicables", async () => {
  const { personal, response } = fixture();
  setup(
    createElement(ParticipantHeader, {
      displayName: "Persona ficticia",
      onLogout: vi.fn(),
    }),
    `/projects/p/respond/${response.question.id}`,
    personal,
  );
  expect(await screen.findByText("Pregunta 4 de 5")).toBeVisible();
});

it.each([true, false])(
  "Responder distingue posición y envíos sin ninguna lectura adicional (caché: %s)",
  async (cached) => {
    const { personal, response } = fixture();
    setup(
      createElement(Respond, { userId: "persona" }),
      `/projects/p/respond/${response.question.id}`,
      personal,
      response,
      cached,
    );
    await screen.findByLabelText("Tu respuesta");
    if (cached) {
      expect(screen.getByText("2 de 5 enviadas")).toBeVisible();
      expect(
        screen.getByRole("progressbar", {
          name: "Posición en el cuestionario",
        }),
      ).toHaveAttribute(
        "aria-valuetext",
        "Pregunta 4 de 5. La posición no indica cuántas respuestas has enviado.",
      );
    } else {
      expect(screen.queryByText(/de \d+ enviadas/)).not.toBeInTheDocument();
      expect(
        screen.getByRole("progressbar", {
          name: "Posición en el cuestionario",
        }),
      ).toHaveAttribute(
        "aria-valuetext",
        "Pregunta 5 de 6. La posición no indica cuántas respuestas has enviado.",
      );
    }
    expect(vi.mocked(api).mock.calls.map(([key]) => key)).toEqual([
      "getResponse",
    ]);
  },
);
