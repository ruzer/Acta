import { test, expect } from "@playwright/test";
import { login } from "./login-helper";
import { checkedPage } from "./fixtures/page-checks";

test("la gestión se carga al navegar, anuncia la espera y enfoca el título al resolver", async ({
  page,
}) => {
  const requested: string[] = [];
  page.on("request", (request) => requested.push(request.url()));
  await login(page, "admin");
  expect(
    requested.some((url) => url.includes("/pages/Administration.tsx")),
  ).toBe(false);
  const release = Promise.withResolvers<void>();
  await page.route(/\/src\/pages\/Administration\.tsx/, async (route) => {
    await release.promise;
    await route.continue();
  });
  try {
    await page
      .getByRole("link", { name: "Administración", exact: true })
      .click();
    await expect(page.locator("main").getByRole("status")).toHaveText(
      "Cargando información…",
    );
  } finally {
    release.resolve();
  }
  await expect(
    page.getByRole("heading", { name: "Administración", exact: true }),
  ).toBeFocused();
  await expect(
    page.getByRole("button", { name: "Crear usuario", exact: true }),
  ).toBeVisible();
  await checkedPage(page, "", "lazy-administration", 1440, { capture: false });
  await page.keyboard.press("Tab");
  expect(
    await page.evaluate(() =>
      document.activeElement?.matches(":focus-visible"),
    ),
  ).toBe(true);
});
