import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";
import type {
  ResponseQuestionView,
  ResponseView,
} from "@requirements/contracts";
import { AnswerControl } from "./AnswerControl";
import { EvidenceList } from "./ReviewShared";
import { downloadEvidence } from "../api";

vi.mock("../api", () => ({ downloadEvidence: vi.fn() }));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
const question: ResponseQuestionView = {
  id: "question",
  sectionId: "topic",
  sectionTitle: "Tema ficticio",
  title: "Pregunta",
  question: "¿Qué necesitas?",
  helpText: "",
  type: "YES_NO",
  required: true,
  config: null,
  options: [],
  position: 1,
  total: 1,
  applicability: "ENABLED",
};
const reason =
  "Esta respuesta cambió. Vuelve a abrir la pregunta antes de continuar.";

describe("Restricciones visibles de la respuesta", () => {
  it.each([
    "SHORT_TEXT",
    "LONG_TEXT",
    "DATE",
    "NUMBER",
    "YES_NO",
    "SINGLE_CHOICE",
    "MULTIPLE_CHOICE",
    "MATRIX",
  ] as const)(
    "%s explica el bloqueo y no modifica la respuesta",
    async (type) => {
      const change = vi.fn();
      render(
        <AnswerControl
          question={{
            ...question,
            type,
            options: [{ value: "one", label: "Opción uno", order: 0 }],
            config:
              type === "MATRIX"
                ? {
                    rows: [{ key: "row", label: "Fila uno" }],
                    columns: [{ key: "col", label: "Columna uno" }],
                  }
                : null,
          }}
          value={null}
          onChange={change}
          unavailable={{ reason }}
        />,
      );
      expect(screen.getByText(reason)).toBeVisible();
      const control =
        type === "MATRIX"
          ? screen.getByRole("combobox")
          : type === "YES_NO"
            ? screen.getByRole("radio", { name: "Sí" })
            : type === "SINGLE_CHOICE"
              ? screen.getByRole("radio", { name: "Opción uno" })
              : type === "MULTIPLE_CHOICE"
                ? screen.getByRole("checkbox")
                : screen.getByLabelText(/Tu respuesta/);
      expect(control).toBeDisabled();
      expect(control).toHaveAccessibleDescription(
        new RegExp(reason.replaceAll(".", "\\.")),
      );
      await userEvent.setup().click(control);
      expect(change).not.toHaveBeenCalled();
    },
  );
  it("solo anuncia ocupado mientras hay una petición pendiente", () => {
    const { rerender } = render(
      <AnswerControl
        question={question}
        value={null}
        onChange={vi.fn()}
        disabled
        aria-busy
      />,
    );
    expect(screen.getByRole("group")).toHaveAttribute("aria-busy", "true");
    expect(screen.getByRole("radio", { name: "Sí" })).toBeDisabled();
    rerender(
      <AnswerControl
        question={question}
        value={null}
        onChange={vi.fn()}
        disabled={false}
        aria-busy={false}
      />,
    );
    expect(screen.getByRole("radio", { name: "Sí" })).toBeEnabled();
  });
});

it.each([
  ["STAGED", "El archivo aún no está listo para descargar."],
  [
    "QUARANTINED",
    "El archivo está en revisión de seguridad y aún no se puede descargar.",
  ],
  ["REJECTED", "El archivo fue rechazado y no se puede descargar."],
] as const)(
  "la evidencia %s muestra el motivo y no intenta descargar",
  async (status, message) => {
    const revision = {
      evidence: [
        {
          id: "link",
          evidence: {
            id: "evidence",
            originalName: "Ejemplo.txt",
            byteSize: 12,
            status,
          },
        },
      ],
    } as ResponseView["revisions"][number];
    render(<EvidenceList revision={revision} projectId="project" />);
    const button = screen.getByRole("button", {
      name: "Descargar Ejemplo.txt",
    });
    expect(button).toHaveAttribute("aria-disabled", "true");
    expect(button).toHaveAccessibleDescription(message);
    expect(screen.getByText(message)).toBeVisible();
    const user = userEvent.setup();
    await user.click(button);
    button.focus();
    await user.keyboard("{Enter} ");
    expect(downloadEvidence).not.toHaveBeenCalled();
  },
);
