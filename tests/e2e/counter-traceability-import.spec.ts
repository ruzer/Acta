import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { login } from "./login-helper";

test.use({ actionTimeout: 15000 });

test("el avance distingue las preguntas que aún dependen de respuestas", async ({
  page,
}) => {
  await login(page, "stakeholder");
  const projects = await page.evaluate(() =>
    fetch("/api/v1/projects").then((r) => r.json()),
  );
  const id = projects.find(
    (p: { externalId: string }) => p.externalId === "DEMO-PRINCIPAL",
  ).id;
  const data = await page.evaluate(
    (id) => fetch(`/api/v1/projects/${id}/my-work`).then((r) => r.json()),
    id,
  );
  expect(data.progress.undetermined).toBe(1);
  const all = await page.evaluate(
    async (ids: string[]) =>
      Promise.all(
        ids.map((id) =>
          fetch(`/api/v1/projects/${id}/my-work`).then((r) => r.json()),
        ),
      ),
    projects.map((p: { id: string }) => p.id),
  );
  const home = all.reduce(
    (sum, project) => ({
      sent: sum.sent + project.progress.sent,
      enabled: sum.enabled + project.progress.enabled,
      undetermined: sum.undetermined + project.progress.undetermined,
    }),
    { sent: 0, enabled: 0, undetermined: 0 },
  );
  for (const path of ["/", `/projects/${id}/work`]) {
    const progress = path === "/" ? home : data.progress;
    await page.goto(path);
    const summary = page.getByRole("region", { name: "Resumen de Mi trabajo" });
    await expect(
      summary.getByText(
        progress.undetermined === 1
          ? "1 pregunta adicional depende de tus respuestas."
          : `${progress.undetermined} preguntas adicionales dependen de tus respuestas.`,
        {
          exact: true,
        },
      ),
    ).toBeVisible();
    await expect(
      summary.getByText(
        `${progress.sent} de ${progress.enabled} preguntas enviadas`,
        { exact: true },
      ),
    ).toBeVisible();
  }
  await page.locator('a[href*="/respond/"]').first().click();
  await expect(page.locator("main h1")).toBeVisible();
  await expect(page.getByText(/no es el número de envíos/)).toHaveCount(0);
  await expect(page.locator(".participant-header-context")).toHaveText(
    `Pregunta 1 de ${data.progress.enabled}`,
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    page
      .locator("main")
      .getByText(`Pregunta 1 de ${data.progress.enabled}`, { exact: true }),
  ).toBeVisible();
});

test("trazabilidad presenta etiquetas y cifras legibles", async ({ page }) => {
  await login(page, "admin");
  const projects = await page.evaluate(() =>
    fetch("/api/v1/projects").then((r) => r.json()),
  );
  const id = projects.find(
    (p: { externalId: string }) => p.externalId === "DEMO-PRINCIPAL",
  ).id;
  await page.goto(`/projects/${id}/traceability`);
  await expect(page.getByText("Requerimiento", { exact: true })).toBeVisible();
  await expect(page.getByText("REQUIREMENT", { exact: true })).toHaveCount(0);
  const facts = page.locator("dl.ac-facts");
  for (const [label, value] of [
    ["Preguntas publicadas con referencias", "1"],
    ["Sin referencias", "7"],
    ["Referencias relacionadas", "1"],
  ]) {
    await expect(
      facts
        .locator("div")
        .filter({ has: page.locator("dt", { hasText: label }) })
        .locator("dd"),
    ).toHaveText(value!);
  }
});

test("importación avisa antes de subir y el servidor sigue rechazando estructura existente", async ({
  page,
}) => {
  await login(page, "admin");
  const projects = await page.evaluate(() =>
    fetch("/api/v1/projects").then((r) => r.json()),
  );
  const full = projects.find(
    (p: { externalId: string }) => p.externalId === "DEMO-PRINCIPAL",
  );
  const empty = projects.find(
    (p: { externalId: string }) => p.externalId === "DEMO-SECUNDARIO",
  );
  await page.goto(`/projects/${full.id}/import`);
  await expect(
    page.getByText(
      "Este proyecto ya contiene estructura. La importación requiere un proyecto vacío.",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Ir al cuestionario", exact: true }),
  ).toHaveAttribute("href", `/projects/${full.id}/editor`);
  await expect(page.getByLabel("Archivo JSON o CSV")).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Revisar archivo", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("link", { name: "Descargar ejemplo mínimo" }),
  ).toBeVisible();
  const template = JSON.parse(
    await readFile("examples/questionnaire-template.minimal.json", "utf8"),
  );
  template.project.externalId = full.externalId;
  const rejection = await page.evaluate(
    async ({ id, template }) => {
      const me = await (await fetch("/api/v1/auth/me")).json();
      const response = await fetch(`/api/v1/projects/${id}/imports/preview`, {
        method: "POST",
        headers: {
          "X-CSRF-Token": me.csrfToken,
          "Content-Type": "application/octet-stream",
        },
        body: JSON.stringify(template),
      });
      return { status: response.status, data: await response.json() };
    },
    { id: full.id, template },
  );
  expect(rejection.status).toBe(201);
  expect(rejection.data.canConfirm).toBe(false);
  expect(rejection.data.errors).toContainEqual({
    path: "/project",
    message:
      "El proyecto ya contiene estructura. La importación requiere un proyecto vacío.",
  });
  await page.goto(`/projects/${empty.id}/import`);
  await expect(page.getByLabel("Archivo JSON o CSV")).toBeEnabled();
  template.project.externalId = empty.externalId;
  await page.getByLabel("Archivo JSON o CSV").setInputFiles({
    name: "example.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(template)),
  });
  await page
    .getByRole("button", { name: "Revisar archivo", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "2. Revisar importación" }),
  ).toBeVisible();
  await expect(
    page.getByText(
      "Este proyecto ya contiene estructura. La importación requiere un proyecto vacío.",
      { exact: true },
    ),
  ).toHaveCount(0);
});
