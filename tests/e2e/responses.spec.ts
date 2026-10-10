import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { PDFDocument } from "pdf-lib";
import { login, logout } from "./login-helper";
async function openQuestion(page: Page, title: string) {
  const target = await page.evaluate(async (title) => {
    const projects = await (await fetch("/api/v1/projects")).json();
    const p = projects.find(
      (p: { externalId: string }) => p.externalId === "DEMO-PRINCIPAL",
    );
    const work = await (await fetch(`/api/v1/projects/${p.id}/my-work`)).json();
    const q = work.sections
      .flatMap(
        (s: { questions: { id: string; title: string; question: string }[] }) =>
          s.questions,
      )
      .find((q: { title: string }) => q.title === title);
    return { projectId: p.id, ...q };
  }, title);
  await page.goto(`/projects/${target.projectId}/respond/${target.id}`);
  await expect(
    page.getByRole("heading", { name: target.question, exact: true }),
  ).toBeVisible();
}
async function save(page: Page) {
  const url = page.url();
  await page
    .getByRole("button", { name: "Guardar y salir", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Mi trabajo", exact: true }),
  ).toBeVisible();
  await page.goto(url);
  await expect(
    page.getByRole("status").filter({ hasText: "Borrador guardado" }),
  ).toBeVisible();
}
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
test("A: guardar, cerrar sesión, regresar y recuperar; sin contenido en localStorage", async ({
  page,
}) => {
  await login(page, "stakeholder");
  await openQuestion(page, "Nombre del procedimiento");
  const text = "Procedimiento ficticio para solicitudes escritas";
  await page.getByLabel("Tu respuesta", { exact: true }).fill(text);
  await page
    .getByLabel("Comentario adicional (opcional)")
    .fill("Consultar una guía ficticia");
  await page.getByRole("button", { name: "Necesito consultar esto" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Pregunta marcada" }),
  ).toBeVisible();
  await logout(page);
  await login(page, "stakeholder");
  await openQuestion(page, "Nombre del procedimiento");
  await expect(page.getByLabel("Tu respuesta", { exact: true })).toHaveValue(
    text,
  );
  await expect(
    page.locator(".ac-status").filter({ hasText: "Por consultar" }),
  ).toBeVisible();
  expect(await page.evaluate(() => JSON.stringify(localStorage))).not.toContain(
    text,
  );
  await page.screenshot({
    path: "artifacts/2c-draft-desktop.png",
    fullPage: true,
  });
});
test("C: dos pestañas, conflicto conserva texto y recuperación del servidor guarda copia local", async ({
  page,
  context,
}) => {
  await login(page, "stakeholder");
  await openQuestion(page, "Nombre del procedimiento");
  await save(page);
  const other = await context.newPage();
  await other.goto(page.url());
  await expect(other.getByLabel("Tu respuesta", { exact: true })).toBeVisible();
  await page
    .getByLabel("Tu respuesta", { exact: true })
    .fill("Ganó la primera pestaña");
  await other
    .getByLabel("Tu respuesta", { exact: true })
    .fill("Texto local de la segunda pestaña");
  await save(page);
  await other
    .getByRole("button", { name: "Guardar y salir", exact: true })
    .click();
  await expect(other.getByRole("alert")).toContainText(
    "El borrador fue actualizado desde otra sesión o pestaña.",
  );
  await expect(other.getByLabel("Tu respuesta", { exact: true })).toHaveValue(
    "Texto local de la segunda pestaña",
  );
  await other
    .getByRole("button", { name: "Consultar versión del servidor" })
    .click();
  await expect(other.getByRole("dialog")).toContainText(
    "Ganó la primera pestaña",
  );
  await accessible(other);
  await other
    .getByRole("button", {
      name: "Usar versión del servidor y conservar copia local",
    })
    .click();
  await expect(other.getByLabel("Tu respuesta", { exact: true })).toHaveValue(
    "Ganó la primera pestaña",
  );
  await expect(other.getByRole("complementary")).toContainText(
    "Texto local de la segunda pestaña",
  );
  await other.close();
});
test("Sesión expirada conserva texto en memoria durante reautenticación", async ({
  page,
}) => {
  await login(page, "stakeholder");
  await openQuestion(page, "Nombre del procedimiento");
  await page
    .getByLabel("Tu respuesta", { exact: true })
    .fill("Texto pendiente mientras recupero sesión");
  await page.evaluate(async () => {
    const me = await (await fetch("/api/v1/auth/me")).json();
    await fetch("/api/v1/auth/logout", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CSRF-Token": me.csrfToken,
      },
      body: "{}",
    });
  });
  await page
    .getByRole("button", { name: "Guardar y salir", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("Tus cambios siguen en esta pestaña");
  await dialog.getByLabel("Usuario", { exact: true }).fill("stakeholder");
  await dialog
    .getByLabel("Contraseña", { exact: true })
    .fill(process.env.DEMO_PASSWORD! + "-Reviewed2B");
  await dialog
    .getByRole("button", { name: "Iniciar sesión", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByLabel("Tu respuesta", { exact: true })).toHaveValue(
    "Texto pendiente mientras recupero sesión",
  );
  await save(page);
});
test("B: PDF ficticio, guardar, enviar, consultar y descargar evidencia del envío", async ({
  page,
}) => {
  await login(page, "stakeholder");
  await openQuestion(page, "Nombre del procedimiento");
  const previousAttachments = page.getByRole("button", {
    name: "Retirar ejemplo-ficticio.pdf",
    exact: true,
  });
  while (await previousAttachments.count()) {
    const count = await previousAttachments.count();
    await previousAttachments.first().click();
    await expect(previousAttachments).toHaveCount(count - 1);
  }

  await page
    .getByLabel("Tu respuesta", { exact: true })
    .fill("Procedimiento documentado ficticio");
  const pdf = await PDFDocument.create();
  pdf.addPage().drawText("Documento ficticio de prueba 2C");
  await page.getByText("Adjuntar evidencia", { exact: true }).click();
  await page.getByLabel("Seleccionar evidencia").setInputFiles({
    name: "ejemplo-ficticio.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from(await pdf.save()),
  });
  await page.getByRole("button", { name: "Adjuntar al borrador" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Evidencia adjunta" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Enviar respuesta", exact: true })
    .click();
  await accessible(page);

  await expect(
    page.getByRole("status").filter({ hasText: "Respuesta enviada." }),
  ).toBeVisible();
  await openQuestion(page, "Nombre del procedimiento");
  await expect(
    page.getByRole("heading", { name: "Tu respuesta", exact: true }),
  ).toBeVisible();
  const download = page.waitForEvent("download");
  const downloadResponse = page.waitForResponse((response) =>
    response.url().endsWith("/download"),
  );
  await page
    .getByRole("button", { name: "Descargar ejemplo-ficticio.pdf" })
    .first()
    .click();
  expect((await download).suggestedFilename()).toBe("ejemplo-ficticio.pdf");
  const headers = (await downloadResponse).headers();
  expect(headers["x-content-type-options"]).toBe("nosniff");
  expect(headers["content-disposition"]).toMatch(/^attachment/);
  expect(headers["cache-control"]).toBe("no-store");
  await accessible(page);
  await page.screenshot({
    path: "artifacts/2c-submitted-desktop.png",
    fullPage: true,
  });
});
test("D: móvil/tablet, matriz por filas, número y fecha guardados con navegación accesible", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page, "stakeholder");
  await openQuestion(page, "Responsabilidad por actividad");
  await page
    .getByRole("combobox", { name: "Recibir la solicitud" })
    .selectOption({ label: "Área solicitante" });
  await page
    .getByRole("combobox", { name: "Revisar la información" })
    .selectOption({ label: "Área revisora" });
  await save(page);
  await accessible(page);
  await page.screenshot({
    path: "artifacts/2c-matrix-mobile.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Guardar y salir" }).click();
  await expect(
    page.getByRole("heading", { name: "Mi trabajo", exact: true }),
  ).toBeVisible();
  await openQuestion(page, "Plazo de atención");
  await page.getByLabel("Tu respuesta: número").fill("12");
  await save(page);
  await accessible(page);
  await page.setViewportSize({ width: 768, height: 1024 });
  await openQuestion(page, "Inicio del procedimiento");
  await page.getByLabel("Tu respuesta: fecha").fill("2026-09-28");
  await save(page);
  await accessible(page);
  await page.screenshot({
    path: "artifacts/2c-date-tablet.png",
    fullPage: true,
  });
});
