import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";
import { questionnaireView } from "@requirements/contracts";
import fixture from "../../../../../tests/fixtures/analyst-visual.json";
import { EditorWorkspace } from "./EditorWorkspace";
import { EditorWorkspace as Organize } from "./EditorWorkspace";

const data = questionnaireView.parse(fixture.questionnaire);
const handlers = {
  projectId: "project-test",
  onEdit: vi.fn(),
  onAction: vi.fn(),
  onCreateTopic: vi.fn(),
  onCreateReference: vi.fn(),
};
const areaReason =
  "Para crear preguntas hace falta al menos un área activa. Pide a la administración de la institución que la active en Administración.";
const topicReason =
  "Su nombre y descripción están protegidos porque el tema tiene preguntas publicadas o archivadas.";
const searchReason =
  "Con una búsqueda activa se muestran todos los grupos desplegados. Limpia la búsqueda para contraerlos.";
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

it.each(["PUBLISHED", "ARCHIVED"] as const)(
  "explica el tema protegido por una pregunta %s y no ejecuta la edición",
  async (publication) => {
    const user = userEvent.setup();
    const editTopic = vi.fn();
    const question = { ...data.questions[0]!, publication };
    render(
      <EditorWorkspace
        {...handlers}
        data={{ ...data, questions: [question] }}
        onTopicAction={editTopic}
      />,
    );
    const topic = data.sections.find(
      (section) => section.id === question.sectionId,
    )!;
    await user.click(screen.getByLabelText("Acciones del tema " + topic.title));
    const edit = screen.getByRole("button", { name: "Editar tema" });
    expect(edit).toHaveAttribute("aria-disabled", "true");
    expect(edit).toHaveAccessibleDescription(topicReason);
    expect(screen.getByText(topicReason)).toBeVisible();
    await user.click(edit);
    edit.focus();
    await user.keyboard("{Enter} ");
    expect(editTopic).not.toHaveBeenCalled();
    expect(edit).toHaveFocus();
  },
);

it("una pregunta en borrador permite editar el tema", async () => {
  const editTopic = vi.fn();
  const question = { ...data.questions[0]!, publication: "DRAFT" as const };
  render(
    <EditorWorkspace
      {...handlers}
      data={{ ...data, questions: [question] }}
      onTopicAction={editTopic}
    />,
  );
  const topic = data.sections.find(
    (section) => section.id === question.sectionId,
  )!;
  await userEvent.click(
    screen.getByLabelText("Acciones del tema " + topic.title),
  );
  await userEvent.click(screen.getByRole("button", { name: "Editar tema" }));
  expect(editTopic).toHaveBeenCalledExactlyOnceWith("edit", topic.id);
});

it.each(["Escribir", "Organizar"])(
  "%s explica la falta de área aunque el cuestionario ya tenga preguntas",
  async (mode) => {
    const user = userEvent.setup();
    render(
      <EditorWorkspace
        {...handlers}
        data={{
          ...data,
          areas: data.areas.map((area) => ({ ...area, active: false })),
        }}
      />,
    );
    if (mode === "Organizar")
      await user.click(screen.getByRole("tab", { name: mode }));
    const controls = screen.getAllByRole("button", {
      name: mode === "Escribir" ? "+ Agregar pregunta" : "Nueva pregunta",
    });
    for (const control of controls) {
      expect(control).toHaveAttribute("aria-disabled", "true");
      expect(control).toHaveAccessibleDescription(areaReason);
      await user.click(control);
      control.focus();
      await user.keyboard("{Enter} ");
    }
    expect(screen.getAllByText(areaReason).length).toBeGreaterThan(0);
    expect(handlers.onEdit).not.toHaveBeenCalled();
  },
);

it("la búsqueda bloquea ambos controles globales y el de fila, sin perder el plegado ni la selección", async () => {
  const user = userEvent.setup();
  const parent = {
    ...data.questions[0]!,
    title: "Principal de prueba",
    question: "Consulta principal de prueba",
    publication: "DRAFT" as const,
    groupParentId: null,
    condition: null,
  };
  const child = {
    ...parent,
    id: "child",
    title: "Seguimiento de prueba",
    question: "Consulta de seguimiento",
    groupParentId: parent.id,
    order: parent.order + 1,
  };
  render(
    <Organize
      initialMode={1}
      {...handlers}
      data={{ ...data, questions: [parent, child] }}
    />,
  );
  await user.click(
    screen.getByRole("button", { name: "Contraer todos los grupos" }),
  );
  const search = screen.getByRole("searchbox", { name: "Buscar preguntas" });
  await user.type(search, "Consulta");
  const selected = screen.getByRole("checkbox", {
    name: "Seleccionar pregunta: " + child.question,
  });
  await user.click(selected);
  for (const name of [
    "Expandir todos los grupos",
    "Contraer todos los grupos",
    "Contraer seguimientos de " + parent.title,
  ]) {
    const control = screen.getByRole("button", { name });
    expect(control).toHaveAttribute("aria-disabled", "true");
    expect(control).toHaveAccessibleDescription(searchReason);
    await user.click(control);
    control.focus();
    await user.keyboard("{Enter} ");
    expect(control).toHaveFocus();
    expect(selected).toBeChecked();
  }
  expect(screen.getByText(searchReason)).toBeVisible();
  await user.clear(search);
  expect(
    screen.getByRole("button", {
      name: "Expandir seguimientos de " + parent.title,
    }),
  ).toHaveAttribute("aria-expanded", "false");
  expect(
    screen.queryByRole("checkbox", {
      name: "Seleccionar pregunta: " + child.question,
    }),
  ).not.toBeInTheDocument();
});

it("una pregunta archivada se consulta pero no ofrece una casilla inutilizable", () => {
  const archived = { ...data.questions[0]!, publication: "ARCHIVED" as const };
  render(
    <Organize
      initialMode={1}
      {...handlers}
      data={{ ...data, questions: [archived] }}
    />,
  );
  const title = screen.getByRole("button", { name: archived.question });
  const row = title.closest("tr")!;
  expect(within(row).queryByRole("checkbox")).not.toBeInTheDocument();
  expect(
    within(row).getByText("No se puede seleccionar una pregunta archivada."),
  ).toBeVisible();
});

it("Escribir conserva la jerarquía de encabezados entre tema y pregunta", () => {
  render(<EditorWorkspace {...handlers} data={data} />);
  const section = data.sections.find(
    (s) => s.id === data.questions[0]!.sectionId,
  )!;
  expect(
    screen.getByRole("heading", { level: 2, name: new RegExp(section.title) }),
  ).toBeVisible();
  expect(
    screen.getByRole("heading", {
      level: 3,
      name: data.questions[0]!.question,
    }),
  ).toBeVisible();
});

it("un tema en el extremo explica por qué no se mueve y no ejecuta la acción", async () => {
  const action = vi.fn();
  const section = data.sections[0]!;
  render(
    <EditorWorkspace
      {...handlers}
      data={{ ...data, sections: [section] }}
      onTopicAction={action}
    />,
  );
  await userEvent.click(
    screen.getByLabelText("Acciones del tema " + section.title),
  );
  const menu = screen
    .getByLabelText("Acciones del tema " + section.title)
    .closest("details")!;
  const up = within(menu).getByRole("button", { name: "Mover arriba" });
  expect(up).toHaveAttribute("aria-disabled", "true");
  expect(up).toHaveAccessibleDescription(
    "Este tema ya está al principio del cuestionario.",
  );
  await userEvent.click(up);
  expect(action).not.toHaveBeenCalled();
});
