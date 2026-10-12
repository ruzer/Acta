import { test, expect, type Page } from "@playwright/test";
import { checkedPage } from "./fixtures/page-checks";
import { login, logout } from "./login-helper";
import { crc32, deflateSync } from "node:zlib";

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
  logoSecondary: "",
  secondaryName: "",
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
    secondaryName: field(""),
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
    await page.goto("/admin/settings/appearance");
    await page
      .getByRole("textbox", { name: "Nombre de la aplicación", exact: true })
      .fill(renamed);
    // The preview follows what is typed, before saving.
    await expect(
      page.getByTestId("branding-preview").locator(".brand-preview-tab"),
    ).toContainText(renamed);
    await page.getByRole("button", { name: "Guardar identidad" }).click();
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
    await page.getByLabel("Color principal").fill("#eeeeee");
    await expect(page.getByText(/demasiado claro/)).toBeVisible();
    await page.getByLabel("Color principal").fill("#7a2e8f");
    await expect(
      page.getByTestId("branding-preview").locator(".button"),
    ).toHaveCSS("background-color", "rgb(122, 46, 143)");
  } finally {
    // Put back what this test changed, whether or not it got that far.
    await page.goto("/admin/settings/appearance");
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

/** A valid PNG of a flat color, built from its specification. */
function png(width: number, height: number, shade = 0x66) {
  const chunk = (type: string, data: Buffer) => {
    const body = Buffer.concat([Buffer.from(type), data]);
    const out = Buffer.alloc(12 + data.length);
    out.writeUInt32BE(data.length, 0);
    body.copy(out, 4);
    out.writeUInt32BE(crc32(body), 8 + data.length);
    return out;
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header.set([8, 2, 0, 0, 0], 8);
  const row = Buffer.concat([Buffer.from([0]), Buffer.alloc(width * 3, shade)]);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk(
      "IDAT",
      deflateSync(Buffer.concat(Array.from({ length: height }, () => row))),
    ),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

test("los dos logotipos: se eligen con vista previa, aparecen en el acceso con jerarquía y se eliminan", async ({
  page,
}) => {
  test.setTimeout(240000);
  await login(page, "admin");
  const entity = "Coordinación General de Sistemas e Informática";
  const mark = (name: string, width: number, height: number) => ({
    name,
    mimeType: "image/png",
    buffer: png(width, height),
  });
  try {
    await page.goto("/admin/settings/appearance");
    const preview = page.getByTestId("branding-preview");
    // Chosen files are seen in the preview before anything is saved.
    await page
      .getByLabel("Subir logotipo principal")
      .setInputFiles(mark("institucion.png", 480, 120));
    await expect(preview.locator(".institution-mark").first()).toHaveAttribute(
      "src",
      /^data:image\/png/,
    );
    await page
      .getByRole("button", { name: "Guardar logotipo principal" })
      .click();
    await expect(page.getByText("Logotipo principal guardado.")).toBeVisible();
    await page
      .getByLabel("Subir segundo logotipo")
      .setInputFiles(mark("area.png", 300, 90));
    await page
      .getByRole("button", { name: "Guardar segundo logotipo" })
      .click();
    await expect(page.getByText("Segundo logotipo guardado.")).toBeVisible();
    await page
      .getByLabel("Entidad del segundo logotipo (opcional)")
      .fill(entity);
    await page.getByRole("button", { name: "Guardar identidad" }).click();
    await expect(page.getByText("Configuración guardada.")).toBeVisible();
    await expect(preview.locator(".institution-mark")).toHaveCount(2);
    await expect(preview.locator(".institution-mark-divider")).toHaveCount(1);
    await checkedPage(page, evidence, "settings-two-logos", 1440, {
      capture: false,
    });

    // The sign-in shows the identity first and Acta last, at every width.
    await logout(page);
    for (const [width, height] of widths) {
      await page.setViewportSize({ width, height });
      await page.goto("/");
      await expect(
        page.getByRole("heading", { name: "Iniciar sesión" }),
      ).toBeVisible();
      const marks = page.locator(".access-intro .institution-marks img");
      await expect(marks).toHaveCount(2);
      await expect(page.locator(".access-secondary")).toHaveText(entity);
      // Same order on the page, and the second mark is the smaller one.
      const sizes = await marks.evaluateAll((images) =>
        images.map((image) => {
          const box = image.getBoundingClientRect();
          return { height: box.height, left: box.left, top: box.top };
        }),
      );
      expect(sizes[1]!.height).toBeLessThanOrEqual(sizes[0]!.height);
      await expect(page.locator(".access-product")).toContainText(
        "Questions. Evidence. Decisions.",
      );
      await checkedPage(page, evidence, "login-two-logos", width, {
        capture: false,
      });
    }
    await page.setViewportSize({ width: 1440, height: 900 });
    await login(page, "admin");
  } finally {
    // Leave the installation without logos, as it was.
    await page.goto("/admin/settings/appearance");
    for (const label of [
      "Eliminar logotipo principal",
      "Eliminar segundo logotipo",
    ]) {
      const remove = page.getByRole("button", { name: label });
      if (await remove.count()) {
        await remove.click();
        await expect(remove).toHaveCount(0);
      }
    }
    const field = page.getByLabel("Entidad del segundo logotipo (opcional)");
    if ((await field.inputValue()) !== "") {
      await field.fill("");
      await page.getByRole("button", { name: "Guardar identidad" }).click();
      await expect(page.getByText("Configuración guardada.")).toBeVisible();
    }
  }
  await page.goto("/admin/settings/appearance");
  await expect(page.locator(".institution-mark")).toHaveCount(0);
});
