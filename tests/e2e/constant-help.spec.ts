import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { login } from "./login-helper";
import { command } from "./fixtures/workbench";
import { checkedPage } from "./fixtures/page-checks";
const evidence =
  process.env.ACTA_DIRECTION_C_EVIDENCE_DIR ?? "test-results/design-evidence";
test.use({ actionTimeout: 15000 });
test("Primeros pasos usa el proyecto real y Ayuda muestra solo las guías del perfil", async ({
  page,
  browser,
}) => {
  test.setTimeout(120000);
  await login(page, "admin");
  await page.setViewportSize({ width: 1440, height: 950 });
  await expect(
    page.getByRole("link", { name: "Ayuda", exact: true }).first(),
  ).toBeVisible();
  const project = await command<{ id: string }>(page, "/projects", {
    externalId: `HELP-${randomUUID()}`,
    name: "Primer proyecto ficticio",
    description: "Solo prueba",
  });
  await page.goto(`/projects/${project.id}/dashboard`);
  await expect(page.getByText("Primeros pasos", { exact: true })).toBeVisible();
  const steps = page
    .locator("details")
    .filter({ has: page.locator("summary", { hasText: "Primeros pasos" }) });
  await expect(
    steps.getByRole("link", { name: "Importar cuestionario", exact: true }),
  ).toHaveAttribute("href", `/projects/${project.id}/import`);
  await expect(
    steps.getByRole("link", { name: "Miembros", exact: true }),
  ).toHaveAttribute("href", `/projects/${project.id}/members`);
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 950 });
    await checkedPage(page, evidence, "constant-first-steps", width);
  }
  await steps.locator("summary").focus();
  await page.keyboard.press("Enter");
  await expect(steps).not.toHaveAttribute("open");
  await page.keyboard.press("Enter");
  await expect(steps).toHaveAttribute("open");
  for (const [user, headings] of [
    [
      "admin",
      ["Guía de Participante", "Guía de Administración", "Guía de Revisión"],
    ],
    ["analyst", ["Guía de Revisión"]],
    ["stakeholder", ["Guía de Participante"]],
    ["viewer", []],
  ] as const) {
    const context = await browser.newContext();
    try {
      const rolePage = await context.newPage();
      await login(rolePage, user);
      await rolePage.goto("/help");
      await expect(
        rolePage.getByRole("heading", { name: "Ayuda", exact: true }),
      ).toBeVisible();
      await expect(rolePage.locator("main h2")).toHaveText([...headings]);
      for (const width of [1440, 390]) {
        await rolePage.setViewportSize({ width, height: 950 });
        await checkedPage(rolePage, evidence, `constant-help-${user}`, width);
      }
    } finally {
      await context.close();
    }
  }
});

test("los pasos completados se retiran y la primera respuesta oculta la tarjeta", async ({
  page,
  browser,
}) => {
  await login(page, "admin");
  const { draftProject } = await import("./fixtures/constant-use");
  const { project, questions } = await draftProject(page);
  await page.goto(`/projects/${project.id}/dashboard`);
  const steps = page
    .locator("details")
    .filter({ has: page.locator("summary", { hasText: "Primeros pasos" }) });
  await expect(steps.getByRole("listitem")).toHaveCount(1);
  await expect(
    steps.getByRole("link", { name: "Participación", exact: true }),
  ).toBeVisible();
  const context = await browser.newContext();
  try {
    const participant = await context.newPage();
    await login(participant, "stakeholder");
    await participant.goto(
      `/projects/${project.id}/respond/${questions[0].id}`,
    );
    await participant
      .getByLabel("Tu respuesta", { exact: true })
      .fill("Prueba ficticia de los primeros pasos.");
    await participant
      .getByRole("button", { name: "Enviar respuesta", exact: true })
      .click();
    await expect(
      participant.getByRole("status").filter({ hasText: "Respuesta enviada." }),
    ).toBeVisible();
    await page.reload();
    await expect(
      page.getByRole("heading", { name: "Atención", exact: true }),
    ).toBeVisible();
    await expect(page.getByText("Primeros pasos", { exact: true })).toHaveCount(
      0,
    );
  } finally {
    await context.close();
  }
});
