import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import "@testing-library/jest-dom/vitest";
import { questionnaireView } from "@requirements/contracts";
import fixture from "../../../../tests/fixtures/analyst-visual.json";
import { QuestionForm } from "./QuestionForm";

const base = questionnaireView.parse(fixture.questionnaire);
const first = base.areas[0]!;
const second = {
  ...first,
  id: "7f4c1f43-9a54-4a6e-8c3e-5a1f6f0b2d10",
  code: "VIGENTE",
};
const withAreas = (inactive: string[]) => ({
  ...base,
  areas: [
    { ...first, name: "Área retirada", active: !inactive.includes("first") },
    { ...second, name: "Área vigente", active: true },
  ],
});
beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute("open");
  };
});
afterEach(cleanup);
function show(
  data: ReturnType<typeof withAreas>,
  initial?: (typeof base.questions)[number],
) {
  const router = createMemoryRouter([
    {
      path: "/",
      element: (
        <QuestionForm
          data={data}
          initial={initial}
          onSave={vi.fn()}
          onCancel={() => {}}
        />
      ),
    },
  ]);
  render(<RouterProvider router={router} />);
  return userEvent.setup();
}
const areaSelect = () =>
  screen.getByLabelText("Área responsable") as HTMLSelectElement;

it("una pregunta nueva parte del primer área activa, nunca de una desactivada", async () => {
  const user = show(withAreas(["first"]));
  await user.click(screen.getByText("Configuración avanzada"));
  expect(areaSelect()).toHaveValue(second.id);
  expect(
    screen.queryByRole("option", { name: /Área retirada/ }),
  ).not.toBeInTheDocument();
});

it("una pregunta que ya usa un área desactivada la conserva visible y marcada", async () => {
  const data = withAreas(["first"]);
  const question = { ...base.questions[0]!, responsibleAreaId: first.id };
  const user = show(data, question);
  await user.click(screen.getByText("Configuración avanzada"));
  expect(areaSelect()).toHaveValue(first.id);
  expect(
    screen.getByRole("option", { name: "Área retirada (desactivada)" }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole("option", { name: "Área vigente" }),
  ).toBeInTheDocument();
});
