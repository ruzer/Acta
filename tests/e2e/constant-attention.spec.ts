import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import type { ResponseView } from "@requirements/contracts";
import { login } from "./login-helper";
import { command, asUser } from "./fixtures/workbench";
import { draftProject } from "./fixtures/constant-use";
import { checkedPage } from "./fixtures/page-checks";
const evidence =
  process.env.ACTA_DIRECTION_C_EVIDENCE_DIR ?? "test-results/design-evidence";
test.use({ actionTimeout: 15000 });
test("Atención no duplica filas y cuenta dos envíos de una pregunta desde la visita anterior", async ({
  page,
  browser,
}) => {
  test.setTimeout(120000);
  await login(page, "admin");
  const fixture = await draftProject(page);
  const base = `/projects/${fixture.project.id}`;
  await page.goto(`${base}/dashboard`);
  await expect(
    page.getByRole("heading", { name: "Atención", exact: true }),
  ).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(
        (id) =>
          Object.keys(localStorage).filter(
            (k) => k.startsWith("acta-attention-visit:") && k.endsWith(id),
          ).length,
        fixture.project.id,
      ),
    )
    .toBe(1);
  await expect(page.getByText(/nuevas? desde tu última visita/)).toHaveCount(0);
  await page.goto("/");
  await asUser(browser, "stakeholder", async (person) => {
    for (let i = 0; i < 3; i++) {
      const path = `${base}/questions/${fixture.questions[i === 2 ? 1 : 0].id}/response`;
      const before = await command<ResponseView>(person, path);
      const saved = await command<ResponseView>(
        person,
        `${path}/draft`,
        {
          requestId: randomUUID(),
          expectedVersion: before.lockVersion,
          answer: `Aportación ficticia ${i}`,
          comment: "",
          example: "",
          consultationRequested: false,
        },
        "PUT",
      );
      if (i < 2)
        await command(person, `${path}/submit`, {
          requestId: randomUUID(),
          expectedVersion: saved.lockVersion,
        });
    }
  });
  await page.goto(`${base}/dashboard`);
  await expect(
    page
      .getByRole("status")
      .filter({ hasText: "2 aportaciones nuevas desde tu última visita" }),
  ).toBeVisible();
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 950 });
    for (const disclosure of await page
      .locator(".ac-attention-content details:not([open]) > summary")
      .all())
      await disclosure.click();
    const ids = await page
      .locator("[data-workbench-id]")
      .evaluateAll((links) =>
        links.map((link) => link.getAttribute("data-workbench-id")),
      );
    expect(ids).toHaveLength(2);
    expect(new Set(ids).size).toBe(2);
    await checkedPage(page, evidence, "constant-attention", width);
  }
  const visits = await page.evaluate(() =>
    Object.keys(localStorage).filter((k) =>
      k.startsWith("acta-attention-visit:"),
    ),
  );
  await page.locator(".ac-mobile-account > summary").click();
  await page
    .getByRole("button", { name: "Cerrar sesión", exact: true })
    .click();
  await login(page, "analyst");
  await page.goto(`${base}/dashboard`);
  await expect(page.getByRole("list", { name: "Te toca a ti" })).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          Object.keys(localStorage).filter((k) =>
            k.startsWith("acta-attention-visit:"),
          ).length,
      ),
    )
    .toBe(visits.length + 1);
  await expect(page.getByText(/nuevas? desde tu última visita/)).toHaveCount(0);
  const action = page.getByRole("link", { name: /^Revisar y decidir:/ });
  await expect(action).toHaveCount(1);
  await page.getByLabel("Filtrar estado").selectOption("ANSWERED");
  await expect(action).toHaveCount(1);
  await checkedPage(page, evidence, "constant-attention-filter", 390);
});
