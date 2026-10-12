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
  const source = screen.getByRole("checkbox", { name: /Participante · envío/ });
  // A single submission is the obvious source: it starts chosen. Without any
  // source the decision is refused, and the message brings the first into view.
  expect(source).toBeChecked();
  await user.click(source);
  await user.click(
    screen.getByRole("button", { name: "Registrar como validada" }),
  );
  expect(api).not.toHaveBeenCalled();
  expect(screen.getByRole("alert")).toHaveTextContent(
    "Selecciona al menos una respuesta que sustente la decisión.",
  );
  await waitFor(() => expect(source).toHaveFocus());
  await user.click(source);
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
it("con varias respuestas vigentes no se elige ninguna fuente por defecto", () => {
  const first = data.submissions[0]!;
  render(
    <ReviewActionDialog
      data={{
        ...data,
        submissions: [
          first,
          { ...first, id: "00000000-0000-4000-8000-000000000009", number: 2 },
        ],
      }}
      action="validateQuestion"
      onClose={vi.fn()}
      onDone={vi.fn()}
      refresh={vi.fn()}
    />,
  );
  const sources = screen.getAllByRole("checkbox", {
    name: /Participante · envío/,
  });
  expect(sources).toHaveLength(2);
  for (const source of sources) expect(source).not.toBeChecked();
});
it("al abrir una decisión el foco empieza en su primer campo, no en «Cerrar»", () => {
  render(
    <ReviewActionDialog
      data={data}
      action="validateQuestion"
      onClose={vi.fn()}
      onDone={vi.fn()}
      refresh={vi.fn()}
    />,
  );
  expect(screen.getByLabelText("Decisión acordada")).toHaveFocus();
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

const sourceId = (n: number) => `00000000-0000-4000-8000-00000000010${n}`;
const many = reviewDetailView.parse({
  ...data,
  submissions: Array.from({ length: 8 }, (_, n) => ({
    ...data.submissions[0],
    id: sourceId(n),
    answer: `Respuesta número ${n + 1}`,
    respondent: { id, displayName: `Persona ${n + 1}` },
  })),
});
it("con muchas fuentes la lista cuenta las elegidas, las elige todas de una vez y deja leer el inicio de cada respuesta", async () => {
  const user = userEvent.setup(),
    onClose = vi.fn(),
    confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
  vi.mocked(api).mockResolvedValue({
    questionId: id,
    status: "VALIDATED",
    lockVersion: 4,
    threadId: null,
  });
  render(
    <ReviewActionDialog
      data={many}
      action="validateQuestion"
      onClose={onClose}
      onDone={vi.fn()}
      refresh={vi.fn()}
    />,
  );
  const boxes = () => screen.getAllByRole("checkbox", { name: /· envío #1/ });
  expect(boxes()).toHaveLength(8);
  expect(screen.getByRole("status")).toHaveTextContent("0 seleccionadas de 8");
  expect(
    screen.getByRole("checkbox", { name: "Persona 2 · envío #1" }),
  ).toHaveAccessibleDescription("Respuesta número 2");
  await user.click(screen.getByRole("button", { name: "Seleccionar todas" }));
  expect(boxes().every((box) => (box as HTMLInputElement).checked)).toBe(true);
  expect(screen.getByRole("status")).toHaveTextContent("8 seleccionadas de 8");
  // The buttons stay enabled so the keyboard focus is not lost when pressed.
  expect(
    screen.getByRole("button", { name: "Seleccionar todas" }),
  ).toHaveFocus();
  await user.click(screen.getByRole("checkbox", { name: /Persona 3/ }));
  expect(screen.getByRole("status")).toHaveTextContent("7 seleccionadas de 8");
  // Choosing in bulk counts as a change: closing asks before discarding it.
  await user.click(screen.getByRole("button", { name: "Cerrar" }));
  expect(confirm).toHaveBeenCalled();
  expect(onClose).not.toHaveBeenCalled();
  await user.type(screen.getByLabelText("Decisión acordada"), "Decisión");
  await user.type(screen.getByLabelText("Alcance"), "Todo");
  await user.type(screen.getByLabelText("Comentario interno"), "Revisado");
  await user.click(
    screen.getByRole("button", { name: "Registrar como validada" }),
  );
  await waitFor(() => expect(api).toHaveBeenCalledOnce());
  const sent = vi.mocked(api).mock.calls[0]![2] as {
    responseRevisionIds: string[];
  };
  expect(sent.responseRevisionIds).toHaveLength(7);
  expect(sent.responseRevisionIds).not.toContain(sourceId(2));
  await user.click(screen.getByRole("button", { name: "Quitar selección" }));
  expect(screen.getByRole("status")).toHaveTextContent("0 seleccionadas de 8");
});
it("con pocas fuentes no se añaden controles de selección en bloque", () => {
  render(
    <ReviewActionDialog
      data={data}
      action="validateQuestion"
      onClose={vi.fn()}
      onDone={vi.fn()}
      refresh={vi.fn()}
    />,
  );
  expect(
    screen.queryByRole("button", { name: "Seleccionar todas" }),
  ).not.toBeInTheDocument();
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
});
