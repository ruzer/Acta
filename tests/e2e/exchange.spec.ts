import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import { login } from "./login-helper";
import { template } from "../fixtures-template.mjs";
const suffix = randomBytes(4).toString("hex"),
  code = "EXCHANGE-" + suffix,
  username = "exchange_" + suffix;
let projectId: string, invalidId: string, questionId: string;
test.describe.configure({ mode: "serial" });
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
      if (!r.ok) throw new Error(`${r.status}: ${JSON.stringify(data)}`);
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
test.beforeAll(async ({ browser }) => {
  const context = await browser.newContext(),
    page = await context.newPage();
  await login(page, "admin");
  const p = await call(page, "/projects", "POST", {
    externalId: code,
    name: "Intercambio ficticio " + suffix,
    description: "",
  });
  projectId = p.id;
  const invalid = await call(page, "/projects", "POST", {
    externalId: "INVALID-" + suffix,
    name: "Importación inválida ficticia",
    description: "",
  });
  invalidId = invalid.id;
  const users = await call(page, "/users");
  for (const name of ["analyst", "viewer"])
    await call(page, `/projects/${projectId}/members`, "POST", {
      userId: users.find((u: { username: string }) => u.username === name).id,
      role: name === "analyst" ? "ANALYST" : "VIEWER",
      areaId: null,
      active: true,
    });
  await call(page, "/users", "POST", {
    username,
    displayName: "Participante ficticio de intercambio",
    temporaryPassword: process.env.DEMO_PASSWORD,
  });
  await context.close();
});
test("B/C/F admin imports fictitious JSON after preview; invalid file writes nothing; audit and axe", async ({
  page,
}) => {
  await login(page, "admin");
  await page.goto(`/projects/${invalidId}/import`);
  const bad = template("INVALID-" + suffix, "E2E-AREA-" + suffix);
  bad.questions[0].sectionExternalId = "MISSING";
  await page.getByLabel("Archivo JSON").setInputFiles({
    name: "invalid.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(bad)),
  });
  await page
    .getByRole("button", { name: "Revisar archivo", exact: true })
    .click();
  await expect(
    page.getByText("Esta pregunta hace referencia a un tema que no existe."),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Confirmar importación" }),
  ).toBeDisabled();
  expect(
    (await call(page, `/projects/${invalidId}/questionnaire`)).questions,
  ).toEqual([]);
  await axe(page);
  await page.goto(`/projects/${projectId}/import`);
  await page.getByLabel("Archivo JSON").setInputFiles({
    name: "ficticio.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(template(code, "E2E-AREA-" + suffix))),
  });
  await page
    .getByRole("button", { name: "Revisar archivo", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "2. Revisar importación" }),
  ).toBeVisible();
  expect(
    (await call(page, `/projects/${projectId}/questionnaire`)).questions,
  ).toEqual([]);
  await page.getByLabel("Confirmo crear estas áreas en la institución").check();
  await axe(page);
  await page.getByRole("button", { name: "Confirmar importación" }).click();
  await expect(
    page.getByText(/Importación completada: 2 preguntas/),
  ).toBeVisible();
  await page.goto(`/projects/${projectId}/history`);
  await page.getByLabel("Acción", { exact: true }).fill("PROJECT_IMPORTED");
  await expect(
    page.getByRole("cell", { name: "PROJECT_IMPORTED", exact: true }),
  ).toBeVisible();
  await axe(page);
  // Prepare a submitted source and decision through real authenticated APIs for export scenarios.
  const questionnaire = await call(
      page,
      `/projects/${projectId}/questionnaire`,
    ),
    users = await call(page, "/users"),
    area = questionnaire.areas.find(
      (a: { code: string }) => a.code === "E2E-AREA-" + suffix,
    );
  const m = await call(page, `/projects/${projectId}/members`, "POST", {
    userId: users.find((u: { username: string }) => u.username === username).id,
    role: "STAKEHOLDER",
    areaId: area.id,
    active: true,
  });
  for (const q of questionnaire.questions) {
    await call(
      page,
      `/projects/${projectId}/questions/${q.id}/assign`,
      "POST",
      {
        projectMemberId: m.id,
        required: true,
        active: true,
        expectedVersion: q.lockVersion,
      },
    );
    const fresh = (
      await call(page, `/projects/${projectId}/questionnaire`)
    ).questions.find((x: { id: string }) => x.id === q.id);
    await call(
      page,
      `/projects/${projectId}/questions/${q.id}/publish`,
      "POST",
      { expectedVersion: fresh.lockVersion },
    );
  }
  questionId = questionnaire.questions.find(
    (q: { externalId: string }) => q.externalId === "FORM-14",
  ).id;
});
test("A/D analyst dashboard filters and opens review; Markdown includes current decision", async ({
  browser,
  page,
}) => {
  const context = await browser.newContext(),
    stake = await context.newPage();
  await login(stake, username);
  const base = `/projects/${projectId}/questions/${questionId}`;
  const response = await call(stake, base + "/response");
  await call(stake, base + "/response/draft", "PUT", {
    answer: true,
    comment: "Fuente ficticia",
    example: "",
    consultationRequested: false,
    expectedVersion: response.lockVersion,
    requestId: crypto.randomUUID(),
  });
  const draft = await call(stake, base + "/response");
  const sent = await call(stake, base + "/response/submit", "POST", {
    expectedVersion: draft.lockVersion,
    requestId: crypto.randomUUID(),
  });
  await login(page, "analyst");
  await page.goto(`/projects/${projectId}/dashboard`);
  await expect(
    page.getByRole("heading", {
      name: "Cuestionario ficticio de intercambio",
      exact: true,
    }),
  ).toBeVisible();
  await page.screenshot({
    path: "/tmp/requirements-2e-dashboard-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await axe(page);
  await page.screenshot({
    path: "/tmp/requirements-2e-dashboard-mobile.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByLabel("Filtrar estado").selectOption("ANSWERED");
  await expect(
    page.getByRole("link", { name: "Pregunta ficticia", exact: true }),
  ).toBeVisible();
  await axe(page);
  await page
    .getByRole("link", { name: "Pregunta ficticia", exact: true })
    .click();
  await expect(page).toHaveURL(new RegExp("/review/" + questionId));
  const detail = await call(page, base + "/review");
  await call(page, base + "/review/validate", "POST", {
    requestId: crypto.randomUUID(),
    expectedVersion: detail.lockVersion,
    decisionText: "DECISION_E2E_VIGENTE",
    scope: "Caso ficticio",
    exceptions: "",
    validationComment: "PRIVATE_EXPORT_COMMENT",
    responseRevisionIds: [sent.revisions[0].id],
    clarificationMessageIds: [],
    conflictResolutionIds: [],
  });
  const next = await call(stake, base + "/response");
  await call(stake, base + "/response/draft", "PUT", {
    answer: false,
    comment: "PRIVATE_EXPORT_DRAFT",
    example: "",
    consultationRequested: false,
    expectedVersion: next.lockVersion,
    requestId: crypto.randomUUID(),
  });
  await context.close();
  await page.goto(`/projects/${projectId}/export`);
  await page.getByLabel("Formato de exportación").selectOption("MARKDOWN");
  await axe(page);
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name: "Descargar exportación" }).click();
  const text = await readFile((await (await pending).path())!, "utf8");
  expect(text).toContain("DECISION\\_E2E\\_VIGENTE");
  expect(text).not.toContain("PRIVATE_EXPORT_DRAFT");
  await page.goto(`/projects/${projectId}/traceability`);
  await expect(
    page.getByRole("link", { name: "REQ-14", exact: true }),
  ).toBeVisible();
  await axe(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await axe(page);
  await page.goto(`/projects/${projectId}/history`);
  await page.getByLabel("Acción", { exact: true }).fill("EXPORT_CREATED");
  await expect(
    page.getByRole("cell", { name: "EXPORT_CREATED", exact: true }),
  ).toBeVisible();
  await axe(page);
});
test("E viewer downloads only current decisions and allowed sources", async ({
  page,
}) => {
  await login(page, "viewer");
  await page.goto(`/projects/${projectId}/export`);
  await expect(page.getByText(/JSON de decisiones vigentes:/)).toBeVisible();
  await expect(page.getByLabel("Formato de exportación")).toHaveCount(0);
  await axe(page);
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name: "Descargar exportación" }).click();
  const text = await readFile((await (await pending).path())!, "utf8"),
    data = JSON.parse(text);
  expect(data.kind).toBe("validated-decisions-export");
  expect(text).toContain("DECISION_E2E_VIGENTE");
  expect(text).not.toContain("PRIVATE_EXPORT_COMMENT");
  expect(text).not.toContain("PRIVATE_EXPORT_DRAFT");
  expect(data.auditEvents).toBeUndefined();
});
