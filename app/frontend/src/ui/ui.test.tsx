import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeAll, expect, it, vi } from "vitest";
import { render, screen, cleanup, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";
import {
  Button,
  Checkbox,
  DataTable,
  Dialog,
  ErrorState,
  Input,
  StatusBadge,
} from "./index";
import { useState } from "react";
import { Login, Password, Projects } from "../pages/Access";
beforeAll(() => {
  // jsdom has no modal dialog: the polyfill opens and closes it.
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute("open");
  };
});
afterEach(cleanup);
it("asocia etiquetas y errores para lectores de pantalla", () => {
  render(<Input label="Nombre" error="Completa el nombre" />);
  const input = screen.getByLabelText("Nombre");
  expect(input).toHaveAttribute("aria-invalid", "true");
  expect(input).toHaveAccessibleDescription("Completa el nombre");
});
it("checkbox se opera por teclado y estado tiene texto", async () => {
  const user = userEvent.setup();
  render(
    <>
      <Checkbox label="Requerida" />
      <StatusBadge>Publicada</StatusBadge>
    </>,
  );
  await user.tab();
  await user.keyboard(" ");
  expect(screen.getByRole("checkbox")).toBeChecked();
  expect(screen.getByText("Publicada")).toBeVisible();
});
it("error de pantalla permite reintentar", async () => {
  const retry = vi.fn();
  render(<ErrorState error={new Error("No hay acceso")} retry={retry} />);
  await userEvent.click(
    screen.getByRole("button", { name: "Volver a intentar" }),
  );
  expect(retry).toHaveBeenCalledOnce();
});
it("login usa etiquetas y autocomplete real", () => {
  const client = new QueryClient({
    defaultOptions: { queries: { staleTime: Infinity } },
  });
  client.setQueryData(["login-context"], {
    mode: "single-organization",
    institutionName: "Example organization",
  });
  render(
    <QueryClientProvider client={client}>
      <Login notice="" onLogin={() => {}} />
    </QueryClientProvider>,
  );
  // The page is about signing in; the institution is shown above the form.
  expect(
    screen.getByRole("heading", { level: 1, name: "Iniciar sesión" }),
  ).toBeVisible();
  expect(screen.getByText("Example organization")).toBeVisible();
  expect(screen.queryByLabelText("Organización")).not.toBeInTheDocument();
  expect(screen.getByLabelText("Usuario")).toHaveAttribute(
    "autocomplete",
    "username",
  );
  expect(screen.getByLabelText("Contraseña")).toHaveAttribute(
    "autocomplete",
    "current-password",
  );
  expect(screen.getByRole("button", { name: "Iniciar sesión" })).toBeEnabled();
});
it("evita cambiar contraseña si la confirmación difiere", async () => {
  const done = vi.fn();
  render(<Password onDone={done} />);
  await userEvent.type(
    screen.getByLabelText("Contraseña actual"),
    "currentExample123",
  );
  await userEvent.type(
    screen.getByLabelText("Nueva contraseña"),
    "newExamplePassword123",
  );
  await userEvent.type(
    screen.getByLabelText("Repetir nueva contraseña"),
    "different",
  );
  await userEvent.click(
    screen.getByRole("button", { name: "Actualizar contraseña" }),
  );
  expect(screen.getByRole("alert")).toHaveTextContent("no coinciden");
  expect(done).not.toHaveBeenCalled();
});

it.each([true, false])(
  "inicio sin proyectos orienta según rol administrador %s",
  (admin) => {
    const client = new QueryClient({
      defaultOptions: { queries: { staleTime: Infinity } },
    });
    client.setQueryData(["projects"], []);
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <Projects isOrganizationAdmin={admin} />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    if (admin) {
      expect(
        screen.getByRole("link", { name: "Administración → Proyectos" }),
      ).toHaveAttribute("href", "/admin");
      expect(
        screen.queryByText(/La administración debe asignarte/),
      ).not.toBeInTheDocument();
    } else
      expect(
        screen.getByText(/La administración debe asignarte/),
      ).toBeVisible();
  },
);

it("CP7: la tabla de datos conserva roles y etiqueta cada celda para apilarse en móvil", () => {
  render(
    <DataTable
      caption="Usuarios de la institución"
      columns={[
        { label: "Persona", bare: true },
        { label: "Estado" },
        { label: "Acciones", bare: true, end: true },
      ]}
      rows={[
        {
          key: "a",
          cells: ["Ana", "Activo", <button key="b">Desactivar</button>],
        },
        {
          key: "b",
          cells: ["Beto", "Desactivado", <button key="c">Activar</button>],
        },
      ]}
    />,
  );
  const table = screen.getByRole("table", {
    name: "Usuarios de la institución",
  });
  expect(within(table).getAllByRole("row")).toHaveLength(3);
  expect(within(table).getAllByRole("columnheader")).toHaveLength(3);
  const cells = within(table).getAllByRole("cell");
  expect(cells).toHaveLength(6);
  // The label shown in the stacked card; the person and the actions need none.
  expect(cells[0]).not.toHaveAttribute("data-label");
  expect(cells[1]).toHaveAttribute("data-label", "Estado");
  expect(cells[2]).not.toHaveAttribute("data-label");
  expect(cells[2]).toHaveAttribute("data-end");
});
function Opener() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>Abrir</Button>
      {open && (
        <Dialog title="Crear" onClose={() => setOpen(false)}>
          <p>Contenido</p>
        </Dialog>
      )}
    </>
  );
}
it("CP7: un diálogo que se retira de la página devuelve el foco a quien lo abrió", async () => {
  const user = userEvent.setup();
  render(<Opener />);
  const opener = screen.getByRole("button", { name: "Abrir" });
  await user.click(opener);
  expect(screen.getByRole("dialog", { name: "Crear" })).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Cerrar" }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(opener).toHaveFocus();
});
