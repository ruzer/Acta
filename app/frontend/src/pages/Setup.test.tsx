import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as apiModule from "../api";
import { Setup } from "./Setup";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  window.history.replaceState(null, "", "/");
});
const code = "A".repeat(43);
const field = (
  value: string,
  source = "default",
  variable: string | null = null,
) => ({
  value,
  source,
  variable,
});
const defaults = (overrides: Record<string, unknown> = {}) => ({
  organizationCode: "DEFAULT",
  organizationName: "",
  appearance: {
    appName: field("Acta"),
    shortName: field("Acta"),
    accent: field("#2b4d7c"),
    locale: field("es-MX"),
    timezone: field("UTC"),
    secondaryName: field(""),
    ...overrides,
  },
});
const checks = {
  database: "ok",
  storage: "ok",
  storageProvider: "S3",
  secureOrigin: true,
  origin: "http://localhost:4317",
};
function mount(
  handlers: Record<string, (input: unknown) => unknown> = {},
  onFinished = vi.fn(),
) {
  const calls: [string, unknown][] = [];
  vi.spyOn(apiModule, "api").mockImplementation((async (
    key: string,
    _params: unknown,
    input: unknown,
  ) => {
    calls.push([key, input]);
    if (handlers[key]) return handlers[key](input);
    if (key === "setupVerify") return { defaults: defaults() };
    if (key === "setupChecks") return checks;
    if (key === "setupComplete") return { ok: true };
    throw new Error("unexpected " + key);
  }) as never);
  render(
    <QueryClientProvider client={new QueryClient()}>
      <Setup onFinished={onFinished} />
    </QueryClientProvider>,
  );
  return { user: userEvent.setup(), calls, onFinished };
}
async function begin(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("Código de instalación"), code);
  await user.click(screen.getByRole("button", { name: "Comenzar" }));
  await screen.findByRole("heading", { name: "Administrador" });
}
async function administrator(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("Nombre de usuario"), "Admin.Uno");
  await user.type(screen.getByLabelText("Nombre visible"), "Persona Uno");
  await user.type(screen.getByLabelText("Contraseña"), "una-clave-larga-1");
  await user.type(
    screen.getByLabelText("Confirma la contraseña"),
    "una-clave-larga-1",
  );
  await user.click(screen.getByRole("button", { name: "Continuar" }));
}

it("toma el código de la dirección, lo quita de ella y explica cómo obtenerlo", async () => {
  window.history.replaceState(null, "", "/#setup=" + code);
  mount();
  expect(screen.getByLabelText("Código de instalación")).toHaveValue(code);
  expect(window.location.hash).toBe("");
  expect(
    screen.getByText(
      "docker compose exec backend node scripts/setup-token.mjs",
    ),
  ).toBeVisible();
  // La guía es opcional: dice cómo configurar sin ella.
  expect(screen.getByText(/scripts\/bootstrap-admin.mjs/)).toBeVisible();
});

it("recoge el código aunque el enlace se pegue en una pestaña que ya tiene Acta abierta", async () => {
  mount();
  expect(screen.getByLabelText("Código de instalación")).toHaveValue("");
  window.history.replaceState(null, "", "/#setup=" + code);
  window.dispatchEvent(new HashChangeEvent("hashchange"));
  await waitFor(() =>
    expect(screen.getByLabelText("Código de instalación")).toHaveValue(code),
  );
  expect(window.location.hash).toBe("");
});

it("no avanza con un código incompleto y muestra el rechazo del servidor", async () => {
  const { user } = mount({
    setupVerify: () => {
      throw new Error("El código de instalación no es válido o caducó.");
    },
  });
  const start = screen.getByRole("button", { name: "Comenzar" });
  expect(start).toBeDisabled();
  await user.type(screen.getByLabelText("Código de instalación"), code);
  await user.click(start);
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "no es válido o caducó",
  );
  expect(screen.getByRole("heading", { name: "Bienvenida" })).toBeVisible();
});

it("valida al administrador antes de seguir y recorre los pasos hasta crear la instalación", async () => {
  const { user, calls, onFinished } = mount();
  await begin(user);
  // Contraseña corta y distinta de su confirmación.
  await user.type(screen.getByLabelText("Nombre de usuario"), "Admin.Uno");
  await user.type(screen.getByLabelText("Nombre visible"), "Persona Uno");
  await user.type(screen.getByLabelText("Contraseña"), "corta");
  await user.type(screen.getByLabelText("Confirma la contraseña"), "otra");
  await user.click(screen.getByRole("button", { name: "Continuar" }));
  expect(screen.getByText("Usa al menos 12 caracteres.")).toBeVisible();
  expect(screen.getByText("Las contraseñas no coinciden.")).toBeVisible();
  await user.clear(screen.getByLabelText("Contraseña"));
  await user.clear(screen.getByLabelText("Confirma la contraseña"));
  await user.type(screen.getByLabelText("Contraseña"), "una-clave-larga-1");
  await user.type(
    screen.getByLabelText("Confirma la contraseña"),
    "una-clave-larga-1",
  );
  await user.click(screen.getByRole("button", { name: "Continuar" }));

  await screen.findByRole("heading", { name: "Organización" });
  expect(
    screen.getByLabelText("Código interno de la instalación"),
  ).toHaveAttribute("readonly");
  await user.click(screen.getByRole("button", { name: "Continuar" }));
  expect(
    screen.getByText("Escribe el nombre de la institución."),
  ).toBeVisible();
  await user.type(
    screen.getByLabelText("Nombre de la institución"),
    "Institución de ejemplo",
  );
  await user.click(screen.getByRole("button", { name: "Continuar" }));

  await screen.findByRole("heading", { name: "Almacenamiento" });
  expect(
    await screen.findByText(/Almacenamiento \(S3 privado\)/),
  ).toBeVisible();
  await user.click(screen.getByRole("button", { name: "Continuar" }));

  await screen.findByRole("heading", { name: "Personalización" });
  // Un color demasiado claro se explica y no deja continuar.
  const accent = screen.getByLabelText("Color principal");
  await user.clear(accent);
  await user.type(accent, "#ffffff");
  expect(screen.getByText(/demasiado claro/)).toBeVisible();
  await user.click(screen.getByRole("button", { name: "Continuar" }));
  expect(
    screen.getByRole("heading", { name: "Personalización" }),
  ).toBeVisible();
  await user.clear(accent);
  await user.type(accent, "#1b4b8c");
  expect(screen.getByText(/Es legible/)).toBeVisible();
  expect(screen.getByTestId("branding-preview")).toBeVisible();
  await user.click(screen.getByRole("button", { name: "Continuar" }));

  await screen.findByRole("heading", { name: "Verificación" });
  expect(screen.getByText("Persona Uno (admin.uno)")).toBeVisible();
  await user.click(screen.getByRole("button", { name: "Crear instalación" }));
  await screen.findByRole("heading", { name: "Finalizar" });

  const complete = calls.find(([key]) => key === "setupComplete")![1] as Record<
    string,
    unknown
  >;
  expect(complete).toEqual({
    token: code,
    administrator: {
      username: "Admin.Uno",
      displayName: "Persona Uno",
      password: "una-clave-larga-1",
    },
    organization: { name: "Institución de ejemplo" },
    appearance: {
      appName: "Acta",
      shortName: "Acta",
      accent: "#1b4b8c",
      locale: "es-MX",
      timezone: "UTC",
    },
  });
  // La contraseña ya no queda en la pantalla ni en el estado.
  expect(screen.queryByDisplayValue("una-clave-larga-1")).toBeNull();
  await user.click(screen.getByRole("button", { name: "Ir a iniciar sesión" }));
  expect(onFinished).toHaveBeenCalledOnce();
});

it("lo que define la infraestructura se muestra sin poder editarse y no se envía", async () => {
  const { user, calls } = mount({
    setupVerify: () => ({
      defaults: defaults({
        appName: field("Nombre del .env", "external", "APP_NAME"),
        timezone: field("Europe/Madrid", "external", "DEFAULT_TIMEZONE"),
      }),
    }),
  });
  await begin(user);
  await administrator(user);
  await user.type(
    screen.getByLabelText("Nombre de la institución"),
    "Institución",
  );
  await user.click(screen.getByRole("button", { name: "Continuar" }));
  await screen.findByRole("heading", { name: "Almacenamiento" });
  await user.click(screen.getByRole("button", { name: "Continuar" }));
  await screen.findByRole("heading", { name: "Personalización" });
  const name = screen.getByLabelText("Nombre de la aplicación");
  expect(name).toHaveValue("Nombre del .env");
  expect(name).toHaveAttribute("readonly");
  expect(
    screen.getAllByText(/Administrado externamente \(APP_NAME\)/)[0],
  ).toBeVisible();
  expect(screen.getByLabelText("Zona horaria")).toHaveValue("Europe/Madrid");
  expect(screen.getByLabelText("Zona horaria")).toHaveAttribute("readonly");
  await user.click(screen.getByRole("button", { name: "Continuar" }));
  await screen.findByRole("heading", { name: "Verificación" });
  await user.click(screen.getByRole("button", { name: "Crear instalación" }));
  await screen.findByRole("heading", { name: "Finalizar" });
  const complete = calls.find(([key]) => key === "setupComplete")![1] as {
    appearance: Record<string, string>;
  };
  expect(Object.keys(complete.appearance).sort()).toEqual([
    "accent",
    "locale",
    "shortName",
  ]);
});

it("si otra persona terminó la instalación primero, deja de ofrecer la guía", async () => {
  const { user, onFinished } = mount({
    setupComplete: () => {
      throw new apiModule.ApiFailure(
        409,
        "La instalación ya está configurada.",
      );
    },
  });
  await begin(user);
  await administrator(user);
  await user.type(
    screen.getByLabelText("Nombre de la institución"),
    "Institución",
  );
  await user.click(screen.getByRole("button", { name: "Continuar" }));
  await screen.findByRole("heading", { name: "Almacenamiento" });
  await user.click(screen.getByRole("button", { name: "Continuar" }));
  await screen.findByRole("heading", { name: "Personalización" });
  await user.click(screen.getByRole("button", { name: "Continuar" }));
  await screen.findByRole("heading", { name: "Verificación" });
  await user.click(screen.getByRole("button", { name: "Crear instalación" }));
  await waitFor(() => expect(onFinished).toHaveBeenCalled());
});

it("con la base de datos sin respuesta no permite crear la instalación", async () => {
  const { user } = mount({
    setupChecks: () => ({ ...checks, database: "unavailable" }),
  });
  await begin(user);
  await administrator(user);
  await user.type(
    screen.getByLabelText("Nombre de la institución"),
    "Institución",
  );
  await user.click(screen.getByRole("button", { name: "Continuar" }));
  await screen.findByRole("heading", { name: "Almacenamiento" });
  await user.click(screen.getByRole("button", { name: "Continuar" }));
  await screen.findByRole("heading", { name: "Personalización" });
  await user.click(screen.getByRole("button", { name: "Continuar" }));
  await screen.findByRole("heading", { name: "Verificación" });
  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: "Crear instalación" }),
    ).toBeDisabled(),
  );
});
