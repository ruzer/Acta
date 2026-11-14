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
  await page.getByLabel("Archivo CSV o JSON").setInputFiles({
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
  if (process.env.ACTA_CSV_EVIDENCE_DIR) {
    await mkdir(process.env.ACTA_CSV_EVIDENCE_DIR, { recursive: true });
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.screenshot({
        path: `${process.env.ACTA_CSV_EVIDENCE_DIR}/importar-${width}.png`,
        fullPage: true,
      });
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
  }
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
  await expect(page.getByLabel("Archivo CSV o JSON")).toBeDisabled();
});
test("CSV: normaliza temas y catálogo, admite título y conserva filas físicas sin duplicar", async ({
  page,
}) => {
  await login(page, "admin");
  const p = await project(page);
  const area = await call(page, "/areas", "POST", {
    code: "CSV-" + randomUUID(),
    name: "Área de Atención " + randomUUID(),
  });
  const normalizedArea =
    "  " +
    area.name
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replaceAll(" ", "   ") +
    " ";
  await page.goto(`/projects/${p.id}/import`);
  await upload(page, "\n" + header + ";Título\n;;;;;;;\nTema;Q1");
  await expect(page.getByRole("alert")).toContainText(
    "Fila 4, columna Pregunta",
  );
  await upload(
    page,
    "\n" +
      header +
      ";Título\n;;;;;;;\n" +
      ` Atención   general ; Q-01 ; ¿Cómo se recibe? ; Ayuda ;Texto corto;Sí;${normalizedArea}; Recepción \n\n` +
      `atencion GENERAL;Q-02;"¿Quién registra?\nExplica el proceso.";;Texto largo;No;${area.name};\n;;;;;;;\n`,
  );
  await expect(
    page.getByRole("button", { name: "Confirmar importación" }),
  ).toBeEnabled();
  await expect(
    page.getByLabel("Confirmo crear estas áreas en la institución"),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Confirmar importación" }).click();
  await expect(
    page.getByText("Importación completada: 2 preguntas y 1 tema."),
  ).toBeVisible();
  const data = await call(page, `/projects/${p.id}/questionnaire`);
  expect(data.sections.map((s: { title: string }) => s.title)).toEqual([
    "Atención general",
  ]);
  expect(
    data.questions.map(
      (q: {
        externalId: string;
        title: string;
        question: string;
        responsibleAreaId: string;
        publication: string;
      }) => ({
        externalId: q.externalId,
        title: q.title,
        question: q.question,
        areaId: q.responsibleAreaId,
        publication: q.publication,
      }),
    ),
  ).toEqual([
    {
      externalId: "Q-01",
      title: "Recepción",
      question: "¿Cómo se recibe?",
      areaId: area.id,
      publication: "DRAFT",
    },
    {
      externalId: "Q-02",
      title: "¿Quién registra?…",
      question: "¿Quién registra?\nExplica el proceso.",
      areaId: area.id,
      publication: "DRAFT",
    },
  ]);
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

test("CSV primero, columnas explicadas y JSON avanzado accesible con teclado", async ({
  page,
}) => {
  await login(page, "admin");
  const p = await project(page);
  await page.goto(`/projects/${p.id}/import`);
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    const guide = page.getByRole("region", {
      name: "Preparar tu cuestionario",
    });
    await expect(guide.getByRole("listitem")).toHaveCount(3);
    await expect(
      guide.getByRole("link", { name: "Descargar plantilla CSV" }),
    ).toBeVisible();
    const summary = page
      .locator("summary")
      .filter({ hasText: "Avanzado: importar con JSON" });
    await expect(summary.locator("..")).not.toHaveAttribute("open", "");
    await expect(
      page.getByText("project.externalId", { exact: true }),
    ).toBeHidden();
    await expect(
      page.getByRole("link", { name: "Descargar ejemplo mínimo" }),
    ).toBeHidden();
    await expect(page.getByLabel("Archivo CSV o JSON")).toBeVisible();
    await summary.focus();
    await page.keyboard.press("Enter");
    await expect(
      page.getByText("project.externalId", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Descargar ejemplo mínimo" }),
    ).toBeVisible();
    await summary.focus();
    await page.keyboard.press("Enter");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  }
});
