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
