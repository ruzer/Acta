import { afterEach, it, expect } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import "@testing-library/jest-dom/vitest";
import type { PersonalProjectView } from "@requirements/contracts";
import { ProjectWork } from "./MyWork";
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
