import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const widths = [
  [1440, 900],
  [1024, 768],
  [768, 1024],
  [390, 844],
  [320, 640],
] as const;
const output = "docs/design/acta-direction-c-evidence";
const records: unknown[] = [];

test.describe("Direction C · foundation", () => {
  test.use({
    locale: "es-MX",
    timezoneId: "America/Mexico_City",
    reducedMotion: "reduce",
  });
  test.afterAll(async () => {
    await mkdir(output, { recursive: true });
    await writeFile(
      `${output}/metrics-cp1.json`,
      JSON.stringify({ checkpoint: 1, records }, null, 2) + "\n",
    );
  });
  for (const [width, height] of widths) {
    test(`componentes, tipografía y accesibilidad ${width}`, async ({
      page,
      baseURL,
    }) => {
      const fonts: string[] = [];
      const failures: string[] = [];
      page.on("request", (request) => {
        if (request.resourceType() === "font") fonts.push(request.url());
      });
      page.on("pageerror", (error) => failures.push(error.message));
      await page.setViewportSize({ width, height });
      // Vite-only test entry. No application route or production entry is added.
      const path = `/@fs/${resolve("tests/visual/direction-c.html")}`;
      await page.goto(path);
      await expect(page).toHaveURL(new URL(path, baseURL!).href);
      await expect(page.locator("main h1")).toHaveText(
        "Jerarquía y componentes de Dirección C",
      );
      await page.evaluate(async () => {
        await document.fonts.load('700 29px "Acta Plex Serif"');
        await document.fonts.load('italic 400 15px "Acta Plex Serif"');
        await document.fonts.load('400 15px "Acta Plex Serif"');
        await document.fonts.ready;
      });
      expect(failures).toEqual([]);
      expect(fonts.length).toBeGreaterThanOrEqual(5);
      for (const url of fonts)
        expect(new URL(url).origin).toBe(new URL(baseURL!).origin);
      expect(fonts.filter((url) => /plex-serif/.test(url))).toHaveLength(3);
      expect(fonts.some((url) => /manrope|googleapis|gstatic/.test(url))).toBe(
        false,
      );
      await expect(page.locator("main h1")).toHaveCount(1);
      await expect(
        page.getByRole("main", { name: "Verificación de componentes" }),
      ).toBeVisible();
      for (const text of [
        "Sin revisar",
        "Respondida",
        "Requiere aclaración",
        "Conflicto",
        "Validada",
      ]) {
        const chips = page
          .locator(".ac-status")
          .filter({ has: page.getByText(text, { exact: true }) });
        expect(await chips.count()).toBeGreaterThan(0);
        for (const chip of await chips.all()) {
          await expect(chip.locator('svg[aria-hidden="true"]')).toHaveCount(1);
        }
      }
      const axe = await new AxeBuilder({ page })
        .withTags([
          "wcag2a",
          "wcag2aa",
          "wcag21a",
          "wcag21aa",
          "wcag22aa",
          "best-practice",
        ])
        .analyze();
      expect(axe.violations).toEqual([]);
      const metrics = await page.evaluate(() => {
        const visible = (el: Element) =>
          el.getBoundingClientRect().width > 0 &&
          el.getBoundingClientRect().height > 0 &&
          getComputedStyle(el).visibility !== "hidden";
        const text = [...document.querySelectorAll("main *")].filter(
          (el) =>
            visible(el) &&
            [...el.childNodes].some(
              (node) =>
                node.nodeType === Node.TEXT_NODE && node.textContent?.trim(),
            ),
        );
        const smallText = text
          .filter((el) => parseFloat(getComputedStyle(el).fontSize) < 12.5)
          .map((el) => ({
            tag: el.tagName,
            text: el.textContent?.slice(0, 60),
            size: getComputedStyle(el).fontSize,
          }));
        const squeezedText = text
          .filter((el) => el.getBoundingClientRect().width < 8)
          .map((el) => el.textContent?.slice(0, 60));
        const overflow = [...document.querySelectorAll("main *")]
          .filter(
            (el) =>
              visible(el) &&
              (el.getBoundingClientRect().right > innerWidth + 1 ||
                el.getBoundingClientRect().left < -1),
          )
          .map((el) => ({ tag: el.tagName, class: el.className }));
        const targets = [
          ...document.querySelectorAll("button,input,select,textarea"),
        ]
          .filter(visible)
          .map((el) => ({
            label:
              el.getAttribute("aria-label") ?? el.textContent ?? el.tagName,
            width: el.getBoundingClientRect().width,
            height: el.getBoundingClientRect().height,
          }));
        const filename = document.querySelector(".ac-evidence-name strong")!;
        const body = getComputedStyle(document.body);
        return {
          width: innerWidth,
          height: innerHeight,
          pageWidth: document.documentElement.scrollWidth,
          smallText,
          squeezedText,
          overflow,
          targets,
          filenameWidth: filename.getBoundingClientRect().width,
          fontFamily: body.fontFamily,
          bodySize: body.fontSize,
          lineHeight: body.lineHeight,
          bg: getComputedStyle(document.documentElement).backgroundColor,
        };
      });
      expect(metrics.pageWidth).toBeLessThanOrEqual(width + 1);
      expect(metrics.smallText).toEqual([]);
      expect(metrics.squeezedText).toEqual([]);
      expect(metrics.overflow).toEqual([]);
      expect(metrics.filenameWidth).toBeGreaterThan(40);
      expect(metrics.fontFamily).toContain("Acta Plex Sans");
      expect(metrics.bodySize).toBe("15px");
      expect(metrics.bg).toBe("rgb(243, 244, 247)");
      for (const target of metrics.targets) {
        expect(target.width, target.label).toBeGreaterThanOrEqual(
          width <= 899 ? 44 : 24,
        );
        expect(target.height, target.label).toBeGreaterThanOrEqual(
          width <= 899 ? 44 : 24,
        );
      }
      await mkdir(`${output}/cp1`, { recursive: true });
      await page.screenshot({
        path: `${output}/cp1/V-00-base-${width}.png`,
        fullPage: false,
      });
      const initial = page.getByRole("tab", {
        name: "Aportaciones",
        exact: true,
      });
      await initial.focus();
      await page.keyboard.press("ArrowRight");
      await expect(
        page.getByRole("tab", { name: "Contraste", exact: true }),
      ).toBeFocused();
      await expect(
        page.getByRole("tabpanel", { name: "Contraste", exact: true }),
      ).toBeVisible();
      const focus = await page
        .getByRole("tab", { name: "Contraste", exact: true })
        .evaluate((el) => getComputedStyle(el).boxShadow);
      expect(focus).toContain("2px");
      expect(focus).toContain("4px");
      await page.keyboard.press("End");
      await expect(
        page.getByRole("tab", { name: "Historial", exact: true }),
      ).toBeFocused();
      await page.keyboard.press("Home");
      await expect(initial).toBeFocused();
      const open = page.getByRole("button", {
        name: "Registrar decisión",
        exact: true,
      });
      await open.click();
      await expect(
        page.getByRole("dialog", { name: "Registrar decisión" }),
      ).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await expect(open).toBeFocused();
      const brandChecks = [];
      for (const accent of ["#2b4d7c", "#18675f"]) {
        await page.evaluate(
          (value) =>
            document.documentElement.style.setProperty(
              "--installation-accent",
              value,
            ),
          accent,
        );
        const brandAxe = await new AxeBuilder({ page })
          .withTags([
            "wcag2a",
            "wcag2aa",
            "wcag21a",
            "wcag21aa",
            "wcag22aa",
            "best-practice",
          ])
          .analyze();
        expect(brandAxe.violations).toEqual([]);
        brandChecks.push({ accent, violations: brandAxe.violations.length });
      }
      records.push({
        ...metrics,
        axeViolations: axe.violations.length,
        brandChecks,
        localFonts: fonts.map((url) => new URL(url).pathname),
        keyboard: "PASS",
        focus,
        screenshot: `cp1/V-00-base-${width}.png`,
      });
    });
  }
});
