import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { randomBytes } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { login, logout } from "./login-helper";
async function accessible(page: Page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(
      document.getAnimations().map((a) => a.finished.catch(() => {})),
    );
  });
  const r = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(r.violations).toEqual([]);
}
test.beforeAll(async () => {
  await mkdir("artifacts", { recursive: true });
});
test("login accesible con teclado, escritorio y móvil", async ({ page }) => {
  const loginPayloads: unknown[] = [];
  page.on("request", (request) => {
    if (request.url().endsWith("/auth/login"))
      loginPayloads.push(request.postDataJSON());
  });
  await page.goto("/");
  // CP7: the page is about signing in (h1); the institution stays the first
  // line of the page, as text, instead of being its title.
  await expect(
    page.getByRole("heading", { level: 1, name: "Iniciar sesión" }),
  ).toBeVisible();
  await expect(
    page.getByText(process.env.ORGANIZATION_NAME || "My organization", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByText("Acta · Questions. Evidence. Decisions.", { exact: true }),
  ).toBeVisible();
  await expect(page.locator("input")).toHaveCount(2);
  await expect(
    page.getByText(/FGEO-DEMO|organizationCode|Organización/),
  ).toHaveCount(0);
  await accessible(page);
  await page.getByLabel("Usuario", { exact: true }).focus();
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("Contraseña", { exact: true })).toBeFocused();
  await page.screenshot({
    path: "artifacts/login-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await accessible(page);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({ path: "artifacts/login-mobile.png", fullPage: true });
  await page.setViewportSize({ width: 320, height: 900 });
  await accessible(page);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await login(page, "stakeholder");
  expect(loginPayloads.length).toBeGreaterThan(0);
  for (const payload of loginPayloads)
    expect(Object.keys(payload as object).sort()).toEqual([
      "password",
      "username",
    ]);
});
test("login explica contexto no disponible y permite reintentar sin pedir códigos", async ({
  page,
}) => {
  let calls = 0;
  await page.route("**/api/v1/auth/context", async (route) => {
    if (++calls === 1) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({
          code: "UNAVAILABLE",
          message:
            "El acceso no está disponible. Contacta a la administración.",
          requestId: "test-context",
        }),
      });
    } else await route.continue();
  });
  await page.goto("/");
  await expect(page.getByRole("status")).toContainText("Cargando información");
  await expect(page.getByRole("alert")).toContainText(
    "El acceso no está disponible",
  );
  await expect(page.locator("input")).toHaveCount(0);
  await accessible(page);
  await page.getByRole("button", { name: "Volver a intentar" }).click();
  await expect(page.getByLabel("Usuario", { exact: true })).toBeVisible();
  await page.getByLabel("Usuario", { exact: true }).fill("missing-user");
  await page
    .getByLabel("Contraseña", { exact: true })
    .fill("wrong-example-only");
  await page
    .getByRole("button", { name: "Iniciar sesión", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText(
    "No fue posible iniciar sesión con esos datos.",
  );
  await expect(page.getByLabel("Usuario", { exact: true })).toHaveValue(
    "missing-user",
  );
  await expect(page.getByLabel("Contraseña", { exact: true })).toHaveValue("");
  await accessible(page);
});
test("stakeholder consulta secciones sin IDs técnicos ni acciones de revisión", async ({
  page,
}) => {
  await login(page, "stakeholder");
  await accessible(page);
  await page
    .getByRole("link", { name: "Proyecto demostración", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Mi trabajo", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("¿El área recibe solicitudes de servicio por escrito?", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Guardar|Enviar|Adjuntar|Validar/ }),
  ).toHaveCount(0);
  expect(await page.locator("main").innerText()).not.toMatch(
    /FORM-DEMO|REQ-DEMO|NOT_REVIEWED|SUBMITTED|QuestionRevision|[a-f0-9]{8}-[a-f0-9]{4}-/,
  );
  await accessible(page);
  await page.screenshot({
    path: "artifacts/stakeholder-desktop.png",
    fullPage: true,
  });

  await expect(
    page.getByRole("link", { name: "Responder: Plazo de atención" }),
  ).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await accessible(page);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "artifacts/stakeholder-mobile.png",
    fullPage: true,
  });
  await logout(page);
  await expect(
    page.getByRole("heading", { name: "Iniciar sesión" }),
  ).toBeVisible();
});
test("administración, edición, guardado, publicación y contenido protegido", async ({
  page,
}) => {
  const questionTitle =
    "Pregunta de comprobación visual " + randomBytes(4).toString("hex");
  await login(page, "admin");
  await page.getByRole("link", { name: "Administración", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Administración", exact: true }),
  ).toBeVisible();
  await accessible(page);
  await page.screenshot({
    path: "artifacts/admin-desktop.png",
    fullPage: true,
  });
  await page.getByRole("link", { name: "Mis proyectos", exact: true }).click();
  await page
    .getByRole("listitem")
    .filter({
      has: page.getByRole("heading", {
        name: "Proyecto demostración",
        exact: true,
      }),
    })
    .getByRole("link", { name: "Editar cuestionario" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Proyecto demostración", exact: true }),
  ).toBeVisible();
  await accessible(page);
  await page.screenshot({
    path: "artifacts/editor-desktop.png",
    fullPage: true,
  });
  await page.getByRole("tab", { name: "Escribir", exact: true }).click();
  await page
    .getByRole("button", { name: "+ Agregar pregunta", exact: true })
    .first()
    .click();
  await page
    .getByLabel("Identificador externo", { exact: true })
    .fill("E2E-" + randomBytes(4).toString("hex"));
  await page.getByLabel("Título breve").fill(questionTitle);
  await page
    .getByLabel("Pregunta", { exact: true })
    .fill("¿Cómo se organiza el servicio ficticio?");
  await page.getByText("Configuración avanzada", { exact: true }).click();
  await expect(page.getByLabel("Posición en la sección")).toHaveCount(0);
  await accessible(page);
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Crear pregunta", exact: true })
    .click();
  await expect(
    page.getByText(
      "Pregunta guardada. Su contenido sigue en preparación hasta que la publiques.",
    ),
  ).toBeVisible();
  const row = page.getByRole("article", { name: questionTitle, exact: true });
  await row.getByLabel("Acciones de " + questionTitle, { exact: true }).click();
  await row.getByRole("button", { name: "Publicar", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await accessible(page);
  await page.getByRole("button", { name: "Confirmar publicación" }).click();
  await expect(
    page.getByText("Pregunta publicada. Su contenido quedó protegido."),
  ).toBeVisible();
  await expect(
    row.getByRole("button", { name: "Editar pregunta", exact: true }),
  ).toHaveCount(0);
  await page.setViewportSize({ width: 768, height: 1024 });
  await accessible(page);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
test("viewer no puede abrir editor y la denegación se explica", async ({
  page,
}) => {
  await login(page, "viewer");
  await page
    .getByRole("listitem")
    .filter({
      has: page.getByRole("heading", {
        name: "Proyecto demostración",
        exact: true,
      }),
    })
    .getByRole("link", { name: "Consultar preguntas" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Proyecto demostración", exact: true }),
  ).toBeVisible();
  await page.goto(page.url() + "/editor");
  await expect(page.getByRole("alert")).toContainText(
    "Tu perfil no permite esta acción",
  );
  await accessible(page);
});

test("cambios sin guardar se conservan al cancelar navegación y miembros funcionan", async ({
  page,
}) => {
  await login(page, "admin");
  await page
    .getByRole("listitem")
    .filter({
      has: page.getByRole("heading", {
        name: "Proyecto demostración",
        exact: true,
      }),
    })
    .getByRole("link", { name: "Editar cuestionario" })
    .click();
  await page
    .locator("summary:visible")
    .filter({ hasText: /^Más herramientas$/ })
    .click();
  await page.getByRole("link", { name: "Miembros", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Miembros del proyecto" }),
  ).toBeVisible();
  await accessible(page);
  await page.getByRole("link", { name: "← Cuestionario" }).click();
  await page.getByRole("tab", { name: "Escribir", exact: true }).click();
  const editorUrl = page.url();
  const trigger = page
    .getByRole("button", {
      name: "+ Agregar pregunta",
      exact: true,
    })
    .first();
  await trigger.click();
  const composer = page.getByRole("dialog", {
    name: "Agregar pregunta al cuestionario",
    exact: true,
  });
  await expect(composer).toBeVisible();
  await expect(composer.getByLabel("Pregunta", { exact: true })).toBeFocused();
  await composer.getByLabel("Título breve").fill("Texto sin guardar");
  await expect(composer.getByRole("status")).toHaveText("Cambios sin guardar");
  const cancel = composer.getByRole("button", {
    name: "Cancelar",
    exact: true,
  });
  // The approved composer uses a native confirmation when leaving with edits.
  await Promise.all([
    page.waitForEvent("dialog").then(async (confirmation) => {
      expect(confirmation.type()).toBe("confirm");
      expect(confirmation.message()).toBe(
        "Hay cambios sin guardar en esta pregunta. ¿Descartarlos?",
      );
      await confirmation.dismiss();
    }),
    cancel.click(),
  ]);
  await expect(composer).toBeVisible();
  await expect(page).toHaveURL(editorUrl);
  await expect(composer.getByLabel("Título breve")).toHaveValue(
    "Texto sin guardar",
  );
  await expect(cancel).toBeFocused();
  await Promise.all([
    page.waitForEvent("dialog").then(async (confirmation) => {
      expect(confirmation.type()).toBe("confirm");
      expect(confirmation.message()).toBe(
        "Hay cambios sin guardar en esta pregunta. ¿Descartarlos?",
      );
      await confirmation.accept();
    }),
    cancel.click(),
  ]);
  await expect(composer).toHaveCount(0);
  await expect(page).toHaveURL(editorUrl);
  await expect(trigger).toBeFocused();
  await trigger.click();
  await expect(composer.getByLabel("Título breve")).toHaveValue("");
  await composer.getByRole("button", { name: "Cancelar", exact: true }).click();
  await expect(composer).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await page.getByRole("link", { name: "Mis proyectos", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Mis proyectos", exact: true }),
  ).toBeVisible();
});

test("estados de carga, error con reintento y proyecto vacío", async ({
  page,
}) => {
  await login(page, "admin");
  await page.route("**/api/v1/projects", async (route) => {
    await new Promise((r) => setTimeout(r, 800));
    await route.fulfill({
      status: 500,
      json: {
        code: "TEST_ERROR",
        message: "Error controlado de prueba",
        requestId: "test",
      },
    });
  });
  await page.reload();
  await expect(page.getByText("Cargando información…")).toBeVisible();
  await expect(page.getByRole("alert")).toContainText(
    "Error controlado de prueba",
  );
  await accessible(page);
  await page.unroute("**/api/v1/projects");
  await page.getByRole("button", { name: "Volver a intentar" }).click();
  await expect(
    page.getByRole("heading", { name: "Mis proyectos", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("listitem")
    .filter({
      has: page.getByRole("heading", {
        name: "Proyecto de ejemplo adicional",
        exact: true,
      }),
    })
    .getByRole("link", { name: "Editar cuestionario" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Todavía no hay preguntas." }),
  ).toBeVisible();
  await accessible(page);
});
