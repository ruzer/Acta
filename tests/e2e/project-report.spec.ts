import { expect } from "@playwright/test";
import { test } from "./fixtures/installation-branding";
import AxeBuilder from "@axe-core/playwright";
import { mkdir, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { PDFDocument } from "pdf-lib";
import { login } from "./login-helper";
import { smallTargets } from "./fixtures/page-checks";
import {
  apiSession,
  seedDocumentCases,
  type DocumentCases,
} from "./fixtures/review-cases";
let cases: DocumentCases;
test.beforeAll(async ({ baseURL }) => {
  test.setTimeout(180000);
  cases = await seedDocumentCases(baseURL!);
  const admin = await apiSession(baseURL!, "admin");
  try {
    const users =
      await admin.call<{ id: string; username: string }[]>("/users");
    await admin.call(`/projects/${cases.project.id}/members`, {
      userId: users.find((u) => u.username === "stakeholder")!.id,
      role: "STAKEHOLDER",
      areaId: cases.questions.decision.responsibleAreaId,
      active: true,
    });
  } finally {
    await admin.dispose();
  }
  if (process.env.ACTA_REPORT_EVIDENCE_DIR) {
    await mkdir(process.env.ACTA_REPORT_EVIDENCE_DIR, { recursive: true });
    await writeFile(
      `${process.env.ACTA_REPORT_EVIDENCE_DIR}/project.json`,
      JSON.stringify({ id: cases.project.id }),
    );
  }
});
for (const username of ["admin", "analyst", "viewer"]) {
  test(`informe: ${username} consulta e imprime solo decisiones vigentes y sus fuentes`, async ({
    page,
  }) => {
    await login(page, username);
    if (username === "viewer") {
      await page.goto(`/projects/${cases.project.id}`);
      await page
        .locator(".ac-shell-sidebar")
        .getByText("Más herramientas", { exact: true })
        .click();
    } else await page.goto(`/projects/${cases.project.id}/decisions`);
    await page.getByRole("link", { name: "Informe para imprimir" }).click();
    await expect(
      page.getByRole("heading", { name: "Informe de decisiones" }),
    ).toBeVisible();
    await expect(page.getByRole("article")).toHaveCount(1);
    await expect(
      page.getByRole("heading", { name: cases.questions.decision.question }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: cases.questions.reopened.question }),
    ).toHaveCount(0);
    await expect(
      page.getByText(
        "El plazo máximo de pago es de 20 días naturales contados desde la recepción de la factura validada por Almacén. Se admiten 30 días naturales únicamente para bienes de importación.",
        { exact: true },
      ),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Aclaración utilizada" }).first(),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Resolución utilizada" }),
    ).toBeVisible();
    await expect(page.locator(".report-sources li")).toHaveCount(3);
    expect(await page.locator(".project-report").innerText()).not.toMatch(
      /[a-f0-9]{8}-[a-f0-9]{4}-|VALIDATED|LONG_TEXT|Comentario interno ficticio/,
    );
    for (const width of [1440, 768, 390]) {
      await page.setViewportSize({ width, height: 1000 });
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
      if (width <= 899)
        expect(
          await smallTargets(page),
          `objetivos táctiles del informe a ${width}px`,
        ).toEqual([]);
      if (username === "analyst" && process.env.ACTA_REPORT_EVIDENCE_DIR)
        await page.screenshot({
          path: `${process.env.ACTA_REPORT_EVIDENCE_DIR}/report-after-${width}.png`,
          fullPage: true,
        });
    }
    await page.emulateMedia({ media: "print" });
    await expect(page.locator(".ac-shell-sidebar")).toBeHidden();
    await expect(page.locator(".ac-shell-context")).toBeHidden();
    await expect(page.locator(".ac-shell-mobile")).toBeHidden();
    await expect(
      page.getByRole("button", { name: "Imprimir o guardar como PDF" }),
    ).toBeHidden();
    await expect(
      page.getByRole("heading", { name: "Informe de decisiones" }),
    ).toBeVisible();
    const bytes = await page.pdf({
      format: "A4",
      printBackground: true,
      ...(username === "analyst" && process.env.ACTA_REPORT_EVIDENCE_DIR
        ? {
            path: `${process.env.ACTA_REPORT_EVIDENCE_DIR}/informe-ficticio.pdf`,
          }
        : {}),
    });
    expect((await PDFDocument.load(bytes)).getPageCount()).toBeGreaterThan(0);
    await page.emulateMedia({ media: "screen" });
    await page
      .getByRole("link", {
        name:
          username === "viewer"
            ? "Volver a preguntas publicadas"
            : "Volver a decisiones",
      })
      .click();
    await expect(page).toHaveURL(
      new RegExp(
        `/projects/${cases.project.id}${username === "viewer" ? "" : "/decisions"}$`,
      ),
    );
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });
}
test("informe: un participante no recibe el exporte ni se amplía su acceso", async ({
  page,
}) => {
  await login(page, "stakeholder");
  const response = page.waitForResponse((r) =>
    r.url().endsWith(`/projects/${cases.project.id}/exports`),
  );
  await page.goto(`/projects/${cases.project.id}/report`);
  expect((await response).status()).toBe(403);
  await expect(page.getByRole("article")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Imprimir o guardar como PDF" }),
  ).toHaveCount(0);
});
test("informe: proyecto sin decisiones muestra un estado vacío accesible", async ({
  page,
  baseURL,
}) => {
  const admin = await apiSession(baseURL!, "admin");
  let project: { id: string };
  try {
    project = await admin.call("/projects", {
      externalId: "REPORT-" + randomUUID(),
      name: "Informe ficticio vacío",
      description: "",
    });
  } finally {
    await admin.dispose();
  }
  await login(page, "admin");
  await page.goto(`/projects/${project.id}/report`);
  await expect(
    page.getByRole("heading", { name: "Todavía no hay decisiones vigentes" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Imprimir o guardar como PDF" }),
  ).toBeDisabled();
});

test("informe conserva el logotipo configurado al imprimir", async ({
  page,
  restoreBranding,
}) => {
  await login(page, "admin");
  await restoreBranding();
  await page.goto("/admin/settings/appearance");
  const png = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 180;
    canvas.height = 60;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#2b4d7c";
    ctx.fillRect(0, 0, 180, 60);
    ctx.fillStyle = "white";
    ctx.font = "24px sans-serif";
    ctx.fillText("EJEMPLO", 25, 38);
    return canvas.toDataURL("image/png").split(",")[1]!;
  });
  await page
    .getByLabel("Subir logotipo principal")
    .setInputFiles({
      name: "logo-ficticio.png",
      mimeType: "image/png",
      buffer: Buffer.from(png, "base64"),
    });
  await page
    .getByRole("button", { name: "Guardar logotipo principal", exact: true })
    .click();
  await expect(
    page.getByText("Logotipo principal guardado.", { exact: true }),
  ).toBeVisible();
  await page.goto(`/projects/${cases.project.id}/report`);
  await expect(
    page.getByRole("heading", { name: "Informe de decisiones" }),
  ).toBeVisible();
  const logo = page.locator(".report-heading img");
  await expect(logo).toBeVisible();
  await expect(logo).toHaveJSProperty("complete", true);
  expect(
    await logo.evaluate((el: HTMLImageElement) => el.naturalWidth),
  ).toBeGreaterThan(0);
  if (process.env.ACTA_REPORT_EVIDENCE_DIR)
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.screenshot({
        path: `${process.env.ACTA_REPORT_EVIDENCE_DIR}/report-logo-${width}.png`,
        fullPage: true,
      });
    }
  await page.emulateMedia({ media: "print" });
  await expect(logo).toBeVisible();
  if (process.env.ACTA_REPORT_EVIDENCE_DIR)
    await page.pdf({
      path: `${process.env.ACTA_REPORT_EVIDENCE_DIR}/informe-ficticio-con-logo.pdf`,
      format: "A4",
      printBackground: true,
    });
});
