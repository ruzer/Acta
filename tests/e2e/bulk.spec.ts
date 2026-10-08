import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import type { QuestionnaireView } from "@requirements/contracts";
import { login } from "./login-helper";
let projectId: string, sourceAreaId: string, targetAreaId: string;
async function call(page: Page, path: string, body?: unknown) {
  return page.evaluate(
    async ({ path, body }) => {
      const me = await (await fetch("/api/v1/auth/me")).json();
      const r = await fetch("/api/v1" + path, {
        method: body ? "POST" : "GET",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": me.csrfToken,
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      const data = await r.json();
      if (!r.ok) throw Error(`${r.status}: ${JSON.stringify(data)}`);
      return data;
    },
    { path, body },
  );
}
const structure = (page: Page): Promise<QuestionnaireView> =>
  call(page, `/projects/${projectId}/questionnaire`);
async function organize(page: Page) {
  await page.goto(`/projects/${projectId}/editor`);
  await page.getByRole("tab", { name: "Organizar", exact: true }).click();
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
test.beforeAll(async ({ browser }) => {
  test.setTimeout(120000);
  const page = await browser.newPage();
  await login(page, "admin");
  const suffix = randomUUID(),
    code = "BULK-" + suffix;
  const project = await call(page, "/projects", {
    externalId: code,
    name: "Cuestionario de operaciones compartidas",
    description: "Datos ficticios para pruebas de escala",
  });
  projectId = project.id;
  const source = await call(page, "/areas", {
      code: "SRC-" + suffix,
      name: "Equipo de entrada de ejemplo",
    }),
    target = await call(page, "/areas", {
      code: "DST-" + suffix,
      name: "Equipo de destino de ejemplo",
    });
  sourceAreaId = source.id;
  targetAreaId = target.id;
  const file = {
    formatVersion: "1.0",
    kind: "questionnaire-template",
    project: { externalId: code, name: project.name },
    areas: [{ code: source.code, name: source.name }],
    sections: [
      { externalId: "TOPIC", title: "Servicios de ejemplo", order: 0 },
    ],
    questions: Array.from({ length: 304 }, (_, i) => ({
      externalId: `BULK-${i}`,
      sectionExternalId: "TOPIC",
      title: `Consulta ${i}`,
      question: `¿Cómo se atiende la solicitud de ejemplo ${i}?`,
      type: "YES_NO",
      required: true,
      priority: "P2",
      responsibleAreaCode: source.code,
      order: i,
      options: [],
      references: [],
      ...(i === 303 ? { groupParentExternalId: "BULK-0" } : {}),
    })),
    conditions: [],
    traceabilityReferences: [],
  };
  await page.evaluate(
    async ({ projectId, file }) => {
      const me = await (await fetch("/api/v1/auth/me")).json();
      const headers = {
        "Content-Type": "application/octet-stream",
        "X-CSRF-Token": me.csrfToken,
      };
      const p = await fetch(`/api/v1/projects/${projectId}/imports/preview`, {
          method: "POST",
          headers,
          body: JSON.stringify(file),
        }),
        preview = await p.json();
      if (!p.ok || preview.errors.length) throw Error(JSON.stringify(preview));
      const command = {
        payloadHash: preview.payloadHash,
        expectedProjectVersion: preview.expectedProjectVersion,
        requestId: crypto.randomUUID(),
        createMissingAreas: false,
      };
      const r = await fetch(`/api/v1/projects/${projectId}/imports/confirm`, {
        method: "POST",
        headers: {
          ...headers,
          "X-Import-Command": encodeURIComponent(JSON.stringify(command)),
        },
        body: JSON.stringify(file),
      });
      if (!r.ok) throw Error(await r.text());
    },
    { projectId, file },
  );
  const users = await call(page, "/users");
  for (const username of ["analyst", "stakeholder"])
    await call(page, `/projects/${projectId}/members`, {
      userId: users.find((u: { username: string }) => u.username === username)
        .id,
      role: username === "analyst" ? "ANALYST" : "STAKEHOLDER",
      areaId: source.id,
      active: true,
    });
  await mkdir("artifacts/bulk-questionnaire", { recursive: true });
  await page.close();
});
test("304 questions: area filter → all results → area; group → participants → atomic publication", async ({
  page,
}) => {
  test.setTimeout(120000);
  await login(page, "analyst");
  await organize(page);
  await page.getByText("Seleccionar preguntas", { exact: true }).click();
  await page
    .getByLabel("Área responsable", { exact: true })
    .selectOption(sourceAreaId);
  await page.getByLabel("Estado de publicación").selectOption("DRAFT");
  await expect(
    page.getByRole("checkbox", { name: /Seleccionar pregunta:/ }),
  ).toHaveCount(40);
  await page
    .getByRole("button", { name: "Seleccionar todos los resultados (304)" })
    .click();
  await expect(
    page.getByText("304 preguntas seleccionadas", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Página siguiente" }).click();
  await expect(
    page.getByRole("checkbox", { name: /Seleccionar pregunta:/ }).first(),
  ).toBeChecked();
  await page.getByRole("button", { name: "Asignar área", exact: true }).click();
  await page
    .getByLabel("Área origen", { exact: true })
    .selectOption(sourceAreaId);
  await page.getByLabel("Nueva área responsable").selectOption(targetAreaId);
  await page.getByRole("button", { name: "Revisar lote" }).click();
  await expect(
    page.getByRole("heading", { name: "Revisión del lote" }),
  ).toBeFocused();
  for (const width of [1440, 1024, 768, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    await axe(page);
    await page.screenshot({
      path: `artifacts/bulk-questionnaire/area-preview-${width}.png`,
      fullPage: false,
    });
  }
  await page.getByRole("button", { name: "Confirmar 304 preguntas" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  let data = await structure(page);
  expect(
    data.questions.every((q) => q.responsibleAreaId === targetAreaId),
  ).toBe(true);
  await page.getByRole("button", { name: "Filtros", exact: true }).click();
  await page
    .getByLabel("Área responsable", { exact: true })
    .selectOption(targetAreaId);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page
    .getByRole("button", {
      name: /¿Cómo se atiende la solicitud de ejemplo 0\?/,
    })
    .click();
  await expect(page.getByText(/Se seleccionarán 2 preguntas/)).toBeVisible();
  await page
    .getByRole("button", { name: "Seleccionar grupo completo" })
    .click();
  await expect(
    page.getByText("2 preguntas seleccionadas", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Agregar participantes", exact: true })
    .click();
  await page.getByRole("checkbox", { name: /Participante demo/ }).check();
  await page.getByLabel("Las nuevas asignaciones serán").selectOption("yes");
  await page.getByRole("button", { name: "Revisar lote" }).click();
  await expect(page.getByText(/2 asignaciones nuevas/)).toBeVisible();
  await page.getByRole("button", { name: "Confirmar 2 preguntas" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  data = await structure(page);
  expect(
    data.questions.filter((q) => q.assignments.some((a) => a.active)),
  ).toHaveLength(2);
  await page
    .getByRole("button", { name: "Seleccionar todos los resultados (304)" })
    .click();
  await page.getByRole("button", { name: "Publicar seleccionadas" }).click();
  await page.getByRole("button", { name: "Revisar lote" }).click();
  await expect(
    page.getByRole("heading", { name: "Revisión del lote" }),
  ).toBeFocused();
  await axe(page);
  await page.screenshot({
    path: "artifacts/bulk-questionnaire/publish-preview.png",
    fullPage: false,
  });
  await page.getByRole("button", { name: "Confirmar 304 preguntas" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  data = await structure(page);
  expect(data.questions.every((q) => q.publication === "PUBLISHED")).toBe(true);
  expect(
    data.questions.find((q) => q.externalId === "BULK-303")!.groupParentId,
  ).toBe(data.questions.find((q) => q.externalId === "BULK-0")!.id);
});
test("stale confirmation shows an error and applies no partial area changes; reload requires another preview", async ({
  page,
}) => {
  await login(page, "analyst");
  await organize(page);
  await page.getByText("Seleccionar preguntas", { exact: true }).click();
  await page
    .getByRole("button", { name: "Seleccionar esta página (40)" })
    .click();
  await page.getByRole("button", { name: "Asignar área", exact: true }).click();
  await page
    .getByRole("radio", { name: "Cambiar las 40 seleccionadas" })
    .check();
  await page.getByLabel("Nueva área responsable").selectOption(sourceAreaId);
  await page.getByRole("button", { name: "Revisar lote" }).click();
  await expect(
    page.getByRole("heading", { name: "Revisión del lote" }),
  ).toBeFocused();
  const before = await structure(page),
    q = before.questions[0]!;
  await call(page, `/projects/${projectId}/questions/${q.id}/metadata`, {
    responsibleAreaId: q.responsibleAreaId,
    priority: q.priority === "P0" ? "P1" : "P0",
    order: q.order,
    expectedVersion: q.lockVersion,
  });
  await page.getByRole("button", { name: "Confirmar 40 preguntas" }).click();
  await expect(page.getByRole("alert")).toContainText("El cuestionario cambió");
  expect(
    (await structure(page)).questions.map((q) => q.responsibleAreaId),
  ).toEqual(before.questions.map((q) => q.responsibleAreaId));
  await expect(
    page.getByRole("button", { name: "Confirmar 40 preguntas" }),
  ).toBeDisabled();
  await page.screenshot({
    path: "artifacts/bulk-questionnaire/stale-error.png",
    fullPage: false,
  });
  await page
    .getByRole("button", { name: "Actualizar y revisar nuevamente" })
    .click();
  await expect(
    page.getByRole("button", { name: "Confirmar 40 preguntas" }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Cancelar", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Asignar área", exact: true }),
  ).toBeFocused();
});
test("responsive selection, keyboard, reduced motion and cancel retain individual inspector", async ({
  page,
}) => {
  await login(page, "analyst");
  await organize(page);
  await page.getByText("Seleccionar preguntas", { exact: true }).click();
  for (const width of [1440, 1024, 768, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    const checkbox = page
      .getByRole("checkbox", { name: /Seleccionar pregunta:/ })
      .first();
    await checkbox.focus();
    await page.keyboard.press("Space");
    await expect(checkbox).toBeChecked();
    await axe(page);
    await page.screenshot({
      path: `artifacts/bulk-questionnaire/organize-${width}.png`,
      fullPage: false,
    });
    await page
      .getByRole("button", { name: "Agregar participantes", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toHaveCount(1);
    await axe(page);
    await page.keyboard.press("Escape");
    await expect(
      page.getByRole("button", { name: "Agregar participantes", exact: true }),
    ).toBeFocused();
    await page.getByRole("button", { name: "Limpiar selección" }).click();
  }
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page
    .getByRole("button", {
      name: /¿Cómo se atiende la solicitud de ejemplo 0\?/,
    })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Detalle de pregunta" }),
  ).toHaveCount(1);
  await page.getByRole("button", { name: "Cerrar detalle" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
