import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";
import { questionnaireView } from "@requirements/contracts";
import fixture from "../../../../../tests/fixtures/analyst-visual.json";
import { EditorWorkspace } from "./EditorWorkspace";
const data = questionnaireView.parse(fixture.questionnaire);
afterEach(cleanup);
it("Escribir muestra contenido completo, alta contextual y conserva seguimiento independiente", async () => {
  const user = userEvent.setup(),
    edit = vi.fn();
  const q = {
    ...data.questions[0]!,
    id: "follow-up",
    title: "Seguimiento ficticio",
    question: "Enunciado completo del seguimiento",
    groupParentId: data.questions[0]!.id,
    condition: null,
  };
  render(
    <EditorWorkspace
      data={{ ...data, questions: [...data.questions, q] }}
      projectId="p"
      onEdit={edit}
      onAction={vi.fn()}
      onCreateTopic={vi.fn()}
      onCreateReference={vi.fn()}
    />,
  );
  expect(screen.getByText(q.question)).toBeVisible();
  expect(screen.getByText(/↳ Seguimiento de/)).toBeVisible();
  const topic = screen.getByRole("region", { name: data.sections[0]!.title });
  await user.click(
    within(topic).getByRole("button", { name: "+ Agregar pregunta" }),
  );
  expect(edit).toHaveBeenCalledWith(undefined, data.sections[0]!.id);
  expect(
    screen.queryByText("Secciones y referencias del proyecto"),
  ).not.toBeInTheDocument();
});
it("modos permiten flechas, Home/End y relacionan cada panel sin etapas obligatorias", async () => {
  const user = userEvent.setup();
  render(
    <EditorWorkspace
      data={data}
      projectId="p"
      onEdit={vi.fn()}
      onAction={vi.fn()}
      onCreateTopic={vi.fn()}
      onCreateReference={vi.fn()}
    />,
  );
  screen.getByRole("tab", { name: "Escribir" }).focus();
  await user.keyboard("{ArrowRight}");
  expect(screen.getByRole("tab", { name: "Organizar" })).toHaveFocus();
  expect(screen.getByRole("tabpanel", { name: "Organizar" })).toBeVisible();
  await user.keyboard("{End}");
  expect(screen.getByRole("tab", { name: "Revisar" })).toHaveFocus();
  await user.keyboard("{Home}");
  expect(screen.getByRole("tab", { name: "Escribir" })).toHaveFocus();
});
it.each([10, 50, 120, 300])(
  "Organizar busca y selecciona por identidad con %i preguntas sin expandirlas todas",
  async (count) => {
    const user = userEvent.setup();
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
    const questions = Array.from({ length: count }, (_, i) => ({
      ...data.questions[0]!,
      id: `question-${i}`,
      title: `Pregunta ${i}`,
      question: `Consulta ficticia número ${i}`,
      order: i,
      groupParentId: null,
    }));
    render(
      <EditorWorkspace
        data={{ ...data, questions }}
        projectId="p"
        onEdit={vi.fn()}
        onAction={vi.fn()}
        onCreateTopic={vi.fn()}
        onCreateReference={vi.fn()}
      />,
    );
    await user.click(screen.getByRole("tab", { name: "Organizar" }));
    expect(document.querySelectorAll(".qe-compact-row").length).toBe(
      Math.min(count, 40),
    );
    await user.type(
      screen.getByLabelText("Buscar preguntas"),
      `Consulta ficticia número ${count - 1}`,
    );
    expect(document.querySelectorAll(".qe-compact-row")).toHaveLength(1);
    await user.click(
      screen.getByRole("button", {
        name: new RegExp(`Consulta ficticia número ${count - 1}`),
      }),
    );
    expect(
      screen.getAllByRole("dialog", { name: "Detalle de pregunta" }),
    ).toHaveLength(1);
    await user.click(screen.getByRole("button", { name: "Cerrar detalle" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  },
);

it("una archivada conserva lectura y no muestra un menú de acciones vacío", () => {
  const archived = { ...data.questions[0]!, publication: "ARCHIVED" as const };
  render(
    <EditorWorkspace
      data={{ ...data, questions: [archived] }}
      projectId="p"
      onEdit={vi.fn()}
      onAction={vi.fn()}
      onCreateTopic={vi.fn()}
      onCreateReference={vi.fn()}
    />,
  );
  const row = screen.getByRole("article", { name: archived.title });
  expect(within(row).getByText(archived.question)).toBeVisible();
  expect(
    within(row).queryByLabelText("Acciones de " + archived.title),
  ).not.toBeInTheDocument();
});

it.each([false, true])(
  "cerrar inspector devuelve foco sin robar una nueva selección (nuevo foco: %s)",
  async (focusMoved) => {
    const callbacks: FrameRequestCallback[] = [];
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      callbacks.push(callback);
      return callbacks.length;
    });
    try {
      const user = userEvent.setup();
      render(
        <EditorWorkspace
          data={data}
          projectId="p"
          onEdit={vi.fn()}
          onAction={vi.fn()}
          onCreateTopic={vi.fn()}
          onCreateReference={vi.fn()}
        />,
      );
      await user.click(screen.getByRole("tab", { name: "Organizar" }));
      const trigger = screen.getByRole("button", {
        name: new RegExp(
          data.questions[0]!.question.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
        ),
      });
      await user.click(trigger);
      await user.click(screen.getByRole("button", { name: "Cerrar detalle" }));
      const tab = screen.getByRole("tab", { name: "Escribir" });
      if (focusMoved) tab.focus();
      for (const callback of callbacks) callback(performance.now());
      expect(focusMoved ? tab : trigger).toHaveFocus();
      if (focusMoved) {
        await user.keyboard("{End}");
        expect(screen.getByRole("tab", { name: "Revisar" })).toHaveFocus();
      }
    } finally {
      vi.unstubAllGlobals();
    }
  },
);
