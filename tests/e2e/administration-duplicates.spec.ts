import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { randomUUID } from "node:crypto";
import { login } from "./login-helper";

for (const [tab, action, nameLabel, keyLabel, message] of [
  [
    "Usuarios",
    "Crear usuario",
    "Nombre para mostrar",
    "Usuario",
    "Ya existe un usuario con ese nombre de usuario. Elige otro.",
  ],
  [
    "Áreas",
    "Crear área",
    "Nombre del área",
    "Código del área",
    "Ya existe un área con ese código. Usa otro código o revisa el área existente.",
  ],
  [
    "Proyectos",
    "Crear proyecto",
    "Nombre del proyecto",
    "Identificador externo",
    "Ya existe un proyecto con ese identificador externo. Usa otro identificador.",
  ],
]) {
  test(`${tab}: el alta duplicada explica qué corregir y conserva el formulario`, async ({
    page,
  }, testInfo) => {
    await login(page, "admin");
    await page.goto("/admin");
    const group = page.getByRole("group", {
      name: "Administración",
      exact: true,
    });
    await group.getByRole("button", { name: tab, exact: true }).click();
    await expect(
      group.getByRole("button", { name: tab, exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    const key = `duplicate-${randomUUID().slice(0, 8)}`;
    for (const duplicate of [false, true]) {
      await page.getByRole("button", { name: action, exact: true }).click();
      const dialog = page.getByRole("dialog", { name: action, exact: true });
      await dialog
        .getByLabel(nameLabel, { exact: true })
        .fill("Ejemplo ficticio");
      await dialog.getByLabel(keyLabel, { exact: true }).fill(key);
      if (tab === "Usuarios")
        await dialog
          .getByLabel("Contraseña temporal", { exact: true })
          .fill(process.env.DEMO_PASSWORD!);
      await dialog.getByRole("button", { name: action, exact: true }).click();
      if (!duplicate) {
        await expect(dialog).not.toBeVisible();
        continue;
      }
      await expect(dialog.getByRole("alert")).toHaveText(message);
      await expect(dialog.getByLabel(keyLabel, { exact: true })).toHaveValue(
        key,
      );
      await expect(dialog.getByLabel(nameLabel, { exact: true })).toHaveValue(
        "Ejemplo ficticio",
      );
      for (const width of [1440, 390]) {
        await page.setViewportSize({ width, height: 900 });
        await page.evaluate(() => document.fonts.ready);
        expect((await new AxeBuilder({ page }).analyze()).violations).toEqual(
          [],
        );
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth),
        ).toBeLessThanOrEqual(width);
        await page.screenshot({
          path: testInfo.outputPath(`duplicate-${width}.png`),
        });
      }
      // Correcting the existing key, without re-entering the form, succeeds.
      await dialog.getByLabel(keyLabel, { exact: true }).fill(`${key}-fixed`);
      await dialog.getByRole("button", { name: action, exact: true }).click();
      await expect(dialog).not.toBeVisible();
    }
  });
}
