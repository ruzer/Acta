import { test, expect, type Page } from "@playwright/test";
import { checkedPage } from "./fixtures/page-checks";
import { login } from "./login-helper";

// First run and the settings center in a real browser. The wizard runs against a
// mocked API (a seeded installation already has its administrator, and the wizard
// must never open there); the settings run against the real API with the demo
// administrator and put back what they change.
const widths = [
  [1440, 900],
  [390, 844],
  [320, 640],
] as const;
const evidence = "docs/design/acta-direction-c-evidence/installation";
test.use({ locale: "es-MX", reducedMotion: "reduce" });
test.describe.configure({ mode: "serial" });

const branding = {
  appName: "Acta",
  shortName: "Acta",
  organizationName: "Institución de ejemplo",
  logo: "",
  favicon: "",
  accent: "#2b4d7c",
  locale: "es-MX",
  timezone: "UTC",
};
const field = (value: string) => ({ value, source: "default", variable: null });
const defaults = {
  organizationCode: "DEFAULT",
  organizationName: "",
  appearance: {
    appName: field("Acta"),
    shortName: field("Acta"),
    accent: field("#2b4d7c"),
    locale: field("es-MX"),
    timezone: field("UTC"),
  },
};

/** A new installation as the browser would meet it. */
async function newInstallation(page: Page) {
  let state = "PENDING";
  await page.route("**/api/v1/**", async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace("/api/v1", "");
    const json = (body: unknown, status = 200) =>
      route.fulfill({
        status,
        contentType: "application/json",
        body: JSON.stringify(body),
      });
    if (path === "/auth/me")
      return json(
        { code: "401", message: "Sin sesión.", requestId: "e2e" },
        401,
      );
    if (path === "/configuration/public") return json(branding);
    if (path === "/setup/status") return json({ state });
    if (path === "/setup/verify") return json({ defaults });
    if (path === "/setup/checks")
      return json({
        database: "ok",
        storage: "ok",
        storageProvider: "S3",
        secureOrigin: true,
        origin: "http://localhost:4317",
      });
    if (path === "/setup/complete") {
      state = "COMPLETED";
      return json({ ok: true }, 201);
    }
    if (path === "/auth/context")
      return json({
        mode: "single-organization",
        institutionName: "Institución de ejemplo",
      });
    return route.continue();
  });
}

for (const [width, height] of widths)
  test(`el asistente se recorre con teclado y cumple accesibilidad a ${width}px`, async ({
    page,
  }) => {
    await newInstallation(page);
    await page.setViewportSize({ width, height });
    await page.goto("/#setup=" + "A".repeat(43));
    // The code came with the link and the link left no trace in the address.
    await expect(page.getByLabel("Código de instalación")).toHaveValue(
      "A".repeat(43),
    );
    expect(new URL(page.url()).hash).toBe("");
    await checkedPage(page, evidence, "setup-welcome", width, {
      capture: false,
    });
    await page.getByRole("button", { name: "Comenzar" }).click();

    await expect(
      page.getByRole("heading", { name: "Administrador" }),
    ).toBeFocused();
    await checkedPage(page, evidence, "setup-administrator", width, {
      capture: false,
    });
    await page.getByLabel("Nombre de usuario").fill("admin.demo");
    await page.getByLabel("Nombre visible").fill("Administración de ejemplo");
    await page
      .getByLabel("Contraseña", { exact: true })
      .fill("una-clave-de-ejemplo-1");
    await page
      .getByLabel("Confirma la contraseña")
      .fill("una-clave-de-ejemplo-1");
    await page.getByRole("button", { name: "Continuar" }).click();

    await expect(
      page.getByRole("heading", { name: "Organización" }),
    ).toBeFocused();
    await checkedPage(page, evidence, "setup-organization", width, {
      capture: false,
    });
    await page
      .getByLabel("Nombre de la institución")
      .fill("Institución de ejemplo");
    await page.getByRole("button", { name: "Continuar" }).click();

    await expect(
      page.getByRole("heading", { name: "Almacenamiento" }),
    ).toBeFocused();
    await expect(page.getByText(/Almacenamiento \(S3 privado\)/)).toBeVisible();
    await checkedPage(page, evidence, "setup-storage", width, {
      capture: false,
    });
    await page.getByRole("button", { name: "Continuar" }).click();

    await expect(
      page.getByRole("heading", { name: "Personalización" }),
    ).toBeFocused();
    await page.getByLabel("Color principal").fill("#7a2e8f");
    await expect(page.getByText(/Es legible/)).toBeVisible();
    // The preview wears the chosen color.
    await expect(
      page.getByTestId("branding-preview").locator(".button"),
    ).toHaveCSS("background-color", "rgb(122, 46, 143)");
    await checkedPage(page, evidence, "setup-appearance", width, {
      capture: false,
    });
    await page.getByRole("button", { name: "Continuar" }).click();

    await expect(
      page.getByRole("heading", { name: "Verificación" }),
    ).toBeFocused();
    await checkedPage(page, evidence, "setup-verify", width, {
      capture: false,
    });
    await page.getByRole("button", { name: "Crear instalación" }).click();

    await expect(
      page.getByRole("heading", { name: "Finalizar" }),
    ).toBeFocused();
    await checkedPage(page, evidence, "setup-finish", width, {
      capture: false,
    });
    await page.getByRole("button", { name: "Ir a iniciar sesión" }).click();
    await expect(
      page.getByRole("heading", { name: "Iniciar sesión" }),
    ).toBeVisible();
    await expect(
      page.getByText(/La instalación quedó configurada/),
    ).toBeVisible();
  });

test("una instalación ya configurada nunca muestra el asistente, ni siquiera con un código en la dirección", async ({
  page,
}) => {
  await page.goto("/#setup=" + "B".repeat(43));
  await expect(
    page.getByRole("heading", { name: "Iniciar sesión" }),
  ).toBeVisible();
  await expect(page.getByText("Configura tu instalación")).toHaveCount(0);
});

test("la configuración: secciones accesibles, cambio visible al instante y vuelta al valor predeterminado", async ({
  page,
}) => {
  test.setTimeout(240000);
  await login(page, "admin");
  const sections = ["general", "appearance", "storage", "system"] as const;
  for (const [width, height] of widths) {
    await page.setViewportSize({ width, height });
    for (const section of sections) {
      await page.goto(`/admin/settings/${section}`);
      await expect(page.locator("main h1")).toHaveText("Configuración");
      await expect(page.locator(".settings-panel h2")).toBeVisible();
      await checkedPage(page, evidence, `settings-${section}`, width, {
        capture: false,
      });
    }
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  // The deep link marks only its own destination in the navigation.
  await page.goto("/admin/settings/general");
  const rail = page
    .getByRole("navigation", { name: "Navegación principal" })
    .first();
  await expect(
    rail.getByRole("link", { name: "Configuración" }),
  ).toHaveAttribute("aria-current", "page");
  await expect(
    rail.getByRole("link", { name: "Administración" }),
  ).not.toHaveAttribute("aria-current");

  const renamed = `Acta de pruebas ${Date.now()}`;
  try {
    await page
      .getByRole("textbox", { name: "Nombre de la aplicación", exact: true })
      .fill(renamed);
    await page.getByRole("button", { name: "Guardar cambios" }).click();
    await expect(page.getByText("Configuración guardada.")).toBeVisible();
    // The title of the page follows without a reload, and survives one.
    await expect(page).toHaveTitle(renamed);
    await page.reload();
    await expect(page).toHaveTitle(renamed);
    await expect(
      page.getByRole("textbox", {
        name: "Nombre de la aplicación",
        exact: true,
      }),
    ).toHaveValue(renamed);
    // A color that the white text could not be read on is explained and not saved.
    await page.goto("/admin/settings/appearance");
    await page.getByLabel("Color principal").fill("#eeeeee");
    await expect(page.getByText(/demasiado claro/)).toBeVisible();
    await page.getByLabel("Color principal").fill("#7a2e8f");
    await expect(
      page.getByTestId("branding-preview").locator(".button"),
    ).toHaveCSS("background-color", "rgb(122, 46, 143)");
  } finally {
    // Put back what this test changed, whether or not it got that far.
    await page.goto("/admin/settings/general");
    const name = page.getByRole("textbox", {
      name: "Nombre de la aplicación",
      exact: true,
    });
    await expect(name).toBeVisible();
    const back = page.getByRole("button", {
      name: "Volver al valor predeterminado de nombre de la aplicación",
    });
    if (await back.count()) {
      await back.click();
      await expect(name).toHaveValue("Acta");
    }
  }
  await expect(page).not.toHaveTitle(renamed);
});
