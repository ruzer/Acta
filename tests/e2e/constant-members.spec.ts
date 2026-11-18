import { test, expect } from "@playwright/test";
import { login } from "./login-helper";
import { draftProject } from "./fixtures/constant-use";
import { checkedPage } from "./fixtures/page-checks";
const evidence =
  process.env.ACTA_DIRECTION_C_EVIDENCE_DIR ?? "test-results/design-evidence";
test("Miembros conserva Área como encabezado a 1440 y 390 px", async ({
  page,
}) => {
  await login(page, "admin");
  const fixture = await draftProject(page);
  await page.goto(`/projects/${fixture.project.id}/members`);
  const table = page.getByRole("table", { name: "Acceso al proyecto" });
  await expect(
    table.getByRole("columnheader", { name: "Área", exact: true }),
  ).toBeVisible();
  await expect(
    table.getByRole("columnheader", { name: "Área participante", exact: true }),
  ).toHaveCount(0);
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 950 });
    await checkedPage(page, evidence, "constant-members", width);
  }
});
