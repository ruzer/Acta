import { test, expect, type Locator, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import type { ProjectView, QuestionView } from "@requirements/contracts";
import { login } from "./login-helper";
import { command } from "./fixtures/workbench";
import { checkedPage } from "./fixtures/page-checks";

const evidence =
  process.env.ACTA_DIRECTION_C_EVIDENCE_DIR ?? "test-results/design-evidence";
test.use({ hasTouch: true, reducedMotion: "no-preference" });
async function fixture(page: Page) {
  await login(page, "admin");
  const project = await command<ProjectView>(page, "/projects", {
    externalId: randomUUID(),
    name: "Movimiento ficticio del panel",
    description: "Prueba sin datos reales",
  });
  const area = (
    await command<{ id: string; active: boolean }[]>(page, "/areas")
  ).find((item) => item.active)!;
  const questions: QuestionView[] = [];
  for (let topic = 0; topic < 2; topic++) {
    const section = await command<{ id: string }>(
      page,
      `/projects/${project.id}/sections`,
      {
        externalId: randomUUID(),
        title: `Tema ficticio ${topic + 1}`,
        description: "",
        order: topic,
      },
    );
    for (let index = 0; index < 2; index++) {
      questions.push(
        await command<QuestionView>(page, `/projects/${project.id}/questions`, {
          externalId: randomUUID(),
          sectionId: section.id,
          title: `Pregunta ficticia ${topic + 1}.${index + 1}`,
          question: `¿Qué información ficticia corresponde al caso ${topic + 1}.${index + 1} y permite describir de forma completa las necesidades, las opciones disponibles y los pasos necesarios para revisar la propuesta?`,
          helpText:
            "Contenido ficticio suficientemente amplio para comprobar el desplazamiento del panel. ".repeat(
              8,
            ),
          type: "SINGLE_CHOICE",
          required: false,
          priority: "P2",
          responsibleAreaId: area.id,
          order: index,
          options: Array.from({ length: 5 }, (_, option) => ({
            value: `choice-${option}`,
            label: `Opción ficticia ${option + 1}`,
            order: option,
          })),
          references: [],
        }),
      );
    }
  }
  await page.goto(`/projects/${project.id}/editor?mode=organize`);
  await page.evaluate(() => document.fonts.ready);
  return { project, questions };
}
async function animations(panel: Locator) {
  return panel.evaluate((element) =>
    element.getAnimations().map((animation) => {
      const effect = animation.effect as KeyframeEffect;
      return {
        duration: effect.getTiming().duration,
        frames: effect.getKeyframes().map((frame) => ({
          opacity: frame.opacity,
          transform: frame.transform,
        })),
      };
    }),
  );
}
async function finishAnimations(panel: Locator) {
  await panel.evaluate((element) =>
    Promise.all(
      element
        .getAnimations()
        .map((animation) => animation.finished.catch(() => undefined)),
    ),
  );
}
async function rows(page: Page) {
  return page.locator("[data-question-opener]").evaluateAll((elements) =>
    elements.map((element) => {
      const text = element.querySelector("span") ?? element;
      const range = document.createRange();
      range.selectNodeContents(text);
      const rect = element.getBoundingClientRect();
      return {
        id: (element as HTMLElement).dataset.questionOpener,
        width: rect.width,
        height: rect.height,
        lines: new Set(
          [...range.getClientRects()].map((line) => Math.round(line.top)),
        ).size,
      };
    }),
  );
}

for (const width of [1440, 1024, 900, 899, 390]) {
  test(`I4 superposición sin reacomodo, tiempos y acceso a ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: width < 900 ? 844 : 900 });
    const { questions } = await fixture(page);
    const before = await rows(page);
    if (width === 1440 || width === 390)
      await checkedPage(page, evidence, "i4-closed", width);
    const opener = page.getByRole("button", {
      name: questions[0]!.question,
      exact: true,
    });
    if (width < 900) await opener.tap();
    else await opener.click({ position: { x: 20, y: 15 } });
    const panel = page.locator(".qe-inspector-motion");
    await expect(panel).toHaveAttribute("data-phase", "open");
    const entry = await animations(panel);
    expect(entry.length).toBeGreaterThan(0);
    expect(
      entry.every(
        (animation) => animation.duration === (width < 900 ? 280 : 180),
      ),
    ).toBe(true);
    expect(
      entry.some((animation) =>
        animation.frames.some((frame) => frame.transform !== undefined),
      ),
    ).toBe(true);
    await finishAnimations(panel);
    const after = await rows(page);
    expect(after).toEqual(before);
    const box = (await panel.boundingBox())!;
    expect(Math.round(box.width)).toBe(width < 900 ? width : 456);
    if (width < 900) {
      expect(Math.round(box.height)).toBe(844);
      await expect(
        page.getByRole("dialog", { name: "Detalle de pregunta" }),
      ).toBeVisible();
    } else
      await expect(
        page.getByRole("complementary", { name: "Detalle de pregunta" }),
      ).toBeVisible();
    const node = await panel.elementHandle();
    await panel.getByRole("button", { name: "Pregunta siguiente" }).click();
    await expect(panel.getByRole("status")).toHaveText("2 de 4 resultados");
    expect(
      await node!.evaluate(
        (element) => element === document.querySelector(".qe-inspector-motion"),
      ),
    ).toBe(true);
    expect(await animations(panel)).toEqual([]);
    await panel.locator(".qe-inspector-body").evaluate((element) => {
      element.scrollTop = element.scrollHeight;
    });
    const primary = panel.locator(".qe-inspector-footer .primary");
    await expect(primary).toBeInViewport();
    const primaryBox = (await primary.boundingBox())!;
    expect(primaryBox.height).toBeGreaterThanOrEqual(44);
    await panel.getByText("Más acciones", { exact: true }).click();
    const menu = panel.getByRole(width < 900 ? "dialog" : "region", {
      name: "Más acciones",
    });
    const archive = menu.getByRole("button", { name: "Archivar", exact: true });
    await archive.scrollIntoViewIfNeeded();
    await expect(archive).toBeInViewport();
    if (width < 900) {
      const menuBox = (await menu.boundingBox())!;
      expect(Math.round(menuBox.y + menuBox.height)).toBe(844);
      await menu.getByRole("button", { name: "Cerrar acciones" }).click();
      await expect(menu).not.toBeVisible();
    } else {
      await panel.getByText("Más acciones", { exact: true }).click();
    }
    if (width === 1440 || width === 390)
      await checkedPage(page, evidence, "i4-open", width);
    await panel.getByRole("button", { name: "Cerrar detalle" }).click();
    await expect(panel).toHaveAttribute("data-phase", "closing");
    const exit = await animations(panel);
    expect(exit.some((animation) => animation.duration === 120)).toBe(true);
    await expect(panel).toHaveCount(0);
    await expect(opener).toBeFocused();
    await test.info().attach(`i4-measurements-${width}`, {
      body: JSON.stringify({ before, after, box, entry, exit }, null, 2),
      contentType: "application/json",
    });
  });
}

test("I4 cierre interrumpido conserva nodo y redirige la pregunta", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const { questions } = await fixture(page);
  await page
    .getByRole("button", { name: questions[0]!.question, exact: true })
    .click();
  const panel = page.locator(".qe-inspector-motion");
  await expect(panel).toHaveAttribute("data-phase", "open");
  await finishAnimations(panel);
  const node = await panel.elementHandle();
  await page.evaluate((id) => {
    document
      .querySelector<HTMLButtonElement>(".qe-inspector-head button")!
      .click();
    requestAnimationFrame(() =>
      document
        .querySelector<HTMLButtonElement>(`[data-question-opener="${id}"]`)!
        .click(),
    );
  }, questions[1]!.id);
  await expect(panel).toHaveAttribute("data-phase", "open");
  await expect(panel.getByRole("status")).toHaveText("2 de 4 resultados");
  expect(
    await node!.evaluate(
      (element) => element === document.querySelector(".qe-inspector-motion"),
    ),
  ).toBe(true);
  await finishAnimations(panel);
  await page.goBack();
  await expect(panel).toHaveCount(0);
  await expect(page).toHaveURL(/\/editor/);
});

for (const width of [1440, 390]) {
  test(`I4 movimiento reducido, teclado y acción inmediata a ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    const { questions } = await fixture(page);
    await page.emulateMedia({ reducedMotion: "reduce" });
    const opener = page.getByRole("button", {
      name: questions[0]!.question,
      exact: true,
    });
    await opener.click();
    const panel = page.locator(".qe-inspector-motion");
    await expect(panel).toHaveAttribute("data-phase", "open");
    const reduced = await animations(panel);
    expect(reduced.length).toBeGreaterThan(0);
    expect(
      reduced.every((animation) =>
        animation.frames.every((frame) => frame.transform === undefined),
      ),
    ).toBe(true);
    await finishAnimations(panel);
    const reducedNext = panel.getByRole("button", {
      name: "Pregunta siguiente",
    });
    const reducedNextBox = (await reducedNext.boundingBox())!;
    await page.mouse.move(
      reducedNextBox.x + reducedNextBox.width / 2,
      reducedNextBox.y + reducedNextBox.height / 2,
    );
    await page.mouse.down();
    expect(
      await reducedNext.evaluate((element) => ({
        pressed: element.matches(":active"),
        transform: getComputedStyle(element).transform,
      })),
    ).toEqual({ pressed: true, transform: "none" });
    expect(
      (await animations(reducedNext)).every((animation) =>
        animation.frames.every((frame) => frame.transform === undefined),
      ),
    ).toBe(true);
    await page.mouse.up();
    await page.keyboard.press("Escape");
    await expect(panel).toHaveCount(0);
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await opener.focus();
    await page.keyboard.down("Space");
    expect(
      await opener.evaluate((element) => ({
        pressed: element.matches(":active"),
        transform: getComputedStyle(element).transform,
        opacity: getComputedStyle(element).opacity,
        transition: getComputedStyle(element).transitionProperty,
        animations: element.getAnimations().length,
      })),
    ).toEqual({
      pressed: true,
      transform: "none",
      opacity: "1",
      transition: "none",
      animations: 0,
    });
    await page.keyboard.up("Space");
    await expect(panel).toHaveAttribute("data-phase", "open");
    expect(await animations(panel)).toEqual([]);
    const keyboardNext = panel.getByRole("button", {
      name: "Pregunta siguiente",
    });
    await keyboardNext.focus();
    await page.keyboard.down("Space");
    expect(
      await keyboardNext.evaluate((element) => ({
        pressed: element.matches(":active"),
        transform: getComputedStyle(element).transform,
        opacity: getComputedStyle(element).opacity,
        transition: getComputedStyle(element).transitionProperty,
        animations: element.getAnimations().length,
      })),
    ).toEqual({
      pressed: true,
      transform: "none",
      opacity: "1",
      transition: "none",
      animations: 0,
    });
    await page.keyboard.up("Space");
    await panel
      .getByRole("button", { name: "Editar pregunta", exact: true })
      .click();
    await expect(panel).toHaveCount(0);
    await expect(
      page.getByRole("group", {
        name: "Contenido de la pregunta",
        exact: true,
      }),
    ).toBeVisible();
  });
}
