import type { ComponentProps } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import "@testing-library/jest-dom/vitest";
import {
  questionInput,
  questionnaireView,
  referenceView,
} from "@requirements/contracts";
import fixture from "../../../../tests/fixtures/analyst-visual.json";
import { ApiFailure } from "../api";
import { QuestionForm } from "./QuestionForm";

const questionnaire = questionnaireView.parse(fixture.questionnaire);
const parent = { ...questionnaire.questions[0]!, type: "YES_NO" as const };
const reference = referenceView.parse({
  id: "20fdf699-1a42-4292-ab74-60a92f8752c3",
  externalId: "REF-TEST",
  type: "DOCUMENT",
  label: "Documento de prueba",
});
const configuredQuestion = {
  ...questionnaire.questions[1]!,
  groupParentId: parent.id,
  supersedesQuestionId: parent.id,
  condition: {
    parentQuestionId: parent.id,
    operator: "EQUALS" as const,
    value: true,
  },
  references: [
    { referenceId: reference.id, scopeNote: "Contexto del proceso" },
  ],
  config: { maxLength: 200 },
};
const data = {
  ...questionnaire,
  questions: [parent, configuredQuestion, ...questionnaire.questions.slice(2)],
  references: [reference],
};

beforeEach(() => {
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
  vi.restoreAllMocks();
});

function form(overrides: Partial<ComponentProps<typeof QuestionForm>> = {}) {
  const onSave = vi.fn().mockResolvedValue(undefined);
  const router = createMemoryRouter([
    {
      path: "/",
      element: (
        <QuestionForm
          data={data}
          initial={configuredQuestion}
          onSave={onSave}
          onCancel={() => {}}
          {...overrides}
        />
      ),
    },
  ]);
  render(<RouterProvider router={router} />);
  return { user: userEvent.setup(), onSave };
}

it("guardar solo la redacción conserva el payload completo de los grupos plegados", async () => {
  const { user, onSave } = form();
  expect(
    screen.getByText("Configuración avanzada").closest("details"),
  ).not.toHaveAttribute("open");
  const question = screen.getByLabelText("Pregunta", { exact: true });
  await user.clear(question);
  await user.type(
    question,
    "¿Qué canal se usa para comunicar el resultado al área solicitante?",
  );
  await user.click(screen.getByRole("button", { name: "Guardar cambios" }));
  const expected = Object.fromEntries(
    Object.keys(questionInput.shape).map((key) => [
      key,
      configuredQuestion[key as keyof typeof configuredQuestion],
    ]),
  );
  await waitFor(() =>
    expect(onSave).toHaveBeenCalledExactlyOnceWith({
      ...expected,
      question:
        "¿Qué canal se usa para comunicar el resultado al área solicitante?",
    }),
  );
});

it.each([
  ["responsibleAreaId", "Área responsable", "Prioridad y área responsable"],
  [
    "groupParentId",
    "Pregunta principal del grupo",
    "Seguimiento de una pregunta",
  ],
  ["condition.value", "Valor esperado", "Condición de visualización"],
  [
    "supersedesQuestionId",
    "Sustituye a una pregunta publicada (opcional)",
    "Referencias de trazabilidad",
  ],
  [
    "references.0.scopeNote",
    "Alcance de REF-TEST",
    "Referencias de trazabilidad",
  ],
  ["config.maxLength", "Máximo de caracteres", "Límites del campo (opcional)"],
])(
  "el error %s abre su grupo y enfoca exactamente el campo asociado",
  async (path, label, group) => {
    const message = "Revisa este valor antes de guardar.";
    const onSave = vi
      .fn()
      .mockRejectedValue(
        new ApiFailure(400, "Revisa el formulario.", { [path]: message }),
      );
    const { user } = form({ onSave });
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));
    const control = screen.getByLabelText(label, { exact: true });
    await waitFor(() => expect(control).toHaveFocus());
    expect(control).toHaveAttribute("aria-invalid", "true");
    expect(control).toHaveAccessibleDescription(message);
    expect(
      screen.getByText("Configuración avanzada").closest("details"),
    ).toHaveAttribute("open");
    expect(
      screen.getByText(group, { exact: true }).closest("details"),
    ).toHaveAttribute("open");
    expect(screen.getByLabelText("Pregunta", { exact: true })).toHaveValue(
      configuredQuestion.question,
    );
  },
);

it.each([
  ["SINGLE_CHOICE", "options", "Opciones disponibles"],
  ["MATRIX", "config", "Filas y columnas de la matriz"],
  ["SHORT_TEXT", "references", "Referencias relacionadas"],
] as const)(
  "un error del grupo %s sin controles asociados tiene mensaje y destino de foco",
  async (type, path, label) => {
    const message = "Revisa la configuración de este grupo.";
    const onSave = vi
      .fn()
      .mockRejectedValue(
        new ApiFailure(400, "Revisa el formulario.", { [path]: message }),
      );
    const { user } = form({
      onSave,
      data: { ...data, references: [] },
      initial: {
        ...configuredQuestion,
        type,
        config: null,
        options: [],
        references: [],
      },
    });
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));
    const group = await screen.findByRole("group", { name: label });
    await waitFor(() => expect(group).toHaveFocus());
    expect(group).toHaveAccessibleDescription(message);
    expect(group).toHaveAttribute("aria-invalid", "true");
  },
);

it("el acceso contextual abre el grupo y enfoca una referencia concreta", async () => {
  form({ focusField: "references.0.scopeNote" });
  await waitFor(() =>
    expect(screen.getByLabelText("Alcance de REF-TEST")).toHaveFocus(),
  );
  expect(
    screen
      .getByText("Referencias de trazabilidad", { exact: true })
      .closest("details"),
  ).toHaveAttribute("open");
});
