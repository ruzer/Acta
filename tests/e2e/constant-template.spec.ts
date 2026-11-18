import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { login } from "./login-helper";
import { command } from "./fixtures/workbench";
import { draftProject } from "./fixtures/constant-use";
import { checkedPage } from "./fixtures/page-checks";
import type { ProjectView, QuestionnaireView } from "@requirements/contracts";
const evidence =
  process.env.ACTA_DIRECTION_C_EVIDENCE_DIR ?? "test-results/design-evidence";
test.use({ actionTimeout: 15000 });
test("descargar CSV y reutilizar desde otro proyecto mantiene la vista previa y crea solo borradores sin personas", async ({
  page,
  browser,
}) => {
  test.setTimeout(120000);
  await login(page, "admin");
  const source = await draftProject(page);
  await command(page, `/areas/${source.area.id}`, {
    name: `Área única ${randomUUID()}`,
  });
  await page.goto(`/projects/${source.project.id}/export`);
  const waiting = page.waitForEvent("download");
  await page
    .getByRole("button", {
      name: "Descargar este cuestionario como plantilla",
      exact: true,
    })
    .click();
  const download = await waiting;
  expect(download.suggestedFilename()).toBe("cuestionario-plantilla.csv");
  const bytes = await readFile((await download.path())!);
  expect(bytes.subarray(0, 3)).toEqual(Buffer.from([239, 187, 191]));
  await expect(page.getByRole("status")).toContainText(
    "Plantilla CSV descargada",
  );
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 950 });
    await checkedPage(page, evidence, "constant-template-export", width);
  }
  const target = await command<ProjectView>(page, "/projects", {
    externalId: `REUSE-${randomUUID()}`,
    name: "Copia ficticia",
    description: "Destino conservado",
  });
  await page.goto(`/projects/${target.id}/import`);
  await page.getByLabel("Proyecto de origen").selectOption(source.project.id);
  await page
    .getByRole("button", { name: "Revisar este cuestionario", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "2. Revisar importación" }),
  ).toBeVisible();
  await expect(page.getByText("0 errores · 0 advertencias")).toBeVisible();
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 950 });
    await checkedPage(page, evidence, "constant-template-reuse-preview", width);
  }
  await page
    .getByRole("button", { name: "Confirmar importación", exact: true })
    .click();
  await expect(
    page.getByText("Importación completada: 2 preguntas y 1 tema."),
  ).toBeVisible();
  const copied = await command<QuestionnaireView>(
    page,
    `/projects/${target.id}/questionnaire`,
  );
  expect(copied.questions).toHaveLength(2);
  expect(
    copied.questions.every(
      (q) => q.publication === "DRAFT" && q.assignments.length === 0,
    ),
  ).toBe(true);
  expect(copied.members).toHaveLength(1);
  // El archivo descargado también pasa por el mismo importador en un destino distinto.
  const fromFile = await command<ProjectView>(page, "/projects", {
    externalId: `FILE-${randomUUID()}`,
    name: "Copia CSV ficticia",
    description: "",
  });
  await page.goto(`/projects/${fromFile.id}/import`);
  await page
    .getByLabel("Archivo CSV o JSON")
    .setInputFiles({
      name: download.suggestedFilename(),
      mimeType: "text/csv",
      buffer: bytes,
    });
  await page
    .getByRole("button", { name: "Revisar archivo", exact: true })
    .click();
  await expect(page.getByText("0 errores · 0 advertencias")).toBeVisible();
  const context = await browser.newContext();
  try {
    const analyst = await context.newPage();
    await login(analyst, "analyst");
    await analyst.goto(`/projects/${source.project.id}/export`);
    await expect(
      analyst.getByRole("button", {
        name: "Descargar este cuestionario como plantilla",
        exact: true,
      }),
    ).toBeVisible();
    for (const width of [1440, 390]) {
      await analyst.setViewportSize({ width, height: 950 });
      await checkedPage(analyst, evidence, "constant-template-analyst", width);
    }
  } finally {
    await context.close();
  }
});
