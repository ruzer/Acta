import {
  test,
  expect,
  type APIRequestContext,
  type Page,
} from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { randomUUID } from "node:crypto";
import { login as loginPage } from "./login-helper";
import { mkdir } from "node:fs/promises";
import { PDFDocument } from "pdf-lib";
import type {
  InvitationView,
  QuestionnaireView,
  ReviewDetail,
} from "@requirements/contracts";

async function invitation(request: APIRequestContext) {
  const origin = process.env.E2E_URL || "http://localhost:4317";
  let login = await request.post("/api/v1/auth/login", {
    headers: { Origin: origin },
    data: {
      username: "analyst",
      password: process.env.DEMO_PASSWORD + "-Reviewed2B",
    },
  });
  if (login.status() !== 201)
    login = await request.post("/api/v1/auth/login", {
      headers: { Origin: origin },
      data: { username: "analyst", password: process.env.DEMO_PASSWORD },
    });
  expect(login.status()).toBe(201);
  const me = await login.json();
  const projects = await (await request.get("/api/v1/projects")).json();
  const project = projects.find(
    (p: { externalId: string }) => p.externalId === "DEMO-PRINCIPAL",
  );
  expect(project).toBeTruthy();
  const graph: QuestionnaireView = await (
    await request.get(`/api/v1/projects/${project.id}/questionnaire`)
  ).json();
  const question = graph.questions.find(
    (q) =>
      q.type === "SHORT_TEXT" && q.publication === "PUBLISHED" && !q.condition,
  )!;
  expect(question).toBeTruthy();
  const created = await request.post(
    `/api/v1/projects/${project.id}/invitations`,
    {
      headers: { Origin: origin, "X-CSRF-Token": me.csrfToken },
      data: {
        requestId: randomUUID(),
        label: "External browser example",
        questionIds: [question.id],
        areaId: graph.areas.find((a) => a.active)!.id,
        identity: { name: "Example Respondent" },
        nonNominal: false,
        allowEvidence: true,
      },
    },
  );
  expect(created.status()).toBe(201);
  const link = (await created.json()) as {
    invitation: InvitationView;
    url: string;
  };
  return {
    ...link,
    projectId: project.id as string,
    question,
    areaId: graph.areas.find((a) => a.active)!.id,
  };
}
async function accessible(page: Page) {
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
for (const width of [1440, 390])
  test(`external respondent saves, resumes, attaches and submits at ${width}px`, async ({
    browser,
    request,
  }) => {
    test.setTimeout(90000);
    const link = await invitation(request);
    const context = await browser.newContext({
      viewport: { width, height: 950 },
    });
    const page = await context.newPage();
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.name));
    try {
      await page.goto(link.url);
      await expect(
        page.getByText("Respuesta mediante invitación", { exact: true }),
      ).toBeVisible();
      expect(new URL(page.url()).hash).toBe("");
      await expect(
        page.getByRole("button", { name: "Iniciar sesión" }),
      ).toHaveCount(0);
      expect(
        (await context.cookies()).some((c) => c.name === "fgeo_session"),
      ).toBe(false);
      await accessible(page);
      const respond = page.getByRole("button", {
        name: "Responder",
        exact: true,
      });
      for (
        let n = 0;
        n < 20 &&
        !(await respond.evaluate((e) => e === document.activeElement));
        n++
      )
        await page.keyboard.press("Tab");
      await expect(respond).toBeFocused();
      await page.keyboard.press("Enter");
      await expect(
        page.getByLabel("Tu respuesta", { exact: true }),
      ).toBeVisible();
      await accessible(page);
      await page
        .getByLabel("Tu respuesta", { exact: true })
        .fill("Fictional answer saved by an external respondent.");
      await page
        .getByRole("button", { name: "Guardar borrador", exact: true })
        .click();
      await expect(
        page.getByText(
          "Borrador guardado. Puedes cerrar y volver con tu enlace.",
          { exact: true },
        ),
      ).toBeVisible();
      await page.getByRole("button", { name: "Todas las preguntas" }).click();
      await page.getByRole("button", { name: "Salir", exact: true }).click();
      await expect(
        page.getByRole("heading", { name: "Hasta luego" }),
      ).toBeVisible();
      await page.goto(link.url);
      await page
        .getByRole("button", { name: "Responder", exact: true })
        .click();
      await expect(
        page.getByLabel("Tu respuesta", { exact: true }),
      ).toHaveValue("Fictional answer saved by an external respondent.");
      const pdf = await PDFDocument.create();
      pdf.addPage().drawText("Fictional external browser evidence");
      await page.locator('input[type="file"]').setInputFiles({
        name: "example.pdf",
        mimeType: "application/pdf",
        buffer: Buffer.from(await pdf.save()),
      });
      await page
        .getByRole("button", { name: "Adjuntar archivo", exact: true })
        .click();
      await expect(
        page.getByText("Archivo adjuntado al borrador.", { exact: true }),
      ).toBeVisible();
      await page
        .getByRole("button", { name: "Enviar respuesta", exact: true })
        .click();
      const dialog = page.getByRole("dialog", { name: "Enviar respuesta" });
      await expect(dialog).toBeVisible();
      await accessible(page);
      await dialog
        .getByRole("button", { name: "Confirmar envío", exact: true })
        .click();
      await expect(
        page.getByRole("heading", { name: "Respuesta enviada", exact: true }),
      ).toBeVisible();
      await expect(
        page.getByText("Respuesta enviada. Gracias por tu aportación.", {
          exact: true,
        }),
      ).toBeVisible();
      await accessible(page);
      const download = page.waitForEvent("download");
      await page
        .getByRole("button", { name: "Descargar", exact: true })
        .click();
      expect((await download).suggestedFilename()).toBe("example.pdf");
      expect(errors).toEqual([]);
      await mkdir("artifacts", { recursive: true });
      await page.screenshot({
        path: `artifacts/invitation-${width}.png`,
        fullPage: true,
      });
    } finally {
      await context.close();
    }
  });

test("opening a different link warns before discarding the active draft", async ({
  browser,
  request,
}) => {
  const a = await invitation(request),
    b = await invitation(request);
  const context = await browser.newContext();
  const page = await context.newPage();
  try {
    await page.goto(a.url);
    await page.getByRole("button", { name: "Responder", exact: true }).click();
    await page
      .getByLabel("Tu respuesta", { exact: true })
      .fill("Keep this unsaved fictional answer");
    await page.goto(b.url);
    const dialog = page.getByRole("dialog", {
      name: "Abrir otro enlace de invitación",
    });
    await expect(dialog).toBeVisible();
    expect(new URL(page.url()).hash).toBe("");
    await dialog.getByRole("button", { name: "Cancelar", exact: true }).click();
    await expect(page.getByLabel("Tu respuesta", { exact: true })).toHaveValue(
      "Keep this unsaved fictional answer",
    );
    await page
      .getByRole("button", { name: "Guardar borrador", exact: true })
      .click();
    await expect(
      page.getByText(
        "Borrador guardado. Puedes cerrar y volver con tu enlace.",
        { exact: true },
      ),
    ).toBeVisible();
    await page.goto(b.url);
    await dialog
      .getByRole("button", { name: "Abrir enlace", exact: true })
      .click();
    await page.getByRole("button", { name: "Responder", exact: true }).click();
    await expect(page.getByLabel("Tu respuesta", { exact: true })).toHaveValue(
      "",
    );
    await page.goto(a.url);
    await dialog
      .getByRole("button", { name: "Abrir enlace", exact: true })
      .click();
    await page.getByRole("button", { name: "Responder", exact: true }).click();
    await expect(page.getByLabel("Tu respuesta", { exact: true })).toHaveValue(
      "Keep this unsaved fictional answer",
    );
  } finally {
    await context.close();
  }
});

test("analyst creates, renews and revokes a link from the editor without creating an account", async ({
  page,
  request,
  browser,
}) => {
  const fixture = await invitation(request);
  await loginPage(page, "analyst");
  await page.goto(`/projects/${fixture.projectId}/editor`);
  await page.getByRole("tab", { name: "Organizar", exact: true }).click();
  await page
    .getByLabel("Buscar preguntas", { exact: true })
    .fill(fixture.question.question);
  await page
    .getByRole("checkbox", {
      name: `Seleccionar pregunta: ${fixture.question.question}`,
      exact: true,
    })
    .check();
  await page
    .getByRole("button", { name: "Invitar mediante enlace", exact: true })
    .click();
  const dialog = page.getByRole("dialog", { name: "Invitar mediante enlace" });
  const label = "Browser invitation " + randomUUID();
  await dialog
    .getByLabel("Referencia de la invitación", { exact: true })
    .fill(label);
  await dialog
    .getByLabel("Nombre de la persona", { exact: true })
    .fill("Example Respondent");
  await dialog.getByRole("button", { name: "Continuar", exact: true }).click();
  await dialog
    .getByLabel("Área de la aportación", { exact: true })
    .selectOption(fixture.areaId);
  await accessible(page);
  await dialog.getByRole("button", { name: "Continuar", exact: true }).click();
  await dialog.getByRole("button", { name: "Continuar", exact: true }).click();
  await expect(
    dialog.getByRole("heading", { name: "Resumen", exact: true }),
  ).toBeFocused();
  await expect(
    dialog.getByText("1 pregunta publicada", { exact: true }),
  ).toBeVisible();
  const creation = page.waitForResponse(
    (r) =>
      r.url().endsWith(`/projects/${fixture.projectId}/invitations`) &&
      r.request().method() === "POST",
  );
  await dialog
    .getByRole("button", { name: "Crear enlace privado", exact: true })
    .click();
  expect((await creation).status()).toBe(201);
  const linkDialog = page.getByRole("dialog", {
    name: "Enlace privado de respuesta",
  });
  const original = await linkDialog
    .getByLabel("Enlace privado", { exact: true })
    .inputValue();
  expect(new URL(original).hash.length > 40).toBe(true);
  await linkDialog.getByRole("button", { name: "Listo", exact: true }).click();
  await page.getByRole("link", { name: "Invitaciones", exact: true }).click();
  const row = page
    .getByRole("listitem")
    .filter({ has: page.getByText(label, { exact: true }) });
  await expect(row).toBeVisible();
  await row
    .getByRole("button", { name: "Renovar enlace", exact: true })
    .click();
  await page
    .getByRole("dialog", { name: "Renovar enlace privado" })
    .getByRole("button", { name: "Confirmar", exact: true })
    .click();
  const renewed = await linkDialog
    .getByLabel("Enlace privado", { exact: true })
    .inputValue();
  expect(original !== renewed).toBe(true);
  await linkDialog.getByRole("button", { name: "Listo", exact: true }).click();
  await row.getByRole("button", { name: "Revocar", exact: true }).click();
  await page
    .getByRole("dialog", { name: "Revocar invitación" })
    .getByRole("button", { name: "Confirmar", exact: true })
    .click();
  await expect(row).toContainText("Revocado");
  await accessible(page);
  const guest = await browser.newContext();
  try {
    const external = await guest.newPage();
    await external.goto(renewed);
    await expect(
      external.getByRole("heading", { name: "Invitación no disponible" }),
    ).toBeVisible();
    await expect(
      external.getByRole("button", { name: "Iniciar sesión" }),
    ).toHaveCount(0);
  } finally {
    await guest.close();
  }
});

test("an external respondent returns to answer a clarification without an account", async ({
  browser,
  request,
}) => {
  const link = await invitation(request);
  const answer = `Fictional clarification example ${randomUUID()}`;
  const context = await browser.newContext({
    viewport: { width: 390, height: 950 },
  });
  const page = await context.newPage();
  try {
    await page.goto(link.url);
    await page.getByRole("button", { name: "Responder", exact: true }).click();
    await page.getByLabel("Tu respuesta", { exact: true }).fill(answer);
    await page
      .getByRole("button", { name: "Enviar respuesta", exact: true })
      .click();
    await page
      .getByRole("dialog", { name: "Enviar respuesta" })
      .getByRole("button", { name: "Confirmar envío", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Respuesta enviada", exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Todas las preguntas" }).click();
    await page.getByRole("button", { name: "Salir", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Hasta luego" }),
    ).toBeVisible();
    const me = await (await request.get("/api/v1/auth/me")).json();
    const base = `/api/v1/projects/${link.projectId}/questions/${link.question.id}`;
    const detail: ReviewDetail = await (
      await request.get(base + "/review")
    ).json();
    const own = detail.submissions.find((r) => r.answer === answer);
    expect(own).toBeTruthy();
    const requested = await request.post(
      base + "/review/clarifications/request",
      {
        headers: {
          Origin: process.env.E2E_URL || "http://localhost:4317",
          "X-CSRF-Token": me.csrfToken,
        },
        data: {
          requestId: randomUUID(),
          expectedVersion: detail.lockVersion,
          responseRevisionId: own!.id,
          body: "Please clarify the fictional scope.",
        },
      },
    );
    expect(requested.status()).toBe(201);
    await page.goto(link.url);
    await expect(
      page.getByText("Tienes una aclaración por responder", { exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Consultar respuesta", exact: true })
      .click();
    await expect(
      page.getByText("Please clarify the fictional scope.", { exact: true }),
    ).toBeVisible();
    await page
      .getByLabel("Tu aclaración", { exact: true })
      .fill("Only the fictional example is included.");
    await accessible(page);
    await page
      .getByRole("button", { name: "Enviar aclaración", exact: true })
      .click();
    await expect(
      page.getByText("Aclaración enviada.", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Tu aclaración está pendiente de revisión", {
        exact: true,
      }),
    ).toBeVisible();
    await page.reload();
    await page
      .getByRole("button", { name: "Consultar respuesta", exact: true })
      .click();
    await expect(
      page.getByText("Only the fictional example is included.", {
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Iniciar sesión" }),
    ).toHaveCount(0);
  } finally {
    await context.close();
  }
});

test("external network errors preserve the answer and move focus to actionable feedback", async ({
  browser,
  request,
}) => {
  const link = await invitation(request);
  const context = await browser.newContext({
    viewport: { width: 390, height: 950 },
  });
  const page = await context.newPage();
  try {
    await page.goto(link.url);
    await page.getByRole("button", { name: "Responder", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: link.question.question, exact: true }),
    ).toBeFocused();
    const answer = page.getByLabel("Tu respuesta", { exact: true });
    await answer.fill(
      "Preserve this fictional answer during a network outage.",
    );
    const path = `**/api/v1/invitations/access/questions/${link.question.id}/draft`;
    await page.route(path, (route) => route.abort("failed"));
    await page
      .getByRole("button", { name: "Guardar borrador", exact: true })
      .click();
    const alert = page
      .getByRole("alert")
      .filter({ hasText: "No hay conexión" });
    await expect(alert).toBeVisible();
    await expect(alert.locator("..")).toBeFocused();
    await expect(answer).toHaveValue(
      "Preserve this fictional answer during a network outage.",
    );
    await accessible(page);
    await page.unroute(path);
    await page
      .getByRole("button", { name: "Guardar borrador", exact: true })
      .click();
    await expect(
      page.getByText(
        "Borrador guardado. Puedes cerrar y volver con tu enlace.",
        { exact: true },
      ),
    ).toBeVisible();
    await expect(answer).toHaveValue(
      "Preserve this fictional answer during a network outage.",
    );
  } finally {
    await context.close();
  }
});

test("unavailable invitation exposes no account navigation or question content", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 950 },
  });
  const page = await context.newPage();
  try {
    await page.goto("/invite#" + "a".repeat(43));
    await expect(
      page.getByRole("heading", { name: "Invitación no disponible" }),
    ).toBeVisible();
    expect(new URL(page.url()).hash).toBe("");
    await expect(
      page.getByRole("button", { name: "Iniciar sesión" }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Responder", exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByText(
        "Abre el enlace original o solicita uno nuevo a quien te invitó.",
      ),
    ).toBeVisible();
    await accessible(page);
  } finally {
    await context.close();
  }
});

test("ACTA NEXT: crear desde el gestor conserva alcance explícito y el invitado móvil distingue guardar de enviar", async ({
  page,
  request,
  browser,
}) => {
  test.setTimeout(120000);
  const fixture = await invitation(request);
  await loginPage(page, "analyst");
  await page.goto(`/projects/${fixture.projectId}/invitations`);
  await page.setViewportSize({ width: 390, height: 844 });
  await page
    .getByRole("button", { name: "Crear invitación", exact: true })
    .click();
  const dialog = page.getByRole("dialog", { name: "Invitar mediante enlace" });
  const label = `Consulta ficticia desde el gestor ${randomUUID()}`;
  await dialog
    .getByLabel("Referencia de la invitación", { exact: true })
    .fill(label);
  await dialog
    .getByLabel("Nombre de la persona", { exact: true })
    .fill("Persona ficticia del gestor");
  await dialog
    .getByLabel("Organización (opcional)")
    .fill("Example Organization");
  await accessible(page);
  await dialog.getByRole("button", { name: "Continuar", exact: true }).click();
  await expect(
    dialog.getByRole("heading", { name: "Preguntas", exact: true }),
  ).toBeFocused();
  await dialog
    .getByRole("searchbox", { name: "Buscar preguntas publicadas" })
    .fill(fixture.question.externalId);
  await dialog
    .getByRole("checkbox", {
      name: `${fixture.question.externalId} · ${fixture.question.question}`,
      exact: true,
    })
    .check();
  await dialog
    .getByLabel("Área de la aportación", { exact: true })
    .selectOption(fixture.areaId);
  await accessible(page);
  await dialog.getByRole("button", { name: "Continuar", exact: true }).click();
  await dialog
    .getByLabel("Permitir adjuntar y descargar evidencia propia")
    .check();
  await accessible(page);
  await dialog.getByRole("button", { name: "Continuar", exact: true }).click();
  await expect(
    dialog.getByRole("heading", { name: "Resumen", exact: true }),
  ).toBeFocused();
  await expect(
    dialog.getByText("Persona ficticia del gestor", { exact: true }),
  ).toBeVisible();
  await expect(
    dialog.getByText("No se enviará ningún correo.", { exact: false }),
  ).toBeVisible();
  await accessible(page);
  const creation = page.waitForResponse(
    (r) =>
      r.url().endsWith(`/projects/${fixture.projectId}/invitations`) &&
      r.request().method() === "POST",
  );
  await dialog
    .getByRole("button", { name: "Crear enlace privado", exact: true })
    .click();
  const created = await creation;
  expect(created.status()).toBe(201);
  const body = await created.json();
  expect(body.invitation.questionIds).toEqual([fixture.question.id]);
  expect(body.invitation.identity).toEqual({
    name: "Persona ficticia del gestor",
    organization: "Example Organization",
  });
  expect(body.invitation.allowEvidence).toBe(true);
  const linkDialog = page.getByRole("dialog", {
    name: "Enlace privado de respuesta",
  });
  const url = await linkDialog
    .getByLabel("Enlace privado", { exact: true })
    .inputValue();
  await linkDialog.getByRole("button", { name: "Listo", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Crear invitación", exact: true }),
  ).toBeFocused();
  const row = page
    .locator(".invitation-management > li")
    .filter({ has: page.getByText(label, { exact: true }) });
  await expect(
    row.getByRole("heading", {
      name: "Persona ficticia del gestor",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    row.getByText("0 de 1 preguntas con envío", { exact: true }),
  ).toBeVisible();
  await expect(row.getByText("Activo", { exact: true })).toBeVisible();
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  try {
    const guest = await context.newPage();
    await guest.goto(url);
    await expect(guest.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(
      guest.locator(".invitation-content > .eyebrow"),
    ).not.toBeEmpty();
    await guest.getByRole("button", { name: "Responder", exact: true }).click();
    await expect(
      guest.getByText("Pregunta 1 de 1", { exact: true }),
    ).toBeVisible();
    await guest
      .getByLabel("Tu respuesta", { exact: true })
      .fill("Aportación ficticia desde el gestor");
    await expect(guest.getByRole("status")).toHaveText("Cambios sin guardar");
    await expect(
      guest.getByText(/Enviar entrega esta respuesta para revisión/),
    ).toBeVisible();
    await guest
      .getByRole("button", { name: "Guardar borrador", exact: true })
      .click();
    await expect(guest.getByRole("status")).toContainText("Borrador guardado");
    await accessible(guest);
    await guest
      .getByRole("button", { name: "Enviar respuesta", exact: true })
      .click();
    await guest
      .getByRole("dialog")
      .getByRole("button", { name: "Confirmar envío", exact: true })
      .click();
    await expect(
      guest.getByRole("region", { name: "Respuesta enviada", exact: true }),
    ).toBeVisible();
    await guest
      .getByRole("button", { name: "← Todas las preguntas", exact: true })
      .click();
    await expect(guest.getByRole("status")).toHaveText(
      "1 de 1 preguntas con respuesta enviada",
    );
  } finally {
    await context.close();
  }
  await page.reload();
  await expect(
    row.getByText("1 de 1 preguntas con envío", { exact: true }),
  ).toBeVisible();
  await expect(
    row.getByText("Sin aperturas registradas", { exact: true }),
  ).toHaveCount(0);
});
