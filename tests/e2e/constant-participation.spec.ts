import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import type {
  ResponseView,
  QuestionnaireView,
  QuestionView,
} from "@requirements/contracts";
import { login } from "./login-helper";
import { command } from "./fixtures/workbench";
import { draftProject } from "./fixtures/constant-use";
import { checkedPage } from "./fixtures/page-checks";
test.use({ actionTimeout: 15000 });
const evidence =
  process.env.ACTA_DIRECTION_C_EVIDENCE_DIR ?? "test-results/design-evidence";
test("Participación muestra cuatro estados, filtra, ordena y copia un recordatorio sin respuestas", async ({
  page,
  browser,
  context,
}) => {
  test.setTimeout(180000);
  await login(page, "admin");
  const fixture = await draftProject(page);
  const base = `/projects/${fixture.project.id}`;
  const accounts = [];
  for (const [name, submissions] of [
    ["No inició", 0],
    ["Persona con avance", 1],
    ["Completó", 2],
  ] as const) {
    const username = `part_${randomUUID().replaceAll("-", "").slice(0, 14)}`;
    const user = await command<{ id: string }>(page, "/users", {
      username,
      displayName: name,
      temporaryPassword: process.env.DEMO_PASSWORD,
    });
    const member = await command<{ id: string }>(page, `${base}/members`, {
      userId: user.id,
      role: "STAKEHOLDER",
      areaId: fixture.area.id,
      active: true,
    });
    const questionnaire = await command<QuestionnaireView>(
      page,
      `${base}/questionnaire`,
    );
    for (const q of questionnaire.questions) {
      await command<QuestionView>(page, `${base}/questions/${q.id}/assign`, {
        projectMemberId: member.id,
        active: true,
        required: true,
        expectedVersion: q.lockVersion,
      });
    }
    accounts.push({ username, submissions });
  }
  for (const account of [
    { username: "stakeholder", submissions: -1 },
    ...accounts,
  ]) {
    const person = await browser.newPage();
    try {
      await login(person, account.username, {
        temporary: account.username !== "stakeholder",
      });
      for (
        let i = 0;
        i < (account.submissions < 0 ? 1 : account.submissions);
        i++
      ) {
        const path = `${base}/questions/${fixture.questions[i].id}/response`;
        const before = await command<ResponseView>(person, path);
        const saved = await command<ResponseView>(
          person,
          `${path}/draft`,
          {
            requestId: randomUUID(),
            expectedVersion: before.lockVersion,
            answer: "Contenido de respuesta ficticia privado",
            comment: "",
            example: "",
            consultationRequested: false,
          },
          "PUT",
        );
        if (account.submissions > 0)
          await command(person, `${path}/submit`, {
            requestId: randomUUID(),
            expectedVersion: saved.lockVersion,
          });
      }
    } finally {
      await person.close();
    }
  }
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  for (const role of ["admin", "analyst"]) {
    if (role !== "admin") {
      await page.locator(".ac-mobile-account > summary").click();
      await page
        .getByRole("button", { name: "Cerrar sesión", exact: true })
        .click();
      await login(page, role);
    }
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 950 });
      await page.goto(`${base}/participation`);
      const table = page.getByRole("table", {
        name: "Participación por persona",
      });
      for (const state of [
        "Sin iniciar",
        "En borrador",
        "Envió parte",
        "Completo",
      ])
        await expect(
          table.getByRole("cell", { name: state, exact: true }),
        ).toHaveCount(1);
      await page.getByLabel("Ordenar participación").selectOption("pending");
      await page.getByLabel("Filtrar participación").selectOption("Completo");
      await expect(table.getByRole("row")).toHaveCount(2);
      await page.getByLabel("Filtrar participación").selectOption("");
      const individual = table
        .getByRole("row")
        .filter({
          has: page.getByRole("cell", { name: "No inició", exact: true }),
        })
        .getByRole("button", {
          name: "Copiar recordatorio para No inició",
          exact: true,
        });
      await individual.focus();
      await page.keyboard.press("Enter");
      await expect(page.getByRole("status")).toContainText(
        "Recordatorio copiado",
      );
      const reminder = await page.evaluate(() =>
        navigator.clipboard.readText(),
      );
      expect(reminder).toContain(
        "No inició: 2 preguntas obligatorias pendientes",
      );
      expect(reminder).toContain(fixture.project.name);
      expect(reminder).not.toMatch(
        /Persona con avance|Completó|Contenido de respuesta ficticia privado/,
      );
      await expect(
        table.getByRole("button", {
          name: "Copiar recordatorio para Completó",
          exact: true,
        }),
      ).toBeDisabled();
      await checkedPage(
        page,
        evidence,
        `constant-participation-${role}`,
        width,
      );
    }
  }
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page
    .getByRole("button", { name: "Copiar recordatorio", exact: true })
    .focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("status")).toContainText("Recordatorio copiado");
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied).toContain(fixture.project.name);
  expect(copied).toContain("preguntas obligatorias pendientes");
  expect(copied).not.toContain("Contenido de respuesta ficticia privado");
  expect(copied).not.toContain("Completó");
  await page.evaluate(() => {
    navigator.clipboard.writeText = async () => {
      throw new Error("No disponible");
    };
  });
  await page
    .getByRole("button", { name: "Copiar recordatorio", exact: true })
    .click();
  const fallback = page.getByLabel("Texto del recordatorio para copiar");
  await expect(fallback).toBeFocused();
  await expect(fallback).toHaveValue(copied);
  await page
    .getByRole("button", {
      name: "Copiar recordatorio para No inició",
      exact: true,
    })
    .click();
  await expect(fallback).toBeFocused();
  await expect(fallback).toHaveValue(
    /No inició: 2 preguntas obligatorias pendientes/,
  );
  expect(await fallback.inputValue()).not.toMatch(
    /Persona con avance|Completó|Contenido de respuesta ficticia privado/,
  );
  await checkedPage(page, evidence, "constant-reminder-fallback", 390);
});
