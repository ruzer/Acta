import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import {
  reviewDetailView,
  validatedDecisionsExportDocument,
} from "@requirements/contracts";
import fixture from "../../../../tests/fixtures/analyst-visual.json";
import { exchangeRequest } from "../api";
import { ProjectReport } from "./ProjectReport";
vi.mock("../api", () => ({ exchangeRequest: vi.fn() }));
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
function document() {
  const detail = reviewDetailView.parse(fixture.decision);
  detail.submissions[0]!.respondent.displayName = "Persona de ejemplo";
  detail.submissions[0]!.area.name = "Servicios";
  detail.validations[0]!.validatedBy.displayName = "Analista de ejemplo";
  return validatedDecisionsExportDocument.parse({
    formatVersion: "1.0",
    kind: "validated-decisions-export",
    exportedAt: "2026-11-13T12:00:00.000Z",
    exportScope: {
      role: "VIEWER",
      scope: "validated-decisions",
      exclusions: [],
    },
    project: {
      id: fixture.projectId,
      externalId: "DEMO",
      name: "Proyecto ficticio",
      description: "",
      lifecycle: "ACTIVE",
    },
    decisions: [{ ...detail, externalId: "Q-1", evidenceDownloads: [] }],
  });
}
function setup(data: ReturnType<typeof document> | Error) {
  if (data instanceof Error) vi.mocked(exchangeRequest).mockRejectedValue(data);
  else vi.mocked(exchangeRequest).mockResolvedValue(data);
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <MemoryRouter initialEntries={[`/projects/${fixture.projectId}/report`]}>
        <Routes>
          <Route
            path="/projects/:projectId/report"
            element={<ProjectReport />}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
it("solicita solo el exporte autorizado y presenta decisión vigente sin UUID, JSON o historia", async () => {
  const data = document();
  const copy = structuredClone(data.decisions[0]!.submissions[0]!);
  copy.id = "b15c63bd-2cf2-4c88-b11e-c2b1f2328ace";
  copy.answer = "Aportación no seleccionada";
  data.decisions[0]!.submissions.push(copy);
  setup(data);
  await screen.findByRole("heading", { name: "Informe de decisiones" });
  expect(exchangeRequest).toHaveBeenCalledWith(
    fixture.projectId,
    "exports",
    validatedDecisionsExportDocument,
    {
      input: {
        format: "JSON",
        scope: "validated-decisions",
        requestId: expect.any(String),
      },
    },
  );
  expect(
    screen.getByRole("heading", { name: "¿Cómo se comunica el resultado?" }),
  ).toBeVisible();
  expect(
    screen.getByText(data.decisions[0]!.validations[0]!.decisionText),
  ).toBeVisible();
  expect(
    screen.queryByText(data.decisions[0]!.validations[1]!.decisionText),
  ).not.toBeInTheDocument();
  expect(screen.getByText("Persona de ejemplo")).toBeVisible();
  expect(
    screen.queryByText("Aportación no seleccionada"),
  ).not.toBeInTheDocument();
  expect(screen.getByRole("article").textContent).not.toMatch(
    /[a-f0-9]{8}-[a-f0-9]{4}-|VALIDATED|SHORT_TEXT|\{"/,
  );
  const print = vi.spyOn(window, "print").mockImplementation(() => {});
  await userEvent.click(
    screen.getByRole("button", { name: "Imprimir o guardar como PDF" }),
  );
  expect(print).toHaveBeenCalledTimes(1);
});
it.each([
  ["YES_NO", true, {}, [], "Sí"],
  [
    "SINGLE_CHOICE",
    "INTERNAL",
    {},
    [{ value: "INTERNAL", label: "Atención presencial", order: 0 }],
    "Atención presencial",
  ],
  [
    "MATRIX",
    { r: "c" },
    {
      rows: [{ key: "r", label: "Recepción" }],
      columns: [{ key: "c", label: "Disponible" }],
    },
    [],
    "Recepción: Disponible",
  ],
] as const)(
  "usa el mismo formato legible de Markdown para %s",
  async (type, answer, config, options, label) => {
    const data = document();
    Object.assign(data.decisions[0]!.question, { type, config, options });
    Object.assign(data.decisions[0]!.submissions[0]!, { answer });
    setup(data);
    expect(await screen.findByText(label)).toBeVisible();
  },
);
it("no imprime preguntas reabiertas ni un informe vacío", async () => {
  const data = document();
  data.decisions[0]!.status = "ANSWERED";
  setup(data);
  await screen.findByText("Todavía no hay decisiones vigentes");
  expect(
    screen.getByRole("button", { name: "Imprimir o guardar como PDF" }),
  ).toBeDisabled();
  expect(screen.queryByRole("article")).not.toBeInTheDocument();
});
it("conserva el rechazo del servidor y no muestra datos ni ofrece imprimir", async () => {
  setup(new Error("No tienes permiso para consultar este proyecto."));
  expect(
    await screen.findByText("No tienes permiso para consultar este proyecto."),
  ).toBeVisible();
  expect(screen.queryByRole("article")).not.toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Imprimir o guardar como PDF" }),
  ).not.toBeInTheDocument();
});
