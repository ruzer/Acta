import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { login } from "./login-helper";
const header =
  "Tema;Código;Pregunta;Texto de ayuda;Tipo;Obligatoria;Área responsable";
async function call(page: Page, path: string, method = "GET", body?: unknown) {
  return page.evaluate(
    async ({ path, method, body }) => {
      const me = await (await fetch("/api/v1/auth/me")).json();
      const response = await fetch("/api/v1" + path, {
        method,
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": me.csrfToken,
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(`${response.status}: ${JSON.stringify(data)}`);
      return data;
    },
    { path, method, body },
  );
}
async function project(page: Page) {
  return call(page, "/projects", "POST", {
    externalId: "CSV-" + randomUUID(),
    name: "Cuestionario ficticio CSV",
    description: "Descripción que se conserva",
  });
}
async function upload(page: Page, csv: string) {
  await page
    .getByLabel("Archivo JSON o CSV")
    .setInputFiles({
      name: "cuestionario.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(csv),
    });
  await page
    .getByRole("button", { name: "Revisar archivo", exact: true })
    .click();
}
test("CSV: errores por fila, revisión sin escrituras, confirmación e integridad literal", async ({
  page,
}) => {
  await login(page, "admin");
  const p = await project(page),
    area = "Equipo ficticio " + randomUUID();
  await page.goto(`/projects/${p.id}/import`);
  await expect(
    page.getByRole("link", { name: "Descargar plantilla CSV" }),
  ).toHaveAttribute("download", "questionnaire-template.csv");
  await upload(
    page,
    header + ";Desconocida\nTema;Q1;Pregunta;;Texto corto;No;" + area,
  );
  await expect(page.getByRole("alert")).toContainText("Fila 1, columna 8");
  expect(
    (await call(page, `/projects/${p.id}/questionnaire`)).questions,
  ).toEqual([]);
  const csv =
    "\ufeff" +
    header +
    `\r\nServicios;REQ-001;=1+1;Ayuda literal;Texto corto;Sí;${area}\r\nOtro;REQ-01;¿Fecha?;;Fecha;No;${area}\r\nServicios;Q3;¿Cuántos?;;Número;No;${area}`;
  await upload(page, csv);
  await expect(
    page.getByRole("heading", { name: "2. Revisar importación" }),
  ).toBeVisible();
  expect(
    (await call(page, `/projects/${p.id}/questionnaire`)).questions,
  ).toEqual([]);
  await expect(
    page.getByRole("button", { name: "Confirmar importación" }),
  ).toBeDisabled();
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  if (process.env.ACTA_CSV_EVIDENCE_DIR) {
    await mkdir(process.env.ACTA_CSV_EVIDENCE_DIR, { recursive: true });
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.screenshot({
        path: `${process.env.ACTA_CSV_EVIDENCE_DIR}/csv-after-${width}.png`,
        fullPage: true,
      });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    }
  }
  await page.getByLabel("Confirmo crear estas áreas en la institución").check();
  await page.getByRole("button", { name: "Confirmar importación" }).click();
  await expect(
    page.getByText("Importación completada: 3 preguntas y 2 temas."),
  ).toBeVisible();
  const q = await call(page, `/projects/${p.id}/questionnaire`);
  expect(q.sections.map((s: { title: string }) => s.title)).toEqual([
    "Servicios",
    "Otro",
  ]);
  expect(
    q.questions.map((q: { externalId: string }) => q.externalId).sort(),
  ).toEqual(["Q3", "REQ-001", "REQ-01"]);
  const first = q.questions.find(
    (q: { externalId: string }) => q.externalId === "REQ-001",
  );
  expect(first).toMatchObject({
    question: "=1+1",
    helpText: "Ayuda literal",
    required: true,
    type: "SHORT_TEXT",
    publication: "DRAFT",
  });
  const projects = await call(page, "/projects");
  expect(
    projects.find((item: { id: string }) => item.id === p.id),
  ).toMatchObject({ name: p.name, description: p.description });
  await page.goto(`/projects/${p.id}/import`);
  await expect(page.getByLabel("Archivo JSON o CSV")).toBeDisabled();
});
test("CSV: Analista reutiliza áreas y no puede crear faltantes", async ({
  page,
  browser,
}) => {
  await login(page, "admin");
  const p = await project(page),
    users = await call(page, "/users"),
    catalog = await call(page, "/areas");
  await call(page, `/projects/${p.id}/members`, "POST", {
    userId: users.find((u: { username: string }) => u.username === "analyst")
      .id,
    role: "ANALYST",
    areaId: null,
    active: true,
  });
  const context = await browser.newContext(),
    analyst = await context.newPage();
  try {
    await login(analyst, "analyst");
    await analyst.goto(`/projects/${p.id}/import`);
    await upload(
      analyst,
      header + `\nTema;Q1;Pregunta;;Sí/No;No;Área inexistente ${randomUUID()}`,
    );
    await expect(
      analyst.getByText(
        /Fila 2, columna Área responsable: Esta área no existe/,
      ),
    ).toBeVisible();
    await expect(
      analyst.getByRole("button", { name: "Confirmar importación" }),
    ).toBeDisabled();
    await upload(
      analyst,
      header +
        `\nTema;Q1;Pregunta;;Sí/No;No;${catalog.find((a: { active: boolean }) => a.active).name}`,
    );
    await expect(
      analyst.getByRole("button", { name: "Confirmar importación" }),
    ).toBeEnabled();
    await analyst
      .getByRole("button", { name: "Confirmar importación" })
      .click();
    await expect(
      analyst.getByText("Importación completada: 1 pregunta y 1 tema."),
    ).toBeVisible();
  } finally {
    await context.close();
  }
});
