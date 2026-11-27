import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";
import { questionnaireView } from "@requirements/contracts";
import fixture from "../../../../../tests/fixtures/analyst-visual.json";
import { api } from "../../api";
import { MoveQuestionDialog } from "./MoveQuestionDialog";
import { questionTopicMove } from "./topic-move";
vi.mock("../../api", async (load) => ({
  ...(await load<typeof import("../../api")>()),
  api: vi.fn(),
}));
const original = questionnaireView.parse(fixture.questionnaire);
const root = {
  ...original.questions[0]!,
  publication: "DRAFT" as const,
  groupParentId: null,
  order: 3,
};
const child = {
  ...root,
  id: "child",
  title: "Seguimiento",
  groupParentId: root.id,
  order: 5,
};
const nested = {
  ...child,
  id: "nested",
  title: "Seguimiento anidado",
  groupParentId: child.id,
  order: 8,
};
const destination = {
  ...original.sections[0]!,
  id: "target",
  title: "Destino",
};
const existing = {
  ...root,
  id: "existing",
  sectionId: destination.id,
  order: 4,
};
const archived = {
  ...existing,
  id: "archived",
  publication: "ARCHIVED" as const,
  order: 2,
};
const data = {
  ...original,
  sections: [...original.sections, destination],
  questions: [root, child, nested, existing, archived],
};
beforeEach(() => {
  vi.mocked(api).mockResolvedValue(undefined as never);
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
    configurable: true,
    value: function (this: HTMLDialogElement) {
      this.setAttribute("open", "");
    },
  });
  Object.defineProperty(HTMLDialogElement.prototype, "close", {
    configurable: true,
    value: function (this: HTMLDialogElement) {
      this.removeAttribute("open");
    },
  });
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
it("la familia incluye principales, descendientes anidados y archivadas que impiden separar el grupo", () => {
  expect(questionTopicMove(data, child).family.map((q) => q.id)).toEqual([
    root.id,
    child.id,
    nested.id,
  ]);
  const blocked = questionTopicMove(
    {
      ...data,
      questions: data.questions.map((q) =>
        q.id === nested.id ? { ...q, publication: "ARCHIVED" } : q,
      ),
    },
    root,
  );
  expect(blocked.reason).toContain(nested.title);
  expect(blocked.family).toHaveLength(3);
});
it("el diálogo mueve todo el grupo, preserva su orden y envía también las posiciones reservadas", async () => {
  const done = vi.fn();
  render(
    <MoveQuestionDialog
      data={data}
      question={child}
      projectId="project"
      onClose={vi.fn()}
      onMoved={done}
    />,
  );
  expect(
    screen.getByText(/Se moverá con su pregunta principal/),
  ).toHaveTextContent(nested.title);
  const user = userEvent.setup();
  await user.selectOptions(
    screen.getByLabelText("Tema de destino"),
    destination.id,
  );
  await user.click(screen.getByRole("button", { name: "Cambiar de tema" }));
  await waitFor(() => expect(done).toHaveBeenCalledWith(destination.id));
  expect(api).toHaveBeenCalledExactlyOnceWith(
    "reorderQuestions",
    { projectId: "project" },
    {
      expectedVersion: data.structureVersion,
      sections: [
        {
          sectionId: root.sectionId,
          expected: [root, child, nested].map(({ id, order, lockVersion }) => ({
            id,
            order,
            lockVersion,
          })),
          orderedIds: [],
        },
        {
          sectionId: destination.id,
          expected: [archived, existing].map(({ id, order, lockVersion }) => ({
            id,
            order,
            lockVersion,
          })),
          orderedIds: [existing.id, root.id, child.id, nested.id],
        },
      ],
    },
  );
});
it("un integrante publicado deja un motivo con su nombre y no ofrece guardar", () => {
  render(
    <MoveQuestionDialog
      data={{
        ...data,
        questions: data.questions.map((q) =>
          q.id === nested.id ? { ...q, publication: "PUBLISHED" } : q,
        ),
      }}
      question={child}
      projectId="project"
      onClose={vi.fn()}
      onMoved={vi.fn()}
    />,
  );
  expect(
    screen.getByRole("group", { name: "Tema al que pertenece" }),
  ).toHaveAccessibleDescription(expect.stringContaining(nested.title));
  expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Cambiar de tema" }),
  ).not.toBeInTheDocument();
  expect(api).not.toHaveBeenCalled();
});
it("un conflicto simultáneo se muestra sin anunciar un movimiento inexistente", async () => {
  vi.mocked(api).mockRejectedValue(
    new Error("Otra persona cambió el cuestionario. Actualiza la información."),
  );
  const done = vi.fn();
  render(
    <MoveQuestionDialog
      data={data}
      question={child}
      projectId="project"
      onClose={vi.fn()}
      onMoved={done}
    />,
  );
  const user = userEvent.setup();
  await user.selectOptions(
    screen.getByLabelText("Tema de destino"),
    destination.id,
  );
  await user.click(screen.getByRole("button", { name: "Cambiar de tema" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Otra persona cambió",
  );
  expect(done).not.toHaveBeenCalled();
});

it.each([
  {
    question: root,
    count: 1,
    notice: `Se moverá con su único seguimiento: «${child.title}».`,
  },
  {
    question: child,
    count: 1,
    notice: `Se moverá con su pregunta principal «${root.title}» y su único seguimiento: «${child.title}».`,
  },
  {
    question: root,
    count: 2,
    notice: `Se moverá con sus 2 seguimientos: «${child.title}», «${nested.title}».`,
  },
  {
    question: child,
    count: 2,
    notice: `Se moverá con su pregunta principal «${root.title}» y sus 2 seguimientos: «${child.title}», «${nested.title}».`,
  },
])(
  "el aviso de $question.id describe $count seguimientos con sus nombres y conserva el grupo",
  ({ question, count, notice }) => {
    const family = count === 1 ? [root, child] : [root, child, nested];
    const result = questionTopicMove({ ...data, questions: family }, question);
    expect(result.notice).toBe(notice);
    expect(result.family.map((member) => member.id)).toEqual(
      family.map((member) => member.id),
    );
  },
);
