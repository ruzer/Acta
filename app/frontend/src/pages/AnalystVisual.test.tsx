import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as apiModule from "../api";
import { ReviewDetail as ReviewDetailPage } from "./ReviewDetail";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  cleanup,
  render,
  screen,
  within,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  MemoryRouter,
  createMemoryRouter,
  RouterProvider,
} from "react-router-dom";
import "@testing-library/jest-dom/vitest";
import {
  reviewDetailView,
  dashboardView,
  questionnaireView,
  reviewStates,
} from "@requirements/contracts";
import fixture from "../../../../tests/fixtures/analyst-visual.json";
import {
  AnalystStatus,
  AttentionPanel,
  ConflictComparison,
  DecisionRecord,
} from "./AnalystVisual";
import { QuestionForm } from "./QuestionForm";
import { SubmittedAnswer, reviewLabels } from "./ReviewShared";
import { ApiFailure } from "../api";
const conflict = reviewDetailView.parse(fixture.conflict);
const decision = reviewDetailView.parse(fixture.decision);
const dashboard = dashboardView.parse(fixture.dashboard);
const questionnaire = questionnaireView.parse(fixture.questionnaire);
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
it.each(reviewStates)(
  "VIS004: %s tiene etiqueta humana e icono decorativo",
  (status) => {
    const { container } = render(<AnalystStatus status={status} />);
    expect(screen.getByText(reviewLabels[status])).toBeVisible();
    expect(container.querySelector("svg")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
    expect(container.textContent).not.toContain(status);
  },
);
it("VIS003: vigente con decisión, alcance, excepciones, autor, fecha y fuentes reales", () => {
  const v = decision.validations.find((v) => !v.invalidatedAt)!;
  render(<DecisionRecord data={decision} validation={v} />);
  expect(
    screen.getByRole("article", { name: "Decisión vigente" }),
  ).toBeVisible();
  for (const text of [
    v.decisionText,
    v.scope,
    v.exceptions!,
    v.validatedBy.displayName,
  ])
    expect(screen.getByText(text)).toBeVisible();
  // CP5: the sources are numbered grounds; each says who, which area and which submission.
  const grounds = within(
    screen.getByRole("heading", { name: "Fundamentos" }).closest("section")!,
  ).getAllByRole("listitem");
  expect(grounds.length).toBeGreaterThan(0);
  expect(grounds[0]).toHaveTextContent(/envío #/);
});
it("VIS003: histórica explica pérdida de vigencia y conserva el texto", () => {
  const v = decision.validations.find((v) => v.invalidatedAt)!;
  render(<DecisionRecord data={decision} validation={v} />);
  expect(
    screen.getByRole("article", { name: "Decisión histórica" }),
  ).toBeVisible();
  expect(screen.getByText(/Ya no es la decisión vigente/)).toBeVisible();
  expect(screen.getByText(v.decisionText)).toBeVisible();
  expect(screen.getByText(new RegExp(v.invalidationReason!))).toBeVisible();
});
it("VIS003: ausencia de fuentes no inventa respaldo", () => {
  render(
    <DecisionRecord
      data={decision}
      validation={{
        ...decision.validations[0]!,
        sources: [],
        messages: [],
        resolutions: [],
      }}
    />,
  );
  expect(
    screen.getByText("Sin fuentes disponibles para mostrar."),
  ).toBeVisible();
});
it("VIS002: posturas simétricas con actor, área, respuesta y evidencia o ausencia", () => {
  render(
    <ConflictComparison data={conflict} conflict={conflict.conflicts[0]!} />,
  );
  // CP5: one table, two columns of equal weight, each field label once.
  const table = screen.getByRole("table", {
    name: "Comparación de aportaciones",
  });
  for (const name of ["Postura A", "Postura B"])
    expect(
      within(table).getByRole("columnheader", { name: new RegExp(`^${name}`) }),
    ).toBeVisible();
  for (const field of [
    "Respuesta",
    "Comentario",
    "Ejemplo",
    "Evidencia",
    "Versión",
  ])
    expect(
      within(table).getAllByRole("rowheader", { name: field }),
    ).toHaveLength(1);
  for (const s of conflict.submissions.slice(0, 2))
    expect(
      within(table).getByRole("columnheader", {
        name: new RegExp(s.respondent.displayName),
      }),
    ).toBeVisible();
  expect(
    screen.getByRole("button", { name: "Descargar guia-ficticia.pdf" }),
  ).toBeEnabled();
  expect(screen.getByText("Sin evidencia adjunta.")).toBeVisible();
});
it("ReviewShared: modo participante conserva su presentación, sin bloques de comparación", () => {
  render(
    <SubmittedAnswer
      projectId={conflict.projectId}
      revision={conflict.submissions[0]!}
      question={conflict.question}
      participant
    />,
  );
  expect(screen.getByText(/^Tú ·/)).toBeVisible();
  expect(
    screen.queryByRole("heading", { name: "Respuesta" }),
  ).not.toBeInTheDocument();
  expect(screen.queryByText("Sin evidencia adjunta.")).not.toBeInTheDocument();
});
it("VIS001: cero preguntas y conjunto cerrado tienen estados vacíos distintos", () => {
  const { rerender } = render(
    <MemoryRouter>
      <AttentionPanel
        data={{ ...dashboard, questions: [] }}
        projectId={fixture.projectId}
      />
    </MemoryRouter>,
  );
  expect(
    screen.getByText("Todavía no hay preguntas publicadas para revisar."),
  ).toBeVisible();
  rerender(
    <MemoryRouter>
      <AttentionPanel
        data={{
          ...dashboard,
          questions: dashboard.questions.map((q) => ({
            ...q,
            status: "VALIDATED",
          })),
        }}
        projectId={fixture.projectId}
      />
    </MemoryRouter>,
  );
  expect(
    screen.getByText(
      "No hay preguntas pendientes de revisión en este proyecto.",
    ),
  ).toBeVisible();
  expect(screen.queryAllByRole("link")).toHaveLength(0);
});
it("VIS001: un conflicto tiene contexto y CTA al caso correcto", () => {
  const q = dashboard.questions.find((q) => q.status === "CONFLICT")!;
  render(
    <MemoryRouter>
      <AttentionPanel
        data={{ ...dashboard, questions: [q] }}
        projectId={fixture.projectId}
      />
    </MemoryRouter>,
  );
  expect(screen.getByText("1 pregunta")).toBeVisible();
  expect(
    screen.getByRole("link", { name: `Revisar conflicto: ${q.title}` }),
  ).toHaveAttribute("href", `/projects/${fixture.projectId}/review/${q.id}`);
  expect(screen.getByText(`${q.sectionTitle} · ${q.areaName}`)).toBeVisible();
});
it("VIS001: limita a tres sin inventar prioridad, mantiene orden y acceso al conjunto", () => {
  const questions = Array.from({ length: 8 }, (_, i) => ({
    ...dashboard.questions[0]!,
    id: String(i),
    title: `Caso ${i}`,
    status: "ANSWERED" as const,
  }));
  render(
    <MemoryRouter>
      <AttentionPanel
        data={{ ...dashboard, questions }}
        projectId={fixture.projectId}
      />
    </MemoryRouter>,
  );
  expect(screen.getAllByRole("listitem")).toHaveLength(3);
  expect(
    screen.getAllByRole("heading", { level: 3 }).map((x) => x.textContent),
  ).toEqual(["Caso 0", "Caso 1", "Caso 2"]);
  expect(screen.getByText("8 preguntas")).toBeVisible();
  expect(screen.getByRole("link", { name: /Ver todas/ })).toHaveAttribute(
    "href",
    "#dashboard-questions",
  );
});
function form(
  onSave = vi.fn().mockResolvedValue(undefined),
  initial?: (typeof questionnaire.questions)[number],
) {
  const router = createMemoryRouter([
    {
      path: "/",
      element: (
        <QuestionForm
          data={questionnaire}
          initial={initial}
          onSave={onSave}
          onCancel={() => {}}
        />
      ),
    },
  ]);
  render(<RouterProvider router={router} />);
  return { user: userEvent.setup(), onSave };
}
async function basic(user: ReturnType<typeof userEvent.setup>) {
  await user.type(
    screen.getByLabelText("Pregunta", { exact: true }),
    "¿Se registra la solicitud?",
  );
  await user.click(screen.getByRole("radio", { name: "Sí o no" }));
  await user.type(screen.getByLabelText("Identificador externo"), "FIC-014");
  await user.type(screen.getByLabelText("Título breve"), "Registro");
}
it("VIS005: creación básica sin abrir avanzado preserva contrato y externalId", async () => {
  const { user, onSave } = form();
  await basic(user);
  expect(
    screen.getByText("Configuración avanzada").closest("details"),
  ).not.toHaveAttribute("open");
  await user.click(
    screen.getByRole("button", { name: /^(Crear pregunta|Guardar cambios)$/ }),
  );
  await waitFor(() => expect(onSave).toHaveBeenCalledOnce());
  expect(onSave.mock.calls[0]![0]).toMatchObject({
    externalId: "FIC-014",
    type: "YES_NO",
    priority: "P1",
    responsibleAreaId: questionnaire.areas[0]!.id,
  });
});
it("VIS005: error avanzado del servidor abre grupo y enfoca campo con error asociado", async () => {
  const onSave = vi.fn().mockRejectedValue(
    new ApiFailure(400, "Revisa el área.", {
      responsibleAreaId: "Selecciona un área disponible.",
    }),
  );
  const { user } = form(onSave);
  await basic(user);
  await user.click(
    screen.getByRole("button", { name: /^(Crear pregunta|Guardar cambios)$/ }),
  );
  await waitFor(() =>
    expect(screen.getByLabelText("Área responsable")).toHaveFocus(),
  );
  expect(
    screen.getByText("Configuración avanzada").closest("details"),
  ).toHaveAttribute("open");
  expect(screen.getByLabelText("Área responsable")).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  expect(screen.getByLabelText("Área responsable")).toHaveAccessibleDescription(
    "Selecciona un área disponible.",
  );
});
it("VIS005: error de límite oculto abre ambos grupos y lleva foco", async () => {
  const { user } = form();
  await basic(user);
  await user.click(screen.getByRole("radio", { name: "Texto breve" }));
  await user.click(screen.getByText("Configuración avanzada"));
  await user.click(screen.getByText("Límites del campo (opcional)"));
  await user.type(screen.getByLabelText("Máximo de caracteres"), "0");
  await user.click(screen.getByText("Configuración avanzada"));
  await user.click(
    screen.getByRole("button", { name: /^(Crear pregunta|Guardar cambios)$/ }),
  );
  await waitFor(() =>
    expect(screen.getByLabelText("Máximo de caracteres")).toHaveFocus(),
  );
  expect(
    screen.getByText("Configuración avanzada").closest("details"),
  ).toHaveAttribute("open");
  expect(screen.getByLabelText("Máximo de caracteres")).toHaveAttribute(
    "aria-invalid",
    "true",
  );
});
it("VIS005: edición sin abrir avanzado conserva todos los datos", async () => {
  const initial = questionnaire.questions[0]!;
  const { user, onSave } = form(undefined, initial);
  await user.click(
    screen.getByRole("button", { name: /^(Crear pregunta|Guardar cambios)$/ }),
  );
  await waitFor(() => expect(onSave).toHaveBeenCalledOnce());
  for (const key of [
    "externalId",
    "priority",
    "responsibleAreaId",
    "order",
    "groupParentId",
    "condition",
    "references",
    "config",
    "options",
  ] as const)
    expect(onSave.mock.calls[0]![0][key]).toEqual(initial[key]);
});

it("VIS005: abre avanzado aunque el primer error sea de contenido", async () => {
  const onSave = vi.fn().mockRejectedValue(
    new ApiFailure(400, "Revisar campos", {
      question: "Revisa la redacción.",
      priority: "Revisa la prioridad.",
    }),
  );
  const { user } = form(onSave);
  await basic(user);
  await user.click(
    screen.getByRole("button", { name: /^(Crear pregunta|Guardar cambios)$/ }),
  );
  await waitFor(() =>
    expect(screen.getByLabelText("Pregunta", { exact: true })).toHaveFocus(),
  );
  expect(
    screen.getByText("Configuración avanzada").closest("details"),
  ).toHaveAttribute("open");
  expect(screen.getByLabelText("Prioridad")).toHaveAccessibleDescription(
    "Revisa la prioridad.",
  );
});

it("VIS002: cerrar resolución devuelve el foco al botón que abrió el diálogo", async () => {
  vi.spyOn(apiModule, "api").mockImplementation(
    async (key) => (key === "projects" ? [] : conflict) as never,
  );
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
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <MemoryRouter>
        <ReviewDetailPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  const buttons = await screen.findAllByRole("button", {
    name: "Resolver conflicto",
  });
  const trigger = buttons[0]!;
  const user = userEvent.setup();
  await user.click(trigger);
  expect(
    screen.getByRole("dialog", { name: "Resolver conflicto" }),
  ).toBeVisible();
  await user.click(screen.getByRole("button", { name: "Cerrar" }));
  await waitFor(() => expect(trigger).toHaveFocus());
});

it("VIS005 Criterio: ocho tipos reales como radios y MATRIX mantiene filas y columnas", async () => {
  const { user } = form();
  expect(screen.getAllByRole("radio")).toHaveLength(8);
  await user.click(screen.getByRole("radio", { name: "Matriz" }));
  expect(screen.getByRole("button", { name: "Agregar fila" })).toBeVisible();
  expect(screen.getByRole("button", { name: "Agregar columna" })).toBeVisible();
  expect(screen.queryByText("Sí / No / Depende")).not.toBeInTheDocument();
});

it("VIS005 Criterio: el selector de tipos funciona con flechas del teclado", async () => {
  const { user } = form();
  screen.getByRole("radio", { name: "Texto breve" }).focus();
  await user.keyboard("{ArrowRight}");
  expect(screen.getByRole("radio", { name: "Texto amplio" })).toBeChecked();
  expect(screen.getByRole("radio", { name: "Texto amplio" })).toHaveFocus();
});

it("el resumen de errores distingue destinos y activa el campo elegido", async () => {
  const { user } = form();
  await user.click(screen.getByRole("button", { name: "Crear pregunta" }));
  // Validation focuses its first field on the next frame. Observe that state
  // before exercising a different error link, as the browser interaction does.
  await waitFor(() =>
    expect(screen.getByLabelText("Pregunta", { exact: true })).toHaveFocus(),
  );
  const links = screen.getAllByRole("link");
  const externalId = links.find((link) =>
    link.textContent?.startsWith("Identificador externo:"),
  );
  expect(externalId).toBeDefined();
  expect(links.some((link) => link.textContent?.startsWith("Pregunta:"))).toBe(
    true,
  );
  expect(
    links.some((link) => link.textContent?.startsWith("Título breve:")),
  ).toBe(true);
  await user.click(externalId!);
  expect(screen.getByLabelText("Identificador externo")).toHaveFocus();
});

it("volver a Revisión conserva los filtros de procedencia sin cambiar el destino", async () => {
  vi.spyOn(apiModule, "api").mockImplementation(
    async (key) => (key === "projects" ? [] : conflict) as never,
  );
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <MemoryRouter
        initialEntries={[
          {
            pathname: "/",
            state: { reviewSearch: "projectId=demo&status=CONFLICT" },
          },
        ]}
      >
        <ReviewDetailPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  expect(
    await screen.findByRole("link", { name: "← Revisar respuestas" }),
  ).toHaveAttribute("href", "/review?projectId=demo&status=CONFLICT");
});

it("la decisión usa la referencia real, sitúa autor antes del resultado y permite consultar la fuente", async () => {
  const user = userEvent.setup();
  const open = vi.fn();
  const validation = decision.validations.find((v) => !v.invalidatedAt)!;
  render(
    <DecisionRecord
      data={decision}
      validation={validation}
      onOpenContribution={open}
    />,
  );
  const article = screen.getByRole("article", { name: "Decisión vigente" });
  expect(
    within(article).getByText(validation.id, { selector: "code" }),
  ).toBeVisible();
  expect(
    within(article)
      .getAllByRole("heading")
      .map((h) => h.textContent),
  ).toEqual([
    "Decisión validada",
    "Se decide",
    "Alcance",
    "Excepciones",
    "Fundamentos",
  ]);
  const author = within(article).getByText(validation.validatedBy.displayName);
  expect(
    author.compareDocumentPosition(
      within(article).getByText(validation.decisionText),
    ) & Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();
  // The record identifier is in the foot, after the result and its grounds.
  const record = within(article).getByText(/^Referencia del registro:/);
  expect(
    within(article)
      .getByText(validation.decisionText)
      .compareDocumentPosition(record) & Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();
  const source = decision.submissions.find((s) =>
    validation.sources.some((v) => v.responseRevisionId === s.id),
  )!;
  const ground = within(article).getAllByRole("listitem")[0]!;
  expect(ground).toHaveTextContent(source.respondent.displayName);
  expect(ground).toHaveTextContent(`envío #${source.number}`);
  await user.click(
    within(ground).getByRole("button", {
      name: `Abrir la aportación de ${source.respondent.displayName}, envío #${source.number}`,
    }),
  );
  expect(open).toHaveBeenCalledWith(source.id);
});
it("la decisión nombra su advertencia: documenta la revisión y no crea efectos jurídicos", () => {
  const validation = decision.validations.find((v) => !v.invalidatedAt)!;
  render(<DecisionRecord data={decision} validation={validation} />);
  const sheet = screen.getByRole("article", { name: "Decisión vigente" });
  expect(sheet.querySelector("footer")).toHaveTextContent(
    "No equivale a una firma electrónica ni tiene un efecto jurídico adicional.",
  );
  expect(sheet.querySelector("footer")).toHaveTextContent(
    "no significa que cada aportación individual haya sido validada",
  );
});
it("la decisión vigente precede a Reabrir, que permanece secundaria y respeta canReview", async () => {
  const api = vi
    .spyOn(apiModule, "api")
    .mockImplementation(
      async (key) => (key === "projects" ? [] : decision) as never,
    );
  function page() {
    return (
      <QueryClientProvider
        client={
          new QueryClient({ defaultOptions: { queries: { retry: false } } })
        }
      >
        <MemoryRouter>
          <ReviewDetailPage />
        </MemoryRouter>
      </QueryClientProvider>
    );
  }
  render(page());
  const card = await screen.findByRole("article", { name: "Decisión vigente" });
  const reopen = screen.getByRole("button", { name: "Reabrir pregunta" });
  expect(
    card.compareDocumentPosition(reopen) & Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();
  // CP5: reopening is a tertiary action in the foot of the document.
  expect(reopen).toHaveClass("tertiary");
  expect(card.querySelector("footer")).toContainElement(reopen);
  cleanup();
  api.mockImplementation(
    async (key) =>
      (key === "projects" ? [] : { ...decision, canReview: false }) as never,
  );
  render(page());
  expect(
    await screen.findByRole("article", { name: "Decisión vigente" }),
  ).toBeVisible();
  expect(
    screen.queryByRole("button", { name: "Reabrir pregunta" }),
  ).not.toBeInTheDocument();
});
