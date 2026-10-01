import { afterEach, beforeAll, expect, it, vi } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";
import { reviewDetailView } from "@requirements/contracts";
import { api } from "../api";
import { ReviewActionDialog } from "./ReviewActions";
vi.mock("../api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../api")>()),
  api: vi.fn(),
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
  vi.clearAllMocks();
});
const id = "00000000-0000-4000-8000-000000000001",
  rid = "00000000-0000-4000-8000-000000000002";
const data = reviewDetailView.parse({
  projectId: id,
  projectName: "Proyecto",
  question: {
    id,
    sectionId: id,
    sectionTitle: "Tema",
    title: "Pregunta",
    question: "¿Cómo funciona?",
    helpText: "",
    type: "SHORT_TEXT",
    required: true,
    config: null,
    options: [],
    position: 1,
    total: 1,
    applicability: "ENABLED",
  },
  status: "ANSWERED",
  priority: "P1",
  lockVersion: 3,
  canReview: true,
  partialReviewReason: null,
  pendingReview: false,
  participants: [],
  submissions: [
    {
      id: rid,
      number: 1,
      status: "SUBMITTED",
      answer: "Así funciona",
      comment: "",
      example: "",
      createdAt: "2026-09-28T12:00:00.000Z",
      current: true,
      evidence: [],
      respondent: { id, displayName: "Participante" },
      area: { id, name: "Equipo" },
    },
  ],
  threads: [],
  validations: [],
  conflicts: [],
  dispositions: [],
  references: [],
});
it("decisión exige fuentes y envía contenido completo; fallo de red conserva texto e idempotencia", async () => {
  const user = userEvent.setup(),
    done = vi.fn();
  vi.mocked(api)
    .mockRejectedValueOnce(new Error("No hay conexión"))
    .mockResolvedValueOnce({
      questionId: id,
      status: "VALIDATED",
      lockVersion: 4,
      threadId: null,
    });
  render(
    <ReviewActionDialog
      data={data}
      action="validateQuestion"
      onClose={vi.fn()}
      onDone={done}
      refresh={vi.fn()}
    />,
  );
  await user.type(
    screen.getByLabelText("Decisión acordada"),
    "Decisión explícita",
  );
  await user.type(screen.getByLabelText("Alcance"), "Caso de prueba");
  await user.type(
    screen.getByLabelText("Comentario interno"),
    "Fuentes revisadas",
  );
  await user.click(
    screen.getByRole("button", { name: "Registrar como validada" }),
  );
  expect(api).not.toHaveBeenCalled();
  expect(screen.getByRole("alert")).toHaveTextContent("selecciona las fuentes");
  await user.click(
    screen.getByRole("checkbox", { name: /Participante · envío/ }),
  );
  await user.click(
    screen.getByRole("button", { name: "Registrar como validada" }),
  );
  await waitFor(() =>
    expect(screen.getByRole("alert")).toHaveTextContent("No hay conexión"),
  );
  expect(screen.getByLabelText("Decisión acordada")).toHaveValue(
    "Decisión explícita",
  );
  await user.click(
    screen.getByRole("button", { name: "Registrar como validada" }),
  );
  await waitFor(() => expect(done).toHaveBeenCalledOnce());
  expect(vi.mocked(api).mock.calls[0]).toEqual(vi.mocked(api).mock.calls[1]);
  expect(vi.mocked(api).mock.calls[1]![2]).toMatchObject({
    expectedVersion: 3,
    responseRevisionIds: [rid],
    decisionText: "Decisión explícita",
  });
});
it("cerrar con cambios requiere decisión del usuario y mantiene texto al cancelar descarte", async () => {
  const close = vi.fn();
  vi.spyOn(window, "confirm").mockReturnValue(false);
  render(
    <ReviewActionDialog
      data={data}
      action="markPartial"
      onClose={close}
      onDone={vi.fn()}
      refresh={vi.fn()}
    />,
  );
  await userEvent.type(screen.getByLabelText("Motivo"), "Falta precisar");
  await userEvent.click(screen.getByRole("button", { name: "Cancelar" }));
  expect(close).not.toHaveBeenCalled();
  expect(screen.getByLabelText("Motivo")).toHaveValue("Falta precisar");
  vi.mocked(window.confirm).mockRestore();
});
