import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { login } from "./login-helper";
let projectId: string, largeId: string;
async function call(page: Page, path: string, method = "GET", body?: unknown) {
  return page.evaluate(
    async ({ path, method, body }) => {
      const me = await (await fetch("/api/v1/auth/me")).json();
      const r = await fetch("/api/v1" + path, {
        method,
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": me.csrfToken,
        },
        ...(method === "GET" ? {} : { body: JSON.stringify(body ?? {}) }),
      });
      const data = await r.json();
      if (!r.ok) throw Error(`${r.status}: ${JSON.stringify(data)}`);
      return data;
    },
    { path, method, body },
  );
}
async function axe(page: Page) {
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
}
async function shot(page: Page, name: string) {
  await page.screenshot({
    path: `artifacts/editor-integration/${name}.png`,
    fullPage: true,
  });
}
test.beforeAll(async ({ browser }) => {
  test.setTimeout(180000);
  await mkdir("artifacts/editor-integration", { recursive: true });
  const page = await browser.newPage();
  await login(page, "admin");
  const areas = await call(page, "/areas");
  for (const count of [10, 300]) {
    const project = await call(page, "/projects", "POST", {
      externalId: randomUUID(),
      name: `Editor ficticio ${count}`,
      description: "Prueba efímera de interfaz",
    });
    if (count === 10) projectId = project.id;
    else largeId = project.id;
    const sections = [];
    for (let i = 0; i < (count === 10 ? 2 : 6); i++)
      sections.push(
        await call(page, `/projects/${project.id}/sections`, "POST", {
          externalId: randomUUID(),
          title: `Tema ficticio ${i + 1}`,
          description: "Contexto de prueba",
          order: i,
        }),
      );
    const ids: string[] = [];
    const types = [
      "YES_NO",
      "SINGLE_CHOICE",
      "MULTIPLE_CHOICE",
      "SHORT_TEXT",
      "LONG_TEXT",
      "DATE",
      "NUMBER",
      "MATRIX",
      "YES_NO",
      "YES_NO",
    ];
    for (let i = 0; i < count; i++) {
      const type = count === 10 ? types[i] : "SHORT_TEXT";
      const sectionId = sections[Math.floor(i / (count / sections.length))]!.id;
      const created = await call(
        page,
        `/projects/${project.id}/questions`,
        "POST",
        {
          externalId: `TEST-${i}`,
          sectionId,
          title: `Pregunta ficticia ${i + 1}`,
          question: `¿Cómo funciona el proceso ficticio número ${i + 1}?`,
          helpText: "Describe el proceso de prueba.",
          type,
          required: true,
          priority: "P1",
          responsibleAreaId: areas[0].id,
          order: i,
          groupParentId: count === 10 && i === 9 ? ids[8] : null,
          condition:
            count === 10 && i === 8
              ? { parentQuestionId: ids[0], operator: "EQUALS", value: true }
              : null,
          options: ["SINGLE_CHOICE", "MULTIPLE_CHOICE"].includes(type!)
            ? [
                { value: "A", label: "Alternativa A", order: 1 },
                { value: "B", label: "Alternativa B", order: 2 },
              ]
            : [],
          config:
            type === "MATRIX"
              ? {
                  rows: [{ key: "ROW", label: "Caso ficticio" }],
                  columns: [
                    { key: "YES", label: "Sí" },
                    { key: "NO", label: "No" },
                  ],
                }
              : null,
          references: [],
        },
      );
      ids.push(created.id);
    }
  }
  await page.close();
});
test("editor: Escribir, alta de tema y pregunta contextual sin orden manual", async ({
  page,
}) => {
  await login(page, "admin");
  await page.goto(`/projects/${projectId}/editor`);
  await page.getByRole("tab", { name: "Escribir", exact: true }).click();
  await page
    .getByRole("button", { name: "+ Agregar tema", exact: true })
    .click();
  await page.getByLabel("Nombre", { exact: true }).fill("Tema nuevo ficticio");
  await expect(
    page.getByRole("dialog").getByLabel(/Identificador|Orden/),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Crear tema", exact: true }).click();
  await expect(page.getByText("Tema creado.", { exact: true })).toBeVisible();
  const topic = page.getByRole("region", {
    name: "Tema nuevo ficticio",
    exact: true,
  });
  await topic.getByRole("button", { name: "+ Agregar pregunta" }).click();
  await expect(page.getByLabel("Tema al que pertenece")).toContainText(
    "Tema nuevo ficticio",
  );
  await page
    .getByLabel("Pregunta", { exact: true })
    .fill("¿Se registra el proceso ficticio?");
  await page.getByLabel("Título breve").fill("Alta ficticia");
  await page
    .getByLabel("Identificador externo", { exact: true })
    .fill(randomUUID());
  await page.getByRole("radio", { name: "Sí o no", exact: true }).check();
  await shot(page, "pregunta-basica");
  await axe(page);
  await page.getByText("Configuración avanzada", { exact: true }).click();
  await shot(page, "pregunta-avanzada");
  await expect(page.getByLabel("Posición en la sección")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Crear pregunta", exact: true })
    .click();
  await expect(
    topic.getByText("¿Se registra el proceso ficticio?", { exact: true }),
  ).toBeVisible();
});
test("editor: galería responsive, tabs, inspector único, MATRIX y condiciones", async ({
  page,
}) => {
  await login(page, "admin");
  await page.goto(`/projects/${projectId}/editor`);
  for (const width of [1440, 1024, 768, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.getByRole("tab", { name: "Escribir", exact: true }).click();
    await shot(page, `escribir-${width}`);
    await axe(page);
    await page.getByRole("tab", { name: "Organizar", exact: true }).click();
    await shot(page, `organizar-${width}`);
    await axe(page);
    await page
      .getByRole("button", {
        name: /¿Cómo funciona el proceso ficticio número 8/,
      })
      .click();
    await expect(
      page.getByRole(width >= 1280 ? "complementary" : "dialog", {
        name: "Detalle de pregunta",
      }),
    ).toHaveCount(1);
    await shot(page, `inspector-${width}`);
    await axe(page);
    await page.getByRole("button", { name: "Cerrar detalle" }).click();
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole("tab", { name: "Escribir" }).focus();
  await page.keyboard.press("End");
  await expect(page.getByRole("tab", { name: "Revisar" })).toBeFocused();
  await page.keyboard.press("Home");
  await expect(page.getByRole("tab", { name: "Escribir" })).toBeFocused();
  for (const [title, name] of [
    ["Pregunta ficticia 8", "matriz"],
    ["Pregunta ficticia 9", "condicion"],
  ]) {
    const row = page.getByRole("article", { name: title, exact: true });
    await row.getByLabel("Acciones de " + title, { exact: true }).click();
    await row
      .getByRole("button", { name: "Editar pregunta", exact: true })
      .click();
    if (name === "condicion")
      await page.getByText("Configuración avanzada", { exact: true }).click();
    await shot(page, "pregunta-" + name);
    await axe(page);
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Cancelar", exact: true })
      .click();
  }
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.getByRole("tab", { name: "Organizar" }).click();
  await page
    .getByRole("button", {
      name: /¿Cómo funciona el proceso ficticio número 1\?/,
    })
    .click();
  expect(
    await page
      .locator(".qe-inspector")
      .evaluate((el) => getComputedStyle(el).animationName),
  ).toBe("none");
});
test("editor: Revisar distingue alcance conjunto y publicación individual conserva dependencias", async ({
  page,
}) => {
  await login(page, "admin");
  await page.goto(`/projects/${projectId}/editor`);
  await page.getByRole("tab", { name: "Revisar" }).click();
  await expect(
    page.getByRole("heading", { name: /Advertencias · revisa/ }),
  ).toBeVisible();
  await shot(page, "revisar-con-problemas");
  await axe(page);
  const issue = page
    .getByRole("article")
    .filter({ hasText: "¿Cómo funciona el proceso ficticio número 9?" })
    .filter({ hasText: "Para publicarla por separado" });
  await expect(
    issue.getByRole("button", { name: "Revisar publicación conjunta" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: "Publicar: Pregunta ficticia 9",
      exact: true,
    }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Publicar: Pregunta ficticia 1", exact: true })
    .click();
  await expect(
    page
      .getByRole("dialog")
      .getByRole("heading", { name: "Pregunta ficticia 1", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Confirmar publicación" }).click();
  await expect(
    page.getByText("Pregunta publicada. Su contenido quedó protegido."),
  ).toBeVisible();
});
test("editor: preview no escribe respuestas y simula condición y matriz", async ({
  page,
}) => {
  await login(page, "admin");
  await page.goto(`/projects/${projectId}/editor`);
  const writes: string[] = [];
  page.on("request", (r) => {
    if (r.url().includes("/api/") && !["GET", "HEAD"].includes(r.method()))
      writes.push(r.url());
  });
  await page.getByRole("button", { name: "Vista previa", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Vista previa", exact: true }),
  ).toBeVisible();
  await page.getByRole("radio", { name: "Sí", exact: true }).check();
  await page
    .getByRole("button", { name: "Aplicar valor a la simulación" })
    .click();
  await page
    .getByLabel("Pregunta de la vista previa")
    .selectOption({ label: "9. Pregunta ficticia 9" });
  await expect(
    page.getByRole("radio", { name: "Sí", exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("Pregunta de la vista previa")
    .selectOption({ label: "8. Pregunta ficticia 8" });
  await expect(page.getByLabel("Caso ficticio")).toBeVisible();
  await shot(page, "vista-previa");
  await axe(page);
  await page.getByRole("button", { name: "Volver al cuestionario" }).click();
  expect(writes).toEqual([]);
});
test("editor: 300 preguntas reales, búsqueda y paginación limitada", async ({
  page,
}) => {
  await login(page, "admin");
  const start = performance.now();
  await page.goto(`/projects/${largeId}/editor`);
  await page.getByRole("tab", { name: "Organizar", exact: true }).click();
  await expect(
    page.getByText("300 preguntas encontradas", { exact: false }),
  ).toBeVisible();
  const loaded = performance.now() - start;
  await expect(page.locator(".qe-compact-row")).toHaveCount(40);
  const searchStart = performance.now();
  await page
    .getByLabel("Buscar preguntas")
    .fill("proceso ficticio número 300?");
  await expect(page.locator(".qe-compact-row")).toHaveCount(1);
  const search = performance.now() - searchStart;
  await page.locator(".qe-compact-row").click();
  await expect(
    page.getByRole("complementary", { name: "Detalle de pregunta" }),
  ).toBeVisible();
  await shot(page, "escala-300");
  await axe(page);
  await writeFile(
    "artifacts/editor-integration/performance.json",
    JSON.stringify({
      questions: 300,
      maximumRenderedRows: 40,
      loadAndSwitchMs: loaded,
      searchMs: search,
    }),
  );
});
test("editor: revisión vacía sin incidencias y error avanzado conserva foco y contenido", async ({
  page,
}) => {
  await login(page, "admin");
  const p = await call(page, "/projects", "POST", {
    externalId: randomUUID(),
    name: "Preparación ficticia vacía",
    description: "",
  });
  await page.goto(`/projects/${p.id}/editor`);
  await page.getByRole("tab", { name: "Revisar" }).click();
  await expect(
    page.getByRole("heading", { name: "Sin incidencias detectadas." }),
  ).toBeVisible();
  await shot(page, "revisar-sin-problemas");
  await axe(page);
  await page.goto(`/projects/${projectId}/editor`);
  await page.getByRole("tab", { name: "Escribir", exact: true }).click();
  await page
    .getByRole("button", { name: "+ Agregar pregunta", exact: true })
    .first()
    .click();
  await page
    .getByLabel("Pregunta", { exact: true })
    .fill("¿Se conserva el borrador del formulario?");
  await page.getByLabel("Título breve").fill("Error ficticio");
  await page
    .getByLabel("Identificador externo", { exact: true })
    .fill(randomUUID());
  await page.route(`**/api/v1/projects/${projectId}/questions`, (route) =>
    route.fulfill({
      status: 400,
      json: {
        code: "VALIDATION_ERROR",
        message: "Selecciona un área responsable válida.",
        requestId: "ui-error-fixture",
        fieldErrors: {
          responsibleAreaId: "Selecciona un área responsable válida.",
        },
      },
    }),
  );
  await page
    .getByRole("button", { name: "Crear pregunta", exact: true })
    .click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Revisa los campos indicados." }),
  ).toBeVisible();
  await expect(
    page.getByLabel("Área responsable", { exact: true }),
  ).toBeFocused();
  await expect(page.getByLabel("Pregunta", { exact: true })).toHaveValue(
    "¿Se conserva el borrador del formulario?",
  );
  await shot(page, "error-configuracion-avanzada");
  await axe(page);
});

test("editor: editar tema, cancelar, conflicto real conserva contenido y teclado a 390px", async ({
  page,
}) => {
  await login(page, "admin");
  await page.setViewportSize({ width: 390, height: 1000 });
  await page.goto(`/projects/${largeId}/editor`);
  await page.getByRole("tab", { name: "Escribir", exact: true }).click();
  const trigger = page.getByLabel("Acciones del tema Tema ficticio 1", {
    exact: true,
  });
  await trigger.focus();
  await page.keyboard.press("Enter");
  await page.getByRole("button", { name: "Editar tema", exact: true }).click();
  await page.getByLabel("Nombre", { exact: true }).fill("No guardar");
  await page.getByRole("button", { name: "Cancelar", exact: true }).click();
  await expect(trigger).toBeFocused();
  await trigger.click();
  await page.getByRole("button", { name: "Editar tema", exact: true }).click();
  await expect(page.getByLabel("Nombre", { exact: true })).toHaveValue(
    "Tema ficticio 1",
  );
  await page
    .getByLabel("Nombre", { exact: true })
    .fill("Tema editado ficticio");
  await page.getByLabel("Descripción (opcional)").fill("Descripción editada");
  await page.getByRole("button", { name: "Guardar tema", exact: true }).click();
  await expect(page.getByText("Tema guardado.", { exact: true })).toBeVisible();
  const snapshot = await call(page, `/projects/${largeId}/questionnaire`);
  const topic = snapshot.sections.find(
    (s: { title: string }) => s.title === "Tema editado ficticio",
  );
  await page
    .getByLabel("Acciones del tema Tema editado ficticio", { exact: true })
    .click();
  await page.getByRole("button", { name: "Editar tema", exact: true }).click();
  await page.getByLabel("Nombre", { exact: true }).fill("Mi edición en curso");
  await call(page, `/projects/${largeId}/sections/${topic.id}/draft`, "PUT", {
    title: "Cambio concurrente",
    description: "Otro analista",
    expectedVersion: snapshot.structureVersion,
  });
  await page.getByRole("button", { name: "Guardar tema", exact: true }).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "El cuestionario cambió",
  );
  await expect(page.getByLabel("Nombre", { exact: true })).toHaveValue(
    "Mi edición en curso",
  );
  await shot(page, "extension-tema-conflicto-390");
  await axe(page);
  await page.getByRole("button", { name: "Cancelar", exact: true }).click();
});

test("editor: reorder temas/preguntas y traslado de 300 preguntas usa una petición por acción", async ({
  page,
}) => {
  await login(page, "admin");
  await page.goto(`/projects/${largeId}/editor`);
  await page.getByRole("tab", { name: "Escribir", exact: true }).click();
  let snapshot = await call(page, `/projects/${largeId}/questionnaire`);
  const topic = snapshot.sections[0],
    second = snapshot.sections[1];
  const requests: string[] = [];
  page.on("request", (r) => {
    if (r.method() === "POST" && r.url().endsWith("/reorder"))
      requests.push(r.url());
  });
  const region = page.getByRole("region", { name: topic.title, exact: true });
  await region
    .getByLabel("Acciones del tema " + topic.title, { exact: true })
    .click();
  await region
    .getByRole("button", { name: "Mover abajo", exact: true })
    .click();
  await expect(
    page.getByText("Orden de temas guardado.", { exact: true }),
  ).toBeVisible();
  expect(requests).toHaveLength(1);
  snapshot = await call(page, `/projects/${largeId}/questionnaire`);
  expect(snapshot.sections[1].id).toBe(topic.id);
  const question = snapshot.questions.filter(
    (q: { sectionId: string }) => q.sectionId === topic.id,
  )[0];
  const row = page.getByRole("article", { name: question.title, exact: true });
  await row
    .getByLabel("Acciones de " + question.title, { exact: true })
    .click();
  await row.getByRole("button", { name: "Mover abajo", exact: true }).click();
  await expect(
    page.getByText("Orden de preguntas guardado.", { exact: true }),
  ).toBeVisible();
  expect(requests).toHaveLength(2);
  snapshot = await call(page, `/projects/${largeId}/questionnaire`);
  expect(
    snapshot.questions.filter(
      (q: { sectionId: string }) => q.sectionId === topic.id,
    )[1].id,
  ).toBe(question.id);
  await page.setViewportSize({ width: 390, height: 1000 });
  await row
    .getByLabel("Acciones de " + question.title, { exact: true })
    .click();
  await row
    .getByRole("button", { name: "Mover a otro tema", exact: true })
    .click();
  await page.getByLabel("Tema de destino").selectOption(second.id);
  await shot(page, "extension-mover-390");
  await axe(page);
  await page
    .getByRole("button", { name: "Mover pregunta", exact: true })
    .click();
  await expect(
    page.getByText(
      "Pregunta movida. Se guardaron los órdenes de ambos temas.",
      { exact: true },
    ),
  ).toBeVisible();
  expect(requests).toHaveLength(3);
  snapshot = await call(page, `/projects/${largeId}/questionnaire`);
  expect(snapshot.questions).toHaveLength(300);
  const moved = snapshot.questions.find(
    (q: { id: string }) => q.id === question.id,
  );
  expect(moved.sectionId).toBe(second.id);
  expect(moved.externalId).toBe(question.externalId);
  expect(moved.revisionNumber).toBe(question.revisionNumber);
  await page.getByRole("tab", { name: "Organizar", exact: true }).click();
  await expect(page.locator(".qe-compact-row")).toHaveCount(40);
  await page.getByLabel("Buscar preguntas").fill(question.question);
  await expect(page.locator(".qe-compact-row")).toHaveCount(1);
  await axe(page);
  await shot(page, "extension-300-390");
  await writeFile(
    "artifacts/editor-integration/reorder-300.json",
    JSON.stringify({
      questions: 300,
      actions: 3,
      reorderRequests: requests.length,
      maximumRenderedRows: 40,
    }),
  );
});
