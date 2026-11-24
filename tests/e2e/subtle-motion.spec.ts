import { test, expect } from "@playwright/test";
import { login } from "./login-helper";
import {
  motionProject,
  observeMotion,
  motion,
  settleMotion,
  noOverflow,
} from "./fixtures/subtle-motion";

for (const preference of ["reduce", "keyboard"] as const) {
  test(`G1-a: ${preference} cambia el valor sin animación`, async ({
    page,
    browser,
  }) => {
    const { project, questions } = await motionProject(browser);
    await observeMotion(page);
    if (preference === "reduce")
      await page.emulateMedia({ reducedMotion: "reduce" });
    await login(page, "stakeholder");
    await page.goto(`/projects/${project.id}/work`);
    await expect(page.locator(".ac-progress-bar")).toBeVisible();
    await page.getByRole("link", { name: "Continuar", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: questions[1]!.question, exact: true }),
    ).toBeVisible();
    await page
      .getByLabel("Tu respuesta", { exact: true })
      .fill("Envío ficticio");
    const send = page.getByRole("button", {
      name: "Enviar respuesta",
      exact: true,
    });
    if (preference === "keyboard") {
      await send.focus();
      await page.keyboard.press("Enter");
    } else await send.click();
    await expect(
      page.getByRole("heading", { name: questions[2]!.question, exact: true }),
    ).toBeVisible();
    await settleMotion(page);
    expect(await motion(page, "participant-position-fill")).toEqual([]);
    const work = page.getByRole("link", { name: "Mi trabajo", exact: true });
    if (preference === "keyboard") {
      await work.focus();
      await page.keyboard.press("Enter");
    } else await work.click();
    await expect(
      page.getByRole("img", { name: "2 de 4 preguntas enviadas" }),
    ).toBeVisible();
    await settleMotion(page);
    expect(await motion(page, "ac-progress-")).toEqual([]);
  });
}

test("G1-a: volver a una posición anterior retrocede sin cambiar el tamaño de la barra", async ({
  page,
  browser,
}) => {
  const { project, questions } = await motionProject(browser);
  await observeMotion(page);
  await login(page, "stakeholder");
  for (const index of [2, 3, 2]) {
    await page.goto(`/projects/${project.id}/respond/${questions[index]!.id}`);
    await expect(
      page.getByRole("heading", {
        name: questions[index]!.question,
        exact: true,
      }),
    ).toBeVisible();
    await settleMotion(page);
  }
  const records = await motion(page, "participant-position-fill");
  expect(records).toHaveLength(1);
  expect(records[0]!.duration).toBe(280);
  expect(records[0]!.frames[0]!.transform).toBe("scaleX(0.75)");
  expect(records[0]!.frames.at(-1)!.transform).toBe("scaleX(0.5)");
  expect(
    await page
      .locator(".participant-progress")
      .evaluate((el) => el.getBoundingClientRect().height),
  ).toBe(4);
});

test.use({ actionTimeout: 15000 });
for (const preference of ["normal", "reduce", "keyboard"] as const) {
  test(`G1-e: diálogo ${preference}, conserva foco, Escape, cierre y salida inmediata`, async ({
    page,
    browser,
  }) => {
    const { project, questions } = await motionProject(browser);
    await observeMotion(page);
    if (preference === "reduce")
      await page.emulateMedia({ reducedMotion: "reduce" });
    await login(page, "stakeholder");
    await page.goto(`/projects/${project.id}/respond/${questions[2]!.id}`);
    await page
      .getByLabel("Tu respuesta", { exact: true })
      .fill("Borrador para comprobar el diálogo");
    const link = page.getByRole("link", { name: "Mi trabajo", exact: true });
    if (preference === "keyboard") {
      await link.focus();
      await page.keyboard.press("Enter");
    } else await link.click();
    const dialog = page.getByRole("dialog", {
      name: "Tienes cambios sin guardar",
    });
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByRole("button", { name: "Guardar y salir", exact: true }),
    ).toBeFocused();
    await settleMotion(page);
    const records = await motion(page, "DIALOG");
    if (preference === "normal") {
      expect(records.length).toBeGreaterThanOrEqual(2);
      expect(records.every((r) => r.duration === 160)).toBe(true);
      expect(records.some((r) => r.frames.some((f) => f.opacity === "0"))).toBe(
        true,
      );
      expect(
        records.some((r) =>
          r.frames.some((f) => String(f.transform).includes("0.97")),
        ),
      ).toBe(true);
    } else expect(records).toEqual([]);
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(link).toBeFocused();
    expect(
      await page.evaluate(
        () =>
          document
            .getAnimations()
            .filter(
              (a) => (a.effect as KeyframeEffect).target?.tagName === "DIALOG",
            ).length,
      ),
    ).toBe(0);
    await link.click();
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Cerrar", exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expect(link).toBeFocused();
  });
}
for (const reduced of [false, true]) {
  test(`G1-d: presionar conserva objetivo y foco; reduced=${reduced}`, async ({
    page,
  }) => {
    if (reduced) await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    const button = page.getByRole("button", {
      name: "Iniciar sesión",
      exact: true,
    });
    await expect(button).toBeVisible();
    await settleMotion(page);
    await button.hover();
    const before = await button.boundingBox();
    expect(before!.height).toBeGreaterThanOrEqual(44);
    await button.hover();
    await page.mouse.down();
    await expect
      .poll(() => button.evaluate((el) => getComputedStyle(el).transform))
      .toBe(reduced ? "none" : "matrix(0.98, 0, 0, 0.98, 0, 0)");
    expect(
      await button.evaluate((el) => el.offsetHeight),
    ).toBeGreaterThanOrEqual(44);
    // The 44px target remains hit-testable even while the visual surface shrinks.
    expect(
      await button.evaluate(
        (el, box) =>
          [0.5, box.height - 0.5].every((y) => {
            const target = document.elementFromPoint(
              box.x + box.width / 2,
              box.y + y,
            );
            return target === el || (target && el.contains(target));
          }),
        before!,
      ),
    ).toBe(true);
    await page.mouse.move(1, 1);
    await page.mouse.up();
    await settleMotion(page);
    expect(await button.boundingBox()).toEqual(before);
    for (const state of ["disabled", "aria-disabled"]) {
      await button.evaluate((el, state) => {
        el.setAttribute(state, state === "disabled" ? "" : "true");
      }, state);
      await button.hover();
      await page.mouse.down();
      expect(
        await button.evaluate((el) => getComputedStyle(el).transform),
      ).toBe("none");
      await page.mouse.move(1, 1);
      await page.mouse.up();
      await button.evaluate((el, state) => el.removeAttribute(state), state);
    }
    await page.getByLabel("Usuario", { exact: true }).focus();
    await page.keyboard.press("Tab");
    expect(
      await page
        .locator(":focus")
        .evaluate(
          (el) =>
            getComputedStyle(el).boxShadow !== "none" ||
            getComputedStyle(el).outlineStyle !== "none",
        ),
    ).toBe(true);
  });
}
for (const preference of ["normal", "reduce", "keyboard"] as const) {
  test(`G1-c: cierre ${preference}, solo celebra al terminar`, async ({
    page,
    browser,
  }) => {
    const { project, questions } = await motionProject(browser);
    await observeMotion(page);
    if (preference === "reduce")
      await page.emulateMedia({ reducedMotion: "reduce" });
    await login(page, "stakeholder");
    await page.goto(`/projects/${project.id}/receipt`);
    await expect(
      page.getByRole("heading", { name: "Listo por ahora", exact: true }),
    ).toBeVisible();
    await settleMotion(page);
    expect(await motion(page, "participant-success")).toEqual([]);
    await page.goto(`/projects/${project.id}/respond/${questions[1]!.id}`);
    for (const index of [1, 2, 3]) {
      await expect(
        page.getByRole("heading", {
          name: questions[index]!.question,
          exact: true,
        }),
      ).toBeVisible();
      await page
        .getByLabel("Tu respuesta", { exact: true })
        .fill("Respuesta ficticia para terminar");
      const send = page.getByRole("button", {
        name: "Enviar respuesta",
        exact: true,
      });
      if (preference === "keyboard") {
        await send.focus();
        await page.keyboard.press("Enter");
      } else await send.click();
    }
    await expect(
      page.getByRole("heading", {
        name: "Terminaste tus preguntas",
        exact: true,
      }),
    ).toBeVisible();
    await settleMotion(page);
    const circles = await motion(page, "participant-success-icon");
    const checks = await motion(page, "participant-success-check");
    expect(circles).toHaveLength(preference === "normal" ? 1 : 0);
    expect(checks).toHaveLength(preference === "normal" ? 1 : 0);
    if (preference === "normal") {
      expect(circles[0]!.duration).toBe(240);
      expect(checks[0]!.duration).toBe(320);
      expect(checks[0]!.delay).toBe(120);
      expect(
        await page
          .locator(".participant-success-check")
          .getAttribute("pathLength"),
      ).toBe("1");
    }
    expect(
      await page
        .locator(".receipt-card")
        .evaluate((el) => el.getAnimations({ subtree: true }).length),
    ).toBe(0);
    await page.setViewportSize({ width: 390, height: 844 });
    await settleMotion(page);
    await noOverflow(page);
    expect(await motion(page, "participant-success-icon")).toHaveLength(
      circles.length,
    );
  });
}
for (const preference of ["normal", "reduce", "keyboard"] as const) {
  test(`G1-b: aviso de envío ${preference}, conserva su anuncio y solo entra una vez`, async ({
    page,
    browser,
  }) => {
    const { project, questions } = await motionProject(browser);
    await observeMotion(page);
    if (preference === "reduce")
      await page.emulateMedia({ reducedMotion: "reduce" });
    await login(page, "stakeholder");
    await page.goto(`/projects/${project.id}/respond/${questions[1]!.id}`);
    const send = page.getByRole("button", {
      name: "Enviar respuesta",
      exact: true,
    });
    await expect(send).toBeVisible();
    if (preference === "keyboard") {
      await send.focus();
      await page.keyboard.press("Enter");
    } else await send.click();
    await expect(
      page.getByRole("heading", { name: questions[2]!.question, exact: true }),
    ).toBeVisible();
    await expect(
      page.locator('.participant-feedback[role="status"]'),
    ).toContainText("Respuesta enviada");
    await settleMotion(page);
    const records = await motion(page, "participant-feedback");
    expect(records).toHaveLength(preference === "normal" ? 1 : 0);
    if (preference === "normal") {
      expect(records[0]!.duration).toBe(160);
      expect(records[0]!.frames[0]!.opacity).toBe("0");
      expect(String(records[0]!.frames[0]!.transform)).toMatch(/-4/);
      expect(records[0]!.frames.at(-1)!.opacity).toBe("1");
    }
    await page
      .getByLabel("Tu respuesta", { exact: true })
      .fill("El aviso permanece mientras escribo.");
    expect(await motion(page, "participant-feedback")).toHaveLength(
      records.length,
    );
  });
}
test("G1-a: primera visita quieta; enviar y regresar anima solo los valores cambiados", async ({
  page,
  browser,
}) => {
  test.setTimeout(90000);
  const { project, questions } = await motionProject(browser);
  await observeMotion(page);
  await login(page, "stakeholder");
  await page.goto(`/projects/${project.id}/work`);
  await expect(
    page.getByRole("img", { name: "1 de 4 preguntas enviadas; 1 en borrador" }),
  ).toBeVisible();
  await settleMotion(page);
  expect(await motion(page, "ac-progress-")).toEqual([]);
  for (const [width, height] of [
    [1440, 900],
    [390, 844],
    [320, 844],
  ]) {
    await page.setViewportSize({ width: width!, height: height! });
    await noOverflow(page);
    expect(
      await page
        .locator(".ac-progress-bar")
        .evaluate((el) => el.getBoundingClientRect().height),
    ).toBe(8);
  }
  await page.getByRole("link", { name: "Continuar", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: questions[1]!.question, exact: true }),
  ).toBeVisible();
  await settleMotion(page);
  expect(await motion(page, "participant-position-fill")).toEqual([]);
  await page
    .getByLabel("Tu respuesta", { exact: true })
    .fill("Respuesta ficticia enviada");
  await page
    .getByRole("button", { name: "Enviar respuesta", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: questions[2]!.question, exact: true }),
  ).toBeVisible();
  await expect
    .poll(async () => (await motion(page, "participant-position-fill")).length)
    .toBe(1);
  const changed = (await motion(page, "participant-position-fill"))[0]!;
  expect(changed.duration).toBe(280);
  expect(changed.frames[0]!.transform).toBe("scaleX(0.25)");
  expect(changed.frames.at(-1)!.transform).toBe("scaleX(0.5)");
  await page.getByRole("link", { name: "Mi trabajo", exact: true }).click();
  await expect(
    page.getByRole("img", { name: "2 de 4 preguntas enviadas" }),
  ).toBeVisible();
  await expect
    .poll(async () => (await motion(page, "ac-progress-sent")).length)
    .toBe(1);
  expect((await motion(page, "ac-progress-sent"))[0]!.duration).toBe(280);
  await settleMotion(page);
  // Reloading the same value uses the stored visit without replaying it.
  await page.reload();
  await expect(page.locator(".ac-progress-bar")).toBeVisible();
  await settleMotion(page);
  expect(await motion(page, "ac-progress-")).toEqual([]);
});
