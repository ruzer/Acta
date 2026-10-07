import { StrictMode } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";
import { dashboardView, questionnaireView } from "@requirements/contracts";
import type { z } from "zod";
import fixture from "../../../../../tests/fixtures/analyst-visual.json";
import { Organize } from "./Organize";
import {
  questionAncestors,
  type OrganizeContext,
} from "./questionnaire-presentation";
const base = questionnaireView.parse(fixture.questionnaire);
afterEach(cleanup);
function dataFor(count: number) {
  return {
    ...base,
    areas: base.areas.map((a) => ({ ...a, name: "Por confirmar" })),
    questions: Array.from({ length: count }, (_, i) => ({
      ...base.questions[0]!,
      id: `q-${i}`,
      externalId: `Q-${i}`,
      title: `Pregunta ${i}`,
      question: `Consulta de ejemplo ${i}`,
      publication: "DRAFT" as const,
      order: i,
      groupParentId: i === count - 1 ? "q-0" : null,
      condition: null,
    })),
  };
}
const handlers = {
  projectId: "p",
  onEdit: vi.fn(),
  onAction: vi.fn(),
  onCreateTopic: vi.fn(),
  onCreateReference: vi.fn(),
};
it.each([12, 54, 304])(
  "mantiene identidades, contexto y selección con %i preguntas al plegar y buscar",
  async (count) => {
    const data = dataFor(count);
    const user = userEvent.setup();
    render(<Organize {...handlers} data={data} />);
    expect(screen.getAllByRole("checkbox")).toHaveLength(Math.min(count, 40));
    await user.click(
      screen.getByRole("checkbox", {
        name: "Seleccionar pregunta: Consulta de ejemplo 0",
      }),
    );
    await user.click(
      screen.getByRole("button", {
        name: "Contraer seguimientos de Pregunta 0",
      }),
    );
    expect(screen.getByText("1 preguntas en grupos plegados.")).toBeVisible();
    expect(screen.getByText("1 pregunta seleccionada")).toBeVisible();
    await user.click(
      screen.getByRole("button", {
        name: "Seleccionar todos los resultados (" + count + ")",
      }),
    );
    expect(screen.getByText(`${count} preguntas seleccionadas`)).toBeVisible();
    expect(
      screen.getByText(
        /Todos los resultados incluye otras páginas y grupos plegados/,
      ),
    ).toBeVisible();
    await user.type(
      screen.getByLabelText("Buscar preguntas"),
      `Q-${count - 1}`,
    );
    expect(screen.getByText("0 preguntas seleccionadas")).toBeVisible();
    expect(screen.getAllByRole("checkbox")).toHaveLength(1);
    expect(
      screen.getByRole("checkbox", {
        name: `Seleccionar pregunta: Consulta de ejemplo ${count - 1}`,
      }),
    ).not.toBeChecked();
    expect(
      screen.getByText("Contexto · fuera de esta página o filtro"),
    ).toBeVisible();
    expect(
      screen.getByText(
        "La búsqueda muestra también seguimientos de grupos plegados.",
      ),
    ).toBeVisible();
    expect(
      screen.getByRole("button", {
        name: "Consulta de ejemplo 0",
      }),
    ).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Analizar" }));
    expect(screen.getAllByRole("checkbox")).toHaveLength(1);
    expect(screen.getAllByText("Por confirmar").length).toBeGreaterThan(0);
    expect(screen.getByText("Sin aportaciones enviadas")).toBeVisible();
  },
);
it("al plegar, seleccionar esta página no incluye descendientes ocultos", async () => {
  const user = userEvent.setup();
  render(<Organize {...handlers} data={dataFor(12)} />);
  await user.click(
    screen.getByRole("button", { name: "Contraer seguimientos de Pregunta 0" }),
  );
  await user.click(
    screen.getByRole("button", { name: "Seleccionar esta página (11)" }),
  );
  expect(screen.getByText("11 preguntas seleccionadas")).toBeVisible();
  await user.click(
    screen.getByRole("button", { name: "Expandir seguimientos de Pregunta 0" }),
  );
  expect(
    screen.getByRole("checkbox", {
      name: "Seleccionar pregunta: Consulta de ejemplo 11",
    }),
  ).not.toBeChecked();
});
it("N usa únicamente submittedRespondents de la proyección y distingue carga/error de cero", async () => {
  const user = userEvent.setup();
  const data = {
    ...dataFor(4),
    questions: dataFor(4).questions.map((q) => ({
      ...q,
      publication: "PUBLISHED" as const,
    })),
  };
  const projection: z.infer<typeof dashboardView>["questions"] =
    data.questions.map((q, i) => ({
      id: q.id,
      externalId: q.externalId,
      title: q.title,
      sectionId: q.sectionId,
      sectionTitle: base.sections[0]!.title,
      priority: q.priority,
      areaId: q.responsibleAreaId,
      areaName: "Por confirmar",
      status: q.status,
      submittedRespondents: [0, 1, 3, 12][i]!,
      requiredRespondents: 20,
      conditionalWithoutCase: false,
      referenceIds: [],
    }));
  const open = vi.fn();
  const view = render(
    <Organize
      {...handlers}
      data={data}
      contributionQuestions={projection}
      onOpenContributions={open}
    />,
  );
  expect(screen.getByText("Sin aportaciones enviadas")).toBeVisible();
  await user.click(
    screen.getByRole("button", { name: "1 aportación de Pregunta 1" }),
  );
  expect(open).toHaveBeenLastCalledWith("q-1");
  await user.click(
    screen.getByRole("button", { name: "3 aportaciones de Pregunta 2" }),
  );
  expect(open).toHaveBeenLastCalledWith("q-2");
  expect(
    screen.getByRole("button", { name: "12 aportaciones de Pregunta 3" }),
  ).toBeVisible();
  view.rerender(<Organize {...handlers} data={data} contributionsLoading />);
  expect(screen.getAllByText("Cargando…")).toHaveLength(4);
  expect(
    screen.queryByText("Sin aportaciones enviadas"),
  ).not.toBeInTheDocument();
  view.rerender(<Organize {...handlers} data={data} contributionsError />);
  expect(screen.getAllByText("No disponible")).toHaveLength(4);
  expect(
    within(screen.getByRole("alert")).getByRole("button", {
      name: "Reintentar aportaciones",
    }),
  ).toBeVisible();
});
it("restaura contexto de presentación sin guardar respuestas ni seleccionar preguntas ajenas", async () => {
  const context: OrganizeContext = {
    topic: "",
    search: "",
    area: "",
    publication: "",
    approach: "analyze",
    page: 1,
    collapsed: [],
    selectedIds: ["q-1", "unknown"],
  };
  const remember = vi.fn();
  render(
    <Organize
      {...handlers}
      data={dataFor(54)}
      organizeContext={context}
      onOrganizeContextChange={remember}
    />,
  );
  expect(screen.getByRole("button", { name: "Analizar" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  expect(screen.getByText(/Página 2 de 2/)).toBeVisible();
  expect(screen.getByText("1 pregunta seleccionada")).toBeVisible();
  expect(screen.getAllByRole("checkbox")).toHaveLength(14);
  expect(remember.mock.lastCall?.[0].selectedIds).toEqual(["q-1"]);
});
it("la presentación de ancestros conserva jerarquía sin mutar datos", () => {
  const data = dataFor(3);
  const [a, b, c] = data.questions;
  b!.groupParentId = a!.id;
  c!.groupParentId = b!.id;
  const map = new Map(data.questions.map((q) => [q.id, q]));
  expect(questionAncestors(c!, map).map((q) => q.id)).toEqual([a!.id, b!.id]);
  a!.groupParentId = c!.id;
  expect(questionAncestors(c!, map)).toHaveLength(2);
});

it("Strict Mode conserva el botón original al cerrar el inspector", async () => {
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
    configurable: true,
    value: function (this: HTMLDialogElement) {
      this.setAttribute("open", "");
      this.querySelector<HTMLElement>("h3")?.focus();
    },
  });
  Object.defineProperty(HTMLDialogElement.prototype, "close", {
    configurable: true,
    value: function (this: HTMLDialogElement) {
      this.removeAttribute("open");
    },
  });
  const user = userEvent.setup();
  render(
    <StrictMode>
      <Organize {...handlers} data={dataFor(12)} />
    </StrictMode>,
  );
  const opener = screen.getByRole("button", { name: "Consulta de ejemplo 0" });
  await user.click(opener);
  expect(
    screen.getByRole("heading", { name: "Detalle de pregunta" }),
  ).toHaveFocus();
  await user.click(screen.getByRole("button", { name: "Cerrar detalle" }));
  await vi.waitFor(() => expect(opener).toHaveFocus());
});

it("un filtro de área muestra el seguimiento y su contexto aunque el padre excluido esté plegado", async () => {
  const user = userEvent.setup();
  const data = dataFor(12);
  const parentArea = data.questions[0]!.responsibleAreaId;
  data.areas.push({
    ...data.areas[0]!,
    id: "followup-area",
    name: "Equipo de seguimiento",
  });
  data.questions[11]!.responsibleAreaId = "followup-area";
  render(<Organize {...handlers} data={data} />);
  await user.click(
    screen.getByRole("button", { name: "Contraer seguimientos de Pregunta 0" }),
  );
  await user.selectOptions(
    screen.getByLabelText("Área responsable"),
    "followup-area",
  );
  expect(screen.getAllByRole("checkbox")).toHaveLength(1);
  expect(
    screen.getByRole("checkbox", {
      name: "Seleccionar pregunta: Consulta de ejemplo 11",
    }),
  ).toBeVisible();
  expect(
    screen.getByText("Contexto · fuera de esta página o filtro"),
  ).toBeVisible();
  await user.selectOptions(
    screen.getByLabelText("Área responsable"),
    parentArea,
  );
  expect(screen.getAllByRole("checkbox")).toHaveLength(11);
});
it("plegar un grupo de otra página conserva página y foco del control", async () => {
  const user = userEvent.setup();
  const data = dataFor(54);
  data.questions[53]!.groupParentId = "q-40";
  render(<Organize {...handlers} data={data} />);
  await user.click(screen.getByRole("button", { name: "Página siguiente" }));
  const toggle = screen.getByRole("button", {
    name: "Contraer seguimientos de Pregunta 40",
  });
  await user.click(toggle);
  expect(screen.getByText(/Página 2 de 2/)).toBeVisible();
  expect(toggle).toHaveFocus();
  expect(
    screen.queryByRole("checkbox", {
      name: "Seleccionar pregunta: Consulta de ejemplo 53",
    }),
  ).not.toBeInTheDocument();
});
