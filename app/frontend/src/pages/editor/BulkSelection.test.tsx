import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";
import { questionnaireView } from "@requirements/contracts";
import fixture from "../../../../../tests/fixtures/analyst-visual.json";
import { Organize } from "./Organize";
const base = questionnaireView.parse(fixture.questionnaire);
afterEach(cleanup);
function setup(count: number) {
  const questions = Array.from({ length: count }, (_, i) => ({
    ...base.questions[0]!,
    id: `q-${i}`,
    title: `Pregunta ${i}`,
    question: `Consulta de ejemplo ${i}`,
    publication: "DRAFT" as const,
    order: i,
    groupParentId: i === count - 1 ? "q-0" : null,
    condition: null,
  }));
  render(
    <Organize
      data={{ ...base, questions }}
      projectId="p"
      onEdit={vi.fn()}
      onAction={vi.fn()}
      onCreateTopic={vi.fn()}
      onCreateReference={vi.fn()}
    />,
  );
  return userEvent.setup();
}
it.each([10, 50, 120, 304])(
  "selecciona los %i resultados manteniendo solo una página de controles",
  async (count) => {
    const user = setup(count);
    expect(
      screen.getAllByRole("checkbox", { name: /Seleccionar pregunta:/ }),
    ).toHaveLength(Math.min(40, count));
    await user.click(
      screen.getByRole("button", {
        name: `Seleccionar todos los resultados (${count})`,
      }),
    );
    expect(screen.getByText(`${count} preguntas seleccionadas`)).toBeVisible();
    expect(
      screen
        .getAllByRole("checkbox", { name: /Seleccionar pregunta:/ })
        .every((x) => (x as HTMLInputElement).checked),
    ).toBe(true);
    await user.click(screen.getByRole("button", { name: "Limpiar selección" }));
    expect(screen.getByText("0 preguntas seleccionadas")).toBeVisible();
  },
);
it("distingue página y resultados; mantiene selección al paginar y la limpia al filtrar", async () => {
  const user = setup(120);
  await user.click(
    screen.getByRole("button", { name: "Seleccionar esta página (40)" }),
  );
  await user.click(screen.getByRole("button", { name: "Página siguiente" }));
  expect(screen.getByText("40 preguntas seleccionadas")).toBeVisible();
  expect(
    screen
      .getAllByRole("checkbox", { name: /Seleccionar pregunta:/ })
      .every((x) => !(x as HTMLInputElement).checked),
  ).toBe(true);
  await user.click(
    screen.getByRole("checkbox", {
      name: "Seleccionar pregunta: Consulta de ejemplo 40",
    }),
  );
  expect(screen.getByText("41 preguntas seleccionadas")).toBeVisible();
  await user.selectOptions(
    screen.getByLabelText("Estado de publicación"),
    "DRAFT",
  );
  expect(screen.getByText("0 preguntas seleccionadas")).toBeVisible();
  expect(
    screen.getByText(/Se limpió la selección al cambiar los filtros/),
  ).toBeVisible();
});

it("el grupo incluye seguimientos fuera de página sin confundir selección e inspector", async () => {
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
  const user = setup(50);
  await user.click(
    screen.getByRole("checkbox", {
      name: "Seleccionar pregunta: Consulta de ejemplo 1",
    }),
  );
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  await user.click(
    screen.getByRole("button", { name: /Consulta de ejemplo 0/ }),
  );
  expect(screen.getByText(/Se seleccionarán 2 preguntas/)).toBeVisible();
  await user.click(
    screen.getByRole("button", { name: "Seleccionar grupo completo" }),
  );
  expect(screen.getByText("3 preguntas seleccionadas")).toBeVisible();
  await user.click(screen.getByRole("button", { name: "Página siguiente" }));
  expect(
    screen.getByRole("checkbox", {
      name: "Seleccionar pregunta: Consulta de ejemplo 49",
    }),
  ).toBeChecked();
});
it("selecciona el tema completo explícitamente; filtrar por área limpia la selección", async () => {
  const user = setup(50);
  await user.click(
    within(
      screen.getByRole("navigation", { name: "Temas del cuestionario" }),
    ).getByRole("button", { name: new RegExp(base.sections[0]!.title) }),
  );
  await user.click(
    screen.getByRole("button", { name: "Seleccionar tema completo (50)" }),
  );
  expect(screen.getByText("50 preguntas seleccionadas")).toBeVisible();
  await user.selectOptions(
    screen.getByLabelText("Área responsable"),
    base.questions[0]!.responsibleAreaId,
  );
  expect(screen.getByText("0 preguntas seleccionadas")).toBeVisible();
  expect(screen.getByText(/Se limpió la selección/)).toBeVisible();
});
