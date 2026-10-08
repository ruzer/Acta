import { login } from "./login-helper";
import { prepare } from "./fixtures/workbench";
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdir, writeFile, readFile } from "node:fs/promises";
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

// Optional path selects the API-seeded disposable fixture used for the design
// comparison. Without it the suite creates its own isolated 304-question project.
// The file contains only fictitious IDs/usernames, never passwords or sessions.
test.describe("Direction C · shell and attention", () => {
  test.use({
    locale: "es-MX",
    timezoneId: "America/Mexico_City",
    reducedMotion: "reduce",
  });
  let projectId: string;
  let users: {
    analyst: string;
    admin: string;
    viewer: string;
    participant: string;
  };
  const measurements: unknown[] = [];
  test.beforeAll(async ({ browser }) => {
    test.setTimeout(240000);
    const file = process.env.ACTA_DIRECTION_C_VISUAL_FIXTURE;
    if (file) {
      const fixture = JSON.parse(await readFile(file, "utf8")) as {
        projectId: string;
        users: Record<string, { username: string }>;
      };
      projectId = fixture.projectId;
      users = {
        analyst: fixture.users.elena!.username,
        admin: fixture.users.marco!.username,
        viewer: fixture.users.gabriela!.username,
        participant: fixture.users.ramiro!.username,
      };
    } else {
      const fixture = await prepare(browser, 304);
      expect(fixture.questions).toHaveLength(304);
      projectId = fixture.project.id;
      users = {
        analyst: "analyst",
        admin: "admin",
        viewer: "viewer",
        participant: "stakeholder",
      };
    }
  });
  test.afterAll(async () => {
    await mkdir(output, { recursive: true });
    if (!measurements.length) return;
    await writeFile(
      `${output}/metrics-cp2.json`,
      JSON.stringify({ checkpoint: 2, measurements }, null, 2) + "\n",
    );
  });
  for (const role of ["analyst", "admin"] as const) {
    for (const [width, height] of widths) {
      test(`Atención ${role} ${width}`, async ({ page }) => {
        await page.setViewportSize({ width, height });
        await login(page, users[role]);
        const path = `/projects/${projectId}/dashboard`;
        await page.goto(path);
        await expect(page).toHaveURL(new RegExp(`${path}$`));
        await expect(page.locator("main h1")).toHaveText("Atención");
        await expect(page.locator("main h1")).toHaveCount(1);
        await expect(
          page
            .getByRole("article", { name: "Aclaraciones", exact: true })
            .locator("strong"),
        ).toHaveText("2");
        await expect(page.getByRole("status")).toHaveText("304 preguntas");
        const action = page.getByRole("region", {
          name: "Te toca a ti",
          exact: true,
        });
        if (role === "analyst") {
          await expect(action).toBeVisible();
          await expect(
            action
              .locator('ul[aria-label="Te toca a ti"] > li')
              .nth(0)
              .getByRole("link", { name: /^Resolver conflicto:/ }),
          ).toBeVisible();
        } else {
          await expect(action).toHaveCount(0);
          await expect(
            page.getByText(
              /Consulta: las acciones corresponden al equipo analista/,
            ),
          ).toBeVisible();
        }
        const nav = page.getByRole("navigation", {
          name: "Navegación del proyecto",
          exact: true,
        });
        await expect(nav.getByRole("link")).toHaveCount(4);
        await expect(
          nav.getByRole("link", { name: "Atención", exact: true }),
        ).toHaveAttribute("aria-current", "page");
        await expect(page.locator(".pw-navigation")).toHaveCount(0);
        await page.evaluate(() => document.fonts.ready);
        const metrics = await page.evaluate(() => {
          const visible = (element: Element) =>
            element.getBoundingClientRect().width > 0 &&
            element.getBoundingClientRect().height > 0 &&
            element.checkVisibility();
          const main = document.querySelector("main")!;
          const row = main.querySelector(".ac-queue-row")!;
          const heading = row.querySelector("h3")!;
          const rowStyle = getComputedStyle(heading);
          const controls = [
            ...document.querySelectorAll(
              "button,select,input,summary,.ac-project-navigation a,.ac-row-action a",
            ),
          ].filter(visible);
          const text = [...main.querySelectorAll("*")].filter(
            (el) =>
              visible(el) &&
              !el.classList.contains("sr-only") &&
              [...el.childNodes].some(
                (node) =>
                  node.nodeType === Node.TEXT_NODE && node.textContent?.trim(),
              ),
          );
          const elements = [...main.querySelectorAll("*")].filter(
            (el) =>
              el.checkVisibility() &&
              !el.closest(".sr-only,svg,[aria-hidden=true],option"),
          );
          // Inspect text even at zero width; page scrollWidth misses flex collapse.
          const squeezedText = elements
            .filter(
              (el) =>
                [...el.childNodes].some(
                  (node) =>
                    node.nodeType === Node.TEXT_NODE &&
                    (node.textContent?.trim().length ?? 0) > 6,
                ) &&
                el.getBoundingClientRect().height > 0 &&
                el.getBoundingClientRect().width < 8,
            )
            .map((el) => el.className || el.tagName);
          const childOverflow = elements
            .filter((el) => {
              const parent = el.parentElement;
              if (!parent || getComputedStyle(parent).display === "inline")
                return false;
              const style = getComputedStyle(el);
              if (style.position === "absolute" || style.position === "fixed")
                return false;
              const bounds = el.getBoundingClientRect();
              const container = parent.getBoundingClientRect();
              return (
                bounds.width > 0 &&
                container.width > 0 &&
                (bounds.right > container.right + 2 ||
                  bounds.left < container.left - 2)
              );
            })
            .map((el) => ({
              element: el.className || el.tagName,
              parent: el.parentElement?.className,
            }));
          const metadataSizes = [...row.querySelectorAll(".ac-meta li")].map(
            (el) => parseFloat(getComputedStyle(el).fontSize),
          );
          const rowActionCounts = [...main.querySelectorAll(".ac-queue-row")]
            .filter(visible)
            .map((el) => el.querySelectorAll(".ac-row-action a").length);
          const firstArticle = main.querySelector(
            ".ac-attention-summary article",
          )!;
          return {
            width: innerWidth,
            height: innerHeight,
            pageWidth: document.documentElement.scrollWidth,
            squeezedText,
            childOverflow,
            metadataSizes,
            rowActionCounts,
            queueBeforeSummary: Boolean(
              row.compareDocumentPosition(firstArticle) &
              Node.DOCUMENT_POSITION_FOLLOWING,
            ),
            firstRowY: row.getBoundingClientRect().top,
            questionSize: parseFloat(rowStyle.fontSize),
            questionWeight: Number(rowStyle.fontWeight),
            sidebar: document
              .querySelector(".ac-shell-sidebar")!
              .getBoundingClientRect().width,
            mobile: document
              .querySelector(".ac-shell-mobile")!
              .checkVisibility(),
            smallText: text
              .filter((el) => parseFloat(getComputedStyle(el).fontSize) < 12.5)
              .map((el) => el.tagName),
            overflow: [...main.querySelectorAll("*")]
              .filter(
                (el) =>
                  visible(el) &&
                  !el.classList.contains("sr-only") &&
                  (el.getBoundingClientRect().right > innerWidth + 1 ||
                    el.getBoundingClientRect().left < -1),
              )
              .map((el) => el.className),
            controls: controls.map((el) => ({
              name: el.getAttribute("aria-label") ?? el.textContent,
              width: el.getBoundingClientRect().width,
              height: el.getBoundingClientRect().height,
            })),
          };
        });
        expect(metrics.pageWidth).toBeLessThanOrEqual(width + 1);
        expect(metrics.smallText).toEqual([]);
        expect(metrics.overflow).toEqual([]);
        expect(metrics.squeezedText).toEqual([]);
        expect(metrics.childOverflow).toEqual([]);
        expect(metrics.queueBeforeSummary).toBe(true);
        expect(metrics.metadataSizes.length).toBeGreaterThan(0);
        for (const size of metrics.metadataSizes)
          expect(size).toBeLessThanOrEqual(14);
        for (const count of metrics.rowActionCounts) expect(count).toBe(1);
        expect(metrics.questionSize).toBeGreaterThanOrEqual(15);
        expect(metrics.questionWeight).toBeGreaterThanOrEqual(500);
        if (width === 1440) expect(metrics.firstRowY).toBeLessThanOrEqual(400);
        expect(metrics.sidebar).toBe(
          width >= 1100 ? 248 : width >= 760 ? 64 : 0,
        );
        expect(metrics.mobile).toBe(width < 760);
        for (const control of metrics.controls) {
          expect(
            control.width,
            control.name ?? "control",
          ).toBeGreaterThanOrEqual(width <= 899 ? 44 : 24);
          expect(
            control.height,
            control.name ?? "control",
          ).toBeGreaterThanOrEqual(width <= 899 ? 44 : 24);
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
        const id = role === "analyst" ? "V-01" : "V-01b-admin";
        await mkdir(`${output}/cp2`, { recursive: true });
        await page.screenshot({
          path: `${output}/cp2/${id}-${width}.png`,
          fullPage: false,
        });
        measurements.push({
          id,
          role,
          path,
          ...metrics,
          axeViolations: axe.violations.length,
        });
        // The same actions remain available via keyboard in the rail/mobile menu.
        if (width < 1100)
          await page
            .locator("summary:visible")
            .filter({ hasText: /^Menú$/ })
            .click();
        const tools = page
          .locator("summary:visible")
          .filter({ hasText: /^Más herramientas$/ });
        await tools.focus();
        await page.keyboard.press("Enter");
        const tool = page.getByRole("link", {
          name: "Trazabilidad",
          exact: true,
        });
        await expect(tool).toBeVisible();
        await tool.focus();
        await page.keyboard.press("Escape");
        await expect(tools).toBeFocused();
        await expect(tool).not.toBeVisible();
        await expect(
          page.getByRole("link", { name: "Mi contraseña", exact: true }),
        ).toBeVisible();
        await expect(
          page.getByRole("button", { name: "Cerrar sesión", exact: true }),
        ).toBeVisible();
      });
    }
  }
  for (const role of ["viewer", "participant"] as const) {
    test(`shell restringida ${role} · cinco anchos`, async ({ page }) => {
      await login(page, users[role]);
      for (const [width, height] of widths) {
        await page.setViewportSize({ width, height });
        await page.goto(
          `/projects/${projectId}${role === "participant" ? "/work" : ""}`,
        );
        await expect(page.locator("main h1")).toBeVisible();
        await expect(
          page.getByRole("navigation", {
            name: "Navegación del proyecto",
            exact: true,
          }),
        ).toHaveCount(0);
        await expect(
          page.getByText("Te toca a ti", { exact: true }),
        ).toHaveCount(0);
        for (const name of ["Invitaciones", "Miembros", "Importar estructura"])
          await expect(
            page.getByRole("link", { name, exact: true }),
          ).toHaveCount(0);
        if (role === "viewer") {
          await expect(
            page.getByRole("navigation", { name: "Navegación de consulta" }),
          ).toBeVisible();
          if (width < 1100)
            await page
              .locator("summary:visible")
              .filter({ hasText: /^Menú$/ })
              .click();
          await page
            .locator("summary:visible")
            .filter({ hasText: /^Más herramientas$/ })
            .click();
          await expect(
            page.getByRole("link", {
              name: "Exportar decisiones vigentes",
              exact: true,
            }),
          ).toHaveAttribute("href", `/projects/${projectId}/export`);
        } else {
          await expect(page.locator(".ac-shell")).toHaveCount(0);
          await expect(page.locator(".participant-topbar")).toBeVisible();
        }
      }
    });
  }
});
