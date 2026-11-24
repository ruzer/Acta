import { useState } from "react";
import { afterEach, it, expect } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";
import { ResponseContent, ResponseQuestionView } from "@requirements/contracts";
import { AnswerControl, answerText } from "./AnswerControl";
afterEach(cleanup);
const q: ResponseQuestionView = {
  id: "a",
  sectionId: "s",
  sectionTitle: "Sección",
  title: "Pregunta",
  question: "Texto",
  helpText: "",
  type: "YES_NO",
  required: true,
  config: null,
  options: [],
  position: 1,
  total: 1,
  applicability: "ENABLED",
};
function Form({ question = q }: { question?: ResponseQuestionView }) {
  const [answer, setAnswer] = useState<ResponseContent["answer"]>(null);
  return (
    <>
      <AnswerControl question={question} value={answer} onChange={setAnswer} />
      <output aria-label="Respuesta elegida">
        {answerText(question, answer)}
      </output>
    </>
  );
}
it("Sí/No mantiene false y permite retirar selección con teclado", async () => {
  render(<Form />);
  const user = userEvent.setup();
  await user.click(screen.getByRole("radio", { name: /^No$/ }));
  expect(
    screen.getByRole("status", { name: "Respuesta elegida" }),
  ).toHaveTextContent("No");
  await user.click(screen.getByRole("radio", { name: "Sin selección" }));
  expect(
    screen.getByRole("status", { name: "Respuesta elegida" }),
  ).toHaveTextContent("Sin valor");
});
it("matriz usa controles etiquetados por fila y presenta etiquetas humanas", async () => {
  render(
    <Form
      question={{
        ...q,
        type: "MATRIX",
        config: {
          rows: [
            { key: "R1", label: "Recibir" },
            { key: "R2", label: "Revisar" },
          ],
          columns: [
            { key: "C1", label: "Área uno" },
            { key: "C2", label: "Área dos" },
          ],
        },
      }}
    />,
  );
  const user = userEvent.setup();
  await user.selectOptions(
    screen.getByRole("combobox", { name: "Recibir" }),
    "C1",
  );
  await user.selectOptions(
    screen.getByRole("combobox", { name: "Revisar" }),
    "C2",
  );
  expect(
    screen.getByRole("status", { name: "Respuesta elegida" }),
  ).toHaveTextContent("Recibir: Área uno");
  expect(
    screen.getByRole("status", { name: "Respuesta elegida" }),
  ).not.toHaveTextContent("R1");
});
it("texto malicioso se muestra literalmente sin HTML ejecutable", () => {
  render(
    <AnswerControl
      question={{ ...q, type: "LONG_TEXT" }}
      value={"<script>alert(1)</script>"}
      onChange={() => {}}
      error="Revisa tu respuesta"
    />,
  );
  expect(screen.getByRole("textbox", { name: "Tu respuesta" })).toHaveValue(
    "<script>alert(1)</script>",
  );
  expect(screen.getByRole("textbox")).toHaveAccessibleDescription(
    "Revisa tu respuesta",
  );
});

it("muestra el rango de opciones y limita solo las no marcadas con una explicación", async () => {
  render(
    <Form
      question={{
        ...q,
        type: "MULTIPLE_CHOICE",
        config: { minSelections: 1, maxSelections: 2 },
        options: ["Uno", "Dos", "Tres"].map((label, order) => ({
          value: label,
          label,
          order,
        })),
      }}
    />,
  );
  expect(screen.getByText("Elige de 1 a 2 opciones.")).toBeVisible();
  expect(screen.getByText("Marcadas 0 de 2")).toHaveAttribute(
    "aria-live",
    "polite",
  );
  const user = userEvent.setup();
  await user.click(screen.getByRole("checkbox", { name: "Uno" }));
  await user.click(screen.getByRole("checkbox", { name: "Dos" }));
  expect(screen.getByText("Marcadas 2 de 2")).toBeVisible();
  expect(screen.getByRole("checkbox", { name: "Tres" })).toBeDisabled();
  expect(
    screen.getByRole("checkbox", { name: "Tres" }),
  ).toHaveAccessibleDescription(/Quita una opción para elegir otra/);
  expect(screen.getByRole("checkbox", { name: "Uno" })).toBeEnabled();
  await user.click(screen.getByRole("checkbox", { name: "Uno" }));
  expect(screen.getByRole("checkbox", { name: "Tres" })).toBeEnabled();
});

it("sin mínimo configurado explica hasta cuántas opciones se pueden elegir", () => {
  render(
    <Form
      question={{
        ...q,
        type: "MULTIPLE_CHOICE",
        config: { maxSelections: 3 },
        options: ["Uno", "Dos", "Tres"].map((label, order) => ({
          value: label,
          label,
          order,
        })),
      }}
    />,
  );
  expect(screen.getByText("Elige hasta 3 opciones.")).toBeVisible();
});

it("texto corto usa el máximo configurado y anuncia el límite real al pegar", async () => {
  render(
    <Form
      question={{ ...q, type: "SHORT_TEXT", config: { maxLength: 200 } }}
    />,
  );
  expect(screen.getByText("0/200 caracteres")).toBeVisible();
  const user = userEvent.setup();
  const control = screen.getByRole("textbox", { name: "Tu respuesta" });
  await user.click(control);
  await user.paste("a".repeat(261));
  expect(control).toHaveValue("a".repeat(200));
  expect(screen.getByText("200/200 caracteres")).toBeVisible();
  expect(
    screen.getByText("Llegaste al máximo de 200 caracteres."),
  ).toHaveAttribute("aria-live", "polite");
});

it("texto corto sin configuración cuenta sobre 500 caracteres, no sobre el valor de una plantilla", () => {
  render(<Form question={{ ...q, type: "SHORT_TEXT", config: null }} />);
  expect(screen.getByText("0/500 caracteres")).toBeVisible();
  expect(screen.getByRole("textbox")).toHaveAttribute("maxlength", "500");
});

it("el contador largo aparece desde el 80 por ciento y deja de anunciar cuando baja del máximo", () => {
  const question: ResponseQuestionView = {
    ...q,
    type: "LONG_TEXT",
    config: { maxLength: 100 },
  };
  const { rerender } = render(
    <AnswerControl
      question={question}
      value={"a".repeat(79)}
      onChange={() => {}}
    />,
  );
  expect(screen.queryByText("79/100 caracteres")).not.toBeInTheDocument();
  rerender(
    <AnswerControl
      question={question}
      value={"a".repeat(80)}
      onChange={() => {}}
    />,
  );
  expect(screen.getByText("80/100 caracteres")).toBeVisible();
  rerender(
    <AnswerControl
      question={question}
      value={"a".repeat(100)}
      onChange={() => {}}
    />,
  );
  expect(
    screen.getByText("Llegaste al máximo de 100 caracteres."),
  ).toBeVisible();
  rerender(
    <AnswerControl
      question={question}
      value={"a".repeat(99)}
      onChange={() => {}}
    />,
  );
  expect(
    screen.queryByText("Llegaste al máximo de 100 caracteres."),
  ).not.toBeInTheDocument();
});

it("explica mínimo, máximo y números enteros sin cambiar el valor del campo", () => {
  render(
    <AnswerControl
      question={{
        ...q,
        type: "NUMBER",
        config: { min: 2, max: 8, integer: true },
      }}
      value="3"
      onChange={() => {}}
    />,
  );
  const control = screen.getByRole("textbox", { name: "Tu respuesta: número" });
  expect(control).toHaveAccessibleDescription(
    /Mínimo: 2\. Máximo: 8\. Solo números enteros\./,
  );
  expect(control).toHaveValue("3");
});

it("explica el rango de una fecha sin desplazar el día por la zona horaria", () => {
  render(
    <AnswerControl
      question={{
        ...q,
        type: "DATE",
        config: { min: "2031-03-15", max: "2031-04-20" },
      }}
      value={null}
      onChange={() => {}}
    />,
  );
  expect(
    screen.getByLabelText("Tu respuesta: fecha"),
  ).toHaveAccessibleDescription(
    /Desde el 15\/03\/2031\. Hasta el 20\/04\/2031\./,
  );
});
