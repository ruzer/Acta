import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";
import { type ComponentProps, type ComponentType, createRef } from "react";
import {
  Button,
  Input,
  Select,
  Textarea,
  Checkbox,
  Radio,
  UnavailableValue,
} from "./index";

afterEach(cleanup);
const reason = "Agrega un área activa antes de crear una pregunta.";
// The cast also lets the regression run against the previous component.
const blocked = { unavailable: { reason } } as ComponentProps<typeof Button>;

it("el botón no disponible conserva nombre, foco y motivo sin ejecutar clic, Enter ni Espacio", async () => {
  const user = userEvent.setup();
  const action = vi.fn();
  render(
    <Button {...blocked} onClick={action}>
      Nueva pregunta
    </Button>,
  );
  const button = screen.getByRole("button", { name: "Nueva pregunta" });
  expect(button).toHaveAttribute("aria-disabled", "true");
  expect(button).not.toBeDisabled();
  expect(button).toHaveAccessibleDescription(reason);
  expect(screen.getByText(reason)).toBeVisible();
  await user.tab();
  expect(button).toHaveFocus();
  await user.keyboard("{Enter} ");
  await user.click(button);
  expect(action).not.toHaveBeenCalled();
});

it("el botón no disponible no envía el formulario ni activa el contenedor", async () => {
  const submitted = vi.fn();
  const bubbled = vi.fn();
  render(
    <form
      onSubmit={(event) => {
        event.preventDefault();
        submitted();
      }}
      onClick={bubbled}
    >
      <Button {...blocked} type="submit">
        Guardar
      </Button>
    </form>,
  );
  await userEvent.click(screen.getByRole("button", { name: "Guardar" }));
  expect(submitted).not.toHaveBeenCalled();
  expect(bubbled).not.toHaveBeenCalled();
});

it.each(["", "   ", undefined])(
  "ningún control compartido acepta estar no disponible sin motivo (%s)",
  (missing) => {
    const props = { unavailable: { reason: missing } } as ComponentProps<
      typeof Button
    >;
    expect(() => render(<Button {...props}>Crear</Button>)).toThrow(/motivo/);
    const fieldProps = { unavailable: { reason: missing } } as ComponentProps<
      typeof Input
    >;
    expect(() => render(<Input {...fieldProps} label="Nombre" />)).toThrow(
      /motivo/,
    );
    const selectProps = { unavailable: { reason: missing } } as ComponentProps<
      typeof Select
    >;
    expect(() =>
      render(
        <Select {...selectProps} label="Área">
          <option>Área ficticia</option>
        </Select>,
      ),
    ).toThrow(/motivo/);
  },
);

it("el motivo compartido no añade envoltorios al menú ni cambia el nombre accesible", () => {
  const ref = createRef<HTMLButtonElement>();
  const props = {
    unavailable: { reason, describedBy: "shared-reason" },
  } as ComponentProps<typeof Button>;
  const { container } = render(
    <>
      <div className="qe-menu-items">
        <Button {...props} ref={ref} aria-label="Crear pregunta">
          +
        </Button>
      </div>
      <p id="shared-reason">{reason}</p>
    </>,
  );
  const button = screen.getByRole("button", { name: "Crear pregunta" });
  expect(container.querySelector(".qe-menu-items > button")).toBe(button);
  expect(ref.current).toBe(button);
  expect(button).toHaveAccessibleDescription(reason);
  expect(screen.getAllByText(reason)).toHaveLength(1);
});

it.each(["input", "select"])(
  "el %s bloqueado conserva motivo, error y descripción adicional",
  (kind) => {
    const props = { unavailable: { reason } };
    render(
      <>
        <p id="context">Proyecto ficticio.</p>
        {kind === "input" ? (
          <Input
            {...props}
            label="Título"
            hint="Escribe un nombre breve."
            error="Revisa el título."
            aria-describedby="context"
          />
        ) : (
          <Select
            {...props}
            label="Título"
            hint="Escribe un nombre breve."
            error="Revisa el título."
            aria-describedby="context"
          >
            <option>Actual</option>
          </Select>
        )}
      </>,
    );
    const control = screen.getByLabelText("Título");
    expect(control).toBeDisabled();
    expect(control).toHaveAccessibleDescription(
      "Revisa el título. Escribe un nombre breve. " +
        reason +
        " Proyecto ficticio.",
    );
    expect(screen.getByText(reason)).toBeVisible();
    expect(control).toHaveAttribute("aria-invalid", "true");
  },
);

it("mantiene el disabled transitorio y vuelve a habilitar sin conservar motivos antiguos", async () => {
  const action = vi.fn();
  const { rerender } = render(
    <Button {...blocked} onClick={action}>
      Crear
    </Button>,
  );
  rerender(
    <Button disabled aria-busy="true" onClick={action}>
      Crear
    </Button>,
  );
  expect(screen.getByRole("button")).toBeDisabled();
  expect(screen.getByRole("button")).toHaveAttribute("aria-busy", "true");
  expect(screen.queryByText(reason)).not.toBeInTheDocument();
  rerender(<Button onClick={action}>Crear</Button>);
  await userEvent.click(screen.getByRole("button"));
  expect(action).toHaveBeenCalledOnce();
});

it("un valor fijo es texto etiquetado con su motivo, sin un campo que parezca editable", () => {
  render(<UnavailableValue label="Tema" value="Contexto" reason={reason} />);
  expect(
    screen.getByRole("group", { name: "Tema" }),
  ).toHaveAccessibleDescription(reason);
  expect(screen.getByText("Contexto")).toBeVisible();
  expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
});

it("el botón sigue siendo hijo directo de una celda y no repite un motivo compartido", () => {
  const { container } = render(
    <>
      <table>
        <tbody>
          <tr>
            <td>
              <Button unavailable={{ reason, describedBy: "table-reason" }}>
                Contraer
              </Button>
            </td>
          </tr>
        </tbody>
      </table>
      <p id="table-reason">{reason}</p>
    </>,
  );
  expect(container.querySelector("td > button")).toBe(
    screen.getByRole("button", { name: "Contraer" }),
  );
  expect(screen.getByRole("button")).toHaveAccessibleDescription(reason);
  expect(screen.getAllByText(reason)).toHaveLength(1);
});

it.each([Button, Input, Select, Textarea, Checkbox, Radio])(
  "rechaza disabled sin una operación ocupada explícita en %s",
  (Control) => {
    // Simula un consumidor JS o props recibidas fuera del control de tipos.
    const Tested = Control as unknown as ComponentType<Record<string, unknown>>;
    expect(() => render(<Tested disabled label="Dato" />)).toThrow(/ocupado/);
  },
);
it.each([Input, Textarea])(
  "exige un motivo para un valor de solo lectura copiable en %s",
  (Control) => {
    const Tested = Control as unknown as ComponentType<Record<string, unknown>>;
    expect(() =>
      render(<Tested readOnly value="valor" label="Dato" />),
    ).toThrow(/lectura/);
  },
);
it("el valor de solo lectura conserva selección, motivo y error", async () => {
  render(
    <Input
      label="Enlace"
      value="https://example.invalid"
      readOnly
      readOnlyReason="Copia este enlace; no se puede editar."
      error="Revisa el destinatario."
    />,
  );
  const input = screen.getByRole("textbox");
  expect(input).not.toBeDisabled();
  expect(input).toHaveAccessibleDescription(
    "Revisa el destinatario. Copia este enlace; no se puede editar.",
  );
  await userEvent.click(input);
  expect(input).toHaveFocus();
});

it.each([Textarea, Checkbox, Radio])(
  "exige motivo en campos largos y opciones (%s)",
  (Control) => {
    const Tested = Control as unknown as ComponentType<Record<string, unknown>>;
    expect(() =>
      render(<Tested label="Dato" unavailable={{ reason: " " }} />),
    ).toThrow(/motivo/);
  },
);
it.each([Button, Input, Select, Textarea, Checkbox, Radio])(
  "rechaza declarar deshabilitado un control que ya no está ocupado (%s)",
  (Control) => {
    const Tested = Control as unknown as ComponentType<Record<string, unknown>>;
    expect(() =>
      render(<Tested label="Dato" disabled aria-busy={false} />),
    ).toThrow(/ocupado/);
    expect(() => render(<Tested label="Dato" aria-disabled />)).toThrow(
      /motivo/,
    );
  },
);

it("Enter desde un campo no envía el formulario mediante una acción no disponible", async () => {
  const submitted = vi.fn();
  const clicked = vi.fn();
  render(
    <form
      onSubmit={(event) => {
        event.preventDefault();
        submitted();
      }}
    >
      <Input label="Título" defaultValue="Pregunta de prueba" />
      <Button type="submit" unavailable={{ reason }} onClick={clicked}>
        Guardar
      </Button>
    </form>,
  );
  const user = userEvent.setup();
  await user.click(screen.getByRole("textbox", { name: "Título" }));
  await user.keyboard("{Enter}");
  expect(submitted).not.toHaveBeenCalled();
  expect(clicked).not.toHaveBeenCalled();
});
