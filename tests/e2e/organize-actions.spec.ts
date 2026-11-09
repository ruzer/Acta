import { test, expect } from "@playwright/test";
import { login } from "./login-helper";

for (const role of ["admin", "analyst"]) {
  test(`organizar: ${role} ve las acciones de captura alineadas y accesibles`, async ({
    page,
  }) => {
    await login(page, role);
    const projects = await page.evaluate(async () => {
      const response = await fetch("/api/v1/projects");
      if (!response.ok) throw new Error(`Projects: ${response.status}`);
      return response.json();
    });
    const project = projects.find(
      (item: { externalId: string }) => item.externalId === "DEMO-PRINCIPAL",
    );
    expect(project).toBeDefined();
    await page.goto(`/projects/${project.id}/editor`);
    await page.getByRole("tab", { name: "Organizar", exact: true }).click();
    const topic = page.getByRole("button", {
      name: "+ Agregar tema",
      exact: true,
    });
    const question = page.getByRole("button", {
      name: "Nueva pregunta",
      exact: true,
    });
    await expect(question).toBeEnabled();
    await page.evaluate(() => document.fonts.ready);
    for (const width of [1440, 1024, 900, 390, 375, 320]) {
      await page.setViewportSize({ width, height: 1000 });
      const a = (await topic.boundingBox())!;
      const b = (await question.boundingBox())!;
      expect(
        Math.abs(a.y - b.y),
        `misma fila a ${width}px`,
      ).toBeLessThanOrEqual(1);
      expect(
        a.x + a.width,
        `acciones separadas a ${width}px`,
      ).toBeLessThanOrEqual(b.x);
      for (const button of [topic, question]) {
        expect(
          await button.evaluate((element) => {
            const rect = element.getBoundingClientRect();
            return element.contains(
              document.elementFromPoint(
                rect.x + rect.width / 2,
                rect.y + rect.height / 2,
              ),
            );
          }),
          `acción no tapada a ${width}px`,
        ).toBe(true);
      }
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        `sin desbordamiento a ${width}px`,
      ).toBe(true);
    }
  });
}
