import { test, expect, type Locator, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import type { ProjectView, QuestionView } from "@requirements/contracts";
import { login } from "./login-helper";
import { command } from "./fixtures/workbench";
import { checkedPage } from "./fixtures/page-checks";

const evidence =
  process.env.ACTA_DIRECTION_C_EVIDENCE_DIR ?? "test-results/design-evidence";
test.use({ hasTouch: true, reducedMotion: "no-preference" });
async function fixture(page: Page, firstQuestionText?: string) {
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
        externalId: `T-${topic + 1}`,
        title: `Tema ficticio ${topic + 1}`,
        description: "",
        order: topic,
      },
    );
    for (let index = 0; index < 2; index++) {
      questions.push(
        await command<QuestionView>(page, `/projects/${project.id}/questions`, {
          externalId: `P-${String(topic * 2 + index + 1).padStart(3, "0")}`,
          sectionId: section.id,
          title: `Pregunta ficticia ${topic + 1}.${index + 1}`,
          question:
            topic === 0 && index === 0 && firstQuestionText
              ? firstQuestionText
              : `¿Qué información ficticia corresponde al caso ${topic + 1}.${index + 1} y permite describir de forma completa las necesidades, las opciones disponibles y los pasos necesarios para revisar la propuesta?`,
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
  await expect(
    page.getByRole("heading", { name: "Cuestionario", level: 1 }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: questions[0]!.question, exact: true }),
  ).toBeVisible();
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
type MotionSnapshot = {
  target: "panel" | "control";
  phase: string | null;
  isConnected: boolean;
  property: string;
  animations: {
    duration: number | string;
    frames: { opacity: unknown; transform: unknown }[];
  }[];
};
type MotionWindow = Window & { actaInspectorTransitions: MotionSnapshot[] };
async function recordMotion(page: Page) {
  await page.evaluate(() => {
    const records: MotionSnapshot[] = [];
    (window as MotionWindow).actaInspectorTransitions = records;
    // Capture at transition creation, before an assertion or a busy CI worker
    // can outlive the 120/180 ms window. Keep plain snapshots after DOM removal.
    document.addEventListener(
      "transitionrun",
      (event) => {
        const element = event.target;
        if (!(element instanceof HTMLElement)) return;
        const panel = element.matches(".qe-inspector-motion");
        if (
          !panel &&
          !element.matches(".qe-inspector button, .qe-question-link")
        )
          return;
        records.push({
          target: panel ? "panel" : "control",
          phase:
            element.closest<HTMLElement>(".qe-inspector-motion")?.dataset
              .phase ?? null,
          isConnected: element.isConnected,
          property: event.propertyName,
          animations: element.getAnimations().map((animation) => {
            const effect = animation.effect as KeyframeEffect;
            const duration = effect.getTiming().duration;
            return {
              duration:
                typeof duration === "number" ? duration : String(duration),
              frames: effect.getKeyframes().map((frame) => ({
                opacity: frame.opacity,
                transform: frame.transform,
              })),
            };
          }),
        });
      },
      true,
    );
  });
}
async function motionRecords(page: Page) {
  return page.evaluate(() => (window as MotionWindow).actaInspectorTransitions);
}
async function clearMotionRecords(page: Page) {
  await page.evaluate(() => {
    (window as MotionWindow).actaInspectorTransitions.length = 0;
  });
}
async function renderingFrames(page: Page) {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
}
async function pressWithFeedback(page: Page, control: Locator) {
  const box = (await control.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  const before = (await motionRecords(page)).length;
  await page.mouse.down();
  await expect
    .poll(() =>
      control.evaluate((element) => Number(getComputedStyle(element).opacity)),
    )
    .toBeLessThan(1);
  expect(await control.evaluate((element) => element.matches(":active"))).toBe(
    true,
  );
  await renderingFrames(page);
  const press = (await motionRecords(page))
    .slice(before)
    .filter((record) => record.target === "control");
  expect([...new Set(press.map((record) => record.property))].sort()).toEqual([
    "opacity",
    "transform",
  ]);
  expect(press.every((record) => record.animations.length > 0)).toBe(true);
  expect(
    press
      .flatMap((record) => record.animations)
      .every((animation) => animation.duration === 100),
  ).toBe(true);
  await page.mouse.up();
}
async function touchTargets(container: Locator) {
  const tooSmall = await container
    .locator("button, summary, a, input, select, textarea")
    .evaluateAll((elements) =>
      elements
        .filter((element) => element.checkVisibility())
        .map((element) => ({
          name: element.getAttribute("aria-label") ?? element.textContent,
          width: element.getBoundingClientRect().width,
          height: element.getBoundingClientRect().height,
        }))
        .filter((rect) => rect.width < 44 || rect.height < 44),
    );
  expect(tooSmall).toEqual([]);
}
async function entryRecords(page: Page, properties: string[]) {
  await expect
    .poll(async () =>
      [
        ...new Set(
          (await motionRecords(page))
            .filter(
              (record) => record.target === "panel" && record.phase === "open",
            )
            .map((record) => record.property),
        ),
      ].sort(),
    )
    .toEqual(properties);
  await renderingFrames(page);
  const records = (await motionRecords(page)).filter(
    (record) => record.target === "panel" && record.phase === "open",
  );
  expect([...new Set(records.map((record) => record.property))].sort()).toEqual(
    properties,
  );
  expect(
    records.every(
      (record) => record.isConnected && record.animations.length > 0,
    ),
  ).toBe(true);
  return records;
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
    await recordMotion(page);
    if (width < 900) await opener.tap();
    else if (width === 1440) await pressWithFeedback(page, opener);
    else await opener.click({ position: { x: 20, y: 15 } });
    const panel = page.locator(".qe-inspector-motion");
    await expect(panel).toHaveAttribute("data-phase", "open");
    const entry = await entryRecords(page, ["opacity", "transform"]);
    const entryAnimations = entry.flatMap((record) => record.animations);
    expect(
      entryAnimations.every(
        (animation) => animation.duration === (width < 900 ? 280 : 180),
      ),
    ).toBe(true);
    expect(
      entryAnimations.some((animation) =>
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
    const beforeNavigation = (await motionRecords(page)).length;
    const next = panel.getByRole("button", { name: "Pregunta siguiente" });
    if (width === 1440) await pressWithFeedback(page, next);
    else await next.click();
    await expect(panel.getByRole("status")).toHaveText("2 de 4 resultados");
    expect(
      await node!.evaluate(
        (element) => element === document.querySelector(".qe-inspector-motion"),
      ),
    ).toBe(true);
    expect(await animations(panel)).toEqual([]);
    await renderingFrames(page);
    expect(
      (await motionRecords(page))
        .slice(beforeNavigation)
        .filter((record) => record.target === "panel"),
    ).toEqual([]);
    await panel.locator(".qe-inspector-body").evaluate((element) => {
      element.scrollTop = element.scrollHeight;
    });
    const primary = panel.locator(".qe-inspector-footer .primary");
    await expect(primary).toBeInViewport({ ratio: 1 });
    await touchTargets(panel);
    const primaryBox = (await primary.boundingBox())!;
    expect(primaryBox.height).toBeGreaterThanOrEqual(44);
    await panel.getByText("Más acciones", { exact: true }).click();
    const menu = panel.getByRole(width < 900 ? "dialog" : "region", {
      name: "Más acciones",
    });
    const archive = menu.getByRole("button", { name: "Archivar", exact: true });
    await archive.scrollIntoViewIfNeeded();
    await expect(archive).toBeInViewport({ ratio: 1 });
    await touchTargets(menu);
    if (width < 900) {
      const menuBox = (await menu.boundingBox())!;
      expect(Math.round(menuBox.y + menuBox.height)).toBe(844);
      const scrimBox = (await panel
        .locator(".qe-inspector-more-scrim")
        .boundingBox())!;
      expect(Math.round(scrimBox.height)).toBe(844);
      expect(Math.round(scrimBox.width)).toBe(width);
      const closeActions = menu.getByRole("button", {
        name: "Cerrar acciones",
      });
      await expect(closeActions).toBeFocused();
      await page.keyboard.press("Shift+Tab");
      await expect(archive).toBeFocused();
      await page.keyboard.press("Tab");
      await expect(closeActions).toBeFocused();
      await checkedPage(page, evidence, "i4-actions-open", width);
      await closeActions.click();
      await expect(menu).not.toBeVisible();
      await expect(
        panel.getByText("Más acciones", { exact: true }),
      ).toBeFocused();
    } else {
      await panel.getByText("Más acciones", { exact: true }).click();
    }
    if (width === 1440 || width === 390)
      await checkedPage(page, evidence, "i4-open", width);
    await panel.getByRole("button", { name: "Cerrar detalle" }).click();
    await expect(panel).toHaveCount(0);
    const exit = (await motionRecords(page)).filter(
      (record) => record.target === "panel" && record.phase === "closing",
    );
    expect(exit.length).toBeGreaterThan(0);
    expect(
      exit.every(
        (record) => record.isConnected && record.animations.length > 0,
      ),
    ).toBe(true);
    expect([...new Set(exit.map((record) => record.property))].sort()).toEqual([
      "opacity",
      "transform",
    ]);
    expect(
      exit
        .flatMap((record) => record.animations)
        .every((animation) => animation.duration === 120),
    ).toBe(true);
    await expect(opener).toBeFocused();
    await test.info().attach(`i4-measurements-${width}`, {
      body: JSON.stringify({ before, after, box, entry, exit }, null, 2),
      contentType: "application/json",
    });
  });
}

for (const [from, to] of [
  [390, 1440],
  [1440, 390],
] as const) {
  test(`I4 cerrar y redimensionar de ${from} a ${to}px libera modalidad y conserva el foco posterior`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: from, height: 844 });
    const { questions } = await fixture(page);
    await page
      .getByRole("button", { name: questions[0]!.question, exact: true })
      .click();
    const panel = page.locator(".qe-inspector-motion");
    await expect(panel).toHaveAttribute("data-phase", "open");
    await finishAnimations(panel);
    expect(await panel.evaluate((element) => element.matches(":modal"))).toBe(
      from < 900,
    );
    // Hold closing beyond the test timeout. Keep its painted state unchanged
    // so replacing dialog/aside cannot emit transitioncancel and end the hold.
    // The tests above measure the unmodified 120 ms exit separately.
    await page.evaluate(() => {
      const sheet = [...document.styleSheets].find(
        (item) => item.href && new URL(item.href).origin === location.origin,
      );
      if (!sheet) throw new Error("No se encontró la hoja de estilos del editor.");
      sheet.insertRule(
        `
        .qe-workspace .qe-inspector-motion[data-phase="closing"] {
          --qe-inspector-duration: 60s !important;
          opacity: 1 !important;
          transform: none !important;
        }
      `,
        sheet.cssRules.length,
      );
    });
    await panel.getByRole("button", { name: "Cerrar detalle" }).click();
    await expect(panel).toHaveAttribute("data-phase", "closing");
    await expect(panel).toHaveAttribute("inert", "");
    expect(await page.locator("dialog:modal").count()).toBe(0);
    expect(await page.locator(".qe-inspector-motion[open]").count()).toBe(0);

    const destination = page.getByRole("tab", { name: "Escribir", exact: true });
    await destination.focus();
    expect(
      await destination.evaluate((element) => document.activeElement === element),
    ).toBe(true);
    await page.setViewportSize({ width: to, height: 844 });
    await expect(panel).toHaveJSProperty(
      "tagName",
      to < 900 ? "DIALOG" : "ASIDE",
    );
    await renderingFrames(page);
    await expect(panel).toHaveAttribute("data-phase", "closing");
    expect(await page.locator("dialog:modal").count()).toBe(0);
    expect(await page.locator(".qe-inspector-motion[open]").count()).toBe(0);
    expect(
      await destination.evaluate((element) => document.activeElement === element),
    ).toBe(true);

    await page.keyboard.press("End");
    const review = page.getByRole("tab", {
      name: "Revisar publicación",
      exact: true,
    });
    await expect(review).toHaveAttribute("aria-selected", "true");
    await renderingFrames(page);
    await expect(review).toBeFocused();
    expect(await page.locator("dialog:modal").count()).toBe(0);
  });
}

test("I4 los abridores cortos conservan objetivos táctiles de 44px en ambos modos", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const { questions } = await fixture(page, "¿Qué falta?");
  for (const mode of ["Escribir", "Organizar"] as const) {
    await page.getByRole("tab", { name: mode, exact: true }).click();
    const opener = page.getByRole("button", {
      name: questions[0]!.question,
      exact: true,
    });
    await expect(opener).toBeVisible();
    const target = await opener.evaluate((element) => {
      const range = document.createRange();
      range.selectNodeContents(
        element.querySelector("span:not([aria-hidden])")!,
      );
      const rect = element.getBoundingClientRect();
      return {
        width: rect.width,
        height: rect.height,
        lines: new Set(
          [...range.getClientRects()].map((line) => Math.round(line.top)),
        ).size,
      };
    });
    expect(target.lines, `texto de una línea en ${mode}`).toBe(1);
    expect(target.width, `ancho táctil en ${mode}`).toBeGreaterThanOrEqual(44);
    expect(target.height, `alto táctil en ${mode}`).toBeGreaterThanOrEqual(44);
  }
});

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
    Array.from(
      document.querySelectorAll<HTMLButtonElement>(".qe-inspector-head button"),
    )
      .find((button) => button.textContent?.trim() === "Cerrar detalle")!
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
    await recordMotion(page);
    await opener.click();
    const panel = page.locator(".qe-inspector-motion");
    await expect(panel).toHaveAttribute("data-phase", "open");
    const reduced = await entryRecords(page, ["opacity"]);
    const reducedAnimations = reduced.flatMap((record) => record.animations);
    expect(
      reducedAnimations.every(
        (animation) => animation.duration === (width < 900 ? 280 : 180),
      ),
    ).toBe(true);
    expect(
      reducedAnimations.every((animation) =>
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
    const beforePress = (await motionRecords(page)).length;
    await page.mouse.down();
    await renderingFrames(page);
    expect(
      await reducedNext.evaluate((element) => ({
        pressed: element.matches(":active"),
        transform: getComputedStyle(element).transform,
      })),
    ).toEqual({ pressed: true, transform: "none" });
    const reducedPress = (await motionRecords(page))
      .slice(beforePress)
      .filter((record) => record.target === "control");
    expect(reducedPress.length).toBeGreaterThan(0);
    expect(
      reducedPress.every(
        (record) =>
          record.property === "opacity" && record.animations.length > 0,
      ),
    ).toBe(true);
    expect(
      reducedPress
        .flatMap((record) => record.animations)
        .every((animation) =>
          animation.frames.every((frame) => frame.transform === undefined),
        ),
    ).toBe(true);
    expect(
      reducedPress
        .flatMap((record) => record.animations)
        .every((animation) => animation.duration === 100),
    ).toBe(true);
    await page.mouse.up();
    await page.keyboard.press("Escape");
    await expect(panel).toHaveCount(0);
    for (const reducedMotion of ["reduce", "no-preference"] as const) {
      await page.emulateMedia({ reducedMotion });
      await clearMotionRecords(page);
      await opener.focus();
      await page.keyboard.down("Space");
      await renderingFrames(page);
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
      await renderingFrames(page);
      expect(await motionRecords(page)).toEqual([]);
      const keyboardNext = panel.getByRole("button", {
        name: "Pregunta siguiente",
      });
      await keyboardNext.focus();
      await page.keyboard.down("Space");
      await renderingFrames(page);
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
      await renderingFrames(page);
      expect(await motionRecords(page)).toEqual([]);
      if (reducedMotion === "reduce") {
        await page.keyboard.press("Escape");
        await expect(panel).toHaveCount(0);
      }
    }
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

test("I4 el pie permanece dentro del espacio visible al simular teclado móvil", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const { questions } = await fixture(page);
  await page
    .getByRole("button", { name: questions[0]!.question, exact: true })
    .tap();
  const panel = page.getByRole("dialog", {
    name: "Detalle de pregunta",
    exact: true,
  });
  await expect(panel).toHaveAttribute("data-phase", "open");
  await finishAnimations(panel);
  await page.evaluate(() => {
    const viewport = window.visualViewport!;
    Object.defineProperties(viewport, {
      height: { configurable: true, get: () => 480 },
      offsetTop: { configurable: true, get: () => 24 },
    });
    viewport.dispatchEvent(new Event("resize"));
  });
  await expect
    .poll(() =>
      panel.evaluate((element) => ({
        top: element.getBoundingClientRect().top,
        height: element.getBoundingClientRect().height,
      })),
    )
    .toEqual({ top: 24, height: 480 });
  const primary = panel.locator(".qe-inspector-footer .primary");
  const box = (await primary.boundingBox())!;
  expect(box.y).toBeGreaterThanOrEqual(24);
  expect(box.y + box.height).toBeLessThanOrEqual(504);
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(390);
  await touchTargets(panel);
  await page.evaluate(() => {
    const viewport = window.visualViewport!;
    Reflect.deleteProperty(viewport, "height");
    Reflect.deleteProperty(viewport, "offsetTop");
    viewport.dispatchEvent(new Event("resize"));
  });
  await expect
    .poll(() =>
      panel.evaluate((element) => element.getBoundingClientRect().height),
    )
    .toBe(844);
});
