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
