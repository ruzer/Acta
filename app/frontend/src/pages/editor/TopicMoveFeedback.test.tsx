import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import userEvent from "@testing-library/user-event";
import { questionnaireView } from "@requirements/contracts";
import fixture from "../../../../../tests/fixtures/analyst-visual.json";
import { EditorWorkspace } from "./EditorWorkspace";
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
it("Ver despliega el destino, enfoca la fila y el resalte termina sin repetirse al actualizar datos", async () => {
  const original = questionnaireView.parse(fixture.questionnaire);
  const source = original.questions[0]!;
  const destination = {
    ...original.sections[0]!,
    id: "destination",
    title: "Destino del movimiento",
    order: 99,
  };
  const target = {
    ...source,
    id: "target",
    title: "Pregunta movida",
    question: "¿Qué se necesita revisar?",
    sectionId: destination.id,
  };
  const data = {
    ...original,
    sections: [...original.sections, destination],
    questions: [
      ...Array.from({ length: 41 }, (_, index) => ({
        ...source,
        id: `q-${index}`,
        title: `Pregunta ${index}`,
        question: `Pregunta ${index}`,
      })),
      target,
    ],
  };
  vi.spyOn(HTMLElement.prototype, "getClientRects").mockReturnValue([
    { width: 200, height: 40 },
  ] as unknown as DOMRectList);
  const scroll = vi.fn();
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
    configurable: true,
    value: scroll,
  });
  const props = {
    data,
    projectId: "project",
    onEdit: vi.fn(),
    onAction: vi.fn(),
    onCreateTopic: vi.fn(),
    onCreateReference: vi.fn(),
    movedQuestion: { id: target.id, sectionId: destination.id },
    revealMove: { id: target.id, sequence: 1 },
  };
  const { rerender } = render(<EditorWorkspace {...props} />);
  const row = await screen.findByRole("article", { name: target.title });
  await waitFor(() => expect(row).toHaveFocus());
  expect(row).toHaveClass("qe-topic-moved");
  expect(scroll).toHaveBeenCalledWith({ block: "center", behavior: "instant" });
  await waitFor(() => expect(row).not.toHaveClass("qe-topic-moved"), {
    timeout: 1800,
  });
  rerender(<EditorWorkspace {...props} data={{ ...data }} />);
  await waitFor(() => expect(row).toHaveFocus());
  expect(row).not.toHaveClass("qe-topic-moved");
});

it("Ver cierra Vista previa para mostrar y enfocar la pregunta trasladada", async () => {
  const data = questionnaireView.parse(fixture.questionnaire);
  const target = data.questions[0]!;
  vi.spyOn(HTMLElement.prototype, "getClientRects").mockReturnValue([
    { width: 200, height: 40 },
  ] as unknown as DOMRectList);
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
    configurable: true,
    value: vi.fn(),
  });
  const props = {
    data,
    projectId: "project",
    onEdit: vi.fn(),
    onAction: vi.fn(),
    onCreateTopic: vi.fn(),
    onCreateReference: vi.fn(),
    movedQuestion: { id: target.id, sectionId: target.sectionId },
  };
  const { rerender } = render(<EditorWorkspace {...props} />);
  await userEvent.click(
    screen.getByRole("button", { name: "Vista previa", exact: true }),
  );
  expect(screen.getByRole("region", { name: "Vista previa" })).toBeVisible();
  const revealMove = { id: target.id, sequence: 1 };
  rerender(<EditorWorkspace {...props} revealMove={revealMove} />);
  const row = await screen.findByRole("article", { name: target.title });
  await waitFor(() => expect(row).toHaveFocus());
  expect(
    screen.queryByRole("region", { name: "Vista previa" }),
  ).not.toBeInTheDocument();
  await userEvent.click(
    screen.getByRole("button", { name: "Vista previa", exact: true }),
  );
  rerender(
    <EditorWorkspace {...props} data={{ ...data }} revealMove={revealMove} />,
  );
  expect(screen.getByRole("region", { name: "Vista previa" })).toBeVisible();
});
