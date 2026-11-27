import { test, expect, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import type { ProjectView, QuestionView } from "@requirements/contracts";
import { login } from "./login-helper";
import { command } from "./fixtures/workbench";
import { checkedPage } from "./fixtures/page-checks";
const evidence =
  process.env.ACTA_DIRECTION_C_EVIDENCE_DIR ?? "test-results/design-evidence";
test.use({ hasTouch: true });
async function fixture(page: Page) {
  await login(page, "admin");
  const project = await command<ProjectView>(page, "/projects", {
    externalId: randomUUID(),
    name: "Lectura ficticia de preguntas",
    description: "Solo prueba de interfaz",
  });
  const area = (
    await command<{ id: string; active: boolean }[]>(page, "/areas")
  ).find((a) => a.active)!;
  const section = await command<{ id: string }>(
    page,
    `/projects/${project.id}/sections`,
    {
      externalId: randomUUID(),
      title: "Tema ficticio",
      description: "",
      order: 0,
    },
  );
  const questions: QuestionView[] = [];
  for (let index = 0; index < 3; index++)
    questions.push(
      await command<QuestionView>(page, `/projects/${project.id}/questions`, {
        externalId: randomUUID(),
        sectionId: section.id,
        title: `Lectura ficticia ${index + 1}`,
        question: `¿Qué opción ficticia corresponde al caso ${index + 1}?`,
        helpText: "Lee las cinco opciones antes de responder.",
        type: "SINGLE_CHOICE",
        required: false,
        priority: "P2",
        responsibleAreaId: area.id,
        order: index,
        options: Array.from({ length: 5 }, (_, option) => ({
          value: `option-${option}`,
          label: `Opción ficticia ${option + 1}`,
          order: option,
        })),
        references: [],
      }),
    );
  await command(
    page,
    `/projects/${project.id}/questions/${questions[0]!.id}/publish`,
    { expectedVersion: questions[0]!.lockVersion },
  );
  return { project, questions };
}
for (const width of [1440, 1280, 390]) {
  test(`I3 abre con ratón, teclado y táctil en ambos modos a ${width}px`, async ({
    page,
  }) => {
    const { project, questions } = await fixture(page);
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`/projects/${project.id}/editor?mode=write`);
    for (const mode of ["Escribir", "Organizar"]) {
      await page.getByRole("tab", { name: mode, exact: true }).click();
      const opener = page.getByRole("button", {
        name: questions[0]!.question,
        exact: true,
      });
      if (width === 390) await opener.tap();
      else await opener.click();
      const panel = page.getByRole(width >= 1280 ? "complementary" : "dialog", {
        name: "Detalle de pregunta",
      });
      await expect(panel).toHaveCount(1);
      await expect(
        panel.getByRole("heading", { name: "Detalle de pregunta" }),
      ).toBeFocused();
      await expect(
        panel
          .getByRole("region", { name: "Opciones de respuesta" })
          .getByRole("listitem"),
      ).toHaveCount(5);
      await expect(
        panel.getByRole("button", { name: "Revisar respuestas", exact: true }),
      ).toHaveClass(/primary/);
      await expect(
        panel.getByRole("button", { name: "Cambiar de tema" }),
      ).toHaveCount(0);
      await expect(opener).toHaveAttribute("aria-current", "true");
      await expect(page).toHaveURL(new RegExp(`question=${questions[0]!.id}`));
      await checkedPage(page, evidence, `i3-${mode.toLowerCase()}`, width);
      await page.keyboard.press("Escape");
      await expect(panel).toHaveCount(0);
      await expect(opener).toBeFocused();
      await opener.press("Enter");
      await expect(panel).toHaveCount(1);
      await page.goBack();
      await expect(panel).toHaveCount(0);
      await expect(page).toHaveURL(/\/editor/);
    }
  });
}
test("I3 recorre filtro sin perder casillas y abre enlaces directos válidos e inválidos", async ({
  page,
}) => {
  const { project, questions } = await fixture(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`/projects/${project.id}/editor?mode=organize&q=opción`);
  const first = questions[0]!,
    second = questions[1]!;
  const selected = page.getByRole("checkbox", {
    name: `Seleccionar pregunta: ${first.question}`,
    exact: true,
  });
  await selected.check();
  await page.getByRole("button", { name: first.question, exact: true }).click();
  const panel = page.getByRole("complementary", {
    name: "Detalle de pregunta",
  });
  await panel.getByRole("button", { name: "Pregunta siguiente" }).click();
  await expect(panel.getByRole("status")).toHaveText("2 de 3 resultados");
  await expect(selected).toBeChecked();
  await expect(page.getByLabel("Buscar preguntas")).toHaveValue("opción");
  await expect(
    panel.getByRole("button", { name: "Publicar", exact: true }),
  ).toHaveClass(/primary/);
  await expect(
    panel.getByRole("button", { name: "Cambiar de tema" }),
  ).toBeVisible();
  await panel.getByText("Más acciones", { exact: true }).click();
  const archive = panel.getByRole("button", { name: "Archivar", exact: true });
  await archive.scrollIntoViewIfNeeded();
  await expect(archive).toBeInViewport();
  await page.keyboard.press("Escape");
  await expect(panel).toHaveCount(1);
  await page.goBack();
  await expect(panel).toHaveCount(0);
  await expect(selected).toBeChecked();
  await page.goto(
    `/projects/${project.id}/editor?mode=write&question=${second.id}`,
  );
  await expect(panel).toBeVisible();
  await page.goBack();
  await expect(panel).toHaveCount(0);
  await expect(page).toHaveURL(/\/editor\?mode=write$/);
  await page.goto(`/projects/${project.id}/editor?mode=write&question=missing`);
  await expect(
    page.getByText(
      "La pregunta del enlace no está disponible en este cuestionario.",
    ),
  ).toBeVisible();
  await expect(panel).toHaveCount(0);
});
