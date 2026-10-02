import { afterEach, describe, it, expect, vi } from "vitest";
import { render, screen, cleanup, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { exchangeRequest } from "../api";
import { ImportStructure } from "./Exchange";
vi.mock("../api", () => ({
  exchangeRequest: vi.fn(),
  api: vi.fn(),
  exchangeFetch: vi.fn(),
  saveDownload: vi.fn(),
}));
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});
const counts = {
  projects: 1,
  sections: 1,
  questions: 2,
  options: 0,
  conditions: 0,
  references: 0,
  links: 0,
  areas: 1,
};
const preview = {
  projectName: "Ejemplo mínimo",
  payloadHash: "a".repeat(64),
  expectedProjectVersion: 2,
  counts,
  missingAreas: [{ code: "SERVICES", name: "Equipo de servicios" }],
  warnings: [],
  errors: [],
  canConfirm: true,
};
function setup() {
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <MemoryRouter initialEntries={["/projects/example/import"]}>
        <Routes>
          <Route
            path="/projects/:projectId/import"
            element={<ImportStructure />}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return userEvent.setup();
}
describe("Import guidance without a new import contract", () => {
  it("offers downloadable examples and keyboard-accessible preparation help", async () => {
    const user = setup();
    expect(
      screen.getByRole("link", { name: "Descargar ejemplo mínimo" }),
    ).toHaveAttribute("download", "questionnaire-template.minimal.json");
    expect(
      screen.getByRole("link", { name: "Descargar ejemplo completo" }),
    ).toHaveAttribute("download", "questionnaire-template.full.json");
    const summary = screen.getByText("Cómo preparar el archivo");
    summary.focus();
    await user.keyboard("{Enter}");
    // Browser smoke covers native details keyboard behavior; here verify its semantic control.
    expect(summary.tagName).toBe("SUMMARY");
    await user.click(summary);
    expect(
      screen.getByText(/Copia su identificador externo exactamente/),
    ).toBeVisible();
  });
  it("identifies a human question position while preserving message and exact technical path", async () => {
    vi.mocked(exchangeRequest).mockResolvedValue({
      ...preview,
      canConfirm: false,
      errors: [
        {
          path: "/questions/7/responsibleAreaCode",
          message:
            "Incluye el área responsable en el catálogo de áreas del archivo.",
        },
      ],
    });
    const user = setup();
    await user.upload(
      screen.getByLabelText("Archivo JSON"),
      new File(["{}"], "example.json", { type: "application/json" }),
    );
    await user.click(screen.getByRole("button", { name: "Revisar archivo" }));
    expect(
      await screen.findByText("Pregunta 8 · Área responsable"),
    ).toBeVisible();
    expect(
      screen.getByText(
        "Incluye el área responsable en el catálogo de áreas del archivo.",
      ),
    ).toBeVisible();
    await user.click(screen.getByText("Detalles técnicos"));
    expect(screen.getByText("/questions/7/responsibleAreaCode")).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Confirmar importación" }),
    ).toBeDisabled();
    await user.upload(
      screen.getByLabelText("Archivo JSON"),
      new File(["{}"], "corrected.json", { type: "application/json" }),
    );
    expect(
      screen.queryByRole("region", { name: "Vista previa" }),
    ).not.toBeInTheDocument();
  });
  it("keeps consent and sends the existing hash/version/bytes on confirmation", async () => {
    vi.mocked(exchangeRequest)
      .mockResolvedValueOnce(preview)
      .mockResolvedValueOnce({ counts });
    const user = setup(),
      file = new File(["{}"], "example.json", { type: "application/json" });
    await user.upload(screen.getByLabelText("Archivo JSON"), file);
    await user.click(screen.getByRole("button", { name: "Revisar archivo" }));
    const region = await screen.findByRole("region", { name: "Vista previa" });
    expect(
      within(region).getByRole("heading", { name: "Ejemplo mínimo" }),
    ).toBeVisible();
    const confirm = screen.getByRole("button", {
      name: "Confirmar importación",
    });
    expect(confirm).toBeDisabled();
    await user.click(
      screen.getByLabelText("Confirmo crear estas áreas en la institución"),
    );
    await user.click(confirm);
    expect(
      await screen.findByText("Importación completada: 2 preguntas y 1 temas."),
    ).toBeVisible();
    expect(vi.mocked(exchangeRequest).mock.calls[1]?.[3]).toEqual({
      file,
      command: {
        payloadHash: preview.payloadHash,
        expectedProjectVersion: 2,
        createMissingAreas: true,
        requestId: expect.any(String),
      },
    });
    expect(
      screen.getByRole("link", { name: "Revisar estructura importada" }),
    ).toHaveAttribute("href", "/projects/example/editor");
  });
  it.each(["/constructor", "/__proto__"])(
    "keeps rejected property %s as technical data",
    async (path) => {
      vi.mocked(exchangeRequest).mockResolvedValue({
        ...preview,
        canConfirm: false,
        errors: [{ path, message: "Propiedad no permitida." }],
      });
      const user = setup();
      await user.upload(
        screen.getByLabelText("Archivo JSON"),
        new File(["{}"], "example.json", { type: "application/json" }),
      );
      await user.click(screen.getByRole("button", { name: "Revisar archivo" }));
      expect(await screen.findByText("Propiedad no permitida.")).toBeVisible();
      expect(screen.getByText("Archivo", { exact: true })).toBeVisible();
      await user.click(screen.getByText("Detalles técnicos"));
      expect(screen.getByText(path, { exact: true })).toBeVisible();
    },
  );
  it("renders untrusted error text literally without HTML execution", async () => {
    vi.mocked(exchangeRequest).mockResolvedValue({
      ...preview,
      canConfirm: false,
      errors: [
        {
          path: "/questions/0/question",
          message: '<img src=x onerror="alert(1)">',
        },
      ],
    });
    const user = setup();
    await user.upload(
      screen.getByLabelText("Archivo JSON"),
      new File(["{}"], "example.json", { type: "application/json" }),
    );
    await user.click(screen.getByRole("button", { name: "Revisar archivo" }));
    expect(
      await screen.findByText('<img src=x onerror="alert(1)">'),
    ).toBeVisible();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });
});
