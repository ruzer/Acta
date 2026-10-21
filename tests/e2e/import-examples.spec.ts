import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { login } from "./login-helper";

async function request(page: Page, path: string, input?: unknown) {
  return page.evaluate(
    async ({ path, input }) => {
      const me = await (await fetch("/api/v1/auth/me")).json();
      const r = await fetch("/api/v1" + path, {
        method: input ? "POST" : "GET",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": me.csrfToken,
        },
        ...(input ? { body: JSON.stringify(input) } : {}),
      });
      if (!r.ok) throw new Error(`Request failed: ${r.status}`);
      return r.json();
    },
    { path, input },
  );
}
for (const kind of ["minimal", "full"] as const) {
  test(`public ${kind} download → prepare → correct → preview → confirm`, async ({
    page,
  }, testInfo) => {
    await login(page, "admin");
    const code = "EXAMPLE-" + randomUUID();
    const project = await request(page, "/projects", {
      externalId: code,
      name: "Ejemplo de importación",
      description: "Datos ficticios",
    });
    await page.goto(`/projects/${project.id}/import`);
    const help = page
      .locator("summary")
      .filter({ hasText: "Cómo preparar el archivo" });
    await help.focus();
    await page.keyboard.press("Enter");
    await expect(
      page.getByText(/Copia su identificador externo exactamente/),
    ).toBeVisible();
    const pending = page.waitForEvent("download");
    await page
      .getByRole("link", {
        name:
          kind === "minimal"
            ? "Descargar ejemplo mínimo"
            : "Descargar ejemplo completo",
      })
      .click();
    const download = await pending;
    expect(download.suggestedFilename()).toBe(
      `questionnaire-template.${kind}.json`,
    );
    const bytes = await readFile((await download.path())!);
    const original = await readFile(
      `examples/questionnaire-template.${kind}.json`,
    );
    expect(bytes.equals(original)).toBe(true);
    const file = JSON.parse(bytes.toString());
    // Adapt the project ID exactly as explained to the user; no other implicit conversion.
    file.project.externalId = code;
    const invalid = structuredClone(file);
    invalid.questions[0].sectionExternalId = "MISSING";
    async function select(data: unknown) {
      await page.getByLabel("Archivo JSON").setInputFiles({
        name: "questionnaire.json",
        mimeType: "application/json",
        buffer: Buffer.from(JSON.stringify(data)),
      });
      await page
        .getByRole("button", { name: "Revisar archivo", exact: true })
        .click();
    }
    await select(invalid);
    await expect(page.getByText("Pregunta 1 · Tema de destino")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Confirmar importación" }),
    ).toBeDisabled();
    expect(
      (await request(page, `/projects/${project.id}/questionnaire`)).questions,
    ).toEqual([]);
    await page
      .getByRole("group")
      .filter({ hasText: "/questions/0/sectionExternalId" })
      .getByText("Detalles técnicos", { exact: true })
      .click();
    await expect(
      page.getByText("/questions/0/sectionExternalId", { exact: true }),
    ).toBeVisible();
    await select(file);
    await expect(
      page.getByRole("heading", { name: "2. Revisar importación" }),
    ).toBeFocused();
    await expect(page.getByText("0 errores", { exact: false })).toBeVisible();
    const consent = page.getByLabel(
      "Confirmo crear estas áreas en la institución",
    );
    if (await consent.isVisible()) await consent.check();
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
    await page.setViewportSize({ width: 390, height: 844 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
    await page.screenshot({
      path: testInfo.outputPath("import-mobile.png"),
      fullPage: true,
    });
    await page.getByRole("button", { name: "Confirmar importación" }).click();
    await expect(
      page.getByText(
        new RegExp(
          `Importación completada: ${file.questions.length} preguntas`,
        ),
      ),
    ).toBeVisible();
    const structure = await request(
      page,
      `/projects/${project.id}/questionnaire`,
    );
    expect(structure.questions).toHaveLength(file.questions.length);
    expect(
      structure.questions.every(
        (q: { publication: string }) => q.publication === "DRAFT",
      ),
    ).toBe(true);
    await page
      .getByRole("link", { name: "Revisar estructura importada" })
      .click();
    await expect(page).toHaveURL(new RegExp(`/projects/${project.id}/editor`));
    await expect(page.getByRole("tab", { name: "Escribir" })).toBeVisible();
  });
}
