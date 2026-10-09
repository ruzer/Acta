import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
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
