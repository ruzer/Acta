import { test, expect, type Locator, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import type {
  ProjectView,
  QuestionView,
  QuestionnaireView,
} from "@requirements/contracts";
import { login } from "./login-helper";
import { command } from "./fixtures/workbench";
import { checkedPage } from "./fixtures/page-checks";
const evidence =
  process.env.ACTA_DIRECTION_C_EVIDENCE_DIR ?? "test-results/design-evidence";
async function fixture(page: Page) {
  await login(page, "admin");
  const project = await command<ProjectView>(page, "/projects", {
    externalId: randomUUID(),
    name: "Cambio de tema ficticio",
    description: "Solo datos de prueba",
  });
  const area = (
    await command<{ id: string; active: boolean }[]>(page, "/areas")
  ).find((a) => a.active)!;
  const sections = [];
  for (const [order, title] of [
    "Origen ficticio",
    "Destino ficticio",
  ].entries())
    sections.push(
      await command<{ id: string; title: string }>(
        page,
        `/projects/${project.id}/sections`,
        { externalId: randomUUID(), title, description: "", order },
      ),
    );
  async function create(
    title: string,
    order: number,
    sectionId = sections[0]!.id,
    groupParentId: string | null = null,
  ) {
    return command<QuestionView>(page, `/projects/${project.id}/questions`, {
      externalId: randomUUID(),
      sectionId,
      title,
      question: `¿Cómo se documenta ${title.toLowerCase()}?`,
      helpText: "Datos ficticios",
      type: "LONG_TEXT",
      required: false,
      priority: "P2",
      responsibleAreaId: area.id,
      order,
      groupParentId,
      options: [],
      references: [],
    });
  }
  const root = await create("Pregunta principal", 0);
  const child = await create(
    "Seguimiento de prueba",
    1,
    sections[0]!.id,
    root.id,
  );
  const existing = await create("Pregunta de destino", 0, sections[1]!.id);
  return { project, sections, root, child, existing, create };
}
async function menu(page: Page, title: string) {
  await page
    .getByRole("article", { name: title, exact: true })
    .locator("[data-question-opener]")
    .click();
}
async function observeNextHighlight(row: Locator) {
  return row.evaluateHandle((element) => {
    const backgrounds = new Set<string>();
    const animationNames = new Set<string>();
    const animationDurations = new Set<string>();
    let started: number | undefined;
    let frames = 0;
    let animatedFrames = 0;
    let frame = 0;
    const done = new Promise<{
      elapsed: number;
      frames: number;
      animatedFrames: number;
      backgrounds: string[];
      animationNames: string[];
      animationDurations: string[];
    }>((resolve) => {
      const sample = () => {
        if (!element.classList.contains("qe-topic-moved")) return;
        const style = getComputedStyle(element);
        backgrounds.add(style.backgroundColor);
        animationNames.add(style.animationName);
        animationDurations.add(style.animationDuration);
        frames++;
        if (element.getAnimations().length) animatedFrames++;
        frame = requestAnimationFrame(sample);
      };
      const observer = new MutationObserver(() => {
        if (element.classList.contains("qe-topic-moved")) {
          if (started === undefined) {
            started = performance.now();
            sample();
          }
        } else if (started !== undefined) {
          observer.disconnect();
          cancelAnimationFrame(frame);
          resolve({
            elapsed: performance.now() - started,
            frames,
            animatedFrames,
            backgrounds: [...backgrounds],
            animationNames: [...animationNames],
            animationDurations: [...animationDurations],
          });
        }
      });
      observer.observe(element, {
        attributes: true,
        attributeFilter: ["class"],
      });
    });
    return { done };
  });
}
for (const width of [1440, 390])
  test(`editar mueve el grupo y su contenido, Ver revela la fila y la vista previa conserva el cambio (${width})`, async ({
    page,
  }) => {
    const { project, sections, root, child, existing } = await fixture(page);
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
    if (width === 390) await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(`/projects/${project.id}/editor?mode=write`);
    await menu(page, child.title);
    await page
      .locator(".qe-inspector")
      .getByRole("button", { name: "Editar pregunta", exact: true })
      .click();
    const dialog = page.getByRole("dialog", {
      name: "Editar pregunta",
      exact: true,
    });
    const topic = dialog.getByLabel("Tema al que pertenece");
    expect((await topic.boundingBox())!.y).toBeLessThan(
      (await dialog.getByLabel("Pregunta", { exact: true }).boundingBox())!.y,
    );
    await expect(
      dialog.getByText(/Se moverá con su pregunta principal/),
    ).toBeVisible();
    await topic.selectOption(sections[1]!.id);
    await dialog
      .getByLabel("Pregunta", { exact: true })
      .fill("¿Qué revisión adicional se necesita?");
    await checkedPage(page, evidence, "editor-topic-edit", width);
    await dialog
      .getByRole("button", { name: "Guardar cambios", exact: true })
      .click();
    const notice = page
      .getByRole("status")
      .filter({ hasText: "Se movió a «Destino ficticio»" });
    await expect(notice).toBeVisible();
    await notice.getByRole("button", { name: "Ver", exact: true }).click();
    const row = page.locator(`article[data-question-id="${child.id}"]`);
    await expect(row).toBeFocused();
    await expect(row).toHaveClass(/qe-topic-moved/);
    await expect(row).toHaveCSS(
      "animation-name",
      width === 390 ? "none" : "qe-topic-moved",
    );
    await expect(row).toContainText("¿Qué revisión adicional se necesita?");
    // Observe a fresh highlight from Ver, after the save highlight has ended.
    // Browser frames and class mutations measure its full lifetime without sleeps.
    await expect(row).not.toHaveClass(/qe-topic-moved/);
    const observation = await observeNextHighlight(row);
    await notice.getByRole("button", { name: "Ver", exact: true }).click();
    const highlight = await observation.evaluate(async ({ done }) => done);
    await observation.dispose();
    expect(highlight.elapsed).toBeGreaterThanOrEqual(1000);
    expect(highlight.elapsed).toBeLessThan(2000);
    expect(highlight.frames).toBeGreaterThan(1);
    if (width === 390) {
      expect(highlight.animationNames).toEqual(["none"]);
      expect(highlight.animatedFrames).toBe(0);
      expect(highlight.backgrounds).toHaveLength(1);
      expect(highlight.backgrounds[0]).not.toBe("rgba(0, 0, 0, 0)");
    } else {
      expect(highlight.animationNames).toEqual(["qe-topic-moved"]);
      expect(highlight.animationDurations).toEqual(["1.2s"]);
      expect(highlight.animatedFrames).toBeGreaterThan(0);
      expect(highlight.backgrounds.length).toBeGreaterThan(1);
    }
    const snapshot = await command<QuestionnaireView>(
      page,
      `/projects/${project.id}/questionnaire`,
    );
    expect(
      snapshot.questions
        .filter((q) => q.sectionId === sections[1]!.id)
        .sort((a, b) => a.order - b.order)
        .map((q) => q.id),
    ).toEqual([existing.id, root.id, child.id]);
    await page
      .getByRole("button", { name: "Vista previa", exact: true })
      .click();
    await page.getByLabel("Pregunta de la vista previa").selectOption(child.id);
    await expect(
      page.getByRole("region", { name: "Vista previa" }),
    ).toContainText("¿Qué revisión adicional se necesita?");
  });
test("Ver desde Organizar conserva filtros, grupos plegados y selección al regresar", async ({
  page,
}) => {
  const { project, sections, root, create } = await fixture(page);
  const retained = await create("Grupo que permanece", 2);
  const retainedChild = await create(
    "Seguimiento que permanece",
    3,
    sections[0]!.id,
    retained.id,
  );
  await page.setViewportSize({ width: 1440, height: 900 });
  const filters = new URLSearchParams({
    mode: "organize",
    topic: sections[0]!.id,
    publication: "DRAFT",
    area: root.responsibleAreaId,
  });
  await page.goto(`/projects/${project.id}/editor?${filters}`);
  await page
    .getByRole("button", {
      name: `Contraer seguimientos de ${retained.title}`,
      exact: true,
    })
    .click();
  await expect(
    page.locator(`button[data-question-id="${retainedChild.id}"]`),
  ).toHaveCount(0);
  // Search temporarily expands groups; their saved collapsed state must survive.
  await page.getByLabel("Buscar preguntas", { exact: true }).fill("documenta");
  const selection = page.getByRole("checkbox", {
    name: `Seleccionar pregunta: ${retained.question}`,
    exact: true,
  });
  await selection.check();
  await page
    .locator("tr")
    .filter({
      has: page.getByRole("button", { name: root.question, exact: true }),
    })
    .getByRole("button", { name: "Editar pregunta", exact: true })
    .click();
  const edit = page.getByRole("dialog", {
    name: "Editar pregunta",
    exact: true,
  });
  await edit.getByLabel("Tema al que pertenece").selectOption(sections[1]!.id);
  await edit
    .getByRole("button", { name: "Guardar cambios", exact: true })
    .click();
  const notice = page
    .getByRole("status")
    .filter({ hasText: "Se movió a «Destino ficticio»" });
  await expect(notice).toBeVisible();
  await expect(
    page.locator(`button[data-question-id="${root.id}"]`),
  ).toHaveCount(0);
  await notice.getByRole("button", { name: "Ver", exact: true }).click();
  await expect(
    page.getByRole("tab", { name: "Escribir", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await expect(
    page.locator(`article[data-question-id="${root.id}"]`),
  ).toBeFocused();
  await page.getByRole("tab", { name: "Organizar", exact: true }).click();
  await expect(
    page.getByLabel("Buscar preguntas", { exact: true }),
  ).toHaveValue("documenta");
  await expect(
    page.getByLabel("Estado de publicación", { exact: true }),
  ).toHaveValue("DRAFT");
  await expect(
    page.getByLabel("Área responsable", { exact: true }),
  ).toHaveValue(root.responsibleAreaId);
  const selectedTheme = page
    .getByRole("navigation", { name: "Temas del cuestionario" })
    .locator(":scope > details > summary");
  await expect(selectedTheme).toHaveCount(1);
  await expect(selectedTheme).toContainText(sections[0]!.title);
  await expect(selection).toBeChecked();
  await expect(
    page.locator(`button[data-question-id="${root.id}"]`),
  ).toHaveCount(0);
  const location = new URL(page.url());
  expect(location.searchParams.get("topic")).toBe(sections[0]!.id);
  expect(location.searchParams.get("q")).toBe("documenta");
  await page.getByLabel("Buscar preguntas", { exact: true }).fill("");
  await expect(
    page.getByRole("button", {
      name: `Expandir seguimientos de ${retained.title}`,
      exact: true,
    }),
  ).toHaveAttribute("aria-expanded", "false");
  await expect(
    page.locator(`button[data-question-id="${retainedChild.id}"]`),
  ).toHaveCount(0);
});
test("Cambiar de tema mueve el grupo completo; un integrante publicado impide moverlo", async ({
  page,
}) => {
  const { project, sections, root, child } = await fixture(page);
  await page.goto(`/projects/${project.id}/editor?mode=write`);
  await menu(page, root.title);
  await page
    .getByRole("button", { name: "Cambiar de tema", exact: true })
    .click();
  const dialog = page.getByRole("dialog", {
    name: "Cambiar de tema",
    exact: true,
  });
  await expect(
    dialog.getByText(`Se moverá con su único seguimiento: «${child.title}».`, {
      exact: true,
    }),
  ).toBeVisible();
  await dialog.getByLabel("Tema de destino").selectOption(sections[1]!.id);
  await dialog
    .getByRole("button", { name: "Cambiar de tema", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  let snapshot = await command<QuestionnaireView>(
    page,
    `/projects/${project.id}/questionnaire`,
  );
  const current = snapshot.questions.find((q) => q.id === root.id)!;
  await command(page, `/projects/${project.id}/questions/${root.id}/publish`, {
    expectedVersion: current.lockVersion,
  });
  await page.reload();
  await menu(page, child.title);
  await expect(
    page
      .locator(".qe-inspector")
      .getByRole("button", { name: "Cambiar de tema", exact: true }),
  ).toHaveAttribute("aria-disabled", "true");
  await expect(
    page
      .locator(".qe-inspector")
      .getByRole("button", { name: "Cambiar de tema", exact: true }),
  ).toHaveAccessibleDescription(new RegExp(root.title));
  await page
    .locator(".qe-inspector")
    .getByRole("button", { name: "Editar pregunta", exact: true })
    .click();
  const edit = page.getByRole("dialog", {
    name: "Editar pregunta",
    exact: true,
  });
  await expect(
    edit.getByRole("combobox", { name: "Tema al que pertenece" }),
  ).toHaveCount(0);
  await expect(
    edit.getByRole("group", { name: "Tema al que pertenece" }),
  ).toHaveAccessibleDescription(new RegExp(root.title));
  snapshot = await command<QuestionnaireView>(
    page,
    `/projects/${project.id}/questionnaire`,
  );
  expect(snapshot.questions.find((q) => q.id === child.id)!.sectionId).toBe(
    sections[1]!.id,
  );
});
