import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { login } from "./login-helper";
import { command } from "./fixtures/workbench";
import { draftProject } from "./fixtures/constant-use";
import { checkedPage } from "./fixtures/page-checks";
import type { ResponseView } from "@requirements/contracts";
const evidence =
  process.env.ACTA_DIRECTION_C_EVIDENCE_DIR ?? "test-results/design-evidence";
test.use({ actionTimeout: 15000 });
test("fecha opcional al crear y editar, visible en Atención y Mi trabajo, sin bloquear un envío vencido", async ({
  page,
  browser,
}) => {
  test.setTimeout(120000);
  await login(page, "admin");
  const fixture = await draftProject(page);
  const base = `/projects/${fixture.project.id}`;
  await page.goto("/admin");
  await page.getByRole("button", { name: "Proyectos", exact: true }).click();
  await page
    .getByRole("button", { name: "Crear proyecto", exact: true })
    .click();
  const create = page.getByRole("dialog");
  await create
    .getByLabel("Nombre del proyecto")
    .fill("Proyecto ficticio con fecha");
  await create.getByLabel("Identificador externo").fill(`DUE-${randomUUID()}`);
  await create
    .getByLabel("Fecha límite para responder (opcional)")
    .fill("2030-11-25");
  await create
    .getByRole("button", { name: "Crear proyecto", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  for (const [date, expected] of [
    ["2030-11-25", "Vence el"],
    ["2020-01-01", "Venció el"],
  ]) {
    await page
      .getByRole("row")
      .filter({ hasText: fixture.project.externalId })
      .getByRole("button", {
        name: `Fecha límite de ${fixture.project.name}`,
        exact: true,
      })
      .click();
    const dialog = page.getByRole("dialog");
    await dialog
      .getByLabel("Fecha límite para responder (opcional)")
      .fill(date);
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 950 });
      await checkedPage(
        page,
        evidence,
        `constant-deadline-form-${date}`,
        width,
      );
    }
    await dialog.getByRole("button", { name: "Guardar fecha límite" }).click();
    await expect(dialog).toHaveCount(0);
    await page.goto(`${base}/dashboard`);
    await expect(
      page.getByText(new RegExp(`${expected}.*Puedes seguir respondiendo`)),
    ).toBeVisible();
    const context = await browser.newContext();
    const participant = await context.newPage();
    try {
      await login(participant, "stakeholder");
      await participant.goto(`${base}/work`);
      await expect(
        participant.getByText(
          new RegExp(`${expected}.*Puedes seguir respondiendo`),
        ),
      ).toBeVisible();
      for (const width of [1440, 390]) {
        await participant.setViewportSize({ width, height: 950 });
        await checkedPage(
          participant,
          evidence,
          `constant-deadline-work-${date}`,
          width,
        );
      }
      if (date === "2020-01-01") {
        const path = `${base}/questions/${fixture.questions[0].id}/response`;
        const before = await command<ResponseView>(participant, path);
        const saved = await command<ResponseView>(
          participant,
          `${path}/draft`,
          {
            requestId: randomUUID(),
            expectedVersion: before.lockVersion,
            answer: "Envío ficticio después del plazo",
            comment: "",
            example: "",
            consultationRequested: false,
          },
          "PUT",
        );
        const sent = await command<ResponseView>(
          participant,
          `${path}/submit`,
          { requestId: randomUUID(), expectedVersion: saved.lockVersion },
        );
        expect(sent.revisions).toHaveLength(1);
      }
    } finally {
      await context.close();
    }
    await page.goto(`${base}/participation`);
    await expect(page.getByRole("heading", { name: "Participación", exact: true })).toBeVisible();
    await expect(page.getByLabel("Filtrar participación")).toBeVisible();
    if (date === "2020-01-01")
      await expect(
        page.getByText(/1 persona con plazo vencido y pendientes/),
      ).toBeVisible();
    await checkedPage(
      page,
      evidence,
      `constant-deadline-participation-${date}`,
      390,
    );
    await page.goto("/admin");
    await page.getByRole("button", { name: "Proyectos", exact: true }).click();
  }
});
