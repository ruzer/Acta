import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  cleanup,
  render,
  screen,
  within,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  invitationCreateInput,
  questionnaireView,
} from "@requirements/contracts";
import fixture from "../../../../tests/fixtures/analyst-visual.json";
import * as apiModule from "../api";
import { CreateInvitation } from "./Invitations";
const questionnaire = questionnaireView.parse(fixture.questionnaire);
const policy = {
  allowNonNominal: false,
  expectedVersion: 0,
  identityRequirement: "NONE",
  defaultDays: 7,
  maxDays: 30,
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
function mount({
  selectable = false,
  questions = questionnaire.questions,
  nonNominal = false,
} = {}) {
  const request = vi
    .spyOn(apiModule, "api")
    .mockImplementation(
      async (key) =>
        (key === "invitationPolicy"
          ? { ...policy, allowNonNominal: nonNominal }
          : { url: "https://example.test/invited" }) as never,
    );
  const close = vi.fn();
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <CreateInvitation
        projectId={fixture.projectId}
        questions={questions}
        areas={questionnaire.areas}
        selectable={selectable}
        onClose={close}
      />
    </QueryClientProvider>,
  );
  return { request, user: userEvent.setup(), close };
}
async function recipient(user: ReturnType<typeof userEvent.setup>) {
  await user.type(
    await screen.findByLabelText("Referencia de la invitación"),
    "Consulta ficticia",
  );
  await user.type(
    screen.getByLabelText("Nombre de la persona"),
    "Persona de ejemplo",
  );
  await user.click(screen.getByRole("button", { name: "Continuar" }));
}
async function areaAndSummary(user: ReturnType<typeof userEvent.setup>) {
  await user.selectOptions(
    screen.getByLabelText("Área de la aportación"),
    questionnaire.areas[0]!.id,
  );
  await user.click(screen.getByRole("button", { name: "Continuar" }));
  await user.click(screen.getByRole("button", { name: "Continuar" }));
}
it("crea solo después de revisar el resumen, con el mismo contrato y alcance contextual", async () => {
  const { request, user } = mount();
  await recipient(user);
  expect(screen.getByRole("heading", { name: "Preguntas" })).toHaveFocus();
  await areaAndSummary(user);
  expect(screen.getByRole("heading", { name: "Resumen" })).toHaveFocus();
  expect(screen.getByText("4 preguntas publicadas")).toBeVisible();
  expect(screen.getByText("7 días desde crear el enlace")).toBeVisible();
  expect(
    request.mock.calls.filter((c) => c[0] === "createInvitation"),
  ).toHaveLength(0);
  await user.click(
    screen.getByRole("button", { name: "Crear enlace privado" }),
  );
  await screen.findByRole("dialog", { name: "Enlace privado de respuesta" });
  const calls = request.mock.calls.filter((c) => c[0] === "createInvitation");
  expect(calls).toHaveLength(1);
  expect(invitationCreateInput.parse(calls[0]![2])).toMatchObject({
    questionIds: questionnaire.questions.map((q) => q.id),
    identity: { name: "Persona de ejemplo" },
    areaId: questionnaire.areas[0]!.id,
    nonNominal: false,
    allowEvidence: false,
  });
  expect(calls[0]![2]).not.toHaveProperty("expiresAt");
});
it("volver conserva destinatario, alcance y campos de vigencia sin crear", async () => {
  const { user, request } = mount();
  await recipient(user);
  await areaAndSummary(user);
  await user.click(screen.getByRole("button", { name: "Atrás" }));
  await user.click(
    screen.getByLabelText("Permitir adjuntar y descargar evidencia propia"),
  );
  await user.click(screen.getByRole("button", { name: "Atrás" }));
  await user.click(screen.getByRole("button", { name: "Atrás" }));
  expect(screen.getByLabelText("Nombre de la persona")).toHaveValue(
    "Persona de ejemplo",
  );
  await user.click(screen.getByRole("button", { name: "Continuar" }));
  await user.click(screen.getByRole("button", { name: "Continuar" }));
  expect(
    screen.getByLabelText("Permitir adjuntar y descargar evidencia propia"),
  ).toBeChecked();
  expect(
    request.mock.calls.filter((c) => c[0] === "createInvitation"),
  ).toHaveLength(0);
});
it("desde el gestor filtra solo publicadas y comunica las seleccionadas fuera del filtro", async () => {
  const { user, request } = mount({
    selectable: true,
    questions: questionnaire.questions.map((q, i) => ({
      ...q,
      publication: i === 3 ? "DRAFT" : "PUBLISHED",
    })),
  });
  await recipient(user);
  expect(
    screen
      .getByRole("group", { name: "Preguntas disponibles" })
      .querySelectorAll("input"),
  ).toHaveLength(3);
  await user.type(screen.getByRole("searchbox"), "VIS-0");
  await user.click(
    screen.getByRole("button", { name: "Seleccionar 1 resultado" }),
  );
  await user.clear(screen.getByRole("searchbox"));
  await user.type(screen.getByRole("searchbox"), "VIS-1");
  expect(screen.getByText(/1 seleccionadas fuera del filtro/)).toBeVisible();
  await user.click(
    screen.getByRole("button", { name: "Seleccionar 1 resultado" }),
  );
  await areaAndSummary(user);
  expect(screen.getByText("2 preguntas publicadas")).toBeVisible();
  await user.click(
    screen.getByRole("button", { name: "Crear enlace privado" }),
  );
  await waitFor(() =>
    expect(
      request.mock.calls.filter((c) => c[0] === "createInvitation"),
    ).toHaveLength(1),
  );
  expect(
    request.mock.calls.find((c) => c[0] === "createInvitation")![2],
  ).toMatchObject({
    questionIds: questionnaire.questions.slice(0, 2).map((q) => q.id),
  });
});
it("una condición no agrega silenciosamente la principal ni permite avanzar sin ella", async () => {
  const dependent = {
    ...questionnaire.questions[1]!,
    condition: {
      parentQuestionId: questionnaire.questions[0]!.id,
      operator: "EQUALS" as const,
      value: true,
    },
  };
  const { user, request } = mount({ questions: [dependent] });
  await recipient(user);
  expect(screen.getByRole("alert")).toHaveTextContent(
    "Faltan preguntas de las que depende una condición",
  );
  expect(screen.getByRole("button", { name: "Continuar" })).toBeDisabled();
  expect(
    request.mock.calls.filter((c) => c[0] === "createInvitation"),
  ).toHaveLength(0);
});
it("los borradores seleccionados no se publican ni permiten crear una invitación", async () => {
  const { user, request } = mount({
    questions: [{ ...questionnaire.questions[0]!, publication: "DRAFT" }],
  });
  await recipient(user);
  expect(screen.getByRole("alert")).toHaveTextContent(
    "Esta acción no publica borradores",
  );
  expect(screen.getByRole("button", { name: "Continuar" })).toBeDisabled();
  expect(
    request.mock.calls.filter((c) => c[0] !== "invitationPolicy"),
  ).toHaveLength(0);
});
it("no nominal respeta la política y envía identidad vacía aunque hubiera datos previos", async () => {
  const { user, request } = mount({ nonNominal: true });
  await user.type(
    await screen.findByLabelText("Referencia de la invitación"),
    "Consulta sin nombre",
  );
  await user.type(
    screen.getByLabelText("Nombre de la persona"),
    "Nombre ficticio descartado",
  );
  await user.click(
    screen.getByLabelText("Invitación no nominal (sin datos personales)"),
  );
  expect(
    screen.queryByLabelText("Nombre de la persona"),
  ).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Continuar" }));
  await areaAndSummary(user);
  await user.click(
    screen.getByRole("button", { name: "Crear enlace privado" }),
  );
  await waitFor(() =>
    expect(
      request.mock.calls.filter((c) => c[0] === "createInvitation"),
    ).toHaveLength(1),
  );
  expect(
    request.mock.calls.find((c) => c[0] === "createInvitation")![2],
  ).toMatchObject({ identity: {}, nonNominal: true });
});
it("el rechazo del backend mantiene el resumen y enfoca el error sin anunciar éxito", async () => {
  const { user, request } = mount();
  await recipient(user);
  await areaAndSummary(user);
  request.mockImplementation(async (key) => {
    if (key === "createInvitation")
      throw new apiModule.ApiFailure(
        409,
        "Cambió una pregunta. Revisa el alcance.",
      );
    return policy as never;
  });
  await user.click(
    screen.getByRole("button", { name: "Crear enlace privado" }),
  );
  const error = await screen.findByRole("alert");
  expect(error).toHaveTextContent("Cambió una pregunta");
  await waitFor(() => expect(error.parentElement).toHaveFocus());
  expect(screen.getByRole("heading", { name: "Resumen" })).toBeVisible();
  expect(
    within(screen.getByRole("dialog")).queryByLabelText("Enlace privado"),
  ).not.toBeInTheDocument();
});
