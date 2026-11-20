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
  const requested = Promise.withResolvers<void>();
  await page.route(
    (url) => url.pathname === `/api/v1${apiPath}`,
    async (route) => {
      requested.resolve();
      await held;
      await route.continue();
    },
    { times: 1 },
  );
  try {
    await page.goto(url);
    await requested.promise;
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

test("el pie a 390×480 deja espacio para responder y permite llegar a guardar y enviar", async ({
  page,
  browser,
}) => {
  const admin = await browser.newPage();
  await login(admin, "admin");
  const fixture = await draftProject(admin);
  await admin.close();
  await login(page, "stakeholder");
  await page.setViewportSize({ width: 390, height: 480 });
  await page.goto(
    `/projects/${fixture.project.id}/respond/${fixture.questions[0].id}`,
  );
  const answer = page.getByLabel("Tu respuesta", { exact: true });
  await answer.focus();
  await answer.scrollIntoViewIfNeeded();
  const footer = page.locator(".response-footer");
  await checkedPage(page, evidence, "polish-response-short-viewport", 390);
  await expect(footer.getByRole("button")).toHaveCount(2);
  await expect(footer.getByText("Necesito consultar esto")).toHaveCount(0);
  await expect(footer.locator(".hint")).toHaveCount(0);
  const bar = (await footer.boundingBox())!;
  const input = (await answer.boundingBox())!;
  expect(bar.height).toBeLessThanOrEqual(140);
  expect(bar.y).toBeGreaterThanOrEqual(200);
  expect(input.y).toBeGreaterThanOrEqual(0);
  expect(input.y + input.height).toBeLessThanOrEqual(bar.y + 1);
  await expect(
    page.getByRole("button", { name: "Necesito consultar esto" }),
  ).toBeAttached();
  await footer.scrollIntoViewIfNeeded();
  await expect(
    footer.getByRole("button", { name: "Guardar y salir", exact: true }),
  ).toBeInViewport();
  await expect(
    footer.getByRole("button", { name: "Enviar respuesta", exact: true }),
  ).toBeInViewport();
});

test("el último campo queda completo sobre el pie al escribir y al reducir el área visible", async ({
  page,
  browser,
}) => {
  const admin = await browser.newPage();
  await login(admin, "admin");
  const fixture = await draftProject(admin);
  await admin.close();
  await login(page, "stakeholder");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(
    `/projects/${fixture.project.id}/respond/${fixture.questions[0].id}`,
  );
  await page
    .getByText("Agregar un ejemplo (opcional)", { exact: true })
    .click();
  const example = page.getByLabel("Ejemplo (opcional)", { exact: true });
  const footer = page.locator(".response-footer");
  await page.evaluate(() => document.fonts.ready);
  // Se puede pulsar el centro del campo aunque su borde inferior quede bajo el pie.
  await example.evaluate((field) => {
    const box = field.getBoundingClientRect();
    const bar = document
      .querySelector(".response-footer")!
      .getBoundingClientRect();
    window.scrollBy(0, box.top + box.height / 2 - (bar.top - 10));
  });
  const box = (await example.boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await page.keyboard.type("Ejemplo ficticio para el piloto.");
  await expect(example).toBeFocused();
  await page.screenshot({ path: `${evidence}/pilot-last-field-390.png` });
  await expect
    .poll(async () => {
      const field = (await example.boundingBox())!;
      const bar = (await footer.boundingBox())!;
      return field.y >= 0 && field.y + field.height <= bar.y;
    })
    .toBe(true);
  expect(await footer.evaluate((el) => getComputedStyle(el).position)).toBe(
    "sticky",
  );

  // Chromium de escritorio no abre un teclado virtual: simulamos su viewport visual.
  await page.evaluate(() => {
    Object.defineProperty(window.visualViewport!, "height", {
      configurable: true,
      value: 400,
    });
    window.visualViewport!.dispatchEvent(new Event("resize"));
  });
  await expect
    .poll(() => footer.evaluate((el) => getComputedStyle(el).position))
    .toBe("static");
  await expect
    .poll(async () => {
      const field = (await example.boundingBox())!;
      return field.y >= 0 && field.y + field.height <= 400;
    })
    .toBe(true);
  await footer.evaluate((el) => el.scrollIntoView({ block: "start" }));
  for (const button of await footer.getByRole("button").all()) {
    const bounds = (await button.boundingBox())!;
    expect(bounds.y).toBeGreaterThanOrEqual(0);
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(400);
    expect(bounds.height).toBeGreaterThanOrEqual(44);
  }
  await page.evaluate(() => {
    delete (window.visualViewport as unknown as { height?: number }).height;
    window.visualViewport!.dispatchEvent(new Event("resize"));
  });
  await expect
    .poll(() => footer.evaluate((el) => getComputedStyle(el).position))
    .toBe("sticky");
  await footer.scrollIntoViewIfNeeded();
  for (const name of ["Guardar y salir", "Enviar respuesta"]) {
    const button = footer.getByRole("button", { name, exact: true });
    await expect(button).toBeInViewport();
    expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  }
});
