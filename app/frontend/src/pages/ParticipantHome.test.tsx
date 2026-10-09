import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import * as apiModule from "../api";
import { Participant } from "./Access";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
it("UX-02: las preguntas publicadas tienen un h1 propio; el proyecto queda en el contexto", async () => {
  vi.spyOn(apiModule, "api").mockResolvedValue({
    projectName: "Modernización de adquisiciones",
    roleLabel: "Lector de decisiones",
    phaseNotice: "Consulta de las preguntas publicadas del proyecto.",
    sections: [],
  } as never);
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <MemoryRouter initialEntries={["/projects/project-a"]}>
        <Routes>
          <Route path="/projects/:projectId" element={<Participant />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  const h1 = await screen.findByRole("heading", { level: 1 });
  expect(h1).toHaveTextContent("Preguntas publicadas");
  expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  // The reader keeps the project context without repeating it as the heading.
  expect(
    screen.getByText("Lector de decisiones · Modernización de adquisiciones"),
  ).toBeVisible();
});
it("CP7: cada pregunta publicada muestra su estado como chip y un único enlace a la decisión", async () => {
  vi.spyOn(apiModule, "api").mockResolvedValue({
    projectName: "Modernización de adquisiciones",
    roleLabel: "Lector de decisiones",
    phaseNotice: "Consulta de las preguntas publicadas del proyecto.",
    sections: [
      {
        key: "s1",
        title: "Alta de proveedores",
        questions: [
          {
            key: "q1",
            title: "Documentos del alta",
            question: "¿Qué documentos debe presentar un proveedor?",
            helpText: "",
            conditional: false,
            groupTitle: "",
            options: [],
            statusLabel: "Validada",
            reviewQuestionId: "q1",
          },
          {
            key: "q2",
            title: "Plazo de respuesta",
            question: "¿Cuál es el plazo máximo?",
            helpText: "",
            conditional: false,
            groupTitle: "",
            options: [],
            statusLabel: "Pendiente",
            reviewQuestionId: null,
          },
        ],
      },
    ],
  } as never);
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <MemoryRouter initialEntries={["/projects/project-a"]}>
        <Routes>
          <Route path="/projects/:projectId" element={<Participant />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  await screen.findByRole("heading", { level: 1 });
  const articles = screen.getAllByRole("article");
  expect(articles).toHaveLength(2);
  // The state is the same chip the analyst sees: glyph and word.
  expect(within(articles[0]!).getByText("Validada")).toBeVisible();
  expect(within(articles[1]!).getByText("Pendiente")).toBeVisible();
  // Only the question that has a review sheet offers the way to it.
  expect(
    within(articles[0]!).getByRole("link", {
      name: "Consultar decisión y fuentes",
    }),
  ).toHaveAttribute("href", "/projects/project-a/review/q1");
  expect(
    within(articles[1]!).queryByRole("link", {
      name: "Consultar decisión y fuentes",
    }),
  ).not.toBeInTheDocument();
});
