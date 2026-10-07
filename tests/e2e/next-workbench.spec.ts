import { test, expect, type Browser, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { randomUUID } from "node:crypto";
import type {
  InvitationView,
  ProjectView,
  QuestionnaireView,
  QuestionView,
  ResponseView,
  ReviewDetail,
} from "@requirements/contracts";
import { login } from "./login-helper";

type Area = { id: string; code: string; name: string };
type Invitations = { items: InvitationView[]; total: number; page: number };
type Fixture = {
  project: ProjectView;
  area: Area;
  questions: QuestionView[];
  urgent: InvitationView;
  revoked: InvitationView;
  participantId: string;
};

// Use the configured demo installation and its public, authenticated commands.
// Each worker creates a new project; no seeded project IDs or database writes.
async function command<T>(
  page: Page,
  path: string,
  body?: unknown,
  method = body === undefined ? "GET" : "POST",
): Promise<T> {
  return page.evaluate(
    async ({ path, body, method }) => {
      const me = await (await fetch("/api/v1/auth/me")).json();
      const response = await fetch(`/api/v1${path}`, {
        method,
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": me.csrfToken,
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      // Do not put invitation URLs, tokens or credentials in failure output.
      if (!response.ok)
        throw new Error(`${method} ${path}: ${response.status}`);
      return response.json();
    },
    { path, body, method },
  );
}

async function asUser<T>(
  browser: Browser,
  username: string,
  work: (page: Page) => Promise<T>,
) {
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    await login(page, username);
    return await work(page);
  } finally {
    await context.close();
  }
}

async function prepare(browser: Browser): Promise<Fixture> {
  const suffix = randomUUID();
  const otherUsername = `next_${suffix.replaceAll("-", "").slice(0, 16)}`;
  const fixture = await asUser(browser, "admin", async (page) => {
    const project = await command<ProjectView>(page, "/projects", {
      externalId: `NEXT-WORKBENCH-${suffix}`,
      name: `Workbench ficticio · ${suffix}`,
      description: "Datos ficticios autónomos para la navegación de ACTA NEXT",
    });
    const area = await command<Area>(page, "/areas", {
      code: `NEXT-WORKBENCH-${suffix}`,
      name: `Servicios de prueba ${suffix.slice(0, 8)}`,
    });
    const users = await command<{ id: string; username: string }[]>(
      page,
      "/users",
    );
    const other = await command<{ id: string }>(page, "/users", {
      username: otherUsername,
      displayName: "Segundo participante ficticio del workbench",
      temporaryPassword: process.env.DEMO_PASSWORD!,
    });
    const members: Record<string, string> = {};
    for (const username of [
      "analyst",
      "stakeholder",
      "viewer",
      otherUsername,
    ]) {
      const user =
        username === otherUsername
          ? other
          : users.find((candidate) => candidate.username === username);
      expect(user, `La instalación demo incluye ${username}`).toBeDefined();
      const role =
        username === "analyst"
          ? "ANALYST"
          : username === "viewer"
            ? "VIEWER"
            : "STAKEHOLDER";
      members[username] = (
        await command<{ id: string }>(page, `/projects/${project.id}/members`, {
          userId: user!.id,
          role,
          areaId: role === "STAKEHOLDER" ? area.id : null,
          active: true,
        })
      ).id;
    }
    const file = {
      formatVersion: "1.0",
      kind: "questionnaire-template",
      project: { externalId: project.externalId, name: project.name },
      areas: [{ code: area.code, name: area.name }],
      sections: [
        { externalId: "TEMA-NEXT", title: "Servicio ficticio", order: 0 },
      ],
      questions: Array.from({ length: 54 }, (_, index) => ({
        externalId: `NEXT-WB-${String(index).padStart(2, "0")}`,
        sectionExternalId: "TEMA-NEXT",
        title: `Caso ficticio ${String(index).padStart(2, "0")}`,
        question: `¿Cómo se atiende el caso ficticio ${index}?`,
        type: "SHORT_TEXT",
        required: true,
        priority: "P2",
        responsibleAreaCode: area.code,
        order: index,
        options: [],
        references: [],
      })),
      conditions: [],
      traceabilityReferences: [],
    };
    await page.evaluate(
      async ({ projectId, file }) => {
        const me = await (await fetch("/api/v1/auth/me")).json();
        const headers = {
          "Content-Type": "application/octet-stream",
          "X-CSRF-Token": me.csrfToken,
        };
        const previewResponse = await fetch(
          `/api/v1/projects/${projectId}/imports/preview`,
          {
            method: "POST",
            headers,
            body: JSON.stringify(file),
          },
        );
        const preview = await previewResponse.json();
        if (!previewResponse.ok || preview.errors.length)
          throw new Error(`Import preview rejected: ${previewResponse.status}`);
        const confirmation = await fetch(
          `/api/v1/projects/${projectId}/imports/confirm`,
          {
            method: "POST",
            headers: {
              ...headers,
              "X-Import-Command": encodeURIComponent(
                JSON.stringify({
                  payloadHash: preview.payloadHash,
                  expectedProjectVersion: preview.expectedProjectVersion,
                  requestId: crypto.randomUUID(),
                  createMissingAreas: false,
                }),
              ),
            },
            body: JSON.stringify(file),
          },
        );
        if (!confirmation.ok)
          throw new Error(`Import confirmation: ${confirmation.status}`);
      },
      { projectId: project.id, file },
    );

    const questionnaire = () =>
      command<QuestionnaireView>(page, `/projects/${project.id}/questionnaire`);
    let questions = (await questionnaire()).questions.sort(
      (a, b) => a.order - b.order,
    );
    // The first four cases become: overlap, clarification, ready, validated.
    for (let index = 0; index < 4; index++) {
      for (const username of index === 0
        ? ["stakeholder", otherUsername]
        : ["stakeholder"]) {
        questions[index] = await command<QuestionView>(
          page,
          `/projects/${project.id}/questions/${questions[index].id}/assign`,
          {
            projectMemberId: members[username],
            active: true,
            required: true,
            expectedVersion: questions[index].lockVersion,
          },
        );
      }
    }
    const publish = {
      requestId: randomUUID(),
      questions: questions.map(({ id, lockVersion }) => ({
        id,
        expectedVersion: lockVersion,
      })),
    };
    const preview = await command<{ previewHash: string }>(
      page,
      `/projects/${project.id}/questions/bulk/publish/preview`,
      publish,
    );
    await command(
      page,
      `/projects/${project.id}/questions/bulk/publish/confirm`,
      {
        ...publish,
        previewHash: preview.previewHash,
      },
    );
    questions = (await questionnaire()).questions.sort(
      (a, b) => a.order - b.order,
    );
    expect(questions).toHaveLength(54);
    expect(
      questions.every((question) => question.publication === "PUBLISHED"),
    ).toBe(true);

    async function invite(label: string, days: number) {
      const result = await command<{ invitation: InvitationView }>(
        page,
        `/projects/${project.id}/invitations`,
        {
          requestId: randomUUID(),
          label,
          questionIds: [questions[53].id],
          areaId: area.id,
          identity: {
            name: "Destinatario ficticio",
            email: "ficticio@example.invalid",
          },
          nonNominal: false,
          expiresAt: new Date(Date.now() + days * 86400000).toISOString(),
          allowEvidence: false,
        },
      );
      return result.invitation;
    }
    // Descending creation order puts both urgent links beyond the first API page.
    const urgent = await invite("Urgente ficticia de segunda página", 3);
    const revoked = await invite("Urgente revocada ficticia", 3);
    await command(
      page,
      `/projects/${project.id}/invitations/${revoked.id}/revoke`,
      {
        expectedVersion: revoked.lockVersion,
      },
    );
    for (let index = 0; index < 25; index++)
      await invite(
        `Vigencia amplia ficticia ${String(index).padStart(2, "0")}`,
        14,
      );
    return {
      project,
      area,
      questions,
      urgent,
      revoked,
      participantId: users.find((u) => u.username === "stakeholder")!.id,
    };
  });

  for (const username of ["stakeholder", otherUsername]) {
    await asUser(browser, username, async (page) => {
      for (const question of username === otherUsername
        ? fixture.questions.slice(0, 1)
        : fixture.questions.slice(0, 4)) {
        const path = `/projects/${fixture.project.id}/questions/${question.id}/response`;
        const initial = await command<ResponseView>(page, path);
        const draft = await command<ResponseView>(
          page,
          `${path}/draft`,
          {
            requestId: randomUUID(),
            expectedVersion: initial.lockVersion,
            answer: `Aportación ficticia de ${username} para ${question.title}`,
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
  }
  await asUser(browser, "analyst", async (page) => {
    const path = (index: number) =>
      `/projects/${fixture.project.id}/questions/${fixture.questions[index].id}/review`;
    for (const index of [0, 1]) {
      const detail = await command<ReviewDetail>(page, path(index));
      await command(page, `${path(index)}/clarifications/request`, {
        requestId: randomUUID(),
        expectedVersion: detail.lockVersion,
        responseRevisionId: detail.submissions.find(
          (s) => s.respondent.id === fixture.participantId,
        )!.id,
        body: "Explica el alcance del procedimiento ficticio.",
      });
    }
    const overlap = await command<ReviewDetail>(page, path(0));
    await command(page, `${path(0)}/conflicts`, {
      requestId: randomUUID(),
      expectedVersion: overlap.lockVersion,
      reason: "Dos aportaciones ficticias describen procedimientos diferentes.",
      responseRevisionIds: overlap.submissions.map(
        (submission) => submission.id,
      ),
    });
    const decision = await command<ReviewDetail>(page, path(3));
    await command(page, `${path(3)}/validate`, {
      requestId: randomUUID(),
      expectedVersion: decision.lockVersion,
      decisionText: "Se adopta el procedimiento ficticio documentado.",
      scope: "Exclusivamente los casos ficticios de esta prueba",
      validationComment: "La aportación ficticia cubre el alcance.",
      responseRevisionIds: decision.submissions.map(
        (submission) => submission.id,
      ),
    });
    for (const [index, status] of [
      [0, "CONFLICT"],
      [1, "CLARIFICATION_REQUIRED"],
      [2, "ANSWERED"],
      [3, "VALIDATED"],
    ] as const)
      expect((await command<ReviewDetail>(page, path(index))).status).toBe(
        status,
      );
  });
  return fixture;
}

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
      await expect(navigation(page).getByRole("link")).toHaveCount(3);
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
    const tools = page.getByText("Más herramientas", { exact: true });
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
  await expect(cases.getByRole("listitem")).toHaveCount(1);
  await expect(
    cases.getByRole("link", { name: fixture.questions[0].title, exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Ver aclaraciones", exact: true })
    .click();
  await expect(cases.getByRole("listitem")).toHaveCount(2);
  // The same conflicted question also remains in clarification results.
  await expect(
    cases.getByRole("link", { name: fixture.questions[0].title, exact: true }),
  ).toBeVisible();
  await expect(
    cases.getByRole("link", { name: fixture.questions[1].title, exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("Filtrar estado", { exact: true })
    .selectOption("CONFLICT");
  await expect(cases.getByRole("listitem")).toHaveCount(1);
  const savedSearch = new URL(page.url()).search;
  const detailLink = cases.getByRole("link", {
    name: fixture.questions[0].title,
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
  await expect(cases.getByRole("listitem")).toHaveCount(1);
  await expect(
    cases.getByRole("link", { name: fixture.questions[2].title, exact: true }),
  ).toBeVisible();
});

for (const width of [1440, 390]) {
  test(`ACTA NEXT: volver al cuestionario conserva filtros, selección, página y scroll a ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 });
    await login(page, "analyst");
    await page.goto(`/projects/${fixture.project.id}/editor`);
    await page.getByLabel("Buscar preguntas", { exact: true }).fill("NEXT-WB");
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
    list.getByRole("heading", { name: fixture.urgent.label, exact: true }),
  ).toBeVisible();
  await expect(
    list.getByRole("heading", { name: fixture.revoked.label, exact: true }),
  ).toHaveCount(0);
  await page.getByLabel("Vigencia", { exact: true }).selectOption("");
  await expect(list.getByRole("listitem")).toHaveCount(25);
  await page.getByRole("button", { name: "Siguiente", exact: true }).click();
  await expect(list.getByRole("listitem")).toHaveCount(2);
  await expect(
    list.getByRole("heading", { name: fixture.urgent.label, exact: true }),
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
    list.getByRole("heading", { name: fixture.urgent.label, exact: true }),
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
      await expect(navigation(page).getByRole("link")).toHaveCount(3);
      await expect(
        page.getByRole("link", { name: "Invitaciones", exact: true }),
      ).toBeVisible();
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
