import { afterEach, it, expect, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import "@testing-library/jest-dom/vitest";
import type { PersonalProjectView } from "@requirements/contracts";
import { ProjectWork, Welcome } from "./MyWork";
import { ParticipantNotice } from "./ParticipantFlow";
afterEach(cleanup);
it("300 preguntas: listado acotado, búsqueda por texto, filtro y tema colapsable por teclado", async () => {
  const data: PersonalProjectView = {
    projectName: "Proyecto ficticio",
    continueQuestionId: "q0",
    progress: {
      total: 300,
      enabled: 300,
      sent: 0,
      drafts: 0,
      pending: 300,
      excluded: 0,
      undetermined: 0,
    },
    sections: [
      {
        id: "topic",
        title: "Solicitudes",
        questions: Array.from({ length: 300 }, (_, i) => ({
          id: `q${i}`,
          title: `Pregunta ${i}`,
          question: `Texto de prueba ${i}`,
          currentSubmission: false,
          hasSubmission: false,
          applicability: "ENABLED",
          state: "PENDING",
          updatedAt: null,
          reviewStatus: "NOT_REVIEWED",
          clarificationWaiting: 0,
          clarificationCount: 0,
        })),
      },
    ],
  };
  render(
    <MemoryRouter>
      <ProjectWork projectId="project" data={data} />
    </MemoryRouter>,
  );
  expect(screen.getAllByRole("listitem")).toHaveLength(30);
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("Buscar en Mi trabajo"), "prueba 299");
  expect(screen.getAllByRole("listitem")).toHaveLength(1);
  expect(screen.getByText("Texto de prueba 299")).toBeVisible();
  await user.click(screen.getByRole("button", { name: "Enviadas" }));
  expect(
    screen.getByText("No encontramos preguntas con estos filtros."),
  ).toBeVisible();
  await user.click(screen.getByRole("button", { name: "Limpiar filtros" }));
  const topic = screen.getByRole("button", { name: /Solicitudes.*300/ });
  topic.focus();
  await user.keyboard("{Enter}");
  expect(screen.queryAllByRole("listitem")).toHaveLength(0);
  expect(topic).toHaveAttribute("aria-expanded", "false");
  await user.keyboard("{Enter}");
  await user.click(
    screen.getByRole("button", {
      name: "Mostrar más preguntas (270 restantes)",
    }),
  );
  expect(screen.getAllByRole("listitem")).toHaveLength(60);
});

it("Por consultar aparece en atención sin perder su estado ni inventar un envío", async () => {
  const item: PersonalProjectView["sections"][number]["questions"][number] = {
    id: "q",
    title: "Consulta",
    question: "Consulta pendiente",
    currentSubmission: false,
    hasSubmission: false,
    applicability: "ENABLED",
    state: "CONSULTATION",
    updatedAt: null,
    reviewStatus: "NOT_REVIEWED",
    clarificationWaiting: 0,
    clarificationCount: 0,
  };
  const data: PersonalProjectView = {
    projectName: "Ejemplo",
    continueQuestionId: "q",
    progress: {
      total: 1,
      enabled: 1,
      sent: 0,
      drafts: 1,
      pending: 0,
      excluded: 0,
      undetermined: 0,
    },
    sections: [{ id: "s", title: "Tema", questions: [item] }],
  };
  render(
    <MemoryRouter>
      <Welcome
        items={[item]}
        progress={{ sent: 0, total: 1, drafts: 1 }}
        waiting={[]}
      />
      <ProjectWork projectId="p" data={data} />
    </MemoryRouter>,
  );
  expect(
    screen.getByText("Requieren atención: 0 aclaraciones y 1 por consultar."),
  ).toBeVisible();
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Buscar y filtrar" }));
  await user.click(screen.getByRole("button", { name: "Requiere atención" }));
  expect(screen.getByText("Por consultar")).toBeVisible();
  expect(
    screen.getByRole("link", { name: "Continuar: Consulta" }),
  ).toHaveAttribute("href", "/projects/p/respond/q");
});
it("la confirmación de envío no desaparece mientras se lee la siguiente pregunta", () => {
  vi.useFakeTimers();
  try {
    render(
      <MemoryRouter
        initialEntries={[
          { pathname: "/", state: { participantNotice: "Respuesta enviada." } },
        ]}
      >
        <ParticipantNotice />
      </MemoryRouter>,
    );
    vi.advanceTimersByTime(60000);
    expect(screen.getByRole("status")).toHaveTextContent("Respuesta enviada.");
  } finally {
    vi.useRealTimers();
  }
});
it("el avance se dice con palabras y sin inventar envíos; la aclaración pendiente se destaca y lleva al sitio", () => {
  const item: PersonalProjectView["sections"][number]["questions"][number] = {
    id: "q",
    title: "Criterio de urgencia",
    question: "¿Quién autoriza una requisición urgente?",
    currentSubmission: true,
    hasSubmission: true,
    applicability: "ENABLED",
    state: "SENT",
    updatedAt: null,
    reviewStatus: "CLARIFICATION_REQUIRED",
    clarificationWaiting: 1,
    clarificationCount: 1,
  };
  render(
    <MemoryRouter>
      <Welcome
        items={[item]}
        progress={{ sent: 5, total: 10, drafts: 2 }}
        href="/projects/p/respond/x"
        waiting={[
          {
            href: "/projects/p/clarifications/q",
            question: item.question,
            title: item.title,
          },
        ]}
      />
    </MemoryRouter>,
  );
  expect(screen.getByText(/^5$/)).toBeVisible();
  expect(
    screen.getByRole("img", {
      name: "5 de 10 preguntas enviadas; 2 en borrador",
    }),
  ).toBeVisible();
  // One primary action; the clarification card is a single link to its page.
  expect(screen.getByRole("link", { name: /Continuar/ })).toHaveAttribute(
    "href",
    "/projects/p/respond/x",
  );
  expect(screen.getByText("Una aclaración espera tu respuesta")).toBeVisible();
  expect(
    screen.getByRole("link", {
      name: "Responder aclaración: Criterio de urgencia",
    }),
  ).toHaveAttribute("href", "/projects/p/clarifications/q");
  expect(screen.getByText(/Guardar y salir/)).toBeVisible();
});
