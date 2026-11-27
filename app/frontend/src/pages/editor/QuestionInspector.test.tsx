import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";
import { questionnaireView } from "@requirements/contracts";
import fixture from "../../../../../tests/fixtures/analyst-visual.json";
import { inspectorActions } from "./inspector-actions";
import { QuestionInspectorContent } from "./QuestionInspectorContent";
import { QuestionInspectorActions } from "./QuestionInspectorActions";
import { QuestionInspectorNavigation } from "./QuestionInspectorNavigation";
import { QuestionOpenButton } from "./QuestionOpenButton";
const data = questionnaireView.parse(fixture.questionnaire);
const draft = {
  ...data.questions[0]!,
  publication: "DRAFT" as const,
  type: "LONG_TEXT" as const,
  options: [],
  groupParentId: null,
  condition: null,
  assignments: [],
};
const props = {
  data: { ...data, questions: [draft] },
  projectId: "p",
  onEdit: vi.fn(),
  onAction: vi.fn(),
  onCreateTopic: vi.fn(),
  onCreateReference: vi.fn(),
};
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
it("sin participantes permite publicar; errores y principal borrador priorizan editar", () => {
  expect(inspectorActions(props.data, draft).primary).toBe("publish");
  expect(
    inspectorActions(
      {
        ...props.data,
        questions: [{ ...draft, responsibleAreaId: "missing" }],
      },
      { ...draft, responsibleAreaId: "missing" },
    ).primary,
  ).toBe("edit");
  const child = { ...draft, id: "child", groupParentId: draft.id };
  expect(
    inspectorActions({ ...data, questions: [draft, child] }, child).primary,
  ).toBe("edit");
});
it.each(["DRAFT", "PUBLISHED", "ARCHIVED"] as const)(
  "muestra tema, asignados, ayuda y opciones en %s",
  (publication) => {
    const q = {
      ...draft,
      publication,
      helpText: "Ayuda ficticia",
      options: [
        { value: "b", label: "Segunda", order: 1 },
        { value: "a", label: "Primera", order: 0 },
      ],
    };
    render(
      <QuestionInspectorContent
        data={data}
        question={q}
        onChangeTopic={vi.fn()}
      />,
    );
    expect(screen.getByText("Ayuda ficticia")).toBeVisible();
    expect(
      within(screen.getByRole("region", { name: "Opciones de respuesta" }))
        .getAllByRole("listitem")
        .map((x) => x.textContent),
    ).toEqual(["Primera", "Segunda"]);
    expect(screen.getByText("Sin participantes asignados")).toBeVisible();
    expect(!!screen.queryByRole("button", { name: "Cambiar de tema" })).toBe(
      publication === "DRAFT",
    );
  },
);
it("muestra las filas y columnas de una matriz", () => {
  render(
    <QuestionInspectorContent
      data={data}
      question={{
        ...draft,
        type: "MATRIX",
        config: {
          rows: [{ key: "r", label: "Fila ficticia" }],
          columns: [{ key: "c", label: "Columna ficticia" }],
        },
      }}
      onChangeTopic={vi.fn()}
    />,
  );
  expect(screen.getByText("Fila ficticia")).toBeVisible();
  expect(screen.getByText("Columna ficticia")).toBeVisible();
});
it("tiene una principal y dos secundarias como máximo; el resto queda en Más acciones", async () => {
  const user = userEvent.setup();
  render(
    <QuestionInspectorActions
      {...props}
      question={draft}
      onSelectGroup={vi.fn()}
    />,
  );
  expect(screen.getByRole("button", { name: "Publicar" })).toHaveClass(
    "primary",
  );
  expect(
    screen
      .getAllByRole("button")
      .filter((button) => !button.closest("details")),
  ).toHaveLength(3);
  expect(
    screen.queryByRole("button", { name: "Cambiar de tema" }),
  ).not.toBeInTheDocument();
  await user.click(screen.getByText("Más acciones"));
  expect(
    screen.getByRole("button", { name: "Seleccionar grupo completo" }),
  ).toBeVisible();
  await user.click(screen.getByRole("button", { name: "Configurar" }));
  expect(props.onAction).toHaveBeenCalledWith("metadata", draft);
});
it("publicada prioriza respuestas y archivada no tiene menú vacío", () => {
  const view = render(
    <QuestionInspectorActions
      {...props}
      question={{ ...draft, publication: "PUBLISHED" }}
      onOpenContributions={vi.fn()}
    />,
  );
  expect(
    screen.getByRole("button", { name: "Revisar respuestas" }),
  ).toHaveClass("primary");
  expect(
    screen
      .getAllByRole("button")
      .filter((button) => !button.closest("details")),
  ).toHaveLength(2);
  view.rerender(
    <QuestionInspectorActions
      {...props}
      question={{ ...draft, publication: "ARCHIVED" }}
    />,
  );
  expect(screen.queryByText("Más acciones")).not.toBeInTheDocument();
});
it("el enlace incluye flecha sin alterar su nombre y se abre con teclado", async () => {
  const user = userEvent.setup(),
    open = vi.fn();
  render(<QuestionOpenButton question={draft} current onOpen={open} />);
  const button = screen.getByRole("button", { name: draft.question });
  expect(button).toHaveAttribute("aria-current", "true");
  button.focus();
  await user.keyboard("{Enter}");
  expect(open).toHaveBeenCalledWith(draft.id);
});
it("recorre solo ids visibles y explica una pregunta fuera de filtros", async () => {
  const user = userEvent.setup(),
    navigate = vi.fn();
  const view = render(
    <QuestionInspectorNavigation
      questionId="b"
      visibleIds={["a", "b", "c"]}
      onNavigate={navigate}
    />,
  );
  expect(screen.getByRole("status")).toHaveTextContent("2 de 3 resultados");
  await user.click(screen.getByRole("button", { name: "Pregunta siguiente" }));
  expect(navigate).toHaveBeenCalledWith("c");
  view.rerender(
    <QuestionInspectorNavigation
      questionId="outside"
      visibleIds={["a", "b"]}
      onNavigate={navigate}
    />,
  );
  expect(screen.getByRole("status")).toHaveTextContent(
    "Fuera de los resultados actuales",
  );
  expect(
    screen.getByRole("button", { name: "Pregunta siguiente" }),
  ).toHaveAttribute("aria-disabled", "true");
});
