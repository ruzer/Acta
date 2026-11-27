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
import { QuestionInspector } from "./QuestionInspector";
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
  vi.unstubAllGlobals();
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

it("ordena lectura antes de datos y conserva las acciones exigidas fuera del menú", () => {
  vi.stubGlobal("matchMedia", () => ({
    matches: true,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
  vi.stubGlobal("requestAnimationFrame", vi.fn());
  const question = {
    ...draft,
    type: "SINGLE_CHOICE" as const,
    options: [
      { value: "one", label: "Opción ficticia", order: 0 },
      { value: "two", label: "Otra opción ficticia", order: 1 },
    ],
  };
  const { container } = render(
    <QuestionInspector
      {...props}
      data={{ ...props.data, questions: [question] }}
      question={question}
      onClose={vi.fn()}
      onNavigate={vi.fn()}
      visibleIds={[question.id]}
    />,
  );
  const panel = screen.getByRole("complementary", {
    name: "Detalle de pregunta",
  });
  expect(
    within(panel).getByRole("heading", { name: "Detalle de pregunta" }),
  ).toHaveFocus();
  const options = screen.getByRole("region", { name: "Opciones de respuesta" });
  const facts = screen.getByRole("region", { name: "Datos de la pregunta" });
  expect(
    options.compareDocumentPosition(facts) & Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();
  const footer = container.querySelector(
    ".qe-inspector-footer",
  )! as HTMLElement;
  expect(within(footer).getByRole("button", { name: "Publicar" })).toHaveClass(
    "primary",
  );
  expect(within(footer).getByText("Más acciones")).toBeVisible();
  expect(footer.closest(".qe-inspector-body")).toBeNull();
  expect(
    screen.getByRole("button", { name: "Editar pregunta" }).closest("details"),
  ).toBeNull();
  expect(
    screen
      .getByRole("button", { name: "Asignar participantes" })
      .closest("details"),
  ).toBeNull();
});
it("una pregunta única comparte un motivo visible y bloquea ambos sentidos sin perder foco", async () => {
  const user = userEvent.setup();
  const navigate = vi.fn();
  render(
    <QuestionInspectorNavigation
      questionId="only"
      visibleIds={["only"]}
      onNavigate={navigate}
    />,
  );
  const reason = "Esta es la única pregunta de los resultados.";
  expect(screen.getAllByText(reason)).toHaveLength(1);
  for (const name of ["Pregunta anterior", "Pregunta siguiente"]) {
    const button = screen.getByRole("button", { name });
    expect(button).toHaveAccessibleDescription(reason);
    await user.click(button);
    expect(button).toHaveFocus();
    await user.keyboard("{Enter}");
  }
  expect(navigate).not.toHaveBeenCalled();
});

it("Revisar respuestas navega una sola vez sin cerrar antes el historial del editor", async () => {
  vi.stubGlobal("matchMedia", () => ({
    matches: true,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
  vi.stubGlobal("requestAnimationFrame", vi.fn());
  const user = userEvent.setup();
  const close = vi.fn();
  const review = vi.fn();
  render(
    <QuestionInspector
      {...props}
      question={{ ...draft, publication: "PUBLISHED" }}
      onClose={close}
      onOpenContributions={review}
      onNavigate={vi.fn()}
      visibleIds={[draft.id]}
    />,
  );
  await user.click(screen.getByRole("button", { name: "Revisar respuestas" }));
  expect(review).toHaveBeenCalledExactlyOnceWith(draft.id);
  expect(close).not.toHaveBeenCalled();
});
