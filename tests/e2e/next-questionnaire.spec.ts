import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { login } from "./login-helper";

async function command(page: Page, path: string, body?: unknown) {
  return page.evaluate(
    async ({ path, body }) => {
      const me = await (await fetch("/api/v1/auth/me")).json();
      const response = await fetch("/api/v1" + path, {
        method: body ? "POST" : "GET",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": me.csrfToken,
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(`${response.status}: ${JSON.stringify(result)}`);
      return result;
    },
    { path, body },
  );
}
async function prepare(page: Page, count: number) {
  await login(page, "admin");
  const suffix = randomUUID();
  const project = await command(page, "/projects", {
    externalId: `NEXT-${suffix}`,
    name: `Servicios compartidos · ${count} preguntas`,
    description: "Cuestionario ficticio de verificación de ACTA NEXT",
  });
  const area = await command(page, "/areas", {
    code: `NEXT-${suffix}`,
    name: "Por confirmar",
  });
  const size = Math.ceil(count / 3);
  const file = {
    formatVersion: "1.0",
    kind: "questionnaire-template",
    project: { externalId: project.externalId, name: project.name },
    areas: [{ code: area.code, name: area.name }],
    sections: [
      "Recepción de solicitudes",
      "Atención y seguimiento",
      "Cierre del servicio",
    ].map((title, order) => ({ externalId: `TOPIC-${order}`, title, order })),
    questions: Array.from({ length: count }, (_, i) => ({
      externalId: `NEXT-${i}`,
      sectionExternalId: `TOPIC-${Math.floor(i / size)}`,
      title: `Consulta ${i}`,
      question: `¿Cómo se atiende la solicitud de ejemplo ${i}?`,
      type: "SHORT_TEXT",
      required: false,
      priority: "P2",
      responsibleAreaCode: area.code,
      order: i % size,
      options: [],
      references: [],
      ...(i === 1 ? { groupParentExternalId: "NEXT-0" } : {}),
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
      const response = await fetch(
        `/api/v1/projects/${projectId}/imports/preview`,
        { method: "POST", headers, body: JSON.stringify(file) },
      );
      const preview = await response.json();
      if (!response.ok || preview.errors.length)
        throw new Error(JSON.stringify(preview));
      const confirmation = await fetch(
        `/api/v1/projects/${projectId}/imports/confirm`,
        {
          method: "POST",
          headers: {
            ...headers,
            "X-Import-Command": encodeURIComponent(
              JSON.stringify({
                payloadHash: preview.payloadHash,
                expectedProjectVersion: preview.expectedProjectVersion,
                requestId: crypto.randomUUID(),
                createMissingAreas: false,
              }),
            ),
          },
          body: JSON.stringify(file),
        },
      );
      if (!confirmation.ok) throw new Error(await confirmation.text());
    },
    { projectId: project.id, file },
  );
  return { project, area };
}

for (const count of [12, 54, 304]) {
  test(`ACTA NEXT: ${count} preguntas, jerarquía, filtros, selección, teclado y reflow`, async ({
    page,
  }) => {
    test.setTimeout(180000);
    const { project, area } = await prepare(page, count);
    await page.goto(`/projects/${project.id}/editor`);
    await expect(
      page.getByRole("tabpanel", { name: "Organizar", exact: true }),
    ).toBeVisible();
    const boxes = page.getByRole("checkbox", { name: /Seleccionar pregunta:/ });
    await expect(boxes).toHaveCount(Math.min(count, 40));
    await expect(
      page.getByRole("button", { name: "Reintentar aportaciones" }),
    ).toHaveCount(0);
    await expect(page.locator(".an-row-area").first()).toContainText(
      "Por confirmar",
    );
    await page
      .getByLabel("Área responsable", { exact: true })
      .selectOption(area.id);
    await page.getByLabel("Estado de publicación").selectOption("DRAFT");
    await page.getByRole("button", { name: "Analizar", exact: true }).click();
    await expect(page.locator(".an-row-contributions").first()).toContainText(
      "Sin aportaciones enviadas",
    );
    await page.getByRole("button", { name: "Preparar", exact: true }).click();
    const collapse = page.getByRole("button", {
      name: "Contraer seguimientos de Consulta 0",
      exact: true,
    });
    await collapse.focus();
    await page.keyboard.press("Enter");
    await expect(
      page.getByRole("checkbox", {
        name: "Seleccionar pregunta: ¿Cómo se atiende la solicitud de ejemplo 1?",
        exact: true,
      }),
    ).toHaveCount(0);
    await page
      .getByRole("button", {
        name: `Seleccionar esta página (${Math.min(count - 1, 40)})`,
        exact: true,
      })
      .click();
    await page
      .getByRole("button", {
        name: "Expandir seguimientos de Consulta 0",
        exact: true,
      })
      .click();
    await expect(
      page.getByRole("checkbox", {
        name: "Seleccionar pregunta: ¿Cómo se atiende la solicitud de ejemplo 1?",
        exact: true,
      }),
    ).not.toBeChecked();
    await page
      .getByRole("button", {
        name: `Seleccionar todos los resultados (${count})`,
        exact: true,
      })
      .click();
    await expect(
      page.getByText(`${count} preguntas seleccionadas`, { exact: true }),
    ).toBeVisible();
    await page.getByLabel("Buscar preguntas").fill(`NEXT-${count - 1}`);
    await expect(boxes).toHaveCount(1);
    await expect(
      page.getByText("0 preguntas seleccionadas", { exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", {
        name: `¿Cómo se atiende la solicitud de ejemplo ${count - 1}?`,
        exact: true,
      })
      .click();
    await expect(
      page.getByRole("heading", { name: "Detalle de pregunta" }),
    ).toBeFocused();
    await page
      .getByRole("button", { name: "Cerrar detalle", exact: true })
      .click();
    await expect(
      page.getByRole("button", {
        name: `¿Cómo se atiende la solicitud de ejemplo ${count - 1}?`,
        exact: true,
      }),
    ).toBeFocused();
    await page.getByLabel("Buscar preguntas").fill("");
    await mkdir("artifacts/acta-next/checkpoint-1", { recursive: true });
    for (const width of [1440, 1024, 768, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      await expect(page.locator(".an-topic-band").first()).toBeVisible();
      const parentBounds = await page
        .getByRole("button", {
          name: "¿Cómo se atiende la solicitud de ejemplo 0?",
          exact: true,
        })
        .locator("strong")
        .boundingBox();
      const childBounds = await page
        .getByRole("button", {
          name: "¿Cómo se atiende la solicitud de ejemplo 1?",
          exact: true,
        })
        .locator("strong")
        .boundingBox();
      expect(childBounds!.x).toBeGreaterThan(parentBounds!.x);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      const report = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
        .analyze();
      expect(report.violations).toEqual([]);
      await page
        .getByRole("heading", { name: "Cuestionario", exact: true })
        .scrollIntoViewIfNeeded();
      await page.screenshot({
        path: `artifacts/acta-next/checkpoint-1/questionnaire-${count}-${width}.png`,
        fullPage: false,
      });
      await page.locator(".an-topic-band").first().scrollIntoViewIfNeeded();
      await page.screenshot({
        path: `artifacts/acta-next/checkpoint-1/questionnaire-rows-${count}-${width}.png`,
        fullPage: false,
      });
    }
    const persisted = await command(
      page,
      `/projects/${project.id}/questionnaire`,
    );
    expect(persisted.questions).toHaveLength(count);
    expect(
      persisted.questions.every(
        (q: { publication: string }) => q.publication === "DRAFT",
      ),
    ).toBe(true);
    expect(
      new Set(
        persisted.questions.map((q: { externalId: string }) => q.externalId),
      ),
    ).toEqual(new Set(Array.from({ length: count }, (_, i) => `NEXT-${i}`)));
  });
}
