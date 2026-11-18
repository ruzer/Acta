import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import { login } from "./login-helper";
import { draftProject } from "./fixtures/constant-use";
import { checkedPage } from "./fixtures/page-checks";
const evidence =
  process.env.ACTA_DIRECTION_C_EVIDENCE_DIR ?? "test-results/design-evidence";
async function holdLoading(
  page: Page,
  url: string,
  apiPath: string,
  heading: string,
) {
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(
    `**/api/v1${apiPath}`,
    async (route) => {
      await held;
      await route.continue();
    },
    { times: 1 },
  );
  try {
    await page.goto(url);
    await expect(
      page.locator('.loading-skeleton[aria-busy="true"]'),
    ).toBeVisible();
    await expect(page.locator(".loading-skeleton")).toHaveAttribute(
      "role",
      "status",
    );
    await expect(
      page.locator('.loading-skeleton [aria-hidden="true"]'),
    ).toHaveCount(1);
    expect(
      await page
        .locator(".loading-skeleton")
        .evaluate((el) => getComputedStyle(el).animationName),
    ).toBe("none");
  } finally {
    release();
  }
  await expect(
    page.getByRole("heading", { name: heading, exact: true }),
  ).toBeVisible();
}
test("Mis proyectos y Atención muestran carga accesible; el menú estrecho mantiene visibles sus etiquetas", async ({
  page,
}) => {
  await login(page, "admin");
  const fixture = await draftProject(page);
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await holdLoading(page, "/", "/projects", "Mis proyectos");
    await checkedPage(page, evidence, "constant-projects", width);
    await holdLoading(
      page,
      `/projects/${fixture.project.id}/dashboard`,
      `/projects/${fixture.project.id}/dashboard`,
      "Atención",
    );
    await checkedPage(page, evidence, "constant-attention", width);
  }
  await page.setViewportSize({ width: 1024, height: 900 });
  const link = page
    .locator(".ac-sidebar")
    .getByRole("link", { name: "Cuestionario", exact: true });
  await link.focus();
  const label = link.locator("span");
  expect(
    await label.evaluate((el) => ({
      width: el.getBoundingClientRect().width,
      clip: getComputedStyle(el).clipPath,
    })),
  ).toMatchObject({ clip: "none" });
  expect((await label.boundingBox())!.width).toBeGreaterThan(50);
});
test("Mi trabajo y Responder muestran carga; las acciones móviles permanecen visibles sin posición fija", async ({
  page,
  browser,
}) => {
  const admin = await browser.newPage();
  await login(admin, "admin");
  const fixture = await draftProject(admin);
  await admin.close();
  await login(page, "stakeholder");
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 844 });
    await holdLoading(
      page,
      `/projects/${fixture.project.id}/work`,
      `/projects/${fixture.project.id}/my-work`,
      "Mi trabajo",
    );
    await checkedPage(page, evidence, "constant-work", width);
    await holdLoading(
      page,
      `/projects/${fixture.project.id}/respond/${fixture.questions[0].id}`,
      `/projects/${fixture.project.id}/questions/${fixture.questions[0].id}/response`,
      fixture.questions[0].question,
    );
    const bar = page.locator(".response-footer");
    if (width === 390) {
      expect(await bar.evaluate((el) => getComputedStyle(el).position)).toBe(
        "sticky",
      );
      await page.getByLabel("Tu respuesta", { exact: true }).focus();
      await expect(
        page.getByRole("button", { name: "Guardar y salir", exact: true }),
      ).toBeInViewport();
      await expect(
        page.getByRole("button", { name: "Enviar respuesta", exact: true }),
      ).toBeInViewport();
      const input = await page
          .getByLabel("Tu respuesta", { exact: true })
          .boundingBox(),
        actions = await bar.boundingBox();
      expect(input!.y + input!.height).toBeLessThanOrEqual(actions!.y + 1);
    }
    await checkedPage(page, evidence, "constant-respond", width);
  }
});
