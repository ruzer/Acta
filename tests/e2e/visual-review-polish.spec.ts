import { expect, type Page } from "@playwright/test";
import { test } from "@playwright/test";
import { login } from "./login-helper";

test.use({ actionTimeout: 15000 });

const mobile = { width: 390, height: 844 };
const desktop = { width: 1440, height: 900 };

async function openDemoQuestionnaire(page: Page) {
  await page.goto("/");
  await page
    .locator(".project-list li", { hasText: "Proyecto demostración" })
    .getByRole("link", { name: "Editar cuestionario" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Cuestionario", exact: true }),
  ).toBeVisible();
}

test("Escribir: el aviso sobre Organizar preguntas es un enlace dentro de la frase", async ({
  page,
}) => {
  await login(page, "admin");
  for (const viewport of [desktop, mobile]) {
    await page.setViewportSize(viewport);
    await openDemoQuestionnaire(page);
    await page.getByRole("tab", { name: "Escribir" }).click();
    const action = page.getByRole("button", { name: "Organizar preguntas" });
    await expect(action).toBeVisible();
    const style = await action.evaluate((node) => {
      const css = getComputedStyle(node);
      return {
        border: css.borderTopWidth,
        display: css.display,
        height: node.getBoundingClientRect().height,
        underline: css.textDecorationLine,
      };
    });
    expect(style.border).toBe("0px");
    // A <button> computes "inline" as "inline-block": it still flows with the text.
    expect(style.display).toMatch(/^inline/);
    expect(style.underline).toContain("underline");
    expect(style.height, "no debe romper el renglón").toBeLessThan(32);
  }
});

test("Escribir: en cada tema la cuenta va antes del menú, también en móvil", async ({
  page,
}) => {
  await login(page, "admin");
  for (const viewport of [desktop, mobile]) {
    await page.setViewportSize(viewport);
    await openDemoQuestionnaire(page);
    await page.getByRole("tab", { name: "Escribir" }).click();
    const header = page.locator(".qe-topic > header").first();
    await expect(header).toBeVisible();
    const count = await header.locator(".hint").boundingBox();
    const menu = await header.locator(".qe-menu").boundingBox();
    expect(count && menu).toBeTruthy();
    expect(
      count!.x + count!.width,
      `cuenta antes del menú a ${viewport.width}px`,
    ).toBeLessThanOrEqual(menu!.x + 1);
  }
});

test("Organizar: el filtro de temas usa el mismo borde que los demás controles", async ({
  page,
}) => {
  await login(page, "admin");
  await page.setViewportSize(desktop);
  await openDemoQuestionnaire(page);
  await page.getByRole("tab", { name: "Organizar" }).click();
  const borders = await page.evaluate(() => {
    const color = (node: Element | null) =>
      node ? getComputedStyle(node).borderTopColor : "(falta)";
    return {
      topics: color(
        document.querySelector(".qe-outline > details > summary > strong"),
      ),
      search: color(document.querySelector("input[placeholder^='Buscar']")),
      select: color(document.querySelector(".qe-filters select")),
    };
  });
  expect(borders.topics).toBe(borders.search);
  expect(borders.topics).toBe(borders.select);
});

test("Administración → Áreas: en móvil «Renombrar» se alinea con las etiquetas de la tarjeta", async ({
  page,
}) => {
  await login(page, "admin");
  await page.setViewportSize(mobile);
  await page.goto("/admin");
  await page.getByRole("button", { name: "Áreas", exact: true }).click();
  const geometry = await page.evaluate(() => {
    const cell = document.querySelector("td[data-label='Código']");
    const button = [...document.querySelectorAll("button")].find((b) =>
      b.getAttribute("aria-label")?.startsWith("Renombrar "),
    );
    if (!cell || !button) return null;
    const padding = parseFloat(getComputedStyle(button).paddingLeft);
    return {
      label: cell.getBoundingClientRect().left,
      text: button.getBoundingClientRect().left + padding,
    };
  });
  expect(geometry).not.toBeNull();
  expect(Math.abs(geometry!.text - geometry!.label)).toBeLessThanOrEqual(1);
});

test("Mis proyectos: la nota para administración no toca la primera tarjeta", async ({
  page,
}) => {
  await login(page, "admin");
  for (const viewport of [desktop, mobile]) {
    await page.setViewportSize(viewport);
    await page.goto("/");
    const note = await page
      .locator("main p.hint", { hasText: "Aquí aparecen los proyectos" })
      .boundingBox();
    const card = await page.locator(".project-list li").first().boundingBox();
    expect(note && card).toBeTruthy();
    expect(
      card!.y - (note!.y + note!.height),
      `separación a ${viewport.width}px`,
    ).toBeGreaterThanOrEqual(16);
  }
});
