import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import type { Me } from "@requirements/contracts";
import * as apiModule from "../api";
import { Settings } from "./Settings";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
const admin = {
  user: { isOrganizationAdmin: true },
  organization: { name: "Organización de ejemplo" },
} as unknown as Me;
const field = (
  value: string,
  source = "default",
  variable: string | null = null,
) => ({
  value,
  source,
  variable,
});
const asset = (overrides = {}) => ({
  url: "",
  source: "default",
  variable: null,
  byteSize: null,
  ...overrides,
});
const settings = (overrides: Record<string, unknown> = {}) => ({
  version: 3,
  organizationName: "Institución de ejemplo",
  appName: field("Acta"),
  shortName: field("Acta"),
  accent: field("#2b4d7c"),
  locale: field("es-MX"),
  timezone: field("UTC"),
  logo: asset(),
  favicon: asset(),
  minimumContrast: 4.5,
  ...overrides,
});
const system = {
  version: "0.8.0",
  environment: "production",
  checkedAt: "2026-10-12T10:00:00.000Z",
  database: { status: "ok" },
  storage: {
    status: "ok",
    provider: "S3",
    endpointHost: "object-storage:9000",
    bucket: "requirements-evidence",
    region: "us-east-1",
    evidenceByBackend: [{ backend: "S3", files: 2 }],
  },
  security: {
    origin: "https://acta.example.org",
    https: true,
    secureCookies: true,
    sessionIdleMinutes: 30,
    sessionMaxHours: 8,
    invitationIdentity: "NAME",
    invitationDefaultDays: 7,
    invitationMaxDays: 30,
  },
  limits: {
    evidenceMaxBytes: 20971520,
    evidenceMaxAttachments: 10,
    evidenceProjectBytes: 2147483648,
    importMaxBytes: 5242880,
  },
};
function mount(
  section: string,
  handlers: Record<string, (input: unknown) => unknown> = {},
  me: Me = admin,
) {
  const calls: [string, unknown][] = [];
  vi.spyOn(apiModule, "api").mockImplementation((async (
    key: string,
    _params: unknown,
    input: unknown,
  ) => {
    calls.push([key, input]);
    if (handlers[key]) return handlers[key](input);
    if (key === "settings") return settings();
    if (key === "systemStatus") return system;
    throw new Error("unexpected " + key);
  }) as never);
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <MemoryRouter initialEntries={[`/admin/settings/${section}`]}>
        <Routes>
          <Route
            path="/admin/settings/:section"
            element={<Settings me={me} />}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return { user: userEvent.setup(), calls };
}

it("solo la administración de la institución entra a la configuración", () => {
  const { calls } = mount("general", {}, {
    user: { isOrganizationAdmin: false },
    organization: { name: "X" },
  } as unknown as Me);
  expect(screen.getByRole("alert")).toHaveTextContent("No tienes permiso");
  expect(calls).toHaveLength(0);
});

it("ofrece solo secciones que funcionan y marca la actual", async () => {
  mount("general");
  const nav = await screen.findByRole("navigation", {
    name: "Secciones de configuración",
  });
  expect(
    within(nav)
      .getAllByRole("link")
      .map((l) => l.textContent),
  ).toEqual(["General", "Apariencia", "Almacenamiento", "Sistema"]);
  expect(within(nav).getByRole("link", { name: "General" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  expect(screen.queryByText(/Correo|Integraciones|Webhook/)).toBeNull();
});

it("guarda solo lo que cambió, con la versión que se vio", async () => {
  const { user, calls } = mount("general", {
    updateSettings: () =>
      settings({ version: 4, organizationName: "Nueva institución" }),
  });
  const name = await screen.findByLabelText("Nombre de la institución");
  await user.clear(name);
  await user.type(name, "Nueva institución");
  await user.click(screen.getByRole("button", { name: "Guardar cambios" }));
  expect(await screen.findByText("Configuración guardada.")).toBeVisible();
  expect(calls.find(([key]) => key === "updateSettings")![1]).toEqual({
    expectedVersion: 3,
    organizationName: "Nueva institución",
  });
});

it("no llama al servidor cuando no hay nada que guardar", async () => {
  const { user, calls } = mount("general");
  await user.click(
    await screen.findByRole("button", { name: "Guardar cambios" }),
  );
  expect(screen.getByRole("alert")).toHaveTextContent(
    "No hay cambios que guardar.",
  );
  expect(calls.some(([key]) => key === "updateSettings")).toBe(false);
});

it("un valor de la infraestructura se muestra sin poder editarse ni restablecerse", async () => {
  mount("general", {
    settings: () =>
      settings({
        appName: field("Nombre del .env", "external", "APP_NAME"),
        timezone: field("Europe/Madrid", "external", "DEFAULT_TIMEZONE"),
        shortName: field("Corto", "saved"),
      }),
  });
  const name = await screen.findByLabelText("Nombre de la aplicación");
  expect(name).toHaveValue("Nombre del .env");
  expect(name).toHaveAttribute("readonly");
  expect(
    screen.getByText(/Administrado externamente \(APP_NAME\)/),
  ).toBeVisible();
  expect(screen.getByLabelText("Zona horaria")).toHaveAttribute("readonly");
  // Solo lo guardado desde Acta se puede devolver a su valor predeterminado.
  expect(
    screen.getByRole("button", {
      name: "Volver al valor predeterminado de nombre corto",
    }),
  ).toBeVisible();
  expect(
    screen.queryByRole("button", { name: /nombre de la aplicación/i }),
  ).toBeNull();
});

it("un conflicto de versión ofrece cargar la configuración actual", async () => {
  const { user } = mount("general", {
    updateSettings: () => {
      throw new apiModule.ApiFailure(
        409,
        "La configuración cambió mientras la editabas.",
      );
    },
  });
  const name = await screen.findByLabelText("Nombre de la institución");
  await user.type(name, " 2");
  await user.click(screen.getByRole("button", { name: "Guardar cambios" }));
  expect(await screen.findByText(/cambió mientras la editabas/)).toBeVisible();
  expect(
    screen.getByRole("button", { name: "Cargar la configuración actual" }),
  ).toBeVisible();
});

it("la apariencia explica el contraste, muestra la vista previa y no permite SVG", async () => {
  const { user, calls } = mount("appearance", {
    updateSettings: () =>
      settings({ version: 4, accent: field("#1b4b8c", "saved") }),
  });
  const accent = await screen.findByLabelText("Color principal");
  const save = screen.getByRole("button", { name: "Guardar color" });
  expect(save).toBeDisabled();
  await user.clear(accent);
  await user.type(accent, "#eeeeee");
  expect(screen.getByText(/demasiado claro/)).toBeVisible();
  await user.clear(accent);
  await user.type(accent, "#1b4b8c");
  expect(screen.getByText(/Es legible/)).toBeVisible();
  expect(screen.getByTestId("branding-preview")).toBeVisible();
  await user.click(save);
  expect(await screen.findByText("Configuración guardada.")).toBeVisible();
  expect(calls.find(([key]) => key === "updateSettings")![1]).toEqual({
    expectedVersion: 3,
    accent: "#1b4b8c",
  });
  const logo = screen.getByLabelText("Subir logotipo") as HTMLInputElement;
  expect(logo.accept).toBe("image/png,image/jpeg");
  expect(screen.getAllByText(/No se\s+admiten SVG/).length).toBeGreaterThan(0);
  expect(
    (screen.getByLabelText("Subir favicon") as HTMLInputElement).accept,
  ).toBe("image/png,image/x-icon");
});

it("un logotipo definido en la infraestructura no se puede cambiar desde la pantalla", async () => {
  mount("appearance", {
    settings: () =>
      settings({
        logo: asset({
          url: "/branding/logo.png",
          source: "external",
          variable: "APP_LOGO",
        }),
      }),
  });
  await screen.findByText(/Se define en la infraestructura \(APP_LOGO\)/);
  expect(screen.queryByLabelText("Reemplazar logotipo")).toBeNull();
  expect(screen.queryByLabelText("Subir logotipo")).toBeNull();
  expect(screen.getByLabelText("Subir favicon")).toBeVisible();
});

it("almacenamiento muestra el estado, no ofrece cambiarlo y permite probar la conexión", async () => {
  const { user, calls } = mount("storage", {
    storageTest: () => ({
      status: "ok",
      provider: "S3",
      checkedAt: "2026-10-12T10:05:00.000Z",
    }),
  });
  expect(await screen.findByText("object-storage:9000")).toBeVisible();
  expect(screen.getByText("requirements-evidence")).toBeVisible();
  expect(screen.getByText("2 archivos en S3")).toBeVisible();
  expect(screen.getByText("Administrado externamente")).toBeVisible();
  expect(screen.queryByRole("textbox")).toBeNull();
  await user.click(screen.getByRole("button", { name: "Probar conexión" }));
  expect(
    await screen.findByText(/El almacenamiento respondió correctamente/),
  ).toBeVisible();
  expect(calls.some(([key]) => key === "storageTest")).toBe(true);
});

it("el sistema informa versión, seguridad y límites sin mostrar credenciales", async () => {
  mount("system");
  expect(await screen.findByText("Acta 0.8.0")).toBeVisible();
  expect(screen.getByText("https://acta.example.org")).toBeVisible();
  expect(screen.getByText(/Se cierra tras 30 minutos/)).toBeVisible();
  expect(document.body.textContent).not.toMatch(
    /DATABASE_URL|S3_SECRET|requirements_app/,
  );
  expect(screen.queryByRole("textbox")).toBeNull();
});
