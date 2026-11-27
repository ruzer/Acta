import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { login } from "./login-helper";
import { command } from "./fixtures/workbench";
import { checkedPage } from "./fixtures/page-checks";
import type { MemberView, ProjectView } from "@requirements/contracts";

const evidence =
  process.env.ACTA_DIRECTION_C_EVIDENCE_DIR ?? "test-results/design-evidence";

test("Miembros conserva valores vigentes y confirma el ascenso sin conceder directorio institucional", async ({
  browser,
  page,
}) => {
  await login(page, "admin");
  const suffix = randomUUID().slice(0, 8);
  const project = await command<ProjectView>(page, "/projects", {
    externalId: `MEMBERS-${suffix}`,
    name: "Proyecto ficticio de accesos",
    description: "",
  });
  const area = await command<{ id: string }>(page, "/areas", {
    code: `MEMBERS-${suffix}`,
    name: "Área revisora",
  });
  const people: { id: string; username: string; displayName: string }[] = [];
  for (const [key, displayName] of [
    ["ana", "Ana de prueba"],
    ["carla", "Carla de prueba"],
    ["outside", "Persona fuera del proyecto"],
  ]) {
    people.push(
      await command<{ id: string; username: string; displayName: string }>(
        page,
        "/users",
        {
          username: `${key}-${suffix}`,
          displayName,
          temporaryPassword: process.env.DEMO_PASSWORD!,
          isOrganizationAdmin: false,
        },
      ),
    );
  }
  for (const [index, role] of [
    [0, "ADMIN"],
    [1, "ANALYST"],
  ] as const) {
    await command(page, `/projects/${project.id}/members`, {
      userId: people[index].id,
      role,
      areaId: area.id,
      active: true,
    });
  }
  const context = await browser.newContext();
  try {
    const ana = await context.newPage();
    await login(ana, people[0].username, { temporary: true });
    await ana.goto(`/projects/${project.id}/members`);
    await expect(
      ana.getByText(
        "Para incorporar usuarios nuevos, solicita apoyo a la administración de la institución. Puedes actualizar miembros existentes.",
      ),
    ).toBeVisible();
    const user = ana.getByLabel("Usuario", { exact: true });
    await expect(
      user.locator("option").filter({ hasText: people[2].displayName }),
    ).toHaveCount(0);
    await user.selectOption(people[1].id);
    await expect(ana.getByLabel("Rol", { exact: true })).toHaveValue("ANALYST");
    await expect(ana.getByLabel("Área", { exact: true })).toHaveValue(area.id);
    await expect(ana.getByLabel("Acceso al proyecto activo")).toBeChecked();
    await expect(ana.getByText("Sin cambios", { exact: true })).toBeVisible();
    const save = ana.getByRole("button", {
      name: "Guardar acceso al proyecto",
      exact: true,
    });
    await expect(save).toHaveAttribute("aria-disabled", "true");
    let writes = 0;
    ana.on("request", (r) => {
      if (
        r.method() === "POST" &&
        r.url().endsWith(`/projects/${project.id}/members`)
      )
        writes++;
    });
    await save.focus();
    await ana.keyboard.press("Enter");
    const unchanged = (
      await command<MemberView[]>(page, `/projects/${project.id}/members`)
    ).find((m) => m.userId === people[1].id)!;
    expect({
      role: unchanged.role,
      areaId: unchanged.areaId,
      active: unchanged.active,
    }).toEqual({ role: "ANALYST", areaId: area.id, active: true });
    expect(writes).toBe(0);
    for (const [width, height] of [
      [1440, 900],
      [390, 844],
    ]) {
      await ana.setViewportSize({ width, height });
      await checkedPage(ana, evidence, "member-access-unchanged", width);
      await ana.screenshot({
        path: `${evidence}/member-access-full-${width}.png`,
        fullPage: true,
      });
    }
    await ana.getByLabel("Rol", { exact: true }).selectOption("ADMIN");
    await expect(ana.getByText(/Rol: Analista → Administración/)).toBeVisible();
    await save.focus();
    await ana.keyboard.press("Enter");
    const dialog = ana.getByRole("dialog");
    await expect(dialog).toBeVisible();
    expect(
      await dialog.evaluate((el) => el.contains(document.activeElement)),
    ).toBe(true);
    expect(writes).toBe(0);
    await checkedPage(ana, evidence, "member-access-confirmation", 390);
    await ana.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(save).toBeFocused();
    await ana.keyboard.press("Enter");
    await dialog.getByRole("button", { name: /Confirmar/ }).click();
    await expect(dialog).toHaveCount(0);
    await expect(
      ana.getByText("Operación guardada.", { exact: true }),
    ).toBeVisible();
    await expect(save).toBeFocused();
    await expect(save).toHaveAttribute("aria-disabled", "true");
    expect(writes).toBe(1);
    const updated = (
      await command<MemberView[]>(page, `/projects/${project.id}/members`)
    ).find((m) => m.userId === people[1].id)!;
    expect(updated.role).toBe("ADMIN");
    expect(updated.areaId).toBe(area.id);
    expect(updated.active).toBe(true);
  } finally {
    await context.close();
  }
});
