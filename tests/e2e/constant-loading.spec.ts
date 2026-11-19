import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
for (const width of [1440, 390]) {
  for (const path of ["/configuration/public", "/auth/me", "/setup/status"]) {
    test(`la carga inicial ${path} usa el esqueleto accesible a ${width}`, async ({
      page,
    }) => {
      const release = Promise.withResolvers<void>();
      const requested = Promise.withResolvers<void>();
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.route(
        (url) => url.pathname === `/api/v1${path}`,
        async (route) => {
          requested.resolve();
          await release.promise;
          await route.continue();
        },
      );
      try {
        await page.goto("/");
        await requested.promise;
        const skeleton = page.locator(".loading-skeleton");
        await expect(skeleton).toHaveAttribute("aria-busy", "true");
        await expect(skeleton).toHaveAttribute("role", "status");
        await expect(skeleton).toHaveText("Cargando información…");
        expect(
          await skeleton.evaluate((el) => getComputedStyle(el).animationName),
        ).toBe("none");
        expect(
          (
            await new AxeBuilder({ page })
              .include(".loading-skeleton")
              .analyze()
          ).violations,
        ).toEqual([]);
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true);
      } finally {
        release.resolve();
      }
      await expect(
        page.getByRole("heading", { name: "Iniciar sesión" }),
      ).toBeVisible();
    });
  }
}
