import { afterEach, expect, it, vi } from "vitest";
import {
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
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
  secondaryName: field(""),
  logo: asset(),
  logoSecondary: asset(),
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

it("General guarda solo lo que cambió, con la versión que se vio, y no llama al servidor sin cambios", async () => {
  const { user, calls } = mount("general", {
    updateSettings: () =>
      settings({ version: 4, timezone: field("America/Mexico_City", "saved") }),
  });
  await user.click(
    await screen.findByRole("button", { name: "Guardar cambios" }),
  );
  expect(screen.getByRole("alert")).toHaveTextContent(
    "No hay cambios que guardar.",
  );
  expect(calls.some(([key]) => key === "updateSettings")).toBe(false);
  await user.selectOptions(
    screen.getByLabelText("Zona horaria"),
    "America/Mexico_City",
  );
  await user.click(screen.getByRole("button", { name: "Guardar cambios" }));
  expect(await screen.findByText("Configuración guardada.")).toBeVisible();
  expect(calls.find(([key]) => key === "updateSettings")![1]).toEqual({
    expectedVersion: 3,
    timezone: "America/Mexico_City",
  });
});

it("General muestra de solo lectura lo que define la infraestructura", async () => {
  mount("general", {
    settings: () =>
      settings({
        timezone: field("Europe/Madrid", "external", "DEFAULT_TIMEZONE"),
        locale: field("es-ES", "saved"),
      }),
  });
  const zone = await screen.findByLabelText("Zona horaria");
  expect(zone).toHaveValue("Europe/Madrid");
  expect(zone).toHaveAttribute("readonly");
  expect(
    screen.getByText(/Administrado externamente \(DEFAULT_TIMEZONE\)/),
  ).toBeVisible();
  expect(
    screen.getByRole("button", {
      name: /^Usar el valor predeterminado \(.*\) de formato regional$/,
    }),
  ).toBeVisible();
});

it("Apariencia reúne identidad, color e imágenes y guarda solo lo que cambió", async () => {
  const { user, calls } = mount("appearance", {
    updateSettings: () =>
      settings({
        version: 4,
        organizationName: "Nueva institución",
        secondaryName: field("Coordinación General", "saved"),
      }),
  });
  const name = await screen.findByLabelText("Nombre de la institución");
  await user.clear(name);
  await user.type(name, "Nueva institución");
  await user.type(
    screen.getByLabelText("Entidad del segundo logotipo (opcional)"),
    "Coordinación General",
  );
  // The preview follows what is typed, before anything is saved.
  const preview = within(screen.getByTestId("branding-preview"));
  expect(preview.getByText("Nueva institución")).toBeVisible();
  expect(preview.getByText("Coordinación General")).toBeVisible();
  await user.click(screen.getByRole("button", { name: "Guardar identidad" }));
  expect(await screen.findByText("Configuración guardada.")).toBeVisible();
  expect(calls.find(([key]) => key === "updateSettings")![1]).toEqual({
    expectedVersion: 3,
    organizationName: "Nueva institución",
    secondaryName: "Coordinación General",
  });
});

it("Apariencia no llama al servidor sin cambios y explica un conflicto de versión", async () => {
  const { user, calls } = mount("appearance", {
    updateSettings: () => {
      throw new apiModule.ApiFailure(
        409,
        "La configuración cambió mientras la editabas.",
      );
    },
  });
  await user.click(
    await screen.findByRole("button", { name: "Guardar identidad" }),
  );
  expect(screen.getByRole("alert")).toHaveTextContent(
    "No hay cambios que guardar.",
  );
  expect(calls.some(([key]) => key === "updateSettings")).toBe(false);
  await user.type(screen.getByLabelText("Nombre corto"), " 2");
  await user.click(screen.getByRole("button", { name: "Guardar identidad" }));
  expect(await screen.findByText(/cambió mientras la editabas/)).toBeVisible();
  expect(
    screen.getByRole("button", { name: "Cargar la configuración actual" }),
  ).toBeVisible();
});

it("un valor de la infraestructura se muestra sin poder editarse ni restablecerse", async () => {
  mount("appearance", {
    settings: () =>
      settings({
        appName: field("Nombre del .env", "external", "APP_NAME"),
        secondaryName: field("Área del .env", "external", "APP_SECONDARY_NAME"),
        shortName: field("Corto", "saved"),
      }),
  });
  const name = await screen.findByLabelText("Nombre de la aplicación");
  expect(name).toHaveValue("Nombre del .env");
  expect(name).toHaveAttribute("readonly");
  expect(
    screen.getByText(/Administrado externamente \(APP_NAME\)/),
  ).toBeVisible();
  expect(
    screen.getByLabelText("Entidad del segundo logotipo (opcional)"),
  ).toHaveAttribute("readonly");
  // Solo lo guardado desde Acta se puede devolver a su valor predeterminado.
  expect(
    screen.getByRole("button", {
      name: /^Usar el valor predeterminado \(.*\) de nombre corto$/,
    }),
  ).toBeVisible();
  expect(
    screen.queryByRole("button", { name: /nombre de la aplicación/i }),
  ).toBeNull();
});

it("el color se explica con palabras y la vista previa lo usa; no se admite SVG", async () => {
  const { user, calls } = mount("appearance", {
    updateSettings: () =>
      settings({ version: 4, accent: field("#1b4b8c", "saved") }),
  });
  const accent = await screen.findByLabelText("Color principal");
  await user.clear(accent);
  await user.type(accent, "#eeeeee");
  expect(screen.getByText(/demasiado claro/)).toBeVisible();
  await user.clear(accent);
  await user.type(accent, "#1b4b8c");
  expect(screen.getByText(/Es legible/)).toBeVisible();
  expect(screen.getByTestId("branding-preview")).toBeVisible();
  await user.click(screen.getByRole("button", { name: "Guardar identidad" }));
  expect(await screen.findByText("Configuración guardada.")).toBeVisible();
  expect(calls.find(([key]) => key === "updateSettings")![1]).toEqual({
    expectedVersion: 3,
    accent: "#1b4b8c",
  });
  const accepts = (label: string) =>
    (screen.getByLabelText(label) as HTMLInputElement).accept;
  expect(accepts("Subir logotipo principal")).toBe("image/png,image/jpeg");
  expect(accepts("Subir segundo logotipo")).toBe("image/png,image/jpeg");
  expect(accepts("Subir favicon")).toBe("image/png,image/x-icon");
  expect(screen.getAllByText(/No se\s+admiten SVG/)).toHaveLength(3);
});

it("el segundo logotipo es opcional: se elige, se ve antes de guardar, se guarda, se reemplaza y se elimina", async () => {
  const upload = vi
    .spyOn(apiModule, "uploadBrandingAsset")
    .mockResolvedValue({} as never);
  const { user, calls } = mount("appearance", {
    settings: () =>
      settings({
        logoSecondary: asset({
          url: "/api/v1/configuration/assets/logoSecondary?v=abc",
          source: "saved",
          byteSize: 100,
        }),
      }),
    removeBrandingAsset: () => ({}),
  });
  // Sin segundo logotipo guardado la sección sigue ofreciendo solo subirlo.
  const input = (await screen.findByLabelText(
    "Reemplazar segundo logotipo",
  )) as HTMLInputElement;
  const file = new File([new Uint8Array([137, 80, 78, 71])], "area.png", {
    type: "image/png",
  });
  await user.upload(input, file);
  // Visible in the preview before it is saved.
  await waitFor(() =>
    expect(
      [...screen.getByTestId("branding-preview").querySelectorAll("img")].some(
        (img) => img.getAttribute("src")?.startsWith("data:image/png"),
      ),
    ).toBe(true),
  );
  await user.click(
    screen.getByRole("button", { name: "Guardar segundo logotipo" }),
  );
  await waitFor(() =>
    expect(upload).toHaveBeenCalledWith("logoSecondary", 3, file),
  );
  await user.click(
    screen.getByRole("button", { name: "Eliminar segundo logotipo" }),
  );
  await waitFor(() =>
    expect(calls).toContainEqual([
      "removeBrandingAsset",
      { expectedVersion: 3 },
    ]),
  );
  // Another kind is not offered a removal it does not have.
  expect(
    screen.queryByRole("button", { name: "Eliminar logotipo principal" }),
  ).toBeNull();
});

it("una imagen demasiado grande se rechaza antes de enviarla", async () => {
  const upload = vi.spyOn(apiModule, "uploadBrandingAsset");
  const { user } = mount("appearance");
  const input = await screen.findByLabelText("Subir segundo logotipo");
  await user.upload(
    input,
    new File([new Uint8Array(513 * 1024)], "grande.png", { type: "image/png" }),
  );
  expect(await screen.findByText(/demasiado grande/)).toBeVisible();
  expect(
    screen.getByRole("button", { name: "Guardar segundo logotipo" }),
  ).toBeDisabled();
  expect(upload).not.toHaveBeenCalled();
});

it("un logotipo definido en la infraestructura no se puede cambiar desde la pantalla", async () => {
  mount("appearance", {
    settings: () =>
      settings({
        logoSecondary: asset({
          url: "/branding/area.png",
          source: "external",
          variable: "APP_LOGO_SECONDARY",
        }),
      }),
  });
  await screen.findByText(
    /Se define en la infraestructura \(APP_LOGO_SECONDARY\)/,
  );
  expect(screen.queryByLabelText("Subir segundo logotipo")).toBeNull();
  expect(screen.queryByLabelText("Reemplazar segundo logotipo")).toBeNull();
  expect(screen.getByLabelText("Subir logotipo principal")).toBeVisible();
  expect(screen.getByLabelText("Subir favicon")).toBeVisible();
});

it("la vista previa muestra solo las marcas que existen y separa la secundaria", async () => {
  mount("appearance", {
    settings: () =>
      settings({
        logo: asset({ url: "/a.png", source: "saved" }),
        logoSecondary: asset({ url: "/b.png", source: "saved" }),
        favicon: asset({ url: "/f.png", source: "saved" }),
      }),
  });
  await screen.findByTestId("branding-preview");
  const preview = screen.getByTestId("branding-preview");
  expect(preview.querySelector(".institution-marks")).not.toBeNull();
  expect(preview.querySelector(".institution-mark-divider")).not.toBeNull();
  expect(preview.querySelector(".institution-mark-secondary")).toHaveAttribute(
    "src",
    "/b.png",
  );
  expect(preview.querySelector(".brand-preview-tab img")).toHaveAttribute(
    "src",
    "/f.png",
  );
  cleanup();
  mount("appearance");
  await screen.findByTestId("branding-preview");
  // Sin ninguna imagen: sin marcas ni espacio reservado, y el sistema sigue funcionando.
  expect(
    screen.getByTestId("branding-preview").querySelector(".institution-marks"),
  ).toBeNull();
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
