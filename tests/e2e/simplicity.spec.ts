import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { randomUUID } from "node:crypto";
import { login } from "./login-helper";
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

async function fixture(page: Page, count: number) {
  await login(page, "admin");
  const suffix = randomUUID(),
    code = "BULK-" + suffix;
  const project = await call(page, "/projects", {
    externalId: code,
    name: "Cuestionario de operaciones compartidas",
    description: "Datos ficticios para pruebas de escala",
  });
  const projectId = project.id;
  const source = await call(page, "/areas", {
      code: "SRC-" + suffix,
      name: "Equipo de entrada de ejemplo",
    }),
    target = await call(page, "/areas", {
      code: "DST-" + suffix,
      name: "Equipo de destino de ejemplo",
    });
  void target;
  const file = {
    formatVersion: "1.0",
    kind: "questionnaire-template",
    project: { externalId: code, name: project.name },
    areas: [{ code: source.code, name: source.name }],
    sections: [
      { externalId: "TOPIC", title: "Servicios de ejemplo", order: 0 },
    ],
    questions: Array.from({ length: count }, (_, i) => ({
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
      ...(i === count - 1 ? { groupParentExternalId: "BULK-0" } : {}),
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
  return projectId;
}

for (const count of [50, 300])
  test(`simplicity: analyst ${count} reviews dependencies and publishes together`, async ({
    page,
  }) => {
    test.setTimeout(120000);
    const id = await fixture(page, count);
    await page.goto(`/projects/${id}/editor`);
    await page
      .getByRole("tab", { name: "Revisar publicación", exact: true })
      .click();
    await expect(page.getByText(/Para publicarla por separado/)).toBeVisible();
    await expect(
      page.getByRole("button", {
        name: `Publicar: Consulta ${count - 1}`,
        exact: true,
      }),
    ).toBeDisabled();
    await page
      .getByRole("button", { name: "Revisar publicación conjunta" })
      .click();
    await expect(
      page.getByRole("tab", { name: "Organizar", exact: true }),
    ).toBeFocused();
    await expect(
      page.getByRole("group", { name: "Alcance de selección" }),
    ).toBeVisible();
    await page
      .getByRole("button", {
        name: `Seleccionar todos los resultados (${count})`,
      })
      .click();
    await page
      .getByRole("button", { name: "Agregar participantes", exact: true })
      .click();
    await page.getByRole("checkbox", { name: /Participante demo/ }).check();
    await page.getByLabel("Las nuevas asignaciones serán").selectOption("yes");
    await page.getByRole("button", { name: "Revisar lote" }).click();
    await page
      .getByRole("button", { name: `Confirmar ${count} preguntas` })
      .click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await page
      .getByRole("button", {
        name: `Seleccionar todos los resultados (${count})`,
      })
      .click();
    await page.getByRole("button", { name: "Publicar seleccionadas" }).click();
    await page.getByRole("button", { name: "Revisar lote" }).click();
    await expect(
      page.getByRole("button", { name: `Confirmar ${count} preguntas` }),
    ).toBeEnabled();
    await axe(page);
    await page
      .getByRole("button", { name: `Confirmar ${count} preguntas` })
      .click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await page
      .getByRole("tab", { name: "Revisar publicación", exact: true })
      .click();
    await expect(
      page.getByText(
        `${count} preguntas publicadas. Su contenido está protegido; puedes consultar su detalle en Organizar.`,
      ),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Ver pregunta", exact: true }),
    ).toHaveCount(0);
    const data = await call(page, `/projects/${id}/questionnaire`);
    expect(
      data.questions.every(
        (q: { publication: string }) => q.publication === "PUBLISHED",
      ),
    ).toBe(true);
  });

test("simplicity: keyboard returns after cancel, assignment, publication and inspector; distinct errors on mobile", async ({
  page,
}) => {
  test.setTimeout(120000);
  const id = await fixture(page, 10);
  await page.goto(`/projects/${id}/editor`);
  await page.getByRole("tab", { name: "Escribir", exact: true }).click();
  const trigger = page.getByLabel("Acciones de Consulta 0", { exact: true });
  for (const name of ["Asignar participantes", "Publicar"]) {
    await trigger.focus();
    await page.keyboard.press("Enter");
    await page.getByRole("button", { name, exact: true }).focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(trigger).toBeFocused();
  }
  await page.keyboard.press("Enter");
  await page
    .getByRole("button", { name: "Asignar participantes", exact: true })
    .focus();
  await page.keyboard.press("Enter");
  await page.getByLabel("Participante", { exact: true }).selectOption({
    label:
      "Participante demo · " +
      (await call(page, `/projects/${id}/questionnaire`)).members.find(
        (m: { role: string }) => m.role === "STAKEHOLDER",
      ).areaName,
  });
  await page.getByRole("button", { name: "Guardar asignación" }).focus();
  await page.keyboard.press("Enter");
  await expect(trigger).toBeFocused();
  await page.keyboard.press("Enter");
  await page.getByRole("button", { name: "Publicar", exact: true }).focus();
  await page.keyboard.press("Enter");
  await page.getByRole("button", { name: "Confirmar publicación" }).focus();
  await page.keyboard.press("Enter");
  await expect(trigger).toBeFocused();
  await page.getByRole("button", { name: "Organizar preguntas" }).click();
  const row = page.getByRole("button", {
    name: /¿Cómo se atiende la solicitud de ejemplo 1\?/,
  });
  await row.click();
  await page.getByLabel("Acciones de Consulta 1", { exact: true }).click();
  await page
    .getByRole("button", { name: "Asignar participantes", exact: true })
    .click();
  await page.keyboard.press("Escape");
  await expect(row).toBeFocused();
  await page.getByRole("tab", { name: "Escribir", exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page
    .getByRole("button", { name: "+ Agregar pregunta", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Crear pregunta", exact: true })
    .click();
  const errors = page.getByRole("alert").getByRole("link");
  await expect(errors).toHaveCount(3);
  await expect(errors.filter({ hasText: /^Pregunta:/ })).toHaveCount(1);
  await errors.filter({ hasText: /^Identificador externo:/ }).click();
  await expect(
    page.getByLabel("Identificador externo", { exact: true }),
  ).toBeFocused();
  await axe(page);
});
