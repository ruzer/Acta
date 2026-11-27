import { test, expect, type Locator, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import type { ProjectView, QuestionView } from "@requirements/contracts";
import { login } from "./login-helper";
import { command } from "./fixtures/workbench";
import { checkedPage, settleVisualState } from "./fixtures/page-checks";

const evidence =
  process.env.ACTA_DIRECTION_C_EVIDENCE_DIR ?? "test-results/design-evidence";
const topicReason =
  "Su nombre y descripción están protegidos porque el tema tiene preguntas publicadas o archivadas.";
const searchReason =
  "Con una búsqueda activa se muestran todos los grupos desplegados. Limpia la búsqueda para contraerlos.";
const areaReason =
  "Para crear preguntas hace falta al menos un área activa. Pide a la administración de la institución que la active en Administración.";

let projectId: string;
let draft: QuestionView;
let parent: QuestionView;
let child: QuestionView;
let archived: QuestionView;

type Area = { id: string; active: boolean };

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
});

test.beforeAll(async ({ browser }) => {
  const page = await browser.newPage();
  try {
    await login(page, "admin");
    const project = await command<ProjectView>(page, "/projects", {
      externalId: `UNAVAILABLE-${randomUUID()}`,
      name: "Proyecto ficticio de controles",
      description: "Comprobación de motivos de acciones no disponibles",
    });
    projectId = project.id;
    const area = (await command<Area[]>(page, "/areas")).find(
      (item) => item.active,
    )!;
    const section = await command<{ id: string }>(
      page,
      `/projects/${projectId}/sections`,
      {
        externalId: randomUUID(),
        title: "Contexto ficticio",
        description: "Tema con preguntas protegidas y borradores",
        order: 0,
      },
    );
    let order = 0;
    async function create(title: string, groupParentId: string | null = null) {
      return command<QuestionView>(page, `/projects/${projectId}/questions`, {
        externalId: `UNAVAILABLE-${order}`,
        sectionId: section.id,
        title,
        question: `¿Cómo se documenta ${title.toLowerCase()}?`,
        helpText: "Usa únicamente información ficticia.",
        type: "LONG_TEXT",
        required: false,
        priority: "P2",
        responsibleAreaId: area.id,
        order: order++,
        groupParentId,
        options: [],
        references: [],
      });
    }
    const published = await create("La consulta publicada");
    await command(
      page,
      `/projects/${projectId}/questions/${published.id}/publish`,
      {
        expectedVersion: published.lockVersion,
      },
    );
    draft = await create("El borrador simple");
    parent = await create("El grupo de prueba");
    child = await create("El seguimiento del grupo de prueba", parent.id);
    const toArchive = await create("La consulta archivada");
    archived = await command<QuestionView>(
      page,
      `/projects/${projectId}/questions/${toArchive.id}/archive`,
      { expectedVersion: toArchive.lockVersion },
    );
  } finally {
    await page.close();
  }
});

async function open(page: Page, mode: "Escribir" | "Organizar") {
  await login(page, "admin");
  await page.goto(`/projects/${projectId}/editor`);
  await page.getByRole("tab", { name: mode, exact: true }).click();
}

async function unavailable(button: Locator, reason: string) {
  await expect(button).toHaveAttribute("aria-disabled", "true");
  await expect(button).toHaveAccessibleDescription(reason);
  await expect(button).toHaveCSS("cursor", "default");
  await button.focus();
  await expect(button).toBeFocused();
  await button.press("Enter");
  await button.press("Space");
  await expect(button).toBeFocused();
}

test("editor: un tema protegido explica el bloqueo y la edición permite elegir el tema del borrador", async ({
  page,
}) => {
  await open(page, "Escribir");
  const menu = page.getByLabel("Acciones del tema Contexto ficticio", {
    exact: true,
  });
  await menu.click();
  const edit = page.getByRole("button", { name: "Editar tema", exact: true });
  await unavailable(edit, topicReason);
  await expect(page.getByText(topicReason, { exact: true })).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  for (const [width, height] of [
    [1440, 900],
    [390, 844],
  ]) {
    await page.setViewportSize({ width, height });
    await edit.scrollIntoViewIfNeeded();
    await checkedPage(page, evidence, "editor-topic-unavailable", width);
  }
  await menu.press("Escape");
  await page
    .getByRole("article", { name: draft.title, exact: true })
    .getByRole("button", { name: "Editar pregunta", exact: true })
    .click();
  const dialog = page.getByRole("dialog", {
    name: "Editar pregunta",
    exact: true,
  });
  await expect(dialog).toBeVisible();
  const topic = dialog.getByRole("combobox", { name: "Tema al que pertenece" });
  await expect(topic).toBeEnabled();
  await expect(topic).toHaveAccessibleDescription(
    "Al guardar, la pregunta pasa al final del tema que elijas, junto con tus cambios.",
  );
  await checkedPage(page, evidence, "editor-topic-draft", 390);
  await dialog.getByRole("button", { name: "Cancelar", exact: true }).click();
});

test("editor: la búsqueda explica por qué no se pueden plegar ni desplegar grupos", async ({
  page,
}) => {
  await open(page, "Organizar");
  await page.getByRole("searchbox").fill("grupo de prueba");
  const expand = page.getByRole("button", {
    name: "Expandir todos los grupos",
    exact: true,
  });
  const collapse = page.getByRole("button", {
    name: "Contraer todos los grupos",
    exact: true,
  });
  const rowToggle = page.getByRole("button", {
    name: `Contraer seguimientos de ${parent.title}`,
    exact: true,
  });
  for (const button of [expand, collapse, rowToggle])
    await unavailable(button, searchReason);
  await expect(rowToggle).toHaveAttribute("aria-expanded", "true");
  await expect(
    page.getByRole("button", { name: child.question, exact: true }),
  ).toBeVisible();
  await expect(page.getByText(searchReason, { exact: true })).toBeVisible();
  for (const [width, height] of [
    [1440, 900],
    [390, 844],
  ]) {
    await page.setViewportSize({ width, height });
    await collapse.scrollIntoViewIfNeeded();
    await checkedPage(page, evidence, "editor-search-unavailable", width);
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByRole("searchbox").fill("");
  await expect(collapse).not.toHaveAttribute("aria-disabled", "true");
  await collapse.click();
  await expect(
    page.getByRole("button", { name: child.question, exact: true }),
  ).toHaveCount(0);
  await expand.click();
  await expect(
    page.getByRole("button", { name: child.question, exact: true }),
  ).toBeVisible();
});

test("editor: crear preguntas sin áreas activas explica a quién pedir ayuda aunque ya haya preguntas", async ({
  page,
}) => {
  await open(page, "Organizar");
  const active = (await command<Area[]>(page, "/areas")).filter(
    (area) => area.active,
  );
  try {
    for (const area of active)
      await command(page, `/areas/${area.id}`, { active: false });
    await page.reload();
    await page.getByRole("tab", { name: "Organizar", exact: true }).click();
    const create = page.getByRole("button", {
      name: "Nueva pregunta",
      exact: true,
    });
    await unavailable(create, areaReason);
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByText(areaReason, { exact: true })).toBeVisible();
    await expect(
      page.getByRole("button", { name: draft.question, exact: true }),
    ).toBeVisible();
    for (const [width, height] of [
      [1440, 900],
      [390, 844],
    ]) {
      await page.setViewportSize({ width, height });
      await create.scrollIntoViewIfNeeded();
      await checkedPage(page, evidence, "editor-create-unavailable", width);
    }
    await page.getByRole("tab", { name: "Escribir", exact: true }).click();
    const add = page.getByRole("button", {
      name: "+ Agregar pregunta",
      exact: true,
    });
    await unavailable(add, areaReason);
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByText(areaReason, { exact: true })).toBeVisible();
    await checkedPage(page, evidence, "editor-add-unavailable", 390);
  } finally {
    for (const area of active)
      await command(page, `/areas/${area.id}`, { active: true });
  }
});

test("editor: una pregunta archivada muestra el motivo en lugar de una casilla inutilizable", async ({
  page,
}) => {
  await open(page, "Organizar");
  await page
    .getByLabel("Estado de publicación", { exact: true })
    .selectOption("ARCHIVED");
  await expect(
    page.getByRole("checkbox", {
      name: `Seleccionar pregunta: ${archived.question}`,
      exact: true,
    }),
  ).toHaveCount(0);
  await expect(
    page.getByText("No se puede seleccionar una pregunta archivada.", {
      exact: true,
    }),
  ).toBeVisible();
  await checkedPage(page, evidence, "editor-archived-selection", 1440);
});

// Exercise the shared selectors in Chromium's real cascade. The editor's fixed
// values are intentionally text, so temporarily disable these existing fields
// without sending any command or changing application state.
test("editor: el estilo compartido distingue campos y selectores no disponibles", async ({
  page,
}) => {
  await open(page, "Organizar");
  const fields = [
    page.getByRole("searchbox"),
    page.getByLabel("Estado de publicación", { exact: true }),
  ];
  for (const field of fields) {
    const colors = await field.evaluate((element) => {
      const control = element as HTMLInputElement | HTMLSelectElement;
      const disabled = control.disabled;
      const reference = document.createElement("span");
      reference.style.backgroundColor = "var(--ac-surface-2)";
      control.parentElement!.append(reference);
      try {
        control.disabled = true;
        const actual = getComputedStyle(control);
        return {
          background: actual.backgroundColor,
          expectedBackground: getComputedStyle(reference).backgroundColor,
          cursor: actual.cursor,
        };
      } finally {
        control.disabled = disabled;
        reference.remove();
      }
    });
    expect(colors.background).toBe(colors.expectedBackground);
    expect(colors.cursor).toBe("default");
  }
});

test("editor: los motivos del menú móvil quedan accesibles sobre la barra inferior", async ({
  page,
}) => {
  await open(page, "Escribir");
  const trigger = page.getByLabel("Acciones del tema Contexto ficticio", {
    exact: true,
  });
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    await trigger.click();
    const edit = page.getByRole("button", { name: "Editar tema", exact: true });
    await expect(edit).toBeVisible();
    const menu = page.locator(".qe-menu-items").filter({ has: edit });
    await settleVisualState(page);
    const bounds = await menu.boundingBox();
    const nav = await page.locator(".ac-shell-mobile").boundingBox();
    expect(bounds).not.toBeNull();
    expect(nav).not.toBeNull();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width);
    expect(bounds!.y).toBeGreaterThanOrEqual(0);
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(nav!.y);
    const lastReason = menu.getByText(
      "Este tema ya está al final del cuestionario.",
      { exact: true },
    );
    await lastReason.scrollIntoViewIfNeeded();
    await expect(lastReason).toBeVisible();
    expect(
      await lastReason.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        const hit = document.elementFromPoint(
          rect.x + rect.width / 2,
          rect.y + rect.height / 2,
        );
        return hit === element || element.contains(hit);
      }),
    ).toBe(true);
    await unavailable(edit, topicReason);
    await checkedPage(page, evidence, "editor-menu-contained", width);
    await trigger.press("Escape");
    await expect(menu).toHaveCount(0);
    await expect(trigger).toBeFocused();
  }
});
