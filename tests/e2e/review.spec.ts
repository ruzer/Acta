import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import { PDFDocument } from "pdf-lib";
import { login, logout } from "./login-helper";
let projectId: string,
  questionIds: string[],
  otherUsername: string,
  participantArea: string;
const suffix = randomBytes(4).toString("hex");
test.describe.configure({ mode: "serial" });
async function accessible(page: Page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(
      document.getAnimations().map((a) => a.finished.catch(() => {})),
    );
  });
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
}
async function question(page: Page, index = 0) {
  await page.goto(`/projects/${projectId}/respond/${questionIds[index]}`);
  await expect(
    page.getByRole("heading", {
      name: `¿Cómo se realiza el procedimiento ficticio ${index + 1}?`,
      exact: true,
      level: 1,
    }),
  ).toBeVisible();
}
async function send(page: Page, text: string, index = 0, withEvidence = false) {
  await question(page, index);
  await page.getByLabel("Tu respuesta", { exact: true }).fill(text);
  if (withEvidence) {
    const pdf = await PDFDocument.create();
    pdf.addPage().drawText("Evidence for fictional conflict test");
    await page.getByText("Adjuntar evidencia", { exact: true }).click();
    await page.getByLabel("Seleccionar evidencia").setInputFiles({
      name: "conflicto-ficticio.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from(await pdf.save()),
    });
    await page.getByRole("button", { name: "Adjuntar al borrador" }).click();
    await expect(
      page.getByRole("status").filter({ hasText: "Evidencia adjunta" }),
    ).toBeVisible();
  }
  await page
    .getByRole("button", { name: "Enviar respuesta", exact: true })
    .click();

  await expect(
    page.getByRole("status").filter({ hasText: "Respuesta enviada." }),
  ).toBeVisible();
}
async function review(page: Page, index = 0) {
  await page.goto(`/projects/${projectId}/review/${questionIds[index]}`);
  await expect(
    page.getByRole("heading", {
      name: `Revisión ficticia ${index + 1}`,
      exact: true,
      level: 1,
    }),
  ).toBeVisible();
}
async function action(page: Page, key: string) {
  await page.getByLabel("Otras acciones").selectOption(key);
  await expect(page.getByRole("dialog")).toBeVisible();
}
async function decide(page: Page) {
  await page
    .getByRole("button", { name: "Registrar decisión", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByLabel("Decisión acordada")
    .fill("Procedimiento ficticio acordado y documentado");
  await dialog
    .getByLabel("Alcance", { exact: true })
    .fill("Solicitudes de la prueba");
  await dialog
    .getByLabel("Comentario interno")
    .fill("Se revisaron las aportaciones y aclaraciones");
  for (const cb of await dialog.getByRole("checkbox").all()) await cb.check();
  await accessible(page);
  await dialog.getByRole("button", { name: "Registrar como validada" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(
    page.locator(".av-status").filter({ hasText: /^Validada$/ }),
  ).toBeVisible();
}
test.beforeAll(async ({ browser }) => {
  const page = await (await browser.newContext()).newPage();
  await login(page, "admin");
  otherUsername = "review_" + suffix;
  const result = await page.evaluate(
    async ({ suffix, password, otherUsername }) => {
      const me = await (await fetch("/api/v1/auth/me")).json();
      async function call(path: string, method = "GET", body?: unknown) {
        const r = await fetch("/api/v1" + path, {
          method,
          headers: {
            "Content-Type": "application/json",
            "X-CSRF-Token": me.csrfToken,
          },
          ...(method === "GET" ? {} : { body: JSON.stringify(body ?? {}) }),
        });
        const data = await r.json();
        if (!r.ok) throw new Error(`${path}: ${r.status} ${data.message}`);
        return data;
      }
      const users = await call("/users"),
        areas = await call("/areas");
      const other = await call("/users", "POST", {
        username: otherUsername,
        displayName: "Segundo participante 2D",
        temporaryPassword: password,
      });
      const p = await call("/projects", "POST", {
        externalId: "E2E-2D-" + suffix,
        name: "Revisión 2D " + suffix,
        description: "Datos exclusivamente ficticios",
      });
      const members: Record<string, string> = {};
      for (const name of ["analyst", "stakeholder", "viewer", otherUsername]) {
        const u =
          name === otherUsername
            ? other
            : users.find((u: { username: string }) => u.username === name);
        const role =
          name === "analyst"
            ? "ANALYST"
            : name === "viewer"
              ? "VIEWER"
              : "STAKEHOLDER";
        members[name] = (
          await call(`/projects/${p.id}/members`, "POST", {
            userId: u.id,
            role,
            areaId: role === "STAKEHOLDER" ? areas[0].id : null,
            active: true,
          })
        ).id;
      }
      const section = await call(`/projects/${p.id}/sections`, "POST", {
        externalId: "TEMA-2D",
        title: "Casos de revisión",
        order: 1,
        description: "",
      });
      const ids = [];
      for (let i = 0; i < 3; i++) {
        let q = await call(`/projects/${p.id}/questions`, "POST", {
          externalId: "E2E-Q-" + i,
          sectionId: section.id,
          title: `Revisión ficticia ${i + 1}`,
          question: `¿Cómo se realiza el procedimiento ficticio ${i + 1}?`,
          type: "SHORT_TEXT",
          required: true,
          priority: "P1",
          responsibleAreaId: areas[0].id,
          order: i,
        });
        for (const name of i === 1
          ? ["stakeholder", otherUsername]
          : ["stakeholder"])
          q = await call(`/projects/${p.id}/questions/${q.id}/assign`, "POST", {
            projectMemberId: members[name],
            active: true,
            required: true,
            expectedVersion: q.lockVersion,
          });
        q = await call(`/projects/${p.id}/questions/${q.id}/publish`, "POST", {
          expectedVersion: q.lockVersion,
        });
        ids.push(q.id);
      }
      return { projectId: p.id, ids, areaName: areas[0].name };
    },
    { suffix, password: process.env.DEMO_PASSWORD!, otherUsername },
  );
  projectId = result.projectId;
  questionIds = result.ids;
  participantArea = result.areaName;
  await page.close();
});
test("2D-A: envío → aclaración → respuesta → cierre → decisión validada; axe bandeja y detalle", async ({
  page,
  browser,
}) => {
  await login(page, "stakeholder");
  await send(page, "Respuesta original ficticia");
  const analyst = await (await browser.newContext()).newPage();
  await login(analyst, "analyst");
  await analyst.goto(`/review?projectId=${projectId}`);
  await expect(
    analyst.getByRole("heading", { name: "Revisión", exact: true }),
  ).toBeVisible();
  await expect(
    analyst.getByRole("link", { name: /procedimiento ficticio 1/ }),
  ).toBeVisible();
  await accessible(analyst);
  await analyst.getByRole("link", { name: /procedimiento ficticio 1/ }).click();
  await action(analyst, "requestClarification");
  let dialog = analyst.getByRole("dialog");
  await dialog
    .getByLabel("Respuesta sobre la que necesitas aclaración")
    .selectOption({ label: "Participante demo · envío #1" });
  await dialog
    .getByLabel("Pregunta de aclaración")
    .fill("¿Cuál es el alcance del procedimiento?");
  await accessible(analyst);
  await dialog.getByRole("button", { name: "Enviar solicitud" }).click();
  await expect(dialog).toHaveCount(0);
  await page.goto(`/projects/${projectId}/work`);
  await expect(
    page.getByRole("link", { name: "Responder: Revisión ficticia 1" }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Responder: Revisión ficticia 1" })
    .click();
  await expect(
    page.getByText("Respuesta original ficticia", { exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("Tu aclaración")
    .fill("Se aplica a las solicitudes recibidas por escrito");
  await accessible(page);
  await page.getByRole("button", { name: "Enviar aclaración" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Aclaración enviada." }),
  ).toBeVisible();
  await page.screenshot({
    path: "artifacts/2d-clarification-desktop.png",
    fullPage: true,
  });
  await review(analyst);
  await analyst
    .getByRole("button", { name: "Cerrar aclaración", exact: true })
    .first()
    .click();
  dialog = analyst.getByRole("dialog");
  await dialog.getByLabel("Motivo").fill("El alcance quedó explicado");
  await dialog
    .getByRole("button", { name: "Cerrar aclaración", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  await decide(analyst);
  await accessible(analyst);
  await analyst.screenshot({
    path: "artifacts/2d-decision-desktop.png",
    fullPage: true,
  });
  await analyst.close();
});
test("2D-B: participante consulta validada sin corregir; decisión permanece vigente", async ({
  page,
  browser,
}) => {
  await login(page, "stakeholder");
  await question(page);
  await expect(page.getByRole("textbox")).toHaveCount(0);
  await expect(
    page.getByRole("button", {
      name: /Preparar nueva|Enviar respuesta|Editar/,
    }),
  ).toHaveCount(0);
  await expect(
    page.locator(".participant-badge").filter({ hasText: "Validada" }),
  ).toBeVisible();
  const analyst = await (await browser.newContext()).newPage();
  await login(analyst, "analyst");
  await review(analyst);
  await expect(
    analyst.locator(".av-status").filter({ hasText: /^Validada$/ }),
  ).toBeVisible();
  await analyst.close();
});
test("2D-C: dos autores → comparación → resolución independiente → validación; responsive y axe", async ({
  page,
  browser,
}) => {
  await login(page, "stakeholder");
  await send(page, "La atención inicia con solicitud escrita", 1, true);
  const other = await (await browser.newContext()).newPage();
  await login(other, otherUsername);
  await send(other, "La atención inicia con solicitud verbal", 1);
  await other.close();
  await logout(page);
  await login(page, "analyst");
  await review(page, 1);
  await action(page, "markConflict");
  let dialog = page.getByRole("dialog");
  await dialog
    .getByLabel("Motivo")
    .fill("Las aportaciones discrepan sobre el inicio");
  for (const cb of await dialog.getByRole("checkbox").all()) await cb.check();
  await dialog
    .getByRole("button", { name: "Marcar conflicto", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  const postures = page.getByRole("region", { name: /^Postura [AB]$/ });
  await expect(postures).toHaveCount(2);
  for (const name of ["Postura A", "Postura B"]) {
    const posture = page.getByRole("region", { name, exact: true });
    await expect(posture).toBeVisible();
    await expect(
      posture.getByText(participantArea, { exact: true }),
    ).toBeVisible();
    await expect(
      posture.getByRole("heading", { name: "Respuesta", exact: true }),
    ).toBeVisible();
    await expect(
      posture.getByRole("heading", { name: "Evidencia", exact: true }),
    ).toBeVisible();
  }
  const written = postures.filter({
    has: page.getByRole("heading", { name: "Participante demo", exact: true }),
  });
  const spoken = postures.filter({
    has: page.getByRole("heading", {
      name: "Segundo participante 2D",
      exact: true,
    }),
  });
  await expect(written).toHaveCount(1);
  await expect(spoken).toHaveCount(1);
  await expect(
    written.getByRole("heading", { name: "Participante demo", exact: true }),
  ).toBeVisible();
  await expect(
    spoken.getByRole("heading", {
      name: "Segundo participante 2D",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    written.getByText("La atención inicia con solicitud escrita", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    spoken.getByText("La atención inicia con solicitud verbal", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    spoken.getByText("Sin evidencia adjunta.", { exact: true }),
  ).toBeVisible();
  await expect(spoken.getByRole("button", { name: /^Descargar / })).toHaveCount(
    0,
  );
  const downloadButton = written.getByRole("button", {
    name: "Descargar conflicto-ficticio.pdf",
    exact: true,
  });
  await expect(downloadButton).toBeEnabled();
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    downloadButton.click(),
  ]);
  expect(download.suggestedFilename()).toBe("conflicto-ficticio.pdf");
  expect(await download.failure()).toBeNull();
  expect(
    (await readFile((await download.path())!)).subarray(0, 5).toString(),
  ).toBe("%PDF-");
  await expect(
    page.getByText(
      "Resolver este conflicto no valida la pregunta. La decisión se registra por separado.",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Decisión vigente", exact: true }),
  ).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  for (const name of ["Postura A", "Postura B"])
    await expect(page.getByRole("region", { name, exact: true })).toBeVisible();
  await accessible(page);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await accessible(page);
  await page.screenshot({
    path: "artifacts/2d-conflict-desktop.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Resolver conflicto", exact: true })
    .first()
    .click();
  dialog = page.getByRole("dialog");
  await dialog
    .getByLabel("Resolución del conflicto")
    .fill("Se acepta solicitud verbal y luego se documenta");
  for (const cb of await dialog.getByRole("checkbox").all()) await cb.check();
  await dialog
    .getByRole("button", { name: "Resolver conflicto", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  await expect(
    page.locator(".av-status").filter({ hasText: /^Respondida$/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Decisión vigente" }),
  ).toHaveCount(0);
  await decide(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await accessible(page);
  await page.screenshot({
    path: "artifacts/2d-review-mobile.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 768, height: 1024 });
  await accessible(page);
});
test("2D-D: no aplica → reapertura y controles de solo lectura", async ({
  page,
  browser,
}) => {
  await login(page, "analyst");
  await review(page, 2);
  await action(page, "markNotApplicable");
  let dialog = page.getByRole("dialog");
  await dialog
    .getByLabel("Motivo")
    .fill("El proceso no se utiliza en este caso");
  await dialog.getByLabel("Alcance de no aplica").fill("Caso ficticio actual");
  await dialog
    .getByRole("button", { name: "Marcar no aplica", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  await expect(
    page.locator(".av-status").filter({ hasText: /^No aplica$/ }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Reabrir pregunta" }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("Motivo").fill("Se incorporó el procedimiento");
  await dialog
    .getByRole("button", { name: "Reabrir pregunta", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  await expect(
    page.locator(".av-status").filter({ hasText: /^Pendiente$/ }),
  ).toBeVisible();
  await page.getByText("Decisiones de no aplica", { exact: true }).click();
  await expect(
    page.getByText("Se incorporó el procedimiento", { exact: false }),
  ).toBeVisible();
  const viewer = await (await browser.newContext()).newPage();
  await login(viewer, "viewer");
  await review(viewer, 1);
  await expect(
    viewer.getByRole("heading", { name: "Decisión vigente" }),
  ).toBeVisible();
  await expect(viewer.getByLabel("Otras acciones")).toHaveCount(0);
  await expect(
    viewer.getByRole("button", { name: "Registrar decisión" }),
  ).toHaveCount(0);
  await accessible(viewer);
  await viewer.goto(`/projects/${projectId}/review/${questionIds[2]}`);
  await expect(viewer.getByRole("alert")).toContainText(
    "No hay una decisión vigente",
  );
  await viewer.close();
});
