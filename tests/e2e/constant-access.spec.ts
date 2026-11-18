import { test, expect, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { login } from "./login-helper";
import { command } from "./fixtures/workbench";
import { checkedPage } from "./fixtures/page-checks";

test.use({ actionTimeout: 15000 });

const evidence =
  process.env.ACTA_DIRECTION_C_EVIDENCE_DIR ?? "test-results/design-evidence";
async function signInHere(page: Page, username: string) {
  await page.getByLabel("Usuario", { exact: true }).fill(username);
  await page
    .getByLabel("Contraseña", { exact: true })
    .fill(process.env.DEMO_PASSWORD! + "-Reviewed2B");
  await page
    .getByRole("button", { name: "Iniciar sesión", exact: true })
    .click();
}
async function projectId(page: Page) {
  const projects = await command<{ id: string; externalId: string }[]>(
    page,
    "/projects",
  );
  return projects.find((p) => p.externalId === "DEMO-PRINCIPAL")!.id;
}
for (const width of [1440, 390]) {
  test(`cambiar de cuenta empieza en el inicio y el permiso denegado tiene salida a ${width}px`, async ({
    page,
    browser,
  }) => {
    test.setTimeout(90000);
    // Initialize the existing demo account without changing a shared password again.
    const setup = await browser.newPage();
    await login(setup, "stakeholder");
    await setup.close();
    await page.setViewportSize({ width, height: 900 });
    await login(page, "analyst");
    const dashboard = `/projects/${await projectId(page)}/dashboard`;
    await page.goto(dashboard);
    await page.reload();
    await expect(
      page.getByRole("heading", { level: 1, name: "Atención" }),
    ).toBeVisible();
    await expect(page).toHaveURL(new RegExp(dashboard + "$"));
    if (width === 390)
      await page.locator(".ac-mobile-account > summary").click();
    await page
      .getByRole("button", { name: "Cerrar sesión", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Iniciar sesión" }),
    ).toBeVisible();
    await expect(page).toHaveURL(/\/$/);
    await signInHere(page, "stakeholder");
    await expect(page.getByRole("heading", { name: /^Hola,/ })).toBeVisible();
    await expect(page).toHaveURL(/\/$/);
    await page.goto(dashboard);
    await expect(
      page.getByRole("link", { name: "Ir a Mis proyectos", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Volver a intentar" }),
    ).toHaveCount(0);
    if (width === 390) {
      await page.locator(".ac-mobile-account > summary").click();
      const home = page
        .locator(".ac-mobile-menu")
        .getByRole("link", { name: "Mis proyectos", exact: true });
      await expect(home).toBeVisible();
      await home.click();
    } else {
      await page
        .getByRole("link", { name: "Ir a Mis proyectos", exact: true })
        .click();
    }
    await expect(page.getByRole("heading", { name: /^Hola,/ })).toBeVisible();
    await checkedPage(page, evidence, "constant-access-home", width);
  });
}

test("la recuperación con otra cuenta sale de la ruta anterior", async ({
  page,
  browser,
}) => {
  const setup = await browser.newPage();
  await login(setup, "stakeholder");
  await setup.close();
  await login(page, "analyst");
  await page.goto(`/projects/${await projectId(page)}/dashboard`);
  await expect(
    page.getByRole("heading", { name: "Atención", exact: true }),
  ).toBeVisible();
  await command(page, "/auth/logout", {});
  await page.evaluate(() => window.dispatchEvent(new Event("session-expired")));
  await expect(
    page.getByRole("dialog", { name: "Recuperar sesión" }),
  ).toBeVisible();
  await signInHere(page, "stakeholder");
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { name: /^Hola,/ })).toBeVisible();
});

test("cambiar contraseña conserva solo el usuario en memoria y permite mostrarla con teclado", async ({
  page,
  browser,
}) => {
  await login(page, "admin");
  const username = `access_${randomUUID().replaceAll("-", "").slice(0, 12)}`;
  await command(page, "/users", {
    username,
    displayName: "Cuenta ficticia de acceso",
    temporaryPassword: process.env.DEMO_PASSWORD!,
  });
  const context = await browser.newContext();
  const participant = await context.newPage();
  try {
    await participant.goto("/");
    await participant.getByLabel("Usuario", { exact: true }).fill(username);
    const password = participant.getByLabel("Contraseña", { exact: true });
    await password.fill(process.env.DEMO_PASSWORD!);
    const toggle = participant.getByRole("button", {
      name: "Mostrar contraseña",
      exact: true,
    });
    await toggle.focus();
    await participant.keyboard.press("Space");
    await expect(password).toHaveAttribute("type", "text");
    await expect(
      participant.getByRole("button", {
        name: "Ocultar contraseña",
        exact: true,
      }),
    ).toHaveAttribute("aria-pressed", "true");
    await participant.keyboard.press("Space");
    await expect(password).toHaveAttribute("type", "password");
    await participant
      .getByRole("button", { name: "Iniciar sesión", exact: true })
      .click();
    await expect(
      participant.getByRole("heading", {
        name: "Cambia tu contraseña temporal",
      }),
    ).toBeVisible();
    await expect(
      participant.getByRole("button", { name: /Mostrar contraseña/ }),
    ).toHaveCount(3);
    await participant
      .getByLabel("Contraseña actual")
      .fill(process.env.DEMO_PASSWORD!);
    await participant
      .getByLabel("Nueva contraseña", { exact: true })
      .fill(process.env.DEMO_PASSWORD! + "-Reviewed2B");
    await participant
      .getByLabel("Repetir nueva contraseña")
      .fill(process.env.DEMO_PASSWORD! + "-Reviewed2B");
    await participant
      .getByRole("button", { name: "Actualizar contraseña" })
      .click();
    await expect(
      participant.getByRole("heading", { name: "Iniciar sesión" }),
    ).toBeVisible();
    await expect(
      participant.getByLabel("Usuario", { exact: true }),
    ).toHaveValue(username);
    await expect(
      participant.getByLabel("Contraseña", { exact: true }),
    ).toBeEmpty();
    expect(new URL(participant.url()).pathname).toBe("/");
    expect(new URL(participant.url()).search).toBe("");
    expect(
      await participant.evaluate(() =>
        [JSON.stringify(localStorage), JSON.stringify(sessionStorage)].some(
          (value) => value.includes("access_"),
        ),
      ),
    ).toBe(false);
    for (const width of [1440, 390]) {
      await participant.setViewportSize({ width, height: 900 });
      await checkedPage(
        participant,
        evidence,
        "constant-access-password-changed",
        width,
      );
    }
    await participant.reload();
    await expect(
      participant.getByLabel("Usuario", { exact: true }),
    ).toBeEmpty();
  } finally {
    await context.close();
  }
});
