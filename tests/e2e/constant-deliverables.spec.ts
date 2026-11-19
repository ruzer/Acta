import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { login } from "./login-helper";
import { seedDocumentCases } from "./fixtures/review-cases";
import { checkedPage } from "./fixtures/page-checks";
const evidence =
  process.env.ACTA_DIRECTION_C_EVIDENCE_DIR ?? "test-results/design-evidence";
test("Atención y Decisiones ofrecen entregables visibles y CSV en español", async ({
  page,
  baseURL,
}) => {
  test.setTimeout(120000);
  const fixture = await seedDocumentCases(baseURL!);
  await login(page, "analyst");
  for (const route of ["dashboard", "decisions"]) {
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`/projects/${fixture.project.id}/${route}`);
      const group = page.getByRole("group", { name: "Entregables" });
      await expect(
        group.getByRole("link", { name: "Informe para imprimir" }),
      ).toBeVisible();
      await expect(
        group.getByRole("link", { name: "Exportar", exact: true }),
      ).toBeVisible();
      await expect(
        page.getByText("Ya puedes imprimir el informe"),
      ).toBeVisible();
      await checkedPage(
        page,
        evidence,
        `constant-deliverables-${route}`,
        width,
      );
    }
  }
  await page
    .getByRole("group", { name: "Entregables" })
    .getByRole("link", { name: "Exportar", exact: true })
    .click();
  await page.getByLabel("Formato").selectOption("CSV");
  const download = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Descargar exportación", exact: true })
    .click();
  const bytes = await readFile((await (await download).path())!);
  expect([...bytes.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
  expect(bytes.toString("utf8")).toMatch(
    /^\uFEFFProyecto,Tema,Código de pregunta,Título/,
  );
  await checkedPage(page, evidence, "constant-csv", 390);
});
