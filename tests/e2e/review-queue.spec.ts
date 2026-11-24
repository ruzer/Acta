import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { randomUUID } from "node:crypto";
import type { QuestionView, ResponseView } from "@requirements/contracts";
import { asUser, command, prepare, type Fixture } from "./fixtures/workbench";
import { login } from "./login-helper";

let fixture: Fixture;
test.use({ actionTimeout: 15000 });
test.beforeAll(async ({ browser }) => {
  test.setTimeout(240000);
  fixture = await prepare(browser);
  const questions = await asUser(browser, "admin", async (page) => {
    const path = `/projects/${fixture.project.id}`;
    const members = await command<{ id: string; userId: string }[]>(
      page,
      `${path}/members`,
    );
    const member = members.find(
      (item) => item.userId === fixture.participantId,
    )!;
    const questions: QuestionView[] = [];
    for (let index = 1; index <= 3; index++) {
      let question = await command<QuestionView>(page, `${path}/questions`, {
        externalId: `COLA-${index}`,
        sectionId: fixture.questions[0]!.sectionId,
        title: `Revisión de cola ${index}`,
        question: `¿Cómo se revisa el caso de cola ${index}?`,
        type: "SHORT_TEXT",
        required: true,
        priority: "P1",
        responsibleAreaId: fixture.area.id,
        order: 100 + index,
      });
      question = await command<QuestionView>(
        page,
        `${path}/questions/${question.id}/assign`,
        {
          projectMemberId: member.id,
          required: true,
          active: true,
          expectedVersion: question.lockVersion,
        },
      );
      question = await command<QuestionView>(
        page,
        `${path}/questions/${question.id}/publish`,
        { expectedVersion: question.lockVersion },
      );
      questions.push(question);
    }
    return questions;
  });
  await asUser(browser, "stakeholder", async (page) => {
    for (const question of questions) {
      const path = `/projects/${fixture.project.id}/questions/${question.id}/response`;
      const initial = await command<ResponseView>(page, path);
      const draft = await command<ResponseView>(
        page,
        `${path}/draft`,
        {
          requestId: randomUUID(),
          expectedVersion: initial.lockVersion,
          answer: "Respuesta ficticia para decidir.",
          comment: "",
          example: "",
          consultationRequested: false,
        },
        "PUT",
      );
      await command(page, `${path}/submit`, {
        requestId: randomUUID(),
        expectedVersion: draft.lockVersion,
      });
    }
  });
});

test("F5: revisar tres preguntas conserva la cola al decidir y permite volver sin nuevas lecturas", async ({
  page,
}) => {
  await login(page, "analyst");
  const search = new URLSearchParams({
    projectId: fixture.project.id,
    status: "ANSWERED",
    priority: "P1",
  });
  await page.goto(`/review?${search}`);
  await expect(page.locator(".review-inbox h2 a")).toHaveCount(3);
  const order = await page
    .locator(".review-inbox h2 a")
    .evaluateAll((links) =>
      links.map((link) => new URL((link as HTMLAnchorElement).href).pathname),
    );
  let queueReads = 0;
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (
      url.pathname === "/api/v1/review" &&
      url.searchParams.get("pageSize") === "100"
    )
      queueReads++;
  });
  await page.locator(".review-inbox h2 a").first().click();
  await expect(page.locator(".review-queue [role=status]")).toContainText(
    "Pregunta 1 de 3",
  );
  await expect(page.locator("main h1")).toBeFocused();
  expect(queueReads).toBe(1);
  for (let index = 0; index < 3; index++) {
    expect(new URL(page.url()).pathname).toBe(order[index]);
    await expect(page.locator(".review-queue [role=status]")).toContainText(
      `Pregunta ${index + 1} de 3`,
    );
    await page
      .getByRole("button", { name: "Registrar decisión", exact: true })
      .click();
    const dialog = page.getByRole("dialog");
    await dialog
      .getByLabel("Decisión acordada")
      .fill(`Decisión ficticia ${index + 1}`);
    await dialog
      .getByLabel("Alcance", { exact: true })
      .fill("Solo esta prueba");
    await dialog.getByLabel("Comentario interno").fill("Aportación comprobada");
    await dialog
      .getByRole("checkbox", { name: /Participante demo · envío/ })
      .check();
    await dialog
      .getByRole("button", {
        name:
          index < 2
            ? "Guardar y pasar a la siguiente"
            : "Registrar como validada",
        exact: true,
      })
      .click();
    await expect(dialog).toHaveCount(0);
    if (index < 2)
      await expect(page.locator(".review-queue [role=status]")).toContainText(
        `Pregunta ${index + 2} de 3`,
      );
    else
      await expect(page.locator(".ac-state-card .ac-status")).toHaveText(
        "Validada",
      );
    await expect(page.locator("main h1")).toBeFocused();
  }
  expect(queueReads).toBe(1);
  await page.reload();
  await expect(page.locator(".review-queue [role=status]")).toContainText(
    "Pregunta 3 de 3",
  );
  expect(queueReads).toBe(1);
  await expect(
    page.getByRole("link", { name: "← Revisar respuestas", exact: true }),
  ).toHaveAttribute("href", `/review?${search}`);
  await expect(
    page.getByRole("link", { name: /Siguiente: pregunta/ }),
  ).toHaveCount(0);
  await page.getByRole("link", { name: /Anterior: pregunta 2 de 3/ }).click();
  await expect(page.locator(".review-queue [role=status]")).toContainText(
    "Pregunta 2 de 3",
  );
  await expect(page.locator(".ac-state-card .ac-status")).toHaveText(
    "Validada",
  );
  expect(queueReads).toBe(1);
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: width === 1440 ? 900 : 844 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    const axe = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
      .analyze();
    expect(axe.violations).toEqual([]);
    for (const link of await page.locator(".review-queue nav a").all())
      expect((await link.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  }
});
