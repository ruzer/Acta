import { afterEach, beforeAll, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import type { ParticipationView } from "@requirements/contracts";
import { api, exchangeRequest } from "../api";
import { ParticipationPeople } from "./ParticipationPeople";
import { ExternalInput } from "./SettingsFields";
import { InvitationLink } from "./Invitations";
import { BulkUsers } from "./BulkUsers";
import { ImportStructure } from "./Exchange";
import { ProjectReport } from "./ProjectReport";

vi.mock("../api", () => ({
  api: vi.fn(),
  exchangeRequest: vi.fn(),
  exchangeFetch: vi.fn(),
  saveDownload: vi.fn(),
}));
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute("open");
  };
});
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});
const person: ParticipationView["participants"][number] = {
  memberId: "person-1",
  name: "Persona ficticia",
  area: "Servicios",
  assigned: 1,
  required: 1,
  sent: 1,
  drafts: 0,
  pending: 0,
  lastActivity: null,
  state: "Completo",
};
function withQuery(node: React.ReactNode) {
  return render(
    <QueryClientProvider
      client={
        new QueryClient({
          defaultOptions: {
            queries: { retry: false },
            mutations: { retry: false },
          },
        })
      }
    >
      {node}
    </QueryClientProvider>,
  );
}

it("explica el recordatorio sin pendientes, conserva su nombre y bloquea ratón y teclado", async () => {
  const user = userEvent.setup(),
    remind = vi.fn();
  render(<ParticipationPeople people={[person]} remind={remind} />);
  const button = screen.getByRole("button", {
    name: "Copiar recordatorio para Persona ficticia",
  });
  expect(button).toHaveAttribute("aria-disabled", "true");
  expect(button).not.toBeDisabled();
  expect(button).toHaveAccessibleDescription(
    "Esta persona no tiene preguntas obligatorias pendientes.",
  );
  await user.click(button);
  button.focus();
  await user.keyboard("{Enter} ");
  expect(button).toHaveFocus();
  expect(remind).not.toHaveBeenCalled();
});

it("el recordatorio con pendientes sigue funcionando", async () => {
  const user = userEvent.setup(),
    remind = vi.fn();
  render(
    <ParticipationPeople
      people={[{ ...person, pending: 1 }]}
      remind={remind}
    />,
  );
  await user.click(
    screen.getByRole("button", {
      name: "Copiar recordatorio para Persona ficticia",
    }),
  );
  expect(remind).toHaveBeenCalledOnce();
});

it("el valor externo conserva selección, copia y motivo asociado", async () => {
  const user = userEvent.setup();
  render(
    <ExternalInput
      label="Nombre"
      field={{
        value: "Aplicación ficticia",
        source: "external",
        variable: "APP_NAME",
      }}
    />,
  );
  expect(screen.queryByRole("textbox", { name: "Nombre" })).toBeNull();
  const fixed = screen.getByRole("group", { name: "Nombre" });
  expect(fixed).toHaveAccessibleDescription(
    /Se define en la infraestructura y no se puede cambiar desde Acta/,
  );
  const value = screen.getByText("Aplicación ficticia");
  const range = document.createRange();
  range.selectNodeContents(value);
  window.getSelection()!.removeAllRanges();
  window.getSelection()!.addRange(range);
  const copied = await user.copy();
  expect(copied!.getData("text/plain")).toBe("Aplicación ficticia");
  window.getSelection()!.removeAllRanges();
});

it("el enlace privado sigue siendo seleccionable y explica por qué no se edita", () => {
  render(
    <InvitationLink
      url="https://example.test/invitation/ficticia"
      onClose={vi.fn()}
    />,
  );
  const input = screen.getByRole("textbox", {
    name: "Enlace privado",
  }) as HTMLTextAreaElement;
  expect(input).toHaveAttribute("readonly");
  expect(input).not.toBeDisabled();
  expect(input).toHaveAccessibleDescription(/Puedes seleccionarlo y copiarlo/);
  input.focus();
  expect(input.selectionEnd - input.selectionStart).toBe(input.value.length);
});

it("usuarios en lote explica la tabla vacía y solo usa disabled mientras revisa", async () => {
  const user = userEvent.setup();
  vi.mocked(api).mockReturnValue(new Promise(() => undefined));
  withQuery(<BulkUsers onClose={vi.fn()} onCreated={vi.fn()} />);
  const button = screen.getByRole("button", { name: "Revisar usuarios" });
  expect(button).toHaveAccessibleDescription(
    "Pega la tabla de usuarios antes de revisarla.",
  );
  await user.click(button);
  expect(api).not.toHaveBeenCalled();
  await user.type(screen.getByLabelText("Tabla de usuarios"), "tabla ficticia");
  await user.click(button);
  expect(api).toHaveBeenCalledOnce();
  expect(button).toBeDisabled();
  expect(button).toHaveAttribute("aria-busy", "true");
});

it("importación sin archivo explica el siguiente paso y no llama al servidor", async () => {
  const user = userEvent.setup();
  vi.mocked(api).mockImplementation(
    async (key) =>
      (key === "questionnaire"
        ? { sections: [], questions: [], references: [] }
        : []) as never,
  );
  withQuery(
    <MemoryRouter initialEntries={["/projects/example/import"]}>
      <Routes>
        <Route
          path="/projects/:projectId/import"
          element={<ImportStructure />}
        />
      </Routes>
    </MemoryRouter>,
  );
  const button = await screen.findByRole("button", { name: "Revisar archivo" });
  await waitFor(() => expect(button).not.toBeDisabled());
  expect(button).toHaveAccessibleDescription(
    "Selecciona un archivo CSV o JSON antes de revisarlo.",
  );
  await user.click(button);
  expect(exchangeRequest).not.toHaveBeenCalled();
});

it("importación de proyecto con estructura mantiene el bloqueo y explica la causa en el control", async () => {
  const user = userEvent.setup();
  vi.mocked(api).mockImplementation(
    async (key) =>
      (key === "questionnaire"
        ? { sections: [{ id: "section" }], questions: [], references: [] }
        : []) as never,
  );
  withQuery(
    <MemoryRouter initialEntries={["/projects/example/import"]}>
      <Routes>
        <Route
          path="/projects/:projectId/import"
          element={<ImportStructure />}
        />
      </Routes>
    </MemoryRouter>,
  );
  const button = await screen.findByRole("button", { name: "Revisar archivo" });
  await waitFor(() => expect(button).not.toBeDisabled());
  expect(button).toHaveAccessibleDescription(
    "Este proyecto ya contiene estructura. La importación requiere un proyecto vacío.",
  );
  expect(
    screen.getByLabelText("Archivo CSV o JSON"),
  ).toHaveAccessibleDescription(/proyecto vacío/);
  await user.click(button);
  expect(exchangeRequest).not.toHaveBeenCalled();
});

it("el informe sin decisiones explica por qué no imprime y conserva el nombre del botón", async () => {
  const user = userEvent.setup(),
    print = vi.spyOn(window, "print").mockImplementation(() => undefined);
  vi.mocked(exchangeRequest).mockResolvedValue({
    exportScope: { role: "ADMIN" },
    project: { name: "Proyecto ficticio" },
    exportedAt: "2026-11-26T12:00:00Z",
    decisions: [],
  });
  withQuery(
    <MemoryRouter initialEntries={["/projects/example/report"]}>
      <Routes>
        <Route path="/projects/:projectId/report" element={<ProjectReport />} />
      </Routes>
    </MemoryRouter>,
  );
  const button = await screen.findByRole("button", {
    name: "Imprimir o guardar como PDF",
  });
  expect(button).toHaveAccessibleDescription(
    "El informe se puede imprimir cuando hay una decisión vigente.",
  );
  await user.click(button);
  expect(print).not.toHaveBeenCalled();
  print.mockRestore();
});
