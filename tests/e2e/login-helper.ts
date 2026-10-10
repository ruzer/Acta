import { expect, type Page } from "@playwright/test";
const temporary = process.env.DEMO_PASSWORD!;
const changed = temporary + "-Reviewed2B";
export async function login(
  page: Page,
  username: string,
  options: { temporary?: boolean } = {},
) {
  await page.goto("/");
  await page.getByLabel("Usuario", { exact: true }).fill(username);
  await page
    .getByLabel("Contraseña", { exact: true })
    .fill(options.temporary ? temporary : changed);
  const first = page.waitForResponse((r) => r.url().endsWith("/auth/login"));
  await page
    .getByRole("button", { name: "Iniciar sesión", exact: true })
    .click();
  let response = await first;
  if (response.status() === 401 && !options.temporary) {
    await page.getByLabel("Contraseña", { exact: true }).fill(temporary);
    const fallback = page.waitForResponse((r) =>
      r.url().endsWith("/auth/login"),
    );
    await page
      .getByRole("button", { name: "Iniciar sesión", exact: true })
      .click();
    response = await fallback;
  }
  expect(
    response.status(),
    "El acceso de prueba debe autenticarse sin eludir límites",
  ).toBe(201);
  await expect(
    page
      .getByRole("button", { name: "Cerrar sesión", includeHidden: true })
      .first(),
  ).toBeAttached();
  if (
    await page
      .getByRole("heading", { name: "Cambia tu contraseña temporal" })
      .isVisible()
  ) {
    await page.getByLabel("Contraseña actual").fill(temporary);
    await page.getByLabel("Nueva contraseña", { exact: true }).fill(changed);
    await page.getByLabel("Repetir nueva contraseña").fill(changed);
    await page.getByRole("button", { name: "Actualizar contraseña" }).click();
    await expect(
      page.getByRole("heading", { name: "Iniciar sesión" }),
    ).toBeVisible();
    await page.getByLabel("Usuario", { exact: true }).fill(username);
    await page.getByLabel("Contraseña", { exact: true }).fill(changed);
    await page
      .getByRole("button", { name: "Iniciar sesión", exact: true })
      .click();
  }
  await expect(
    page.getByRole("heading", {
      name: /^(Mis proyectos|Hola, .+)$/,
      exact: true,
    }),
  ).toBeVisible();
}

export async function logout(page: Page) {
  if (
    !(await page.getByRole("button", { name: "Cerrar sesión" }).isVisible())
  ) {
    if (!(await page.locator(".participant-account").count()))
      await page.getByRole("link", { name: "Mi trabajo", exact: true }).click();
    await page.locator(".participant-account summary").click();
  }
  await page.getByRole("button", { name: "Cerrar sesión" }).click();
}
