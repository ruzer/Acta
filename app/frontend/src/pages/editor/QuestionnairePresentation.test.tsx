import { StrictMode } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";
import { dashboardView, questionnaireView } from "@requirements/contracts";
import type { z } from "zod";
import fixture from "../../../../../tests/fixtures/analyst-visual.json";
import { Organize } from "./Organize";
import { EditorWorkspace } from "./EditorWorkspace";
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
  "plegado global conserva filtros, selección y jerarquía con %i preguntas",
  async (count) => {
    const user = userEvent.setup();
    const data = dataFor(count);
    data.questions[1]!.groupParentId = "q-0";
    data.questions[2]!.groupParentId = "q-1";
    data.questions[count - 1]!.groupParentId = `q-${count - 2}`;
    const original = JSON.stringify(data);
    const context: OrganizeContext = {
      topic: data.sections[0]!.id,
      area: data.questions[0]!.responsibleAreaId,
      publication: "DRAFT",
      search: "",
      approach: "prepare",
      page: 0,
      collapsed: [],
      selectedIds: ["q-2", `q-${count - 1}`],
    };
    render(<Organize {...handlers} data={data} organizeContext={context} />);
    const controls = screen.getByRole("group", {
      name: "Presentación de grupos",
    });
    const collapse = within(controls).getByRole("button", {
      name: "Contraer todos los grupos",
    });
    const expand = within(controls).getByRole("button", {
      name: "Expandir todos los grupos",
    });
    expect(collapse).toBeVisible();
    expect(expand).toBeVisible();
    collapse.focus();
    await user.keyboard("{Enter}");
    expect(collapse).toHaveFocus();
    expect(screen.getByText("3 preguntas en grupos plegados.")).toBeVisible();
    expect(screen.getByText("2 preguntas seleccionadas")).toBeVisible();
    expect(
      screen.queryByRole("checkbox", {
        name: "Seleccionar pregunta: Consulta de ejemplo 1",
      }),
    ).not.toBeInTheDocument();
    expect(screen.getByLabelText("Área responsable")).toHaveValue(context.area);
    expect(screen.getByLabelText("Estado de publicación")).toHaveValue("DRAFT");
    expect(
      screen.getByRole("navigation", { name: "Temas del cuestionario" }),
    ).toHaveTextContent(data.sections[0]!.title);
    const parent = screen.getByRole("button", {
      name: "Expandir seguimientos de Pregunta 0",
    });
    expect(parent).toHaveAttribute("aria-expanded", "false");
    parent.focus();
    await user.keyboard(" ");
    expect(parent).toHaveAttribute("aria-expanded", "true");
    expect(
      screen.getByRole("button", {
        name: "Expandir seguimientos de Pregunta 1",
      }),
    ).toHaveAttribute("aria-expanded", "false");
    expect(
      screen.queryByRole("checkbox", {
        name: "Seleccionar pregunta: Consulta de ejemplo 2",
      }),
    ).not.toBeInTheDocument();
    expand.focus();
    await user.keyboard(" ");
    expect(expand).toHaveFocus();
    expect(
      screen.getByRole("checkbox", {
        name: "Seleccionar pregunta: Consulta de ejemplo 2",
      }),
    ).toBeChecked();
    expect(
      screen.getByRole("button", {
        name: "Contraer seguimientos de Pregunta 1",
      }),
    ).toHaveAttribute("aria-expanded", "true");
    if (count > 40) {
      const next = screen.getByRole("button", { name: "Página siguiente" });
      while (!next.hasAttribute("disabled")) await user.click(next);
    }
    expect(
      screen.getByRole("checkbox", {
        name: `Seleccionar pregunta: Consulta de ejemplo ${count - 1}`,
      }),
    ).toBeChecked();
    expect(
      screen.getByRole("button", {
        name: `Contraer seguimientos de Pregunta ${count - 2}`,
      }),
    ).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("2 preguntas seleccionadas")).toBeVisible();
    expect(JSON.stringify(data)).toBe(original);
  },
);

it("buscar conserva los seguimientos visibles y explica por qué no se pliegan", async () => {
  const user = userEvent.setup();
  render(<Organize {...handlers} data={dataFor(12)} />);
  await user.click(
    screen.getByRole("button", { name: "Contraer todos los grupos" }),
  );
  const search = screen.getByRole("searchbox", { name: "Buscar preguntas" });
  await user.type(search, "Consulta de ejemplo");
  expect(screen.getAllByRole("checkbox")).toHaveLength(12);
  expect(
    screen.getByRole("button", { name: "Contraer todos los grupos" }),
  ).toBeDisabled();
  expect(
    screen.getByRole("button", { name: "Contraer seguimientos de Pregunta 0" }),
  ).toBeDisabled();
  expect(
    screen.getByText(
      "La búsqueda muestra también seguimientos de grupos plegados.",
    ),
  ).toBeVisible();
  const child = screen.getByRole("checkbox", {
    name: "Seleccionar pregunta: Consulta de ejemplo 11",
  });
  await user.click(child);
  await user.click(
    screen.getByRole("button", { name: "Expandir todos los grupos" }),
  );
  expect(search).toHaveValue("Consulta de ejemplo");
  expect(child).toBeChecked();
  await user.clear(search);
  expect(screen.getAllByRole("checkbox")).toHaveLength(12);
  expect(
    screen.getByRole("button", { name: "Contraer todos los grupos" }),
  ).toBeEnabled();
});

it("Organizar conserva plegado y selección al cambiar de modo y volver", async () => {
  const user = userEvent.setup();
  render(<EditorWorkspace {...handlers} data={dataFor(12)} initialMode={1} />);
  await user.click(
    screen.getByRole("checkbox", {
      name: "Seleccionar pregunta: Consulta de ejemplo 11",
    }),
  );
  await user.click(
    screen.getByRole("button", { name: "Contraer todos los grupos" }),
  );
  await user.click(screen.getByRole("tab", { name: "Escribir" }));
  await user.click(screen.getByRole("tab", { name: "Organizar" }));
  expect(screen.getByText("1 pregunta en grupos plegados.")).toBeVisible();
  expect(screen.getByText("1 pregunta seleccionada")).toBeVisible();
  await user.click(
    screen.getByRole("button", { name: "Expandir todos los grupos" }),
  );
  expect(
    screen.getByRole("checkbox", {
      name: "Seleccionar pregunta: Consulta de ejemplo 11",
    }),
  ).toBeChecked();
});

it("sin seguimientos no muestra controles de grupos sin efecto", () => {
  const data = dataFor(3);
  for (const question of data.questions) question.groupParentId = null;
  render(<Organize {...handlers} data={data} />);
  expect(
    screen.queryByRole("group", { name: "Presentación de grupos" }),
  ).not.toBeInTheDocument();
});
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
    expect(screen.getByText("1 pregunta en grupos plegados.")).toBeVisible();
    expect(screen.getByText("1 pregunta seleccionada")).toBeVisible();
    await user.click(
      screen.getByText("Seleccionar preguntas", { exact: true }),
    );
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
  await user.click(screen.getByText("Seleccionar preguntas", { exact: true }));
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
  expect(
    screen.getByRole("columnheader", { name: "Participantes" }),
  ).toBeVisible();
  expect(
    screen.queryByRole("columnheader", { name: "Aportaciones" }),
  ).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Analizar" }));
  expect(
    screen.getByRole("columnheader", { name: "Aportaciones" }),
  ).toBeVisible();
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

it("un cuestionario vacío explica cómo empezar, sin atribuir la ausencia a los filtros", () => {
  render(<Organize {...handlers} data={{ ...dataFor(0), sections: [] }} />);
  expect(
    screen.getByRole("heading", { name: "Todavía no hay preguntas." }),
  ).toBeVisible();
  expect(
    screen.getByText(
      "Agrega un tema para crear la primera pregunta o importa una estructura.",
    ),
  ).toBeVisible();
  expect(screen.getByRole("button", { name: "+ Agregar tema" })).toBeEnabled();
  // No topic yet, so "Nueva pregunta" would be a dead control: it is not offered.
  expect(
    screen.queryByRole("button", { name: "Nueva pregunta" }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByText("Cambia el tema o elimina los filtros."),
  ).not.toBeInTheDocument();
});
it("un cuestionario vacío no muestra búsqueda, filtros ni selección: solo cómo empezar", () => {
  render(<Organize {...handlers} data={dataFor(0)} />);
  expect(
    screen.queryByRole("searchbox", { name: "Buscar preguntas" }),
  ).not.toBeInTheDocument();
  expect(screen.queryByText("Seleccionar preguntas")).not.toBeInTheDocument();
  expect(screen.queryByRole("table")).not.toBeInTheDocument();
  expect(
    screen.getByText(
      "Crea la primera con Nueva pregunta o importa una estructura.",
    ),
  ).toBeVisible();
  expect(screen.getByRole("button", { name: "Nueva pregunta" })).toBeEnabled();
});
it("un cuestionario vacío sin áreas activas explica por qué no se puede crear la primera pregunta", () => {
  const data = dataFor(0);
  render(
    <Organize
      {...handlers}
      data={{
        ...data,
        areas: data.areas.map((a) => ({ ...a, active: false })),
      }}
    />,
  );
  expect(screen.getByRole("button", { name: "Nueva pregunta" })).toBeDisabled();
  expect(screen.getByText(/hace falta al menos un área activa/)).toBeVisible();
});
it("una búsqueda sin coincidencias conserva el mensaje de filtros, sin fingir un cuestionario vacío", async () => {
  const user = userEvent.setup();
  render(<Organize {...handlers} data={dataFor(12)} />);
  await user.type(
    screen.getByRole("searchbox", { name: "Buscar preguntas" }),
    "sin coincidencias",
  );
  expect(
    screen.getByRole("heading", {
      name: "No encontramos preguntas con estos filtros.",
    }),
  ).toBeVisible();
  expect(
    screen.queryByRole("heading", { name: "Todavía no hay preguntas." }),
  ).not.toBeInTheDocument();
});

it("la frase del alcance de «Expandir/Contraer todos» solo se ve si el alcance va más allá de lo visible", async () => {
  const user = userEvent.setup();
  const { unmount } = render(<Organize {...handlers} data={dataFor(12)} />);
  const scope = () =>
    screen.getByText(/Todos los grupos, incluso fuera de los filtros/);
  // Everything is on screen: the sentence stays for assistive technology only.
  expect(scope()).toHaveClass("sr-only");
  expect(
    screen.getByRole("group", { name: "Presentación de grupos" }),
  ).toHaveAccessibleDescription(
    /Todos los grupos, incluso fuera de los filtros/,
  );
  // A filter hides part of the questionnaire: now it is worth saying.
  await user.type(
    screen.getByRole("searchbox", { name: "Buscar preguntas" }),
    "Consulta de ejemplo 3",
  );
  expect(scope()).toHaveClass("hint");
  expect(scope()).not.toHaveClass("sr-only");
  unmount();
  // More than one page of results: also worth saying.
  render(<Organize {...handlers} data={dataFor(54)} />);
  expect(scope()).toHaveClass("hint");
});

it.each([0, 3, 304])(
  "Agregar tema es un solo botón visible en Organizar con %i preguntas",
  async (count) => {
    const user = userEvent.setup();
    const onCreateTopic = vi.fn();
    render(
      <Organize
        {...handlers}
        onCreateTopic={onCreateTopic}
        data={dataFor(count)}
      />,
    );
    // One control, in the page itself and not inside the closed topic picker.
    const buttons = screen.getAllByRole("button", { name: "+ Agregar tema" });
    expect(buttons).toHaveLength(1);
    expect(buttons[0]!.closest("details")).toBeNull();
    await user.click(buttons[0]!);
    expect(onCreateTopic).toHaveBeenCalledTimes(1);
    // It sits beside "Nueva pregunta", which stays available in both states.
    expect(
      screen.getAllByRole("button", { name: "Nueva pregunta" }),
    ).toHaveLength(1);
  },
);

it("el encabezado de cada tema cuenta en singular y en plural", () => {
  const one = dataFor(1);
  render(
    <Organize
      {...handlers}
      data={{
        ...one,
        questions: one.questions.map((q) => ({ ...q, groupParentId: null })),
      }}
    />,
  );
  expect(screen.getByText("1 pregunta", { exact: true })).toBeInTheDocument();
  expect(screen.queryByText("1 preguntas")).toBeNull();
});

it("Escribir ofrece Agregar tema al inicio, antes de los temas, y una sola vez", () => {
  render(<EditorWorkspace {...handlers} data={dataFor(304)} initialMode={0} />);
  const buttons = screen.getAllByRole("button", { name: "+ Agregar tema" });
  expect(buttons).toHaveLength(1);
  const firstTopic = screen.getAllByRole("region")[0]!;
  expect(
    buttons[0]!.compareDocumentPosition(firstTopic) &
      Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();
});

it("Escribir sin temas también permite empezar con Agregar tema", () => {
  render(
    <EditorWorkspace
      {...handlers}
      data={{ ...dataFor(0), sections: [] }}
      initialMode={0}
    />,
  );
  expect(
    screen.getAllByRole("button", { name: "+ Agregar tema" }),
  ).toHaveLength(1);
});
