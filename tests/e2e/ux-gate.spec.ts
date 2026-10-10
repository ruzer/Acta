import { test, expect, type Page } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { checkedPage, smallTargets } from "./fixtures/page-checks";
import { login } from "./login-helper";
import {
  seedReviewCases,
  seedScale,
  type ReviewCases,
  type ScaleFixture,
} from "./fixtures/review-cases";

// UX correction gate before checkpoint 5 (findings UX-01, 02, 03, 06, 07, 08,
// 09 and 15 of docs/design/ACTA-DIRECTION-C-IMPLEMENTATION.md). Real browser,
// real API, disposable data; every screen is measured and captured at four widths.
const widths = [
  [1440, 900],
  [768, 1024],
  [390, 844],
  [320, 640],
] as const;
const evidence =
  (process.env.ACTA_DIRECTION_C_EVIDENCE_DIR ??
    "docs/design/acta-direction-c-evidence") + "/ux-gate";
const records: Record<string, unknown>[] = [];
const bottomNav = 64; // the mobile tab bar covers the foot of the viewport

test.use({
  locale: "es-MX",
  timezoneId: "America/Mexico_City",
  reducedMotion: "reduce",
});
test.describe.configure({ mode: "serial" });
test.afterAll(async () => {
  await mkdir(evidence, { recursive: true });
  await writeFile(
    `${evidence}/metrics-ux-gate.json`,
    JSON.stringify({ checkpoint: "ux-gate", records }, null, 2) + "\n",
  );
});

async function checked(page: Page, id: string, width: number) {
  await checkedPage(page, evidence, id, width);
}

for (const count of [12, 54, 304]) {
  test(`UX-01/03: Atención con ${count} preguntas deja el trabajo a la vista, pliega lo que espera y no repite preguntas`, async ({
    page,
    baseURL,
  }) => {
    test.setTimeout(600000);
    const fixture: ScaleFixture = await seedScale(baseURL!, count);
    await login(page, "analyst");
    const path = `/projects/${fixture.project.id}/dashboard`;
    for (const [width, height] of widths) {
      await page.setViewportSize({ width, height });
      await page.goto(path);
      await expect(page.locator("main h1")).toHaveText("Atención");
      const queue = page.getByRole("region", { name: "Qué requiere atención" });
      const rows = queue.locator(".ac-queue-row");
      await expect(rows).toHaveCount(
        fixture.action + fixture.clarificationsOnly,
      );
      // One row per question: unique review links across the queue.
      const ids = await rows
        .locator("[data-workbench-id]")
        .evaluateAll((els) =>
          els.map((e) => (e as HTMLElement).dataset.workbenchId),
        );
      expect(new Set(ids).size).toBe(ids.length);
      const overlap = queue.getByRole("link", {
        name: new RegExp(`: ${fixture.overlap.title}$`),
      });
      await expect(overlap).toHaveCount(1);
      await expect(overlap).toHaveAccessibleName(
        `Resolver conflicto: ${fixture.overlap.title}`,
      );
      const row = overlap.locator(
        "xpath=ancestor::li[contains(@class,'ac-queue-row')]",
      );
      await expect(row.getByText("Aclaraciones abiertas")).toBeVisible();
      // The waiting group is folded, with its count, and holds no rows.
      for (const [label, total] of [
        ["En espera de otras personas", fixture.waiting],
      ] as const) {
        if (!total) continue;
        const fold = page.locator("details.ac-attention-fold", {
          hasText: label,
        });
        await expect(fold).not.toHaveAttribute("open", "");
        await expect(fold.locator("summary")).toContainText(
          `${total} ${total === 1 ? "pregunta" : "preguntas"}`,
        );
        await expect(fold.locator(".ac-queue-row")).toHaveCount(0);
      }
      const metrics = await page.evaluate(() => ({
        nodes: document.querySelectorAll("*").length,
        scrollHeight: document.documentElement.scrollHeight,
        firstRowY: Math.round(
          document.querySelector(".ac-queue-row")!.getBoundingClientRect().top +
            scrollY,
        ),
      }));
      // The old queue rendered every question: thousands of nodes and tens of thousands of pixels.
      expect(metrics.nodes).toBeLessThan(1800);
      if (width === 1440) {
        expect(metrics.firstRowY).toBeLessThanOrEqual(400);
        expect(metrics.scrollHeight).toBeLessThan(3200);
      }
      records.push({
        id: `UX01-n${count}`,
        width,
        ...metrics,
        dataset: {
          total: fixture.total,
          action: fixture.action,
          clarificationsOnly: fixture.clarificationsOnly,
          waiting: fixture.waiting,
          unassigned: fixture.unassigned,
        },
      });
      await checked(page, `UX01-n${count}`, width);
      if (width <= 899) {
        const small = (await smallTargets(page)).filter(
          (t) => !/^(Ver |Revisar |Resolver )/.test(t.name) || t.h < 44,
        );
        expect(small, `objetivos pequeños en Atención a ${width}px`).toEqual(
          [],
        );
      }
    }
    // Progressive reveal and persistent state on the largest list.
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(path);
    const waiting = page.locator("details.ac-attention-fold", {
      hasText: "En espera de otras personas",
    });
    if (fixture.waiting) {
      await waiting.locator("summary").click();
      const list = waiting.getByRole("list", {
        name: "En espera de otras personas",
      });
      const first = Math.min(
        fixture.waiting,
        fixture.waiting <= 60 ? fixture.waiting : 50,
      );
      await expect(list.locator(":scope > li")).toHaveCount(first);
      if (fixture.waiting > 60) {
        await expect(
          waiting.getByText(`Mostrando 50 de ${fixture.waiting}`),
        ).toBeVisible();
        await waiting.getByRole("button", { name: "Mostrar 50 más" }).click();
        await expect(list.locator(":scope > li")).toHaveCount(100);
        // Focus lands on the first new row, not at the top of the page.
        await expect(list.locator("[data-workbench-id]").nth(50)).toBeFocused();
      }
      // Leave for a review and come back: open state, revealed rows and the row's focus return.
      const target = list.locator("[data-workbench-id]").last();
      await target.scrollIntoViewIfNeeded();
      await target.focus();
      const id = await target.getAttribute("data-workbench-id");
      await page.keyboard.press("Enter");
      await expect(page.locator("main h1")).toBeVisible();
      await page.getByRole("link", { name: "← Atención", exact: true }).click();
      await expect(waiting).toHaveAttribute("open", "");
      await expect(page.locator(`[data-workbench-id="${id}"]`)).toBeFocused();
    }
    // Filters keep working over the whole list and keep the rest of the URL.
    await page
      .getByLabel("Filtrar estado", { exact: true })
      .selectOption("PENDING");
    await expect(page).toHaveURL(/status=PENDING/);
    const filtered = page.getByRole("list", { name: "Casos de atención" });
    const pending = filtered.locator(":scope > li");
    expect(await pending.count()).toBeLessThanOrEqual(50);
    await page.getByRole("button", { name: "Ver todas las preguntas" }).click();
    await expect(page).not.toHaveURL(/status=/);
  });
}

test.describe("revisión con 0, 1, 3, 12 y 50 aportaciones", () => {
  let cases: ReviewCases;
  test.beforeAll(async ({ baseURL }) => {
    test.setTimeout(900000);
    cases = await seedReviewCases(baseURL!);
  });
  const names = ["zero", "one", "three", "twelve", "fifty"] as const;
  const relevant: Record<string, RegExp | null> = {
    zero: null,
    one: /Participante 01/,
    three: /Participante 03/, // pending clarification wins over the conflict
    twelve: /Participante 08/, // the clarification that now waits on the analyst
    fifty: /Participante (05|22)/, // two clarifications waiting on the person
  };
  for (const key of names) {
    test(`UX-06/07: ${key} aportaciones se abre en la aportación relevante y cabe en cuatro anchos`, async ({
      page,
    }) => {
      test.setTimeout(240000);
      await login(page, "analyst");
      const question = cases.questions[key];
      for (const [width, height] of widths) {
        await page.setViewportSize({ width, height });
        await page.goto(`/projects/${cases.project.id}/review/${question.id}`);
        await expect(page.locator("main h1")).toHaveText(question.question);
        const card = page.locator(".ac-state-card");
        await expect(card).toBeVisible();
        const pane = page.locator(".ac-contribution-pane h2");
        // Contributions are on the first tab unless a conflict makes Contraste the default.
        if (key === "three") {
          await expect(
            page.getByRole("tab", { name: "Contraste" }),
          ).toHaveAttribute("aria-selected", "true");
          await expect(
            page
              .getByRole("tab", { name: "Contraste" })
              .locator('[data-icon="flag"]'),
          ).toBeVisible();
          await page.getByRole("tab", { name: /^Aportaciones/ }).click();
        }
        const expected = relevant[key];
        if (expected) {
          await expect(pane).toHaveText(expected);
          // Panels stay in the DOM while hidden: wait for the one that was chosen.
          await expect(pane).toBeVisible();
        } else
          await expect(
            page.getByText("Sin aportaciones vigentes"),
          ).toBeVisible();
        // The question, the state and the primary action are in the first viewport.
        const usable = height - (width < 760 ? bottomNav : 0);
        const geometry = await page.evaluate(() => {
          const rect = (selector: string) => {
            const el = [...document.querySelectorAll(selector)].find((e) =>
              e.checkVisibility(),
            );
            if (!el) return null;
            const r = el.getBoundingClientRect();
            return {
              top: Math.round(r.top + scrollY),
              bottom: Math.round(r.bottom + scrollY),
            };
          };
          return {
            h1: rect("main h1"),
            card: rect(".ac-state-card"),
            cta: rect(".ac-state-actions > .button"),
            // The heading of the open contribution itself, not the section's.
            pane: rect(".ac-contribution-pane h2"),
            answer: rect(".ac-contribution-pane .ac-answer"),
          };
        });
        expect(geometry.h1!.top).toBeLessThan(usable);
        expect(geometry.card!.top).toBeLessThan(usable);
        if (geometry.cta)
          expect(
            geometry.cta.bottom,
            `CTA a la vista a ${width}px`,
          ).toBeLessThanOrEqual(usable);
        // 320×640 only keeps the question, the state and the action in view; the contribution is one scroll away.
        if (width === 390 && expected) {
          expect(geometry.pane, "hay una aportación abierta").not.toBeNull();
          expect(
            geometry.pane!.top,
            "la aportación relevante empieza dentro de la primera pantalla a 390px",
          ).toBeLessThan(usable);
        }
        records.push({ id: `UX06-${key}`, width, ...geometry });
        // Secondary actions: one accessible menu on every width (CP5, UX-05);
        // its name is "Más acciones" on phones and "Otras acciones" elsewhere.
        const menuName = width < 760 ? "Más acciones" : "Otras acciones";
        await expect(
          page.getByRole("combobox", { name: "Otras acciones" }),
        ).toHaveCount(0);
        await expect(page.getByText(menuName, { exact: true })).toBeVisible();
        // An open clarification blocks recording a decision (the server answers
        // 409), so the menu does not offer it.
        if (key !== "zero" && key !== "one") {
          await page.getByText(menuName, { exact: true }).click();
          const offered = await page
            .locator(".ac-action-menu li button")
            .allTextContents();
          await page.keyboard.press("Escape");
          expect(
            offered.length,
            `acciones secundarias a ${width}px`,
          ).toBeGreaterThan(0);
          expect(offered.join(" | ")).not.toContain("Registrar decisión");
        }
        await checked(page, `UX06-${key}`, width);
        if (width <= 899)
          expect(
            await smallTargets(page),
            `objetivos pequeños en la revisión a ${width}px`,
          ).toEqual([]);
      }
    });
  }
  test("UX-07: el menú «Más acciones» funciona con teclado, Escape y devuelve el foco", async ({
    page,
  }) => {
    await login(page, "analyst");
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(
      `/projects/${cases.project.id}/review/${cases.questions.fifty.id}`,
    );
    const trigger = page.getByText("Más acciones");
    await trigger.focus();
    await page.keyboard.press("Enter");
    const request = page.getByRole("button", { name: "Solicitar aclaración" });
    await expect(request).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(request).toBeHidden();
    await expect(trigger).toBeFocused();
    await page.keyboard.press("Enter");
    await request.click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Cancelar" }).click();
    await expect(dialog).toHaveCount(0);
    await expect(trigger).toBeFocused();
  });
  test("UX-06: «Comparar aportaciones» y «← Volver» llevan el foco al elemento visible, con ratón y teclado", async ({
    page,
  }) => {
    await login(page, "analyst");
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: width === 1440 ? 900 : 844 });
      await page.goto(
        `/projects/${cases.project.id}/review/${cases.questions.twelve.id}?tab=contributions`,
      );
      if (width < 900) {
        await page
          .getByRole("button", { name: /^← Volver a 12 aportaciones/ })
          .click();
        // Returning to the list hands focus back to the contribution it came
        // from on the next frame; wait for that before moving focus ourselves.
        await expect(
          page.locator(".ac-contribution-rail button:focus, h2#received:focus"),
        ).toBeVisible();
      }
      const compare = page.getByRole("button", {
        name: "Comparar aportaciones",
      });
      await compare.focus();
      await page.keyboard.press("Enter");
      await expect(
        page.getByRole("heading", { name: "Contrastar aportaciones" }),
      ).toBeFocused();
      await page
        .getByRole("button", { name: /^← Volver a 12 aportaciones/ })
        .click();
      await expect(compare).toBeFocused();
    }
  });
  test("UX-09: ADMIN lee todo lo que el servidor le entrega, sin controles y con la razón", async ({
    page,
  }) => {
    await login(page, "admin");
    for (const [width, height] of widths) {
      await page.setViewportSize({ width, height });
      await page.goto(
        `/projects/${cases.project.id}/review/${cases.questions.three.id}`,
      );
      // The conflict has content; the clarification on the third person gives Historial something to show.
      await expect(page.getByRole("tab")).toHaveText([
        "Aportaciones (3)",
        "Contraste",
        "Historial",
      ]);
      await expect(
        page.getByText(
          "Las acciones de revisión corresponden al equipo analista.",
          { exact: false },
        ),
      ).toBeVisible();
      await expect(page.getByText("Te toca a ti")).toHaveCount(0);
      await expect(page.getByText("Otras acciones")).toHaveCount(0);
      await expect(page.getByText("Más acciones")).toHaveCount(0);
      await expect(page.locator(".ac-state-actions")).toHaveCount(0);
      await checked(page, "UX09-admin", width);
    }
  });
});

test("UX-09: el lector solo ve las pestañas con contenido y entiende por qué no hay acciones", async ({
  page,
  baseURL,
}) => {
  test.setTimeout(300000);
  const fixture = await seedScale(baseURL!, 12);
  await login(page, "viewer");
  await page.goto(`/projects/${fixture.project.id}`);
  const decided = page
    .getByRole("link", { name: /Consultar decisión/ })
    .first();
  await decided.click();
  for (const [width, height] of widths) {
    await page.setViewportSize({ width, height });
    await expect(page.getByRole("tab")).toHaveText([
      "Aportaciones (1)",
      "Decisión",
    ]);
    await expect(page.getByRole("tab", { name: "Decisión" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(
      page.getByText(
        "Las acciones de revisión corresponden al equipo analista.",
        { exact: false },
      ),
    ).toBeVisible();
    await expect(page.getByText("Otras acciones")).toHaveCount(0);
    await expect(page.getByText("Más acciones")).toHaveCount(0);
    await checked(page, "UX09-viewer", width);
  }
});

test("UX-02/08/15: la ruta vuelve a Atención, los iconos son distintos, cada página nombra su h1 y los objetivos caben", async ({
  page,
  baseURL,
}) => {
  test.setTimeout(300000);
  const fixture = await seedScale(baseURL!, 12);
  await login(page, "analyst");
  const id = fixture.project.id;
  await page.goto(`/projects/${id}/decisions`);
  const root = page
    .getByRole("navigation", { name: "Contexto de página" })
    .getByRole("link")
    .first();
  await expect(root).toHaveAttribute("href", `/projects/${id}/dashboard`);
  for (const [path, title] of [
    ["dashboard", "Atención"],
    ["editor", "Cuestionario"],
    ["decisions", "Decisiones"],
    ["invitations", "Invitaciones"],
    ["", "Preguntas publicadas"],
  ] as const) {
    await page.goto(`/projects/${id}${path ? `/${path}` : ""}`);
    await expect(page.locator("main h1")).toHaveText(title);
    await expect(page.locator("main h1")).toHaveCount(1);
  }
  await page.goto(`/projects/${id}/dashboard`);
  // Measure the settled shell.
  await expect(page.locator("main h1")).toHaveText("Atención");
  await expect(page.locator(".ac-sidebar")).toBeVisible();
  await page.setViewportSize({ width: 1440, height: 900 });
  const icons = await page
    .locator(".ac-sidebar [data-icon]")
    .evaluateAll((els) => els.map((e) => e.getAttribute("data-icon")));
  expect(icons.length).toBeGreaterThanOrEqual(6); // project, four destinations, tools
  expect(new Set(icons).size, `iconos del shell: ${icons.join(", ")}`).toBe(
    icons.length,
  );
  // Tablet and phones: every standalone target is usable (44 px).
  for (const [width, height] of widths.filter(([w]) => w <= 899)) {
    await page.setViewportSize({ width, height });
    expect(
      await smallTargets(page),
      `objetivos del shell a ${width}px`,
    ).toEqual([]);
  }
  // The mobile root link goes to Atención too, with a name that says so.
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    page
      .getByRole("navigation", { name: "Contexto de página" })
      .getByRole("link")
      .first(),
  ).toHaveAccessibleName(/ir a Atención$/);
  // Keyboard: the root of the path is reachable and shows the focus ring; the skip link still targets the content.
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`/projects/${id}/dashboard`);
  await expect(page.locator("main h1")).toHaveText("Atención");
  const rootLink = page
    .getByRole("navigation", { name: "Contexto de página" })
    .getByRole("link")
    .first();
  await rootLink.focus();
  await expect(rootLink).toBeFocused();
  expect(
    await rootLink.evaluate((el) => getComputedStyle(el).boxShadow),
  ).not.toBe("none");
  await expect(
    page.getByRole("link", { name: "Ir al contenido" }),
  ).toHaveAttribute("href", "#main");
  await expect(page.locator("main#main")).toHaveCount(1);
});

test("UX-02 (residual): la página se monta una sola vez dentro del shell y conserva lo elegido mientras cargan los proyectos", async ({
  page,
  baseURL,
}) => {
  test.setTimeout(300000);
  const fixture = await seedScale(baseURL!, 12);
  await login(page, "admin");
  // A slow project list used to show the page in the legacy layout first and
  // remount it inside the shell, dropping the chosen file.
  await page.route(
    (url) => url.pathname === "/api/v1/projects",
    async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      await route.continue();
    },
  );
  await page.goto(`/projects/${fixture.project.id}/import`);
  const input = page.getByLabel("Archivo JSON");
  await input.setInputFiles({
    name: "ficticio.json",
    mimeType: "application/json",
    buffer: Buffer.from("{}"),
  });
  await expect(page.locator(".ac-sidebar")).toBeVisible();
  await expect(page.locator("main h1")).toHaveCount(1);
  expect(
    await input.evaluate((el) => (el as HTMLInputElement).files?.length),
  ).toBe(1);
});
