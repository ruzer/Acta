import { test, expect } from "@playwright/test";
import { login } from "./login-helper";
import { draftProject } from "./fixtures/constant-use";
import { checkedPage } from "./fixtures/page-checks";

test.use({ actionTimeout: 15000 });
const evidence =
  process.env.ACTA_DIRECTION_C_EVIDENCE_DIR ?? "test-results/design-evidence";

test("autoguarda después de ocho segundos sin salir y conserva la edición en curso", async ({
  page,
  browser,
}) => {
  const admin = await browser.newPage();
  await login(admin, "admin");
  const fixture = await draftProject(admin);
  await admin.close();
  await login(page, "stakeholder");
  await page.goto(
    `/projects/${fixture.project.id}/respond/${fixture.questions[0].id}`,
  );
  const answer = page.getByLabel("Tu respuesta", { exact: true });
  await expect(answer).toBeVisible();
  await page.clock.install();
  const requests: { expectedVersion: number; answer: string }[] = [];
  page.on("request", (r) => {
    if (r.url().endsWith("/response/draft") && r.method() === "PUT")
      requests.push(r.postDataJSON());
  });
  await answer.fill("Una respuesta ficticia que no debe perderse.");
  await page.clock.runFor(7999);
  expect(requests).toHaveLength(0);
  await page.clock.runFor(1);
  await expect(
    page.getByRole("status").filter({ hasText: "Borrador guardado a las" }),
  ).toBeVisible();
  expect(requests).toHaveLength(1);
  expect(requests[0].expectedVersion).toBe(0);
  expect(await answer.inputValue()).toBe(
    "Una respuesta ficticia que no debe perderse.",
  );
  expect(
    await page.evaluate(() =>
      Object.keys(sessionStorage).filter((key) =>
        key.startsWith("acta-draft:"),
      ),
    ),
  ).toEqual([]);
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await checkedPage(page, evidence, "constant-draft-saved", width);
  }
});

test("recupera solo el texto propio después de recargar sin conexión", async ({
  page,
  browser,
}) => {
  const admin = await browser.newPage();
  await login(admin, "admin");
  const fixture = await draftProject(admin);
  await admin.close();
  await login(page, "stakeholder");
  await page.goto(
    `/projects/${fixture.project.id}/respond/${fixture.questions[0].id}`,
  );
  const answer = page.getByLabel("Tu respuesta", { exact: true });
  await expect(answer).toBeVisible();
  await page.route("**/response/draft", (route) => route.abort());
  await answer.fill("Texto ficticio antes de una interrupción.");
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          Object.keys(sessionStorage).filter((key) =>
            key.startsWith("acta-draft:"),
          ).length,
      ),
    )
    .toBe(1);
  expect(await page.evaluate(() => JSON.stringify(localStorage))).not.toContain(
    "Texto ficticio",
  );
  page.on("dialog", (dialog) => dialog.accept());
  await page.reload();
  await page
    .getByRole("button", { name: "Restaurar texto de esta pestaña" })
    .click();
  await expect(answer).toHaveValue("Texto ficticio antes de una interrupción.");
  await page.unroute("**/response/draft");
  await page
    .getByRole("button", { name: "Guardar y salir", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Mi trabajo", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(() =>
      Object.keys(sessionStorage).filter((key) =>
        key.startsWith("acta-draft:"),
      ),
    ),
  ).toEqual([]);
});

test("el guardado lento conserva lo escrito después y serializa Guardar y salir", async ({
  page,
  browser,
}) => {
  const admin = await browser.newPage();
  await login(admin, "admin");
  const fixture = await draftProject(admin);
  await admin.close();
  await login(page, "stakeholder");
  const url = `/projects/${fixture.project.id}/respond/${fixture.questions[0].id}`;
  await page.goto(url);
  const answer = page.getByLabel("Tu respuesta", { exact: true });
  await expect(answer).toBeVisible();
  await page.clock.install();
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  const writes: { expectedVersion: number; answer: string }[] = [];
  let active = 0,
    maximum = 0;
  await page.route("**/response/draft", async (route) => {
    writes.push(route.request().postDataJSON());
    maximum = Math.max(maximum, ++active);
    if (writes.length === 1) await held;
    const result = await route.fetch();
    active--;
    await route.fulfill({ response: result });
  });
  await answer.fill("Primera versión ficticia.");
  await page.clock.runFor(8000);
  await expect.poll(() => writes.length).toBe(1);
  await answer.fill("Versión nueva mientras el servidor guarda.");
  await page
    .getByRole("button", { name: "Guardar y salir", exact: true })
    .click();
  expect(writes).toHaveLength(1);
  release();
  await expect(
    page.getByRole("heading", { name: "Mi trabajo", exact: true }),
  ).toBeVisible();
  expect(maximum).toBe(1);
  expect(writes.map((v) => v.expectedVersion)).toEqual([0, 1]);
  expect(writes[1].answer).toBe("Versión nueva mientras el servidor guarda.");
  await page.goto(url);
  await expect(answer).toHaveValue(
    "Versión nueva mientras el servidor guarda.",
  );
});

test("el conflicto automático conserva el texto y al caducar la sesión borra el respaldo", async ({
  page,
  browser,
}) => {
  const admin = await browser.newPage();
  await login(admin, "admin");
  const fixture = await draftProject(admin);
  await admin.close();
  await login(page, "stakeholder");
  await page.goto(
    `/projects/${fixture.project.id}/respond/${fixture.questions[0].id}`,
  );
  const answer = page.getByLabel("Tu respuesta", { exact: true });
  await expect(answer).toBeVisible();
  await page.clock.install();
  await page.route("**/response/draft", (route) =>
    route.fulfill({
      status: 409,
      json: {
        code: "CONFLICT",
        requestId: "conflicto-ficticio",
        message: "El borrador fue actualizado desde otra sesión o pestaña.",
        fieldErrors: {},
      },
    }),
  );
  await answer.fill("Texto local que permanece tras el conflicto.");
  await page.clock.runFor(8000);
  await expect(page.getByRole("alert")).toContainText(
    "El borrador fue actualizado",
  );
  await expect(answer).toHaveValue(
    "Texto local que permanece tras el conflicto.",
  );
  await expect(
    page.getByRole("button", { name: "Consultar versión del servidor" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () =>
        Object.keys(sessionStorage).filter((key) =>
          key.startsWith("acta-draft:"),
        ).length,
    ),
  ).toBe(1);
  await page.evaluate(() => window.dispatchEvent(new Event("session-expired")));
  await expect(page.getByRole("dialog")).toContainText(
    "Tus cambios siguen en esta pestaña",
  );
  expect(
    await page.evaluate(() =>
      Object.keys(sessionStorage).filter((key) =>
        key.startsWith("acta-draft:"),
      ),
    ),
  ).toEqual([]);
  await expect(answer).toHaveValue(
    "Texto local que permanece tras el conflicto.",
  );
});

test("tras fallar, el autoguardado espera sesenta segundos y conserva el texto", async ({
  page,
  browser,
}) => {
  const admin = await browser.newPage();
  await login(admin, "admin");
  const fixture = await draftProject(admin);
  await admin.close();
  await login(page, "stakeholder");
  const clockStart = new Date("2026-11-19T12:00:00Z");
  await page.clock.install({ time: new Date(clockStart.getTime() - 60000) });
  await page.goto(
    `/projects/${fixture.project.id}/respond/${fixture.questions[0].id}`,
  );
  const answer = page.getByLabel("Tu respuesta", { exact: true });
  await expect(answer).toBeVisible();
  await page.clock.pauseAt(clockStart);
  let attempts = 0;
  let releaseFailure!: () => void;
  const heldFailure = new Promise<void>((resolve) => {
    releaseFailure = resolve;
  });
  const responseDelay = 1000;
  await page.route("**/response/draft", async (route) => {
    attempts++;
    if (attempts === 1) {
      await heldFailure;
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({
          message: "No se pudo guardar.",
          code: "SERVICE_UNAVAILABLE",
        }),
      });
    } else await route.continue();
  });
  await answer.fill("Borrador ficticio conservado tras un fallo.");
  await page.clock.runFor(8000);
  await expect.poll(() => attempts).toBe(1);
  const firstAttemptTime = await page.evaluate(() => Date.now());
  await page.clock.runFor(responseDelay);
  releaseFailure();
  await expect(page.getByRole("status")).toContainText(
    "No se pudo guardar. Tu texto sigue aquí",
  );
  // El plazo nace en el intento, no cuando el navegador recibe el error.
  await page.clock.runFor(60000 - responseDelay - 1);
  expect(await page.evaluate(() => Date.now())).toBe(firstAttemptTime + 59999);
  expect(attempts).toBe(1);
  await expect(answer).toHaveValue(
    "Borrador ficticio conservado tras un fallo.",
  );
  await page.clock.runFor(1);
  await expect(page.getByRole("status")).toContainText(
    "Borrador guardado a las",
  );
  expect(attempts).toBe(2);
  expect(await page.evaluate(() => Date.now())).toBe(firstAttemptTime + 60000);
});

for (const action of ["Guardar y salir", "Enviar respuesta"] as const) {
  test(`${action} funciona al primer clic mientras falla el autoguardado`, async ({
    page,
    browser,
  }) => {
    const admin = await browser.newPage();
    await login(admin, "admin");
    const fixture = await draftProject(admin);
    await admin.close();
    await login(page, "stakeholder");
    const path = `/projects/${fixture.project.id}/respond/${fixture.questions[0].id}`;
    await page.goto(path);
    const answer = page.getByLabel("Tu respuesta", { exact: true });
    await expect(answer).toBeVisible();
    await page.clock.install();
    const started = Promise.withResolvers<void>(),
      release = Promise.withResolvers<void>();
    let attempts = 0;
    await page.route("**/response/draft", async (route) => {
      attempts++;
      if (attempts === 1) {
        started.resolve();
        await release.promise;
        await route.fulfill({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify({
            message: "No se pudo guardar.",
            code: "SERVICE_UNAVAILABLE",
          }),
        });
      } else await route.continue();
    });
    await answer.fill("Texto ficticio que se guarda con un clic.");
    await page.clock.runFor(8000);
    await started.promise;
    try {
      await page.getByRole("button", { name: action, exact: true }).click();
    } finally {
      release.resolve();
    }
    await expect(page).not.toHaveURL(new RegExp(`${path}$`));
    expect(attempts).toBe(2);
  });
}
