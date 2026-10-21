import { test, expect, type Page } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { login } from "./login-helper";
import {
  seedParticipantCases,
  type ParticipantCases,
} from "./fixtures/review-cases";
import {
  checkedPage,
  matrixWidths,
  smallTargets,
} from "./fixtures/page-checks";

// Checkpoint 6 — participants and external guests (Direction C). Real
// browser, real API, disposable data, five widths. The question and the answer
// lead; what to do, what was saved, what was sent and what follows must be clear
// without inventing anything the product does not do.
const folder =
  (process.env.ACTA_DIRECTION_C_EVIDENCE_DIR ??
    "docs/design/acta-direction-c-evidence") + "/cp6";
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
    `${folder}/metrics-cp6.json`,
    JSON.stringify({ checkpoint: 6, records }, null, 2) + "\n",
  );
});

let cases: ParticipantCases;
test.beforeAll(async ({ baseURL }) => {
  test.setTimeout(600000);
  cases = await seedParticipantCases(baseURL!);
});
const go = async (page: Page, path: string) => {
  await page.goto(path);
  await expect(page.locator("main h1")).toHaveCount(1);
  await page.evaluate(async () => {
    await document.fonts.ready;
    scrollTo(0, 0);
  });
};
const primaryCount = (page: Page) =>
  page.locator("main .button.primary:visible").count();
const top = (page: Page, selector: string) =>
  page
    .locator(selector)
    .first()
    .evaluate((el) => el.getBoundingClientRect().top + scrollY);
const font = (page: Page, selector: string) =>
  page
    .locator(selector)
    .first()
    .evaluate((el) => {
      const css = getComputedStyle(el);
      return {
        size: parseFloat(css.fontSize),
        weight: Number(css.fontWeight),
        family: css.fontFamily,
      };
    });

test("V-15 · Mi trabajo: avance, aclaración destacada y la pregunta como texto principal", async ({
  page,
}) => {
  test.setTimeout(240000);
  await login(page, "stakeholder");
  for (const [width, height] of matrixWidths) {
    await page.setViewportSize({ width, height });
    await go(page, `/projects/${cases.project.id}/work`);
    await expect(page.locator("main h1")).toHaveText("Mi trabajo");
    // Progress in words and a bar; the note is the real behaviour of saving.
    await expect(page.getByText(/^3 de 8 preguntas enviadas$/)).toBeVisible();
    await expect(
      page.getByRole("img", { name: /3 de 8 preguntas enviadas/ }),
    ).toBeVisible();
    await expect(page.getByText(/Guardar y salir/)).toBeVisible();
    // The clarification that waits on the person is above the list.
    const callout = page.locator(".ac-callout");
    await expect(callout).toContainText("Una aclaración espera tu respuesta");
    const list = await top(page, ".participant-topic");
    const attention = await top(page, ".ac-callout");
    expect(attention).toBeLessThan(list);
    // One primary action; rows lead with the question in document voice.
    expect(await primaryCount(page)).toBeLessThanOrEqual(1);
    const row = await font(page, ".participant-row-question");
    expect(row.family).toContain("Plex Serif");
    expect(row.size).toBeGreaterThanOrEqual(16);
    // Every state is a glyph plus a word, never colour alone.
    for (const chip of await page
      .locator(".participant-work-row .ac-status")
      .all()) {
      await expect(chip.locator('svg[aria-hidden="true"]')).toHaveCount(1);
      expect((await chip.innerText()).trim().length).toBeGreaterThan(2);
    }
    records.push({ id: "V-15", width, callout: attention, list });
    await checkedPage(page, folder, "V-15-mi-trabajo", width);
    if (width <= 899)
      expect(
        await smallTargets(page),
        `objetivos táctiles a ${width}px`,
      ).toEqual([]);
  }
});

test("V-16 · Responder: la pregunta domina, la nota queda junto a los botones y hay un solo primario", async ({
  page,
}) => {
  test.setTimeout(240000);
  await login(page, "stakeholder");
  for (const [width, height] of matrixWidths) {
    await page.setViewportSize({ width, height });
    await go(
      page,
      `/projects/${cases.project.id}/respond/${cases.questions.pending[0]!.id}`,
    );
    const h1 = await font(page, "main h1");
    expect(h1.family).toContain("Plex Serif");
    expect(h1.weight).toBeGreaterThanOrEqual(700);
    expect(h1.size).toBe(width <= 600 ? 23 : 28);
    // The question comes before the fields it asks for.
    expect(await top(page, "main h1")).toBeLessThan(
      await top(page, "textarea"),
    );
    // One primary: "Enviar respuesta"; the note about saving is right under the actions.
    await expect(
      page.getByRole("button", { name: /^Enviar respuesta/ }),
    ).toHaveCount(1);
    expect(await primaryCount(page)).toBe(1);
    const geometry = await page.evaluate(() => {
      const actions = document
        .querySelector(".response-actions")!
        .getBoundingClientRect();
      const note = [...document.querySelectorAll<HTMLElement>("p.hint")]
        .find((p) => p.textContent?.includes("Guardar y salir"))!
        .getBoundingClientRect();
      return { gap: note.top - actions.bottom };
    });
    expect(geometry.gap, "la nota junto a las acciones").toBeLessThanOrEqual(
      24,
    );
    // No invented autosave: nothing says "guardado" before anything was saved.
    await expect(page.getByText(/Borrador guardado/)).toHaveCount(0);
    records.push({ id: "V-16", width, h1: h1.size, gap: geometry.gap });
    await checkedPage(page, folder, "V-16-responder", width);
    if (width <= 899)
      expect(
        await smallTargets(page),
        `objetivos táctiles a ${width}px`,
      ).toEqual([]);
  }
  // A real saved draft is reported with its real date.
  await page.setViewportSize({ width: 1440, height: 900 });
  await go(
    page,
    `/projects/${cases.project.id}/respond/${cases.questions.draft.id}`,
  );
  await expect(page.getByText(/^Borrador guardado · /)).toBeVisible();
  await expect(page.getByLabel("Tu respuesta", { exact: true })).toHaveValue(
    /Borrador:/,
  );
});

test("V-17 · Enviada: tu respuesta, archivos, «Qué sigue» real y nada de la decisión", async ({
  page,
}) => {
  test.setTimeout(240000);
  await login(page, "stakeholder");
  for (const [width, height] of matrixWidths) {
    await page.setViewportSize({ width, height });
    await go(
      page,
      `/projects/${cases.project.id}/submitted/${cases.questions.submitted.id}`,
    );
    await expect(page.getByText("En revisión", { exact: true })).toBeVisible();
    const answer = await font(page, ".participant-answer");
    expect(answer.family).toContain("Plex Serif");
    // The sent answer is a document: a rule above, who/when on the same line.
    await expect(page.locator(".participant-submission-head")).toContainText(
      /Tú · Envío 1 · /,
    );
    // Files keep their name visible.
    const names = page.locator(".ac-evidence-name strong");
    await expect(names).toHaveCount(1);
    expect(
      await page
        .locator(".ac-evidence-name")
        .first()
        .evaluate((el) => el.getBoundingClientRect().width),
    ).toBeGreaterThan(40);
    // "Qué sigue" only holds states that exist.
    const steps = page
      .getByRole("complementary")
      .filter({ has: page.getByRole("heading", { name: "Qué sigue" }) });
    await expect(steps.getByRole("listitem")).toHaveCount(3);
    await expect(steps).toContainText("Enviaste tu respuesta");
    await expect(steps).toContainText("El equipo analista revisa tu respuesta");
    await expect(steps).toContainText(
      "Verás el estado «Validada» en esta pregunta.",
    );
    // No invented notification promise.
    await expect(page.getByText(/correo/i)).toHaveCount(0);
    records.push({ id: "V-17", width, answer: answer.size });
    await checkedPage(page, folder, "V-17-enviada", width);
    if (width <= 899)
      expect(
        await smallTargets(page),
        `objetivos táctiles a ${width}px`,
      ).toEqual([]);
  }
  // A validated question shows the state, never the text of the decision.
  await page.setViewportSize({ width: 1440, height: 900 });
  await go(
    page,
    `/projects/${cases.project.id}/submitted/${cases.questions.validated.id}`,
  );
  await expect(
    page.getByText("Validada", { exact: true }).first(),
  ).toBeVisible();
  await expect(
    page.getByText(/El plazo máximo de pago es de 20 días naturales\./),
  ).toHaveCount(0);
  await expect(
    page.getByText(
      /Esto no significa que cada aportación individual haya sido validada/,
    ),
  ).toBeVisible();
  await checkedPage(page, folder, "V-17-validada", 1440);
});

test("V-19 · Aclaración: intercambio con roles claros, turno visible y respuesta en el mismo lugar", async ({
  page,
}) => {
  test.setTimeout(240000);
  await login(page, "stakeholder");
  for (const [width, height] of matrixWidths) {
    await page.setViewportSize({ width, height });
    await go(
      page,
      `/projects/${cases.project.id}/clarifications/${cases.questions.clarification.id}`,
    );
    await expect(
      page.getByText("Necesitamos que aclares esta respuesta"),
    ).toBeVisible();
    const thread = page.getByRole("region", { name: "Aclaración solicitada" });
    await expect(thread).toBeVisible();
    await expect(
      thread.getByText("Espera aclaración del participante"),
    ).toBeVisible();
    await expect(thread.getByText("Te toca responder.")).toBeVisible();
    await expect(
      thread.getByRole("listitem").filter({ hasText: "Pregunta" }),
    ).toHaveCount(1);
    // The original answer comes first, then the exchange, then the reply box.
    expect(await top(page, ".participant-submission")).toBeLessThan(
      await top(page, ".ac-thread-inset"),
    );
    expect(await top(page, ".ac-thread-inset")).toBeLessThan(
      await top(page, "textarea"),
    );
    const steps = page
      .getByRole("complementary")
      .filter({ has: page.getByRole("heading", { name: "Qué sigue" }) });
    await expect(steps).toContainText("Pidieron una aclaración");
    await expect(steps).toContainText("Te toca responder.");
    await checkedPage(page, folder, "V-19-aclaracion", width);
    if (width <= 899)
      expect(
        await smallTargets(page),
        `objetivos táctiles a ${width}px`,
      ).toEqual([]);
  }
  // Answering moves the turn: the thread now waits on the analyst.
  await page.setViewportSize({ width: 1440, height: 900 });
  await go(
    page,
    `/projects/${cases.project.id}/clarifications/${cases.questions.clarification.id}`,
  );
  await page
    .getByLabel("Tu aclaración")
    .fill("La autoriza la persona titular del área, por escrito.");
  await page.getByRole("button", { name: "Enviar aclaración" }).click();
  await expect(page).toHaveURL(
    /\/(clarifications|submitted|respond|receipt)\//,
  );
});

test("V-18 · Acuse: lo que quedó de tu trabajo, con los mismos conteos", async ({
  page,
}) => {
  await login(page, "stakeholder");
  for (const [width, height] of matrixWidths) {
    await page.setViewportSize({ width, height });
    await go(page, `/projects/${cases.project.id}/receipt`);
    await expect(
      page.getByText(/respuestas enviadas en el proyecto/),
    ).toBeVisible();
    await checkedPage(page, folder, "V-18-acuse", width);
  }
});

test("V-20/21/22 · Invitación externa: carta con la organización primero, vigencia y advertencia a la vista, y confirmación real", async ({
  browser,
}) => {
  test.setTimeout(480000);
  for (const [width, height] of matrixWidths) {
    const context = await browser.newContext({
      viewport: { width, height },
      locale: "es-MX",
    });
    const page = await context.newPage();
    await page.goto(cases.invitation.url);
    await expect(page.locator("main h1")).toHaveCount(1);
    await page.evaluate(async () => {
      await document.fonts.ready;
      scrollTo(0, 0);
    });
    await expect(
      page.getByText("Invitación para aportar", { exact: true }),
    ).toBeVisible();
    await expect(page.locator("main h1")).toContainText(
      "te invita a responder 3 preguntas",
    );
    expect(new URL(page.url()).hash, "el enlace no queda en la URL").toBe("");
    // Facts, expiry and the truth about the link are in the first viewport.
    const expires = await top(page, ".ac-facts dd >> nth=1");
    const notice = await top(page, ".invitation-notice");
    const start = await top(page, "main .button.primary");
    expect(expires, "la vigencia a la vista").toBeLessThan(height);
    expect(notice, "la advertencia del enlace a la vista").toBeLessThan(height);
    if (width >= 390)
      expect(start, "la acción principal a la vista").toBeLessThan(height);
    // Only what the contract provides: no recipient and no purpose are invented.
    await expect(page.getByText("Persona invitada ficticia")).toHaveCount(0);
    await expect(page.getByText("Puedes adjuntar evidencia")).toBeVisible();
    await expect(page.getByText("No necesitas crear una")).toBeVisible();
    const h1 = await font(page, "main h1");
    expect(h1.family).toContain("Plex Serif");
    expect(await primaryCount(page)).toBeLessThanOrEqual(1);
    records.push({ id: "V-20", width, expires, notice, start });
    await checkedPage(page, folder, "V-20-invitacion", width);
    if (width <= 899)
      expect(
        await smallTargets(page),
        `objetivos táctiles a ${width}px`,
      ).toEqual([]);
    await context.close();
  }
  // Answer the three questions through the interface; the last one closes the letter.
  const answering = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    locale: "es-MX",
  });
  const guest = await answering.newPage();
  await guest.goto(cases.invitation.url);
  for (let n = 0; n < 3; n++) {
    await guest.getByRole("button", { name: /^(Comenzar|Continuar)/ }).click();
    await expect(guest.locator("main h1")).toContainText(
      "¿Cómo debe atenderse",
    );
    if (n === 0)
      await checkedPage(guest, folder, "V-21-invitado-responder", 1440);
    await guest
      .getByLabel("Tu respuesta", { exact: true })
      .fill(`Respuesta ficticia ${n + 1} de la persona invitada.`);
    await guest
      .getByRole("button", { name: "Enviar respuesta", exact: true })
      .click();
    await guest
      .getByRole("dialog")
      .getByRole("button", { name: "Confirmar envío" })
      .click();
    await expect(guest.getByRole("dialog")).toHaveCount(0);
    await guest
      .getByRole("button", {
        name: /Todas las preguntas|Volver a las preguntas/,
      })
      .first()
      .click();
  }
  await answering.close();
  // The confirmation, at every width, reopening the same link.
  for (const [width, height] of matrixWidths) {
    const context = await browser.newContext({
      viewport: { width, height },
      locale: "es-MX",
    });
    const page = await context.newPage();
    await page.goto(cases.invitation.url);
    await expect(page.locator("main h1")).toHaveText(
      "Gracias. Recibimos tus respuestas",
    );
    const next = page.getByRole("complementary").filter({
      has: page.getByRole("heading", { name: "Qué sigue" }),
    });
    await expect(next).toContainText(
      "El equipo analista revisará tus respuestas.",
    );
    await expect(next).toContainText(
      "Puedes cerrar esta página. No hace falta hacer nada más.",
    );
    await expect(
      page.locator(".invitation-section .ac-status", { hasText: "Enviada" }),
    ).toHaveCount(3);
    // The next steps are plain sentences: they read as text, not as headings.
    const weights = await next
      .locator(".ac-step-title")
      .evaluateAll((els) =>
        els.map((el) => Number(getComputedStyle(el).fontWeight)),
      );
    expect(weights.length).toBe(3);
    for (const weight of weights) expect(weight).toBeLessThan(600);
    await checkedPage(page, folder, "V-22-invitado-confirmacion", width);
    if (width <= 899)
      expect(
        await smallTargets(page),
        `objetivos táctiles a ${width}px`,
      ).toEqual([]);
    await context.close();
  }
});

test("Tema oscuro del participante: el contraste sigue sin violaciones automáticas", async ({
  browser,
}) => {
  const context = await browser.newContext({
    colorScheme: "dark",
    viewport: { width: 1440, height: 900 },
    locale: "es-MX",
  });
  const page = await context.newPage();
  await login(page, "stakeholder");
  await go(page, `/projects/${cases.project.id}/work`);
  await checkedPage(page, folder, "V-15-oscuro", 1440);
  await context.close();
});
