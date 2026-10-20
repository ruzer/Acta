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
import { nextQuestionId, suggestTitle } from "./question-suggestions";

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

const withIds = (...ids: string[]) => ({
  ...data,
  questions: data.questions.map((q, i) => ({
    ...q,
    externalId: ids[i] ?? q.externalId,
  })),
});

it("la siguiente pregunta propone el identificador libre y nunca toca los existentes", () => {
  expect(nextQuestionId([])).toBe("P-001");
  expect(nextQuestionId(["P-001", "P-009", "Q-77", "p-3"])).toBe("P-010");
  expect(nextQuestionId(["P-999"])).toBe("P-1000");
});

it("el título sugerido sale de la primera oración, sin servicios externos", () => {
  expect(suggestTitle("")).toBe("");
  expect(
    suggestTitle("¿Cómo se registra una solicitud?  ¿Quién la revisa?"),
  ).toBe("Cómo se registra una solicitud");
  const long =
    "Describe el procedimiento completo de recepción de solicitudes internas y de su registro inicial en el sistema";
  const title = suggestTitle(long);
  expect(title.length).toBeLessThanOrEqual(81);
  expect(title.endsWith("…")).toBe(true);
  expect(long.startsWith(title.slice(0, -1))).toBe(true);
});

it("una pregunta nueva propone identificador y título, editables y sin pisar lo escrito", async () => {
  const { user } = form({
    initial: undefined,
    data: withIds("P-007", "P-002"),
  });
  const id = screen.getByLabelText("Identificador externo");
  const title = screen.getByLabelText("Título breve");
  expect(id).toHaveValue("P-008");
  const statement = screen.getByLabelText("Pregunta", { exact: true });
  await user.type(statement, "¿Qué canal se usa para recibir solicitudes?");
  expect(title).toHaveValue("Qué canal se usa para recibir solicitudes");
  // The person writes their own title: later edits of the statement leave it alone.
  await user.clear(title);
  await user.type(title, "Canal de recepción");
  await user.type(statement, " Responde con el canal principal.");
  expect(title).toHaveValue("Canal de recepción");
  // And their own identifier is kept as typed.
  await user.clear(id);
  await user.type(id, "RH-014");
  expect(id).toHaveValue("RH-014");
});

it("editar una pregunta existente no propone ni cambia identificador ni título", async () => {
  const { user } = form();
  const statement = screen.getByLabelText("Pregunta", { exact: true });
  const before = {
    id: (screen.getByLabelText("Identificador externo") as HTMLInputElement)
      .value,
    title: (screen.getByLabelText("Título breve") as HTMLInputElement).value,
  };
  await user.type(statement, " Más contexto.");
  expect(screen.getByLabelText("Identificador externo")).toHaveValue(before.id);
  expect(screen.getByLabelText("Título breve")).toHaveValue(before.title);
});

it("si otra persona usó el identificador sugerido, propone el siguiente sin perder el texto", async () => {
  const onSave = vi
    .fn()
    .mockRejectedValueOnce(
      new ApiFailure(400, "Revisa los campos indicados.", {
        externalId:
          "Ya existe una pregunta con este identificador en el proyecto.",
      }),
    )
    .mockResolvedValue(undefined);
  const { user } = form({ initial: undefined, data: withIds("P-001"), onSave });
  await user.type(
    screen.getByLabelText("Pregunta", { exact: true }),
    "¿Hay un canal único?",
  );
  expect(screen.getByLabelText("Identificador externo")).toHaveValue("P-002");
  await user.click(screen.getByRole("button", { name: "Crear pregunta" }));
  await waitFor(() =>
    expect(screen.getByLabelText("Identificador externo")).toHaveValue("P-003"),
  );
  expect(screen.getByText(/El identificador P-002 ya se usó/)).toBeVisible();
  expect(screen.getByLabelText("Pregunta", { exact: true })).toHaveValue(
    "¿Hay un canal único?",
  );
  await user.click(screen.getByRole("button", { name: "Crear pregunta" }));
  await waitFor(() => expect(onSave).toHaveBeenCalledTimes(2));
  expect(onSave.mock.calls[1]![0].externalId).toBe("P-003");
});

it("un identificador escrito a mano que ya existe se señala en su campo y no se cambia", async () => {
  const onSave = vi.fn().mockRejectedValue(
    new ApiFailure(400, "Revisa los campos indicados.", {
      externalId:
        "Ya existe una pregunta con este identificador en el proyecto.",
    }),
  );
  const { user } = form({
    initial: undefined,
    data: withIds("RH-014"),
    onSave,
  });
  await user.type(
    screen.getByLabelText("Pregunta", { exact: true }),
    "¿Hay un canal único?",
  );
  const id = screen.getByLabelText("Identificador externo");
  await user.clear(id);
  await user.type(id, "RH-014");
  await user.click(screen.getByRole("button", { name: "Crear pregunta" }));
  await waitFor(() =>
    expect(
      screen.getAllByText(/Ya existe una pregunta/).length,
    ).toBeGreaterThan(0),
  );
  expect(id).toHaveValue("RH-014");
});
