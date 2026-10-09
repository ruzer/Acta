import { test, expect, type Page } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { login } from "./login-helper";
import {
  seedDocumentCases,
  seedReviewCases,
  type DocumentCases,
  type ReviewCases,
} from "./fixtures/review-cases";
import {
  checkedPage,
  matrixWidths,
  smallTargets,
} from "./fixtures/page-checks";

// Checkpoint 5 — conflicts, clarifications and decisions (Direction C).
// Real browser, real API, disposable data; five widths. The measured values
// are the ones of CODEX-VISUAL-ACCEPTANCE §6.4 and §6.5.
const folder =
  (process.env.ACTA_DIRECTION_C_EVIDENCE_DIR ??
    "docs/design/acta-direction-c-evidence") + "/cp5";
const records: Record<string, unknown>[] = [];
test.use({
  locale: "es-MX",
  timezoneId: "America/Mexico_City",
  reducedMotion: "reduce",
});
test.describe.configure({ mode: "serial" });
test.afterAll(async () => {
  await mkdir(folder, { recursive: true });
  await writeFile(
    `${folder}/metrics-cp5.json`,
    JSON.stringify({ checkpoint: 5, records }, null, 2) + "\n",
  );
});

let docs: DocumentCases;
let reviews: ReviewCases;
test.beforeAll(async ({ baseURL }) => {
  test.setTimeout(900000);
  docs = await seedDocumentCases(baseURL!);
  reviews = await seedReviewCases(baseURL!);
});
const open = async (
  page: Page,
  project: string,
  question: string,
  tab = "",
) => {
  await page.goto(
    `/projects/${project}/review/${question}${tab ? `?tab=${tab}` : ""}`,
  );
  await expect(page.locator("main h1")).toHaveCount(1);
  await page.evaluate(async () => {
    await document.fonts.ready;
    scrollTo(0, 0);
  });
};
const primaryCount = (page: Page) =>
  page.locator("main .button.primary:visible").count();

test("V-09 · Contraste: tabla simétrica, respuestas como contenido y acciones junto a la pareja", async ({
  page,
}) => {
  test.setTimeout(240000);
  await login(page, "analyst");
  for (const [width, height] of matrixWidths) {
    await page.setViewportSize({ width, height });
    await open(page, docs.project.id, docs.questions.conflict.id);
    await expect(page.getByRole("tab", { name: "Contraste" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    const table = page.getByRole("table", {
      name: "Comparación de aportaciones",
    });
    await expect(table).toBeVisible();
    // One heading for the panel; the conflict is a band, not another heading.
    await expect(
      page.getByRole("heading", { name: "Contrastar aportaciones" }),
    ).toHaveCount(1);
    await expect(page.getByRole("heading", { name: /Conflicto/ })).toHaveCount(
      0,
    );
    for (const field of [
      "Respuesta",
      "Comentario",
      "Ejemplo",
      "Evidencia",
      "Versión",
    ])
      await expect(
        table.getByRole("rowheader", { name: field, exact: true }),
      ).toHaveCount(1);
    const heads = await table
      .getByRole("columnheader", { name: /^Postura [AB]/ })
      .evaluateAll((els) =>
        els.map((el) => {
          const r = el.getBoundingClientRect();
          return {
            top: r.top + scrollY,
            x: r.x,
            y: r.y,
            width: r.width,
            height: r.height,
            background: getComputedStyle(el).backgroundColor,
          };
        }),
      );
    expect(heads).toHaveLength(2);
    // Neither side has a colour of its own.
    expect(heads[0]!.background).toBe(heads[1]!.background);
    if (width >= 760) {
      expect(Math.abs(heads[0]!.y - heads[1]!.y)).toBeLessThan(2);
      expect(Math.abs(heads[0]!.width - heads[1]!.width)).toBeLessThan(2);
    } else {
      // Interleaved by field on phones: the second posture follows the first.
      expect(heads[1]!.y).toBeGreaterThanOrEqual(
        heads[0]!.y + heads[0]!.height,
      );
      expect(Math.abs(heads[0]!.x - heads[1]!.x)).toBeLessThan(2);
    }
    if (width === 1440)
      expect(
        heads[0]!.top,
        "la tabla comparativa empieza dentro del primer viewport",
      ).toBeLessThanOrEqual(700);
    // The answer is the content: it is the largest text of the table.
    const sizes = await table.evaluate((el) => {
      const px = (selector: string) =>
        parseFloat(getComputedStyle(el.querySelector(selector)!).fontSize);
      return { answer: px(".ac-answer"), label: px("tbody th") };
    });
    expect(sizes.answer).toBeGreaterThan(sizes.label);
    // Actions sit next to the pair; only the state card holds a primary control.
    await expect(
      page.getByRole("button", { name: /^Pedir aclaración a A/ }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /^Pedir aclaración a B/ }),
    ).toBeVisible();
    expect(await primaryCount(page)).toBeLessThanOrEqual(1);
    records.push({ id: "V-09", width, tableTop: heads[0]!.top, sizes });
    await checkedPage(page, folder, "V-09-conflicto", width);
    if (width <= 899)
      expect(
        await smallTargets(page),
        `objetivos táctiles a ${width}px`,
      ).toEqual([]);
  }
});

test("V-09/V-10 · «Pedir aclaración a A» abre el diálogo con esa aportación ya elegida y devuelve el foco al cancelar", async ({
  page,
}) => {
  await login(page, "analyst");
  for (const [width, height] of [matrixWidths[0], matrixWidths[3]]) {
    await page.setViewportSize({ width, height });
    await open(page, docs.project.id, docs.questions.conflict.id);
    const ask = page.getByRole("button", { name: /^Pedir aclaración a A/ });
    await ask.click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByRole("combobox", {
        name: "Respuesta sobre la que necesitas aclaración",
      }),
    ).toHaveCount(0);
    await expect(
      dialog.getByText(/^Aportación de .* · envío #\d+$/),
    ).toBeVisible();
    await dialog.getByRole("button", { name: "Cancelar" }).click();
    await expect(dialog).toHaveCount(0);
    await expect(ask).toBeFocused();
  }
});

test("V-10 · Aclaración: intercambio pegado a la aportación, quién pregunta y quién responde, estado y turno", async ({
  page,
}) => {
  test.setTimeout(240000);
  await login(page, "analyst");
  for (const [width, height] of matrixWidths) {
    await page.setViewportSize({ width, height });
    await open(page, reviews.project.id, reviews.questions.twelve.id);
    // The clarification that waits on the analyst opens first.
    const thread = page.getByRole("region", { name: /^Aclaración · envío #/ });
    await expect(thread).toBeVisible();
    await expect(thread.getByText("Lista para revisar")).toBeVisible();
    await expect(thread.getByText(/Te toca a ti/)).toBeVisible();
    const items = thread.getByRole("listitem");
    await expect(items.filter({ hasText: "Pregunta" })).toHaveCount(1);
    await expect(items.filter({ hasText: "Respuesta" })).toHaveCount(1);
    // Actions are inside the exchange, below its messages.
    const geometry = await thread.evaluate((el) => ({
      list: el.querySelector("ol")!.getBoundingClientRect().bottom,
      actions: el.querySelector(".ac-thread-actions")!.getBoundingClientRect()
        .top,
    }));
    expect(geometry.actions).toBeGreaterThanOrEqual(geometry.list);
    await expect(
      thread.getByRole("button", { name: "Cerrar aclaración" }),
    ).toBeVisible();
    await expect(
      thread.getByRole("button", { name: "Preguntar nuevamente" }),
    ).toBeVisible();
    await thread.scrollIntoViewIfNeeded();
    await checkedPage(page, folder, "V-10-aclaracion", width);
  }
});

test("V-11 · Decisión: documento con «Se decide» dominante, fundamentos numerados y registro al pie", async ({
  page,
}) => {
  test.setTimeout(240000);
  await login(page, "analyst");
  for (const [width, height] of matrixWidths) {
    await page.setViewportSize({ width, height });
    await open(page, docs.project.id, docs.questions.decision.id);
    await expect(page.getByRole("tab", { name: "Decisión" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    const sheet = page.getByRole("article", { name: "Decisión vigente" });
    await expect(sheet).toBeVisible();
    // The accessible heading "Decisión vigente" still exists (state card).
    await expect(
      page.getByRole("heading", { name: "Decisión vigente", exact: true }),
    ).toHaveCount(1);
    const result = sheet.locator(".ac-decision-result");
    const type = await result.evaluate((el) => {
      const css = getComputedStyle(el);
      return {
        size: parseFloat(css.fontSize),
        weight: Number(css.fontWeight),
        family: css.fontFamily,
        top: el.getBoundingClientRect().top + scrollY,
      };
    });
    expect(type.family).toContain("Plex Serif");
    expect(type.weight).toBeGreaterThanOrEqual(700);
    if (width >= 900) {
      expect(type.size).toBeGreaterThanOrEqual(28);
      expect(type.size).toBeLessThanOrEqual(30);
    }
    if (width === 1440)
      expect(
        type.top,
        "«Se decide» a la vista en el primer viewport",
      ).toBeLessThanOrEqual(560);
    // The result is the largest text of the document.
    const largest = await sheet.evaluate((el) => {
      const sizes = [...el.querySelectorAll<HTMLElement>("*")]
        .filter((n) => n.checkVisibility() && n.childNodes.length)
        .map((n) => parseFloat(getComputedStyle(n).fontSize));
      return Math.max(...sizes);
    });
    expect(type.size).toBe(largest);
    // Numbered grounds with who, which area, which submission and the file names.
    const grounds = sheet.locator(".ac-foundations > li");
    expect(await grounds.count()).toBeGreaterThanOrEqual(5);
    await expect(grounds.first()).toContainText("[1]");
    await expect(grounds.first()).toContainText(/envío #\d+/);
    await expect(
      sheet.locator(".ac-evidence-name strong").first(),
    ).toBeVisible();
    for (const box of await sheet
      .locator(".ac-evidence-name")
      .evaluateAll((els) => els.map((el) => el.getBoundingClientRect().width)))
      expect(box).toBeGreaterThan(40);
    // The identifier is only in the foot, below the result; the foot carries the warning.
    const foot = sheet.locator("footer");
    await expect(foot).toContainText("Referencia del registro:");
    await expect(foot).toContainText(
      "No equivale a una firma electrónica ni tiene un efecto jurídico adicional",
    );
    const uuid = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/;
    const above = await sheet.evaluate((el, source) => {
      const pattern = new RegExp(source);
      const resultNode = el.querySelector(".ac-decision-result")!;
      return [...el.querySelectorAll<HTMLElement>("*")]
        .filter(
          (n) => n.children.length === 0 && pattern.test(n.textContent ?? ""),
        )
        .filter(
          (n) =>
            n.compareDocumentPosition(resultNode) &
            Node.DOCUMENT_POSITION_FOLLOWING,
        ).length;
    }, uuid.source);
    expect(above, "ningún identificador técnico sobre el resultado").toBe(0);
    // Reopening is a tertiary action in the foot.
    await expect(
      foot.getByRole("button", { name: "Reabrir pregunta" }),
    ).toHaveClass(/tertiary/);
    records.push({
      id: "V-11",
      width,
      resultSize: type.size,
      resultTop: type.top,
      grounds: await grounds.count(),
    });
    await checkedPage(page, folder, "V-11-decision", width);
    if (width <= 899)
      expect(
        await smallTargets(page),
        `objetivos táctiles a ${width}px`,
      ).toEqual([]);
  }
});

test("V-11 · «Cómo se llegó aquí» y la cronología del Historial se derivan del detalle y siguen el orden de los hechos", async ({
  page,
}) => {
  await login(page, "analyst");
  await page.setViewportSize({ width: 1440, height: 900 });
  await open(page, docs.project.id, docs.questions.decision.id);
  const aside = page.getByRole("complementary").filter({
    has: page.getByRole("heading", { name: "Cómo se llegó aquí" }),
  });
  await expect(aside).toBeVisible();
  const events = await aside
    .getByRole("listitem")
    .evaluateAll((els) => els.map((el) => el.textContent ?? ""));
  const order = [
    "envió su aportación",
    "registró un conflicto",
    "pidió una aclaración",
    "respondió la aclaración",
    "cerró la aclaración",
    "resolvió el conflicto (no valida la pregunta)",
    "registró la decisión",
  ];
  let cursor = -1;
  for (const fragment of order) {
    const index = events.findIndex(
      (text, position) => position > cursor && text.includes(fragment),
    );
    expect(
      index,
      `«${fragment}» aparece después del hecho anterior`,
    ).toBeGreaterThan(cursor);
    cursor = index;
  }
  // The same chronology is the Historial.
  await page.getByRole("tab", { name: "Historial" }).click();
  await expect(
    page.getByRole("list", { name: "Cronología de la pregunta" }),
  ).toBeVisible();
});

test("V-11 · «Abrir la aportación» lleva a la aportación de esa fuente y enfoca su encabezado", async ({
  page,
}) => {
  await login(page, "analyst");
  for (const [width, height] of [matrixWidths[0], matrixWidths[3]]) {
    await page.setViewportSize({ width, height });
    await open(page, docs.project.id, docs.questions.decision.id);
    const link = page
      .getByRole("article", { name: "Decisión vigente" })
      .getByRole("button", { name: /^Abrir la aportación de / })
      .nth(1);
    const label = (await link.getAttribute("aria-label"))!;
    const person = /de (.+), envío/.exec(label)![1]!;
    await link.click();
    await expect(
      page.getByRole("tab", { name: /^Aportaciones/ }),
    ).toHaveAttribute("aria-selected", "true");
    const heading = page.getByRole("heading", { level: 2, name: person });
    await expect(heading).toBeFocused();
  }
});

test("V-11 · una decisión reabierta se conserva como antecedente, no como la vigente", async ({
  page,
}) => {
  await login(page, "analyst");
  await page.setViewportSize({ width: 1440, height: 900 });
  await open(page, docs.project.id, docs.questions.reopened.id, "decision");
  await expect(
    page.getByRole("article", { name: "Decisión vigente" }),
  ).toHaveCount(0);
  const history = page.locator("details.ac-decision-history");
  await expect(history.locator(":scope > summary")).toHaveText(
    "Decisiones históricas (1)",
  );
  await history.locator(":scope > summary").click();
  const record = history.getByRole("article", { name: "Decisión histórica" });
  await expect(record).toBeVisible();
  await expect(record.getByText("Antecedente", { exact: true })).toBeVisible();
  await expect(record).toContainText(
    "Volvió a revisión: Cambió el alcance de la comunicación.",
  );
  await checkedPage(page, folder, "V-11-reabierta", 1440);
});

test("V-12 · Decisiones del proyecto: línea de registro con referencia, título documental, tema · área y marca Vigente", async ({
  page,
}) => {
  test.setTimeout(240000);
  await login(page, "analyst");
  for (const [width, height] of matrixWidths) {
    await page.setViewportSize({ width, height });
    await page.goto(`/projects/${docs.project.id}/decisions`);
    await expect(page.locator("main h1")).toHaveText("Decisiones");
    const row = page.locator(".ac-register-row").first();
    await expect(row).toBeVisible();
    await expect(row.getByText("Vigente")).toBeVisible();
    const parts = await row.evaluate((el) => {
      const px = (selector: string) =>
        parseFloat(getComputedStyle(el.querySelector(selector)!).fontSize);
      return {
        reference: px(".ac-register-reference"),
        title: px(".ac-register-title"),
        meta: px(".ac-register-meta"),
        titleFont: getComputedStyle(el.querySelector(".ac-register-title")!)
          .fontFamily,
      };
    });
    // Identifiers and metadata are never larger than the title.
    expect(parts.title).toBeGreaterThan(parts.reference);
    expect(parts.title).toBeGreaterThan(parts.meta);
    expect(parts.titleFont).toContain("Plex Serif");
    await checkedPage(page, folder, "V-12-decisiones", width);
    if (width <= 899)
      expect(
        await smallTargets(page),
        `objetivos táctiles a ${width}px`,
      ).toEqual([]);
  }
});

test("V-13/V-14 · solo lectura: ADMIN ve el contraste completo y VIEWER la decisión, sin controles y con la razón", async ({
  page,
}) => {
  test.setTimeout(240000);
  await login(page, "admin");
  for (const [width, height] of matrixWidths) {
    await page.setViewportSize({ width, height });
    await open(page, docs.project.id, docs.questions.conflict.id);
    await expect(page.getByText("Consulta de solo lectura.")).toBeVisible();
    await expect(
      page.getByRole("table", { name: "Comparación de aportaciones" }),
    ).toBeVisible();
    await expect(page.getByText(/^(Otras|Más) acciones$/)).toHaveCount(0);
    await expect(
      page.getByRole("button", {
        name: /Resolver conflicto|Pedir aclaración|Marcar conflicto|Registrar decisión/,
      }),
    ).toHaveCount(0);
    await checkedPage(page, folder, "V-13-admin", width);
  }
  await page.context().clearCookies();
  await login(page, "viewer");
  for (const [width, height] of matrixWidths) {
    await page.setViewportSize({ width, height });
    await open(page, docs.project.id, docs.questions.decision.id);
    const sheet = page.getByRole("article", { name: "Decisión vigente" });
    await expect(sheet).toBeVisible();
    await expect(
      sheet.getByRole("button", { name: "Reabrir pregunta" }),
    ).toHaveCount(0);
    await expect(page.getByText(/^(Otras|Más) acciones$/)).toHaveCount(0);
    // The viewer only gets the sources the server returns; the comment stays hidden.
    await expect(sheet.getByText("Comentario interno")).toHaveCount(0);
    await checkedPage(page, folder, "V-14-viewer", width);
  }
});

test("V-05/V-06 · respuestas largas y evidencias: nombres de archivo a la vista y sin desbordes", async ({
  page,
}) => {
  test.setTimeout(240000);
  await login(page, "analyst");
  for (const [width, height] of matrixWidths) {
    await page.setViewportSize({ width, height });
    await open(page, docs.project.id, docs.questions.long.id, "contributions");
    // Open the contribution with the most files (person 4: three).
    const rail = page.getByRole("list", { name: "Aportaciones vigentes" });
    if (await rail.isVisible().catch(() => false))
      await rail
        .getByRole("button", { name: /Abrir aportación de Héctor Villalobos/ })
        .click();
    else {
      await page
        .getByRole("button", { name: /Abrir aportación de Héctor Villalobos/ })
        .click();
    }
    const names = page.locator(
      ".ac-contribution-pane .ac-evidence-name strong",
    );
    await expect(names).toHaveCount(3);
    for (const box of await page
      .locator(".ac-contribution-pane .ac-evidence-name")
      .evaluateAll((els) => els.map((el) => el.getBoundingClientRect().width)))
      expect(box).toBeGreaterThan(40);
    await checkedPage(page, folder, "V-05-respuesta-larga", width);
  }
});
