import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { login } from "./login-helper";
import {
  prepare,
  command,
  type Fixture,
  type Invitations,
} from "./fixtures/workbench";

function navigation(page: Page) {
  return page.getByRole("navigation", {
    name: "Navegación del proyecto",
    exact: true,
  });
}

async function accessible(page: Page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(
      document
        .getAnimations()
        .map((animation) => animation.finished.catch(() => {})),
    );
  });
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
}

let fixture: Fixture;
test.beforeAll(async ({ browser }) => {
  test.setTimeout(240000);
  fixture = await prepare(browser);
});

test("ACTA NEXT: navegación del proyecto, teclado y reflow en cuatro tamaños", async ({
  page,
}) => {
  test.setTimeout(180000);
  await login(page, "analyst");
  await page.goto(`/projects/${fixture.project.id}/dashboard`);
  for (const width of [1440, 1024, 768, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const [label, path] of [
      ["Atención", "dashboard"],
      ["Cuestionario", "editor"],
      ["Decisiones", "decisions"],
    ]) {
      const link = navigation(page).getByRole("link", {
        name: label,
        exact: true,
      });
      await link.focus();
      await page.keyboard.press("Enter");
      await expect(page).toHaveURL(
        new RegExp(`/projects/${fixture.project.id}/${path}(?:\\?|$)`),
      );
      await expect(
        navigation(page).getByRole("link", { name: label, exact: true }),
      ).toHaveAttribute("aria-current", "page");
      await expect(navigation(page).getByRole("link")).toHaveCount(4);
      if (label === "Atención")
        await expect(
          page
            .getByRole("article", { name: "Aclaraciones", exact: true })
            .locator("strong"),
        ).toHaveText("2");
      if (label === "Cuestionario")
        await expect(
          page.getByRole("tabpanel", { name: "Organizar", exact: true }),
        ).toBeVisible();
      if (label === "Decisiones")
        await expect(
          page.getByRole("link", {
            name: fixture.questions[3].title,
            exact: true,
          }),
        ).toBeVisible();
      await accessible(page);
    }
    if (width < 1100)
      await page
        .locator("summary")
        .filter({ hasText: /^Menú$/ })
        .click();
    const tools = page
      .locator("summary:visible")
      .filter({ hasText: /^Más herramientas$/ });
    await tools.focus();
    await page.keyboard.press("Enter");
    await expect(
      page.getByRole("navigation", { name: "Otras herramientas del proyecto" }),
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(tools).toBeFocused();
    await expect(
      page.getByRole("navigation", { name: "Otras herramientas del proyecto" }),
    ).not.toBeVisible();
  }
});

test("ACTA NEXT: atención conserva el solapamiento y el contexto al volver del detalle", async ({
  page,
}) => {
  await login(page, "analyst");
  await page.goto(`/projects/${fixture.project.id}/dashboard`);
  const attention = page.getByRole("region", { name: "Qué requiere atención" });
  await expect(attention.getByRole("article")).toHaveCount(4);
  for (const [name, count] of [
    ["Conflictos", "1"],
    ["Aclaraciones", "2"],
    ["Listas para decidir", "1"],
    ["Invitaciones por expirar", "1"],
  ])
    await expect(
      attention.getByRole("article", { name, exact: true }).locator("strong"),
    ).toHaveText(count);
  await expect(
    attention.getByText(
      "Cada entrada tiene su propio alcance. Una pregunta puede aparecer en más de una.",
    ),
  ).toBeVisible();
  const cases = page.getByRole("list", { name: "Casos de atención" });
  await page
    .getByRole("button", { name: "Ver conflictos", exact: true })
    .click();
  await expect(cases.locator(":scope > li")).toHaveCount(1);
  await expect(
    cases.getByRole("link", {
      name: `Revisar conflicto: ${fixture.questions[0].title}`,
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Ver aclaraciones", exact: true })
    .click();
  await expect(cases.locator(":scope > li")).toHaveCount(2);
  // The same conflicted question also remains in clarification results.
  await expect(
    cases.getByRole("link", {
      name: `Revisar conflicto: ${fixture.questions[0].title}`,
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    cases.getByRole("link", {
      name: `Revisar respuestas: ${fixture.questions[1].title}`,
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByLabel("Filtrar estado", { exact: true })
    .selectOption("CONFLICT");
  await expect(cases.locator(":scope > li")).toHaveCount(1);
  const savedSearch = new URL(page.url()).search;
  const detailLink = cases.getByRole("link", {
    name: `Revisar conflicto: ${fixture.questions[0].title}`,
    exact: true,
  });
  await detailLink.scrollIntoViewIfNeeded();
  await detailLink.focus();
  const scrollY = await page.evaluate(() => window.scrollY);
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("heading", {
      name: fixture.questions[0].title,
      exact: true,
      level: 1,
    }),
  ).toBeVisible();
  await page.getByRole("link", { name: "← Atención", exact: true }).click();
  await expect(page).toHaveURL(
    `/projects/${fixture.project.id}/dashboard${savedSearch}`,
  );
  await expect(page.getByLabel("Filtrar estado", { exact: true })).toHaveValue(
    "CONFLICT",
  );
  await expect(
    page.getByRole("button", { name: "Ver aclaraciones", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(detailLink).toBeFocused();
  await expect
    .poll(async () =>
      Math.abs((await page.evaluate(() => window.scrollY)) - scrollY),
    )
    .toBeLessThan(5);
  await page
    .getByRole("button", { name: "Revisar para decidir", exact: true })
    .click();
  await expect(page.getByLabel("Filtrar estado", { exact: true })).toHaveValue(
    "",
  );
  await expect(cases.locator(":scope > li")).toHaveCount(1);
  await expect(
    cases.getByRole("link", {
      name: `Revisar respuestas: ${fixture.questions[2].title}`,
      exact: true,
    }),
  ).toBeVisible();
});

for (const width of [1440, 390]) {
  test(`ACTA NEXT: volver al cuestionario conserva filtros, selección, página y scroll a ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 });
    await login(page, "analyst");
    // Exercise route commits under CPU pressure: late scroll events must not
    // replace the list context. Keep the same strict position assertion.
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 6 });
    await page.goto(`/projects/${fixture.project.id}/editor`);
    await page.getByLabel("Buscar preguntas", { exact: true }).fill("NEXT-WB");
    if (width < 900)
      await page.getByRole("button", { name: "Filtros", exact: true }).click();
    await page
      .getByLabel("Área responsable", { exact: true })
      .selectOption(fixture.area.id);
    await page
      .getByLabel("Estado de publicación", { exact: true })
      .selectOption("PUBLISHED");
    await page
      .getByRole("button", { name: "Página siguiente", exact: true })
      .click();
    await expect(
      page.getByText("54 preguntas encontradas · Página 2 de 2", {
        exact: true,
      }),
    ).toBeVisible();
    const question = fixture.questions[50];
    const selection = page.getByRole("checkbox", {
      name: `Seleccionar pregunta: ${question.question}`,
      exact: true,
    });
    await selection.check();
    const review = page.getByRole("button", {
      name: `Revisar respuestas de ${question.title}`,
      exact: true,
    });
    await review.scrollIntoViewIfNeeded();
    await review.focus();
    const scrollY = await page.evaluate(() => window.scrollY);
    expect(scrollY).toBeGreaterThan(100);
    await page.keyboard.press("Enter");
    await expect(
      page.getByRole("heading", {
        name: question.title,
        exact: true,
        level: 1,
      }),
    ).toBeVisible();
    await page
      .getByRole("link", { name: "← Cuestionario", exact: true })
      .click();
    await expect(
      page.getByRole("tabpanel", { name: "Organizar", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByLabel("Buscar preguntas", { exact: true }),
    ).toHaveValue("NEXT-WB");
    await expect(
      page.getByLabel("Área responsable", { exact: true }),
    ).toHaveValue(fixture.area.id);
    await expect(
      page.getByLabel("Estado de publicación", { exact: true }),
    ).toHaveValue("PUBLISHED");
    await expect(
      page.getByText("54 preguntas encontradas · Página 2 de 2", {
        exact: true,
      }),
    ).toBeVisible();
    await expect(selection).toBeChecked();
    await expect(
      page.getByText("1 pregunta seleccionada", { exact: true }),
    ).toBeVisible();
    await expect
      .poll(async () =>
        Math.abs((await page.evaluate(() => window.scrollY)) - scrollY),
      )
      .toBeLessThan(5);
    await navigation(page)
      .getByRole("link", { name: "Atención", exact: true })
      .click();
    await navigation(page)
      .getByRole("link", { name: "Cuestionario", exact: true })
      .click();
    await expect(selection).toBeChecked();
    await expect(
      page.getByText("54 preguntas encontradas · Página 2 de 2", {
        exact: true,
      }),
    ).toBeVisible();
  });
}

test("ACTA NEXT: decisiones conserva sus filtros al volver de la decisión vigente", async ({
  page,
}) => {
  await login(page, "analyst");
  await page.goto(`/projects/${fixture.project.id}/decisions`);
  const question = fixture.questions[3];
  await page
    .getByLabel("Buscar decisiones", { exact: true })
    .fill(question.title);
  await page
    .getByLabel("Área responsable", { exact: true })
    .selectOption(fixture.area.id);
  await page
    .getByLabel("Tema", { exact: true })
    .selectOption(question.sectionId);
  const savedSearch = new URL(page.url()).search;
  const detailLink = page.getByRole("link", {
    name: question.title,
    exact: true,
  });
  await detailLink.click();
  await expect(
    page.getByRole("heading", { name: "Decisiones registradas", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "← Decisiones", exact: true }).click();
  await expect(page).toHaveURL(
    `/projects/${fixture.project.id}/decisions${savedSearch}`,
  );
  await expect(
    page.getByLabel("Buscar decisiones", { exact: true }),
  ).toHaveValue(question.title);
  await expect(
    page.getByLabel("Área responsable", { exact: true }),
  ).toHaveValue(fixture.area.id);
  await expect(page.getByLabel("Tema", { exact: true })).toHaveValue(
    question.sectionId,
  );
  await expect(detailLink).toBeFocused();
});

test("ACTA NEXT: vigencia de invitaciones incluye la segunda página y excluye revocadas", async ({
  page,
}) => {
  await login(page, "admin");
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 6 });
  const base = `/projects/${fixture.project.id}`;
  const first = await command<Invitations>(page, `${base}/invitations?page=1`);
  const second = await command<Invitations>(page, `${base}/invitations?page=2`);
  expect(first.total).toBe(27);
  expect(first.items).toHaveLength(25);
  expect(
    first.items.some((invitation) => invitation.id === fixture.urgent.id),
  ).toBe(false);
  expect(second.items.map((invitation) => invitation.id)).toContain(
    fixture.urgent.id,
  );
  await page.goto(`${base}/dashboard`);
  await expect(
    page
      .getByRole("article", { name: "Invitaciones por expirar", exact: true })
      .locator("strong"),
  ).toHaveText("1");
  await page
    .getByRole("link", { name: "Ver invitaciones por expirar", exact: true })
    .click();
  await expect(page).toHaveURL(`${base}/invitations?expiresWithin=7`);
  await expect(page.getByLabel("Vigencia", { exact: true })).toHaveValue("7");
  const list = page.locator("ul.invitation-management");
  await expect(list.getByRole("listitem")).toHaveCount(1);
  await expect(
    list.getByText(fixture.urgent.label, { exact: true }),
  ).toBeVisible();
  await expect(
    list.getByText(fixture.revoked.label, { exact: true }),
  ).toHaveCount(0);
  await page.getByLabel("Vigencia", { exact: true }).selectOption("");
  await expect(list.getByRole("listitem")).toHaveCount(25);
  await page.getByRole("button", { name: "Siguiente", exact: true }).click();
  await expect(list.getByRole("listitem")).toHaveCount(2);
  await expect(
    list.getByText(fixture.urgent.label, { exact: true }),
  ).toBeVisible();
  await navigation(page)
    .getByRole("link", { name: "Atención", exact: true })
    .click();
  await page.getByRole("link", { name: "Invitaciones", exact: true }).click();
  await expect(page.getByText("Página 2", { exact: true })).toBeVisible();
  await expect(list.getByRole("listitem")).toHaveCount(2);
  // Changing the filter on page two must reset pagination before filtering.
  await page.getByLabel("Vigencia", { exact: true }).selectOption("7");
  await expect(list.getByRole("listitem")).toHaveCount(1);
  await expect(
    list.getByText(fixture.urgent.label, { exact: true }),
  ).toBeVisible();
});

for (const username of ["admin", "analyst", "viewer", "stakeholder"] as const) {
  test(`ACTA NEXT: controles disponibles para ${username}`, async ({
    page,
  }) => {
    await login(page, username);
    const base = `/projects/${fixture.project.id}`;
    if (username === "stakeholder") {
      await page.goto(`${base}/work`);
      await expect(
        page.getByRole("link", {
          name: `Responder: ${fixture.questions[0].title}`,
          exact: true,
        }),
      ).toBeVisible();
      await expect(navigation(page)).toHaveCount(0);
      await expect(
        page.getByRole("link", { name: "Invitaciones", exact: true }),
      ).toHaveCount(0);
      await expect(
        page.getByRole("button", { name: "Registrar decisión", exact: true }),
      ).toHaveCount(0);
      return;
    }
    if (username !== "viewer") {
      await page.goto(`${base}/dashboard`);
      await expect(navigation(page).getByRole("link")).toHaveCount(4);
      await expect(
        page.getByRole("link", { name: "Invitaciones", exact: true }),
      ).toBeVisible();
      await page
        .locator("summary:visible")
        .filter({ hasText: /^Más herramientas$/ })
        .click();
      await expect(
        page.getByRole("link", { name: "Miembros", exact: true }),
      ).toHaveCount(username === "admin" ? 1 : 0);
      await expect(
        page
          .getByRole("article", { name: "Aclaraciones", exact: true })
          .locator("strong"),
      ).toHaveText("2");
    }
    await page.goto(
      `${base}/review/${fixture.questions[username === "viewer" ? 3 : 2].id}`,
    );
    if (username === "analyst") {
      await expect(
        page.getByRole("button", { name: "Registrar decisión", exact: true }),
      ).toBeVisible();
      await expect(
        page.getByLabel("Otras acciones", { exact: true }),
      ).toBeVisible();
    } else {
      await expect(
        page.getByText("Consulta de solo lectura.", { exact: true }),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Registrar decisión", exact: true }),
      ).toHaveCount(0);
      await expect(
        page.getByLabel("Otras acciones", { exact: true }),
      ).toHaveCount(0);
      if (username === "viewer") {
        await expect(
          page.getByRole("heading", {
            name: "Decisiones registradas",
            exact: true,
          }),
        ).toBeVisible();
        await expect(navigation(page)).toHaveCount(0);
        await expect(
          page.getByRole("link", { name: "Invitaciones", exact: true }),
        ).toHaveCount(0);
      }
    }
  });
}

test("Direction C: listado completo conserva apertura, foco y retorno", async ({
  page,
}) => {
  await login(page, "analyst");
  const path = `/projects/${fixture.project.id}/dashboard`;
  await page.goto(path);
  const disclosure = page.locator(".ac-attention-all");
  await expect(disclosure).not.toHaveAttribute("open");
  await disclosure.locator("summary").click();
  const list = page.getByRole("list", {
    name: "Casos de atención",
    exact: true,
  });
  await expect(list.locator(":scope > li")).toHaveCount(54);
  const question = fixture.questions[53]!;
  const link = list.getByRole("link", {
    name: `Revisar respuestas: ${question.title}`,
    exact: true,
  });
  await link.scrollIntoViewIfNeeded();
  await link.focus();
  const scroll = await page.evaluate(() => window.scrollY);
  await page.keyboard.press("Enter");
  await expect(page.locator("main h1")).toHaveText(question.title);
  await page.getByRole("link", { name: "← Atención", exact: true }).click();
  await expect(page).toHaveURL(path);
  await expect(disclosure).toHaveAttribute("open");
  await expect(link).toBeFocused();
  await expect
    .poll(async () =>
      Math.abs((await page.evaluate(() => window.scrollY)) - scroll),
    )
    .toBeLessThan(5);
});
