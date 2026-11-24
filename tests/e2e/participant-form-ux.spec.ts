import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import type { ProjectView, QuestionView } from "@requirements/contracts";
import { login } from "./login-helper";
import { asUser, command } from "./fixtures/workbench";

let project: ProjectView;
const questions: Record<string, QuestionView> = {};
test.describe.configure({ mode: "serial" });
test.use({ actionTimeout: 15000, locale: "es-MX" });
test.beforeAll(async ({ browser }) => {
  test.setTimeout(180000);
  await asUser(browser, "admin", async (page) => {
    const suffix = randomUUID();
    project = await command<ProjectView>(page, "/projects", {
      externalId: `F1-FORM-${suffix}`,
      name: `Formularios ficticios ${suffix.slice(0, 8)}`,
      description: "Casos de prueba del participante; sin datos reales",
    });
    const areas = await command<{ id: string }[]>(page, "/areas");
    const users = await command<{ id: string; username: string }[]>(
      page,
      "/users",
    );
    const person = users.find((user) => user.username === "stakeholder");
    expect(person).toBeDefined();
    const member = await command<{ id: string }>(
      page,
      `/projects/${project.id}/members`,
      {
        userId: person!.id,
        role: "STAKEHOLDER",
        areaId: areas[0].id,
        active: true,
      },
    );
    const section = await command<{ id: string }>(
      page,
      `/projects/${project.id}/sections`,
      {
        externalId: "F1-TEMA",
        title: "Formulario ficticio",
        description: "",
        order: 0,
      },
    );
    const definitions = [
      ["NUMBER", "number", { min: 1, max: 100, integer: true }],
      ["LONG_TEXT", "dialog", { maxLength: 2000 }],
      ["MULTIPLE_CHOICE", "multiple", { minSelections: 1, maxSelections: 3 }],
      ["SHORT_TEXT", "text", { maxLength: 200 }],
      ["LONG_TEXT", "consult", { maxLength: 2000 }],
      ["LONG_TEXT", "expiry", { maxLength: 2000 }],
      ["LONG_TEXT", "next", { maxLength: 2000 }],
    ] as const;
    for (const [index, [type, key, config]] of definitions.entries()) {
      let question = await command<QuestionView>(
        page,
        `/projects/${project.id}/questions`,
        {
          externalId: `F1-${key}`,
          sectionId: section.id,
          title: `Caso ficticio ${key}`,
          question: `Pregunta ficticia ${key}`,
          type,
          config,
          required: true,
          priority: "P2",
          responsibleAreaId: areas[0].id,
          order: index,
          options:
            type === "MULTIPLE_CHOICE"
              ? ["Presencial", "Teléfono", "Correo", "Portal"].map(
                  (label, order) => ({ value: `op${order}`, label, order }),
                )
              : [],
          references: [],
        },
      );
      question = await command<QuestionView>(
        page,
        `/projects/${project.id}/questions/${question.id}/assign`,
        {
          projectMemberId: member.id,
          active: true,
          required: true,
          expectedVersion: question.lockVersion,
        },
      );
      questions[key] = await command<QuestionView>(
        page,
        `/projects/${project.id}/questions/${question.id}/publish`,
        { expectedVersion: question.lockVersion },
      );
    }
  });
});

test("F1: guardar número fuera del límite conserva altura y texto; corregir permite enviar", async ({
  page,
}) => {
  await login(page, "stakeholder");
  await page.goto(`/projects/${project.id}/respond/${questions.number.id}`);
  const input = page.getByLabel("Tu respuesta: número", { exact: true });
  const status = page.locator(".save-status").first();
  await expect(input).toBeVisible();
  await expect(
    page.getByText(/Mínimo: 1\. Máximo: 100\. Solo números enteros\./),
  ).toBeVisible();
  const height = await status.evaluate(
    (element) => element.getBoundingClientRect().height,
  );
  await input.fill("101");
  await expect(status).toHaveAttribute("data-save-state", "unsaved");
  let release!: () => void;
  let arrived!: (status: number) => void;
  const released = new Promise<void>((resolve) => (release = resolve));
  const held = new Promise<number>((resolve) => (arrived = resolve));
  await page.route("**/response/draft", async (route) => {
    if (route.request().method() !== "PUT") return route.continue();
    const response = await route.fetch();
    arrived(response.status());
    await released;
    await route.fulfill({ response });
  });
  try {
    await page
      .getByRole("button", { name: "Guardar y salir", exact: true })
      .click();
    expect(await held).toBe(422);
    await expect(status).toHaveText("Guardando…");
    expect(
      await status.evaluate(
        (element) => element.getBoundingClientRect().height,
      ),
    ).toBe(height);
  } finally {
    release();
  }
  await expect(status).toHaveAttribute("data-save-state", "error");
  await expect(status).toContainText("Tu texto sigue aquí");
  await expect(input).toHaveValue("101");
  expect(
    await status.evaluate((element) => element.getBoundingClientRect().height),
  ).toBe(height);
  await page.unroute("**/response/draft");
  await input.fill("5");
  await expect(status).toHaveAttribute("data-save-state", "unsaved");
  const submitted = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      response.url().endsWith("/response/submit"),
  );
  await page
    .getByRole("button", { name: "Enviar respuesta", exact: true })
    .click();
  expect((await submitted).status()).toBe(201);
  await expect(
    page.getByText("Respuesta enviada. El equipo de revisión la recibirá.", {
      exact: true,
    }),
  ).toBeVisible();
});

test("F1: Guardar y salir del diálogo conserva el borrador ante fallo y sale tras guardar", async ({
  page,
}) => {
  await login(page, "stakeholder");
  await page.goto(`/projects/${project.id}/respond/${questions.dialog.id}`);
  await page
    .getByLabel("Tu respuesta", { exact: true })
    .fill("Borrador ficticio que debe conservarse.");
  await page
    .getByRole("link", { name: "Mi trabajo", exact: true })
    .first()
    .click();
  const dialog = page.getByRole("dialog", {
    name: "Tienes cambios sin guardar",
  });
  const save = dialog.getByRole("button", {
    name: "Guardar y salir",
    exact: true,
  });
  await expect(save).toBeFocused();
  let failOnce = true;
  await page.route("**/response/draft", async (route) => {
    if (failOnce && route.request().method() === "PUT") {
      failOnce = false;
      return route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({
          code: "SERVICE_UNAVAILABLE",
          message: "Interrupción ficticia de guardado.",
        }),
      });
    }
    return route.continue();
  });
  await save.click();
  await expect(dialog.getByRole("alert")).toBeVisible();
  await expect(dialog).toBeVisible();
  await expect(page.getByLabel("Tu respuesta", { exact: true })).toHaveValue(
    "Borrador ficticio que debe conservarse.",
  );
  await save.click();
  await expect(page).toHaveURL(new RegExp(`/projects/${project.id}/work$`));
  await expect(dialog).toHaveCount(0);
  await page.unroute("**/response/draft");
  await page.goto(`/projects/${project.id}/respond/${questions.dialog.id}`);
  await expect(page.getByLabel("Tu respuesta", { exact: true })).toHaveValue(
    "Borrador ficticio que debe conservarse.",
  );
});

test("F1: selección múltiple informa límite y permite reemplazar una opción", async ({
  page,
}) => {
  await login(page, "stakeholder");
  await page.goto(`/projects/${project.id}/respond/${questions.multiple.id}`);
  await expect(
    page.getByText("Elige de 1 a 3 opciones.", { exact: true }),
  ).toBeVisible();
  for (const name of ["Presencial", "Teléfono", "Correo"])
    await page.getByRole("checkbox", { name, exact: true }).check();
  await expect(
    page.getByText("Marcadas 3 de 3", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("checkbox", { name: "Portal", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByText("Quita una opción para elegir otra.", { exact: true }),
  ).toBeVisible();
  await page.getByRole("checkbox", { name: "Correo", exact: true }).uncheck();
  await expect(
    page.getByRole("checkbox", { name: "Portal", exact: true }),
  ).toBeEnabled();
  await page.getByRole("checkbox", { name: "Portal", exact: true }).check();
  await expect(
    page.getByText("Marcadas 3 de 3", { exact: true }),
  ).toBeVisible();
});

test("F1: texto informa máximo y mantiene campos de 16 px y acciones alcanzables a 390/320", async ({
  page,
}) => {
  await login(page, "stakeholder");
  await page.goto(`/projects/${project.id}/respond/${questions.text.id}`);
  const input = page.getByLabel("Tu respuesta", { exact: true });
  await input.fill("a".repeat(261));
  await expect(input).toHaveValue("a".repeat(200));
  await expect(
    page.getByText("200/200 caracteres", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Llegaste al máximo de 200 caracteres.", { exact: true }),
  ).toBeVisible();
  for (const [width, height] of [
    [390, 844],
    [320, 640],
  ]) {
    await page.setViewportSize({ width, height });
    await input.scrollIntoViewIfNeeded();
    await input.focus();
    expect(
      await input.evaluate((element) =>
        parseFloat(getComputedStyle(element).fontSize),
      ),
    ).toBeGreaterThanOrEqual(16);
    const submit = page.getByRole("button", {
      name: "Enviar respuesta",
      exact: true,
    });
    await submit.scrollIntoViewIfNeeded();
    expect(
      await submit.evaluate((element) => {
        const box = element.getBoundingClientRect();
        return element.contains(
          document.elementFromPoint(
            box.x + box.width / 2,
            box.y + box.height / 2,
          ),
        );
      }),
    ).toBe(true);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
  }
});

test("F1: consultar y deshacer conserva texto con una escritura adicional; aviso caduca", async ({
  page,
}) => {
  await login(page, "stakeholder");
  await page.goto(`/projects/${project.id}/respond/${questions.consult.id}`);
  await page
    .getByLabel("Tu respuesta", { exact: true })
    .fill("Contenido ficticio para consultar.");
  const writes: boolean[] = [],
    gets: string[] = [];
  page.on("request", (request) => {
    if (request.method() === "PUT" && request.url().endsWith("/response/draft"))
      writes.push(request.postDataJSON().consultationRequested);
    if (request.method() === "GET" && request.url().includes("/api/v1/"))
      gets.push(request.url());
  });
  await page
    .getByRole("button", { name: "Necesito consultar esto", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Deshacer", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".response-page h1")).toBeVisible();
  const beforeUndo = gets.length;
  await page.getByRole("button", { name: "Deshacer", exact: true }).click();
  await expect(
    page.getByText(
      "Deshiciste la marca Por consultar. Tu borrador se conserva.",
      { exact: true },
    ),
  ).toBeVisible();
  expect(writes).toEqual([true, false]);
  expect(gets.length).toBe(beforeUndo);
  await page.reload();
  await expect(page.locator("main h1")).toBeVisible();
  await expect(page.locator(".participant-feedback")).toHaveCount(0);
  await page.goto(`/projects/${project.id}/respond/${questions.consult.id}`);
  await expect(page.getByLabel("Tu respuesta", { exact: true })).toHaveValue(
    "Contenido ficticio para consultar.",
  );
  await expect(page.getByText("Por consultar", { exact: true })).toHaveCount(0);
  await page.goto(`/projects/${project.id}/respond/${questions.expiry.id}`);
  await page
    .getByLabel("Tu respuesta", { exact: true })
    .fill("Otra consulta ficticia para medir caducidad.");
  await page
    .getByRole("button", { name: "Necesito consultar esto", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Deshacer", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Deshacer", exact: true }),
  ).toHaveCount(0, { timeout: 10000 });
  await expect(page.locator(".participant-feedback")).toHaveCount(0);
});
