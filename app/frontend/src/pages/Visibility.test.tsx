import { afterEach, describe, it, expect, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { referenceTypes } from "@requirements/contracts";
import { exchangeRequest } from "../api";
import { Metric, Traceability } from "./Visibility";
vi.mock("../api", () => ({ api: vi.fn(), exchangeRequest: vi.fn() }));
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});
describe("Metric user-visible contract", () => {
  it("shows numerator denominator and no misleading percentage for empty universe", () => {
    render(
      <Metric
        label="Validación"
        value={{ numerator: 0, denominator: 0, percentage: null }}
      />,
    );
    expect(screen.getByText("0 / 0")).toBeVisible();
    expect(screen.getByText("Sin preguntas")).toBeVisible();
    expect(screen.queryByText("100 %")).not.toBeInTheDocument();
  });
  it("keeps counts visible with percentage", () => {
    render(
      <Metric
        label="Cierre"
        value={{ numerator: 21, denominator: 30, percentage: 70 }}
      />,
    );
    expect(screen.getByText("21 / 30")).toBeVisible();
    expect(screen.getByText("70 %")).toBeVisible();
  });
});

it("traduce todos los tipos de referencia y conserva las tres cifras del servidor", async () => {
  vi.mocked(exchangeRequest).mockResolvedValue({
    questionsWithReferences: 3,
    questionsWithoutReferences: 7,
    references: referenceTypes.map((type, i) => ({
      id: `r${i}`,
      externalId: `R-${i}`,
      type,
      label: `Referencia ${i}`,
      description: "",
      url: null,
      questions: [],
    })),
  });
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={["/projects/p/traceability"]}>
        <Routes>
          <Route
            path="/projects/:projectId/traceability"
            element={<Traceability />}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  for (const label of [
    "Pregunta",
    "Regla de negocio",
    "Requerimiento",
    "Capacidad",
    "Flujo de trabajo",
    "Documento",
    "Código",
    "Otra referencia",
  ])
    expect(await screen.findByText(label, { exact: true })).toBeVisible();
  for (const type of referenceTypes)
    expect(screen.queryByText(type, { exact: true })).not.toBeInTheDocument();
  expect(
    [...document.querySelectorAll(".ac-facts dd")].map((el) => el.textContent),
  ).toEqual(["3", "7", "0"]);
});
