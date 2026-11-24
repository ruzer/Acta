import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { login } from "./login-helper";
import { prepare, type Fixture } from "./fixtures/workbench";

let fixture: Fixture;
test.describe.configure({ mode: "serial" });
test.use({ actionTimeout: 15000 });
test.beforeAll(async ({ browser }) => {
  test.setTimeout(240000);
  fixture = await prepare(browser);
});

test("F4: Organizar conserva búsqueda y Analizar al recargar y volver sin consultar por filtro", async ({
  page,
}) => {
  await login(page, "analyst");
  await page.goto(`/projects/${fixture.project.id}/editor`);
  await page.getByRole("tab", { name: "Organizar", exact: true }).click();
  const search = page.getByLabel("Buscar preguntas", { exact: true });
  const analyze = page.getByRole("button", { name: "Analizar", exact: true });
  await expect(page.locator(".qe-compact-row").first()).toBeVisible();
  const requests: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/api/v1/")) requests.push(request.url());
  });
  await search.fill("NEXT-WB-02");
  await analyze.click();
  await expect(search).toHaveValue("NEXT-WB-02");
  await expect(analyze).toHaveAttribute("aria-pressed", "true");
  await expect(page).toHaveURL(/q=NEXT-WB-02/);
  await expect(page).toHaveURL(/approach=analyze/);
  expect(requests).toEqual([]);
  await page.reload();
  await expect(search).toHaveValue("NEXT-WB-02");
  await expect(analyze).toHaveAttribute("aria-pressed", "true");
  await page
    .locator(`a[href='/projects/${fixture.project.id}/dashboard']`)
    .first()
    .click();
  await expect(page.locator(".ac-attention")).toBeVisible();
  await page.goBack();
  await expect(search).toHaveValue("NEXT-WB-02");
  await expect(analyze).toHaveAttribute("aria-pressed", "true");
});

test("F4: la bandeja mantiene filtros, foco y posición mientras llega la consulta", async ({
  page,
}) => {
  await login(page, "analyst");
  await page.goto(`/review?projectId=${fixture.project.id}`);
  await expect(page.locator(".review-inbox li").first()).toBeVisible();
  const priority = page.getByLabel("Prioridad", { exact: true });
  const filters = page.getByRole("region", { name: "Filtros de la lista" });
  const expectedLabels = [
    "Estado",
    "Prioridad",
    "Proyecto",
    "Tema",
    "Área responsable",
    "Participante asignado",
  ];
  for (const label of expectedLabels)
    await expect(filters.getByLabel(label, { exact: true })).toBeVisible();
  const previousRows = await page.locator(".review-inbox li").count();
  let release!: () => void;
  let arrived!: () => void;
  const released = new Promise<void>((resolve) => (release = resolve));
  const held = new Promise<void>((resolve) => (arrived = resolve));
  await page.route("**/api/v1/review?**", async (route) => {
    if (new URL(route.request().url()).searchParams.get("priority") !== "P2")
      return route.continue();
    const response = await route.fetch();
    arrived();
    await released;
    await route.fulfill({ response });
  });
  try {
    await priority.focus();
    await page.evaluate(() => window.scrollTo(0, 160));
    const before = await page.evaluate(() => window.scrollY);
    await priority.selectOption("P2");
    await held;
    await expect(
      page.getByRole("region", { name: "Resultados de revisión" }),
    ).toHaveAttribute("aria-busy", "true");
    for (const label of expectedLabels)
      await expect(filters.getByLabel(label, { exact: true })).toBeVisible();
    await expect(priority).toBeFocused();
    expect(await page.evaluate(() => window.scrollY)).toBe(before);
    await expect(page.locator(".review-inbox li")).toHaveCount(previousRows);
    const contrast = await new AxeBuilder({ page })
      .include(".review-results")
      .withRules(["color-contrast"])
      .analyze();
    expect(contrast.violations).toEqual([]);
  } finally {
    release();
  }
  await expect(
    page.getByRole("region", { name: "Resultados de revisión" }),
  ).toHaveAttribute("aria-busy", "false");
  await expect(priority).toHaveValue("P2");
  await expect(priority).toBeFocused();
  await page.unroute("**/api/v1/review?**");
});

test("F4: volver de revisión conserva filtros tras pestaña, recarga y enlace directo", async ({
  page,
  browser,
}) => {
  await login(page, "analyst");
  const params = new URLSearchParams({
    projectId: fixture.project.id,
    status: "CLARIFICATION_REQUIRED",
    priority: "P2",
  });
  const inbox = `/review?${params}`;
  await page.goto(inbox);
  const question = page.locator(".review-inbox h2 a").first();
  await expect(question).toBeVisible();
  expect(
    new URL(
      (await question.getAttribute("href"))!,
      page.url(),
    ).searchParams.get("reviewSearch"),
  ).toBe(params.toString());
  await question.click();
  const back = page.getByRole("link", {
    name: "← Revisar respuestas",
    exact: true,
  });
  await expect(back).toHaveAttribute("href", inbox);
  await page.getByRole("tab", { name: "Historial", exact: true }).click();
  await expect(back).toHaveAttribute("href", inbox);
  await page.reload();
  await expect(
    page.getByRole("tab", { name: "Historial", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await expect(back).toHaveAttribute("href", inbox);
  const direct = page.url();
  await back.click();
  await expect(page.getByLabel("Estado", { exact: true })).toHaveValue(
    "CLARIFICATION_REQUIRED",
  );
  await expect(page.getByLabel("Prioridad", { exact: true })).toHaveValue("P2");
  const context = await browser.newContext({
    storageState: await page.context().storageState(),
  });
  try {
    const external = await context.newPage();
    await external.goto(direct);
    const returnLink = external.getByRole("link", {
      name: "← Revisar respuestas",
      exact: true,
    });
    await expect(returnLink).toHaveAttribute("href", inbox);
    await returnLink.click();
    await expect(external.getByLabel("Proyecto", { exact: true })).toHaveValue(
      fixture.project.id,
    );
    await expect(external.getByLabel("Estado", { exact: true })).toHaveValue(
      "CLARIFICATION_REQUIRED",
    );
    await expect(external.getByLabel("Prioridad", { exact: true })).toHaveValue(
      "P2",
    );
  } finally {
    await context.close();
  }
});
