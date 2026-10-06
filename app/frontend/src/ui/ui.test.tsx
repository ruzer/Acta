import { MemoryRouter } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";
import { Input, Checkbox, ErrorState, StatusBadge } from "./index";
import { Login, Password, Projects } from "../pages/Access";
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
  expect(
    screen.getByRole("heading", {
      name: "Example organization",
    }),
  ).toBeVisible();
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
