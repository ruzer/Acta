import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import "@testing-library/jest-dom/vitest";
import type {
  InvitationAccessView,
  ResponseView,
} from "@requirements/contracts";
import { ParticipantStatus, submittedSteps } from "./ParticipantFlow";
import { InvitationHome } from "./InvitedResponse";

afterEach(cleanup);
const response = (
  review: ResponseView["reviewStatus"],
  revisions = 1,
): ResponseView =>
  ({
    reviewStatus: review,
    revisions: Array.from({ length: revisions }, (_, i) => ({
      id: `r${i}`,
      createdAt: "2026-10-01T13:10:00.000Z",
    })),
  }) as unknown as ResponseView;
const titles = (steps: ReturnType<typeof submittedSteps>) =>
  steps.map((step) => `${step.state}:${step.title}`);

it("«Qué sigue» solo contiene estados que existen: enviada, revisión y decisión pendiente", () => {
  expect(
    titles(submittedSteps(response("ANSWERED"), { waiting: 0, total: 0 })),
  ).toEqual([
    "done:Enviaste tu respuesta",
    "current:El equipo analista revisa tu respuesta",
    "todo:Decisión validada",
  ]);
});
it("con una aclaración que espera a la persona, el turno es suyo y la revisión aún no empieza", () => {
  const steps = submittedSteps(response("CLARIFICATION_REQUIRED"), {
    waiting: 1,
    total: 1,
  });
  expect(titles(steps)).toEqual([
    "done:Enviaste tu respuesta",
    "current:Pidieron una aclaración",
    "todo:Decisión validada",
  ]);
  expect(steps[1]!.detail).toBe("Te toca responder.");
});
it("una aclaración ya atendida se dice sin prometer nada más", () => {
  expect(
    titles(submittedSteps(response("ANSWERED"), { waiting: 0, total: 1 })),
  ).toEqual([
    "done:Enviaste tu respuesta",
    "done:Se pidió una aclaración",
    "current:El equipo analista revisa tu respuesta",
    "todo:Decisión validada",
  ]);
});
it("validada y no aplica cierran la lista; ninguna promete avisos ni fechas", () => {
  const validated = submittedSteps(response("VALIDATED"), {
    waiting: 0,
    total: 0,
  });
  expect(titles(validated)).toEqual([
    "done:Enviaste tu respuesta",
    "done:Decisión validada",
  ]);
  expect(
    titles(
      submittedSteps(response("NOT_APPLICABLE"), { waiting: 0, total: 0 }),
    ),
  ).toEqual(["done:Enviaste tu respuesta", "done:Marcada como No aplica"]);
  const all = JSON.stringify([
    ...validated,
    ...submittedSteps(response("ANSWERED"), { waiting: 0, total: 0 }),
  ]);
  expect(all).not.toMatch(/correo|aviso|notific/i);
});
it("el estado visible del participante es glifo + palabra y la aclaración manda sobre los demás", () => {
  const { rerender } = render(
    <ParticipantStatus review="ANSWERED" waiting={false} hasRevision />,
  );
  expect(screen.getByText("En revisión")).toBeVisible();
  rerender(<ParticipantStatus review="ANSWERED" waiting hasRevision />);
  expect(screen.getByText("Aclaración pendiente de tu parte")).toBeVisible();
  expect(screen.queryByText("En revisión")).not.toBeInTheDocument();
  rerender(
    <ParticipantStatus review="VALIDATED" waiting={false} hasRevision />,
  );
  expect(screen.getByText("Validada").closest(".ac-status")).toHaveClass(
    "ac-status-success",
  );
});

const question = (
  overrides: Partial<
    InvitationAccessView["work"]["sections"][number]["questions"][number]
  >,
) => ({
  id: "q",
  title: "Pregunta",
  question: "¿Texto de la pregunta?",
  currentSubmission: false,
  hasSubmission: false,
  applicability: "ENABLED" as const,
  state: "PENDING" as const,
  updatedAt: null,
  reviewStatus: "NOT_REVIEWED" as const,
  clarificationWaiting: 0,
  clarificationCount: 0,
  ...overrides,
});
const access = (
  questions: ReturnType<typeof question>[],
  allowEvidence = true,
): InvitationAccessView => ({
  invitationId: "00000000-0000-4000-8000-000000000001",
  csrfToken: "a".repeat(64),
  expiresAt: new Date(Date.now() + 8 * 86_400_000).toISOString(),
  allowEvidence,
  work: {
    projectName: "Modernización de adquisiciones",
    progress: {
      total: questions.length,
      enabled: questions.length,
      sent: 0,
      drafts: 0,
      pending: questions.length,
      excluded: 0,
      undetermined: 0,
    },
    continueQuestionId: questions[0]?.id ?? null,
    sections: [{ id: "s", title: "Tema", questions }],
  },
});
function home(data: InvitationAccessView, onSelect = vi.fn()) {
  render(
    <MemoryRouter>
      <InvitationHome
        access={data}
        organization="Instituto Meridiano"
        onSelect={onSelect}
        onExit={vi.fn()}
      />
    </MemoryRouter>,
  );
  return onSelect;
}

it("la carta nombra a la organización primero, da las cuatro cifras reales y advierte del enlace", async () => {
  const user = userEvent.setup();
  const select = home(
    access([
      question({ id: "a", title: "Uno" }),
      question({ id: "b", title: "Dos" }),
      question({ id: "c", title: "Tres" }),
    ]),
  );
  expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
    "Instituto Meridiano te invita a responder 3 preguntas",
  );
  expect(screen.getByText("Invitación para aportar")).toBeVisible();
  for (const label of ["Preguntas", "Vence", "Archivos", "Cuenta"])
    expect(screen.getByText(label, { exact: true })).toBeVisible();
  expect(screen.getByText("Puedes adjuntar evidencia")).toBeVisible();
  expect(screen.getByText("No necesitas crear una")).toBeVisible();
  expect(screen.getByText(/en 8 días/)).toBeVisible();
  expect(screen.getByText(/Este enlace es personal\./)).toBeVisible();
  // The primary action starts at the first question that still needs an answer.
  await user.click(screen.getByRole("button", { name: /^Comenzar/ }));
  expect(select).toHaveBeenCalledWith("a");
  // Not invented: no recipient, no purpose.
  expect(screen.queryByText(/destinatari|motivo/i)).not.toBeInTheDocument();
});
it("sin archivos permitidos la carta lo dice; con progreso el botón continúa donde quedó", async () => {
  const user = userEvent.setup();
  const select = home(
    access(
      [
        question({ id: "a", hasSubmission: true, state: "SENT" }),
        question({ id: "b", clarificationWaiting: 1, hasSubmission: true }),
        question({ id: "c" }),
      ],
      false,
    ),
  );
  expect(screen.getByText("No se piden archivos")).toBeVisible();
  // A clarification that waits on the person comes before a plain pending question.
  await user.click(screen.getByRole("button", { name: /^Continuar/ }));
  expect(select).toHaveBeenCalledWith("b");
});
it("al enviar todo, la carta se convierte en confirmación con «Qué sigue» real", () => {
  home(
    access([
      question({ id: "a", hasSubmission: true, state: "SENT" }),
      question({ id: "b", hasSubmission: true, state: "SENT" }),
    ]),
  );
  expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
    "Gracias. Recibimos tus respuestas",
  );
  expect(screen.getByText("Enviaste 2 de 2 preguntas.")).toBeVisible();
  const next = screen.getByRole("complementary");
  expect(
    within(next).getByText("El equipo analista revisará tus respuestas."),
  ).toBeVisible();
  expect(
    within(next).getByText(/Si necesitan precisión, verás una aclaración/),
  ).toBeVisible();
  expect(screen.getAllByText("Enviada")).toHaveLength(2);
  expect(
    screen.queryByRole("button", { name: /Comenzar|Continuar/ }),
  ).not.toBeInTheDocument();
});
