import { login } from "./login-helper";
import { prepare } from "./fixtures/workbench";
import { test, expect, type Page } from "@playwright/test";
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
const output =
  process.env.ACTA_DIRECTION_C_EVIDENCE_DIR ??
  "docs/design/acta-direction-c-evidence";
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

// Measure the active surface, including content below a scrollable dialog fold.
/**
 * UX-06 contract: the contribution the review opens on when something is
 * pending — the clarification waiting for the analyst, then any open
 * clarification, then the open conflict. Returns that person's display name,
 * or null when nothing is pending on a current contribution.
 */
function relevantContribution(
  data: import("@requirements/contracts").ReviewDetail,
): string | null {
  const current = data.submissions.filter((s) => s.current);
  const byId = new Map(current.map((s) => [s.id, s]));
  const open = data.threads.filter(
    (t) => t.status !== "CLOSED" && byId.has(t.responseRevisionId),
  );
  const thread =
    open.find((t) => t.status === "WAITING_ANALYST") ?? open[0] ?? null;
  if (thread)
    return byId.get(thread.responseRevisionId)!.respondent.displayName;
  const conflict = data.conflicts.find((c) => c.status === "OPEN");
  const linked = conflict?.participants.find((p) =>
    byId.has(p.responseRevisionId),
  );
  return linked
    ? byId.get(linked.responseRevisionId)!.respondent.displayName
    : null;
}

async function surfaceMetrics(page: Page, selector: string) {
  const metrics = await page.locator(selector).evaluate((root) => {
    const visible = (el: Element) =>
      el.checkVisibility() &&
      el.getBoundingClientRect().width > 0 &&
      !el.closest('.sr-only,svg,[aria-hidden="true"]');
    const controls = [
      ...root.querySelectorAll("button,input,select,textarea,summary"),
    ]
      .filter(visible)
      .filter((el) => !(el as HTMLInputElement).disabled);
    const text = [...root.querySelectorAll("*")].filter(
      (el) =>
        visible(el) &&
        !el.matches("option") &&
        [...el.childNodes].some(
          (n) => n.nodeType === Node.TEXT_NODE && n.textContent?.trim(),
        ),
    );
    return {
      scrollWidth: document.documentElement.scrollWidth,
      width: innerWidth,
      tooSmall: controls
        .map((el) => {
          const target = el.matches(
            'input[type="radio"],input[type="checkbox"]',
          )
            ? (el.closest("label") ?? el)
            : el;
          const r = target.getBoundingClientRect();
          return {
            name: el.getAttribute("aria-label") ?? el.textContent?.trim(),
            width: r.width,
            height: r.height,
          };
        })
        .filter(
          (r) =>
            r.width < (innerWidth < 900 ? 44 : 24) ||
            r.height < (innerWidth < 900 ? 44 : 24),
        ),
      smallText: text
        .filter((el) => parseFloat(getComputedStyle(el).fontSize) < 12.5)
        .map((el) => el.textContent?.slice(0, 70)),
      squeezedText: text
        .filter((el) => el.getBoundingClientRect().width < 8)
        .map((el) => el.textContent?.slice(0, 70)),
      overflow: text
        .filter((el) => {
          const r = el.getBoundingClientRect();
          return r.left < -1 || r.right > innerWidth + 1;
        })
        .map((el) => el.textContent?.slice(0, 70)),
    };
  });
  expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.width + 1);
  expect(metrics.tooSmall).toEqual([]);
  expect(metrics.smallText).toEqual([]);
  expect(metrics.squeezedText).toEqual([]);
  expect(metrics.overflow).toEqual([]);
  return metrics;
}

test.describe("Direction C · questionnaire", () => {
  test.use({
    locale: "es-MX",
    timezoneId: "America/Mexico_City",
    reducedMotion: "reduce",
  });
  let projectId: string;
  let analyst: string;
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
      analyst = fixture.users.elena!.username;
    } else {
      const fixture = await prepare(browser, 304);
      expect(fixture.questions).toHaveLength(304);
      projectId = fixture.project.id;
      analyst = "analyst";
    }
  });
  test.afterAll(async () => {
    if (!measurements.length) return;
    await mkdir(output, { recursive: true });
    await writeFile(
      `${output}/metrics-cp3.json`,
      JSON.stringify({ checkpoint: 3, records: measurements }, null, 2) + "\n",
    );
  });
  for (const [width, height] of widths) {
    test(`tabla Preparar y Analizar, densidad, filtros y teclado ${width}`, async ({
      page,
      baseURL,
    }) => {
      await page.setViewportSize({ width, height });
      await login(page, analyst);
      const path = `/projects/${projectId}/editor`;
      await page.goto(path);
      await expect(page).toHaveURL(new URL(path, baseURL!).href);
      await expect(page.locator("main h1")).toHaveText("Cuestionario");
      await page.getByRole("tab", { name: "Organizar", exact: true }).click();
      await expect(
        page.getByRole("checkbox", { name: /Seleccionar pregunta:/ }),
      ).toHaveCount(40);
      await expect(page.locator(".ac-questionnaire-total")).toContainText(
        "304 preguntas",
      );
      for (const [lens, id] of [
        ["Preparar", "V-02b"],
        ["Analizar", "V-02"],
      ] as const) {
        await page.getByRole("button", { name: lens, exact: true }).click();
        await expect(
          page.getByRole("button", { name: lens, exact: true }),
        ).toHaveAttribute("aria-pressed", "true");
        await expect(
          page.getByRole("columnheader", {
            name: lens === "Preparar" ? "Participantes" : "Aportaciones",
            exact: true,
          }),
        ).toBeAttached();
        await page.evaluate(async () => {
          await document.fonts.ready;
          scrollTo(0, 0);
        });
        const metrics = await page.evaluate(() => {
          const rows = [
            ...document.querySelectorAll<HTMLElement>(".an-question-row"),
          ];
          const question = rows[0]!.querySelector("strong")!;
          const q = getComputedStyle(question);
          const visible = (el: Element) =>
            el.checkVisibility() &&
            el.getBoundingClientRect().width > 1 &&
            el.getBoundingClientRect().height > 1;
          const controls = [
            ...document.querySelectorAll(
              "main button,main input,main select,main summary",
            ),
          ]
            .filter(visible)
            .filter((el) => !(el as HTMLInputElement).disabled);
          const tooSmall = controls
            .map((el) => {
              const target = el.matches(
                'input[type="checkbox"],input[type="radio"]',
              )
                ? (el.closest("label") ?? el)
                : el;
              const r = target.getBoundingClientRect();
              return {
                name: el.getAttribute("aria-label") ?? el.textContent?.trim(),
                width: r.width,
                height: r.height,
              };
            })
            .filter(
              (r) =>
                r.width < (innerWidth < 900 ? 44 : 24) ||
                r.height < (innerWidth < 900 ? 44 : 24),
            );
          const text = [...document.querySelectorAll("main *")].filter(
            (el) =>
              visible(el) &&
              !el.closest(".sr-only,svg,[aria-hidden=true],option") &&
              !(innerWidth < 900 && el.closest("thead")) &&
              [...el.childNodes].some(
                (n) => n.nodeType === Node.TEXT_NODE && n.textContent?.trim(),
              ),
          );
          return {
            width: innerWidth,
            height: innerHeight,
            scrollWidth: document.documentElement.scrollWidth,
            rows: rows.length,
            fullyVisibleRows: rows.filter(
              (el) =>
                el.getBoundingClientRect().top >= 0 &&
                el.getBoundingClientRect().bottom <= innerHeight,
            ).length,
            firstQuestionBottom: question.getBoundingClientRect().bottom,
            rowDisplay: getComputedStyle(rows[0]!).display,
            questionSize: parseFloat(q.fontSize),
            questionWeight: q.fontWeight,
            questionLines:
              question.getBoundingClientRect().height /
              parseFloat(q.lineHeight),
            headerPosition: getComputedStyle(
              document.querySelector("thead th")!,
            ).position,
            tooSmall,
            smallText: text
              .filter((el) => parseFloat(getComputedStyle(el).fontSize) < 12.5)
              .map((el) => el.textContent?.slice(0, 70)),
            squeezedText: text
              .filter((el) => el.getBoundingClientRect().width < 8)
              .map((el) => el.textContent?.slice(0, 70)),
            overflow: text
              .filter((el) => {
                const r = el.getBoundingClientRect();
                return r.left < -1 || r.right > innerWidth + 1;
              })
              .map((el) => el.textContent?.slice(0, 70)),
          };
        });
        expect(metrics.scrollWidth).toBeLessThanOrEqual(width + 1);
        expect(metrics.rows).toBe(40);
        expect(metrics.questionSize).toBeGreaterThanOrEqual(15);
        expect(metrics.smallText).toEqual([]);
        expect(metrics.squeezedText).toEqual([]);
        expect(metrics.overflow).toEqual([]);
        expect(metrics.tooSmall).toEqual([]);
        if (width === 1440) {
          expect(metrics.fullyVisibleRows).toBeGreaterThanOrEqual(5);
          expect(metrics.questionLines).toBeLessThanOrEqual(2.01);
        }
        if (width >= 900) {
          expect(metrics.rowDisplay).toBe("table-row");
          expect(metrics.headerPosition).toBe("sticky");
          await page.evaluate(() => scrollTo(0, 600));
          const header = await page.locator("thead th").first().boundingBox();
          expect(header!.y).toBeGreaterThanOrEqual(0);
          expect(header!.y).toBeLessThanOrEqual(5);
          await page.evaluate(() => scrollTo(0, 0));
        } else {
          expect(metrics.rowDisplay).toBe("grid");
          if (width >= 390)
            expect(metrics.firstQuestionBottom).toBeLessThanOrEqual(
              height - (width < 760 ? 76 : 0),
            );
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
        await mkdir(`${output}/cp3`, { recursive: true });
        await page.screenshot({ path: `${output}/cp3/${id}-${width}.png` });
        let reflowQuestionBounds;
        if (width === 320) {
          // Product-approved reflow check: retain all editor modes (DEV-16)
          // and verify the complete question after scrolling, clear of fixed navigation.
          const first = page
            .locator(".an-question-row .qe-compact-row")
            .first();
          await first.evaluate((el) => el.scrollIntoView({ block: "center" }));
          reflowQuestionBounds = await first.boundingBox();
          expect(reflowQuestionBounds!.y).toBeGreaterThanOrEqual(0);
          expect(
            reflowQuestionBounds!.y + reflowQuestionBounds!.height,
          ).toBeLessThanOrEqual(height - 76);
          await page.screenshot({
            path: `${output}/cp3/${id}-reflow-${width}.png`,
          });
          await page.evaluate(() => scrollTo(0, 0));
        }
        measurements.push({
          id,
          ...metrics,
          reflowQuestionBounds,
          axeViolations: axe.violations.length,
        });
      }
      const filter = page.getByRole("button", { name: "Filtros", exact: true });
      if (width < 900) {
        await expect(
          page.getByLabel("Área responsable", { exact: true }),
        ).toBeHidden();
        await filter.focus();
        await page.keyboard.press("Enter");
        await expect(
          page.getByLabel("Área responsable", { exact: true }),
        ).toBeVisible();
      }
      const topic = page.locator(".qe-outline > details > summary");
      await topic.focus();
      await page.keyboard.press("Enter");
      await expect(
        page.getByRole("button", { name: /^Todos los temas/ }),
      ).toBeVisible();
      await page.getByRole("button", { name: /^Todos los temas/ }).focus();
      await page.keyboard.press("Escape");
      await expect(topic).toBeFocused();
      if (width < 900) {
        await page.getByLabel("Área responsable", { exact: true }).focus();
        await page.keyboard.press("Escape");
        await expect(filter).toBeFocused();
        await expect(
          page.getByLabel("Área responsable", { exact: true }),
        ).toBeHidden();
      }
    });
    test(`selección y revisión del lote sin confirmar ${width}`, async ({
      page,
      baseURL,
    }) => {
      await page.setViewportSize({ width, height });
      await login(page, analyst);
      const path = `/projects/${projectId}/editor`;
      await page.goto(path);
      await expect(page).toHaveURL(new URL(path, baseURL!).href);
      await expect(page.locator("main h1")).toHaveText("Cuestionario");
      await page.getByRole("tab", { name: "Organizar", exact: true }).click();
      await page.getByText("Seleccionar preguntas", { exact: true }).click();
      await page
        .getByRole("button", {
          name: "Seleccionar esta página (40)",
          exact: true,
        })
        .click();
      await expect(
        page.getByText("40 preguntas seleccionadas", { exact: true }),
      ).toBeVisible();
      await expect(
        page.getByText("40 en esta página · 0 fuera de esta página", {
          exact: true,
        }),
      ).toBeVisible();
      const bar = page.locator(".ac-selection-bar");
      const bounds = await bar.boundingBox();
      expect(bounds!.y).toBeGreaterThanOrEqual(0);
      expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(height);
      expect(await bar.getByRole("button").count()).toBeGreaterThanOrEqual(4);
      const selectionMetrics = await surfaceMetrics(page, ".ac-selection-bar");
      const selectionAxe = await new AxeBuilder({ page })
        .withTags([
          "wcag2a",
          "wcag2aa",
          "wcag21a",
          "wcag21aa",
          "wcag22aa",
          "best-practice",
        ])
        .analyze();
      expect(selectionAxe.violations).toEqual([]);
      await page.screenshot({
        path: `${output}/cp3/V-02c-selection-${width}.png`,
      });
      const trigger = page.getByRole("button", {
        name: "Publicar seleccionadas",
        exact: true,
      });
      await trigger.click();
      const dialog = page.getByRole("dialog", {
        name: "Publicar preguntas seleccionadas",
      });
      await expect(dialog).toBeVisible();
      await page
        .getByRole("button", { name: "Revisar lote", exact: true })
        .click();
      await expect(
        page.getByRole("heading", { name: "Revisión del lote", exact: true }),
      ).toBeFocused();
      await expect(
        page.getByRole("button", { name: /^Confirmar / }),
      ).toBeDisabled();
      await page.evaluate(() => document.fonts.ready);
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
      const dialogMetrics = await surfaceMetrics(page, "dialog[open]");
      await page.screenshot({ path: `${output}/cp3/V-02c-${width}.png` });
      await page.keyboard.press("Escape");
      await expect(trigger).toBeFocused();
      await page
        .getByRole("button", { name: "Limpiar selección", exact: true })
        .click();
      await expect(
        page.getByText("0 preguntas seleccionadas", { exact: true }),
      ).toBeFocused();
      measurements.push({
        id: "V-02c",
        width,
        height,
        selectionBounds: bounds,
        selectionMetrics,
        selectionAxeViolations: selectionAxe.violations.length,
        dialogMetrics,
        axeViolations: axe.violations.length,
        confirmed: false,
      });
    });
    test(`autoría, campo principal, tipos y pie ${width}`, async ({
      page,
      baseURL,
    }) => {
      await page.setViewportSize({ width, height });
      await login(page, analyst);
      const path = `/projects/${projectId}/editor`;
      await page.goto(path);
      await expect(page).toHaveURL(new URL(path, baseURL!).href);
      await expect(page.locator("main h1")).toHaveText("Cuestionario");
      await page.getByRole("tab", { name: "Organizar", exact: true }).click();
      await page
        .getByRole("button", { name: "Nueva pregunta", exact: true })
        .click();
      const dialog = page.getByRole("dialog", {
        name: "Agregar pregunta al cuestionario",
      });
      await expect(dialog).toBeVisible();
      const question = page.getByRole("textbox", {
        name: "Pregunta",
        exact: true,
      });
      await expect(question).toBeFocused();
      await question.fill(
        "¿Se debe exigir garantía de anticipo cuando el proveedor solicita un pago adelantado?",
      );
      const hero = await question.evaluate((el) => ({
        height: el.getBoundingClientRect().height,
        size: parseFloat(getComputedStyle(el).fontSize),
        family: getComputedStyle(el).fontFamily,
      }));
      expect(hero.height).toBeGreaterThanOrEqual(104);
      expect(hero.size).toBeGreaterThanOrEqual(20);
      expect(hero.family).toContain("Plex Sans");
      await expect(page.getByRole("radio")).toHaveCount(8);
      await page
        .getByRole("radio", { name: "Una opción", exact: true })
        .check();
      for (const [index, label] of [
        "Solo si el contrato supera 500 UMA",
        "Siempre, sin importar el monto",
        "Nunca: basta el visto bueno del área",
      ].entries()) {
        await page
          .getByRole("button", { name: "Agregar opción", exact: true })
          .click();
        await page
          .getByRole("textbox", {
            name: `Texto de opción ${index + 1}`,
            exact: true,
          })
          .fill(label);
      }
      await question.focus();
      await dialog.evaluate((el) => (el.scrollTop = 0));
      const footer = dialog.locator("footer");
      await expect(
        footer.getByRole("button", { name: "Crear pregunta", exact: true }),
      ).toBeVisible();
      const r = await footer.boundingBox();
      expect(r!.y + r!.height).toBeLessThanOrEqual(height);
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
      const formMetrics = await surfaceMetrics(page, "dialog[open]");
      await page.screenshot({ path: `${output}/cp3/V-03-${width}.png` });
      measurements.push({
        id: "V-03",
        width,
        height,
        hero,
        footerBounds: r,
        formMetrics,
        axeViolations: axe.violations.length,
        saved: false,
      });
    });
  }
});

test.describe("Direction C · review", () => {
  test.use({
    locale: "es-MX",
    timezoneId: "America/Mexico_City",
    reducedMotion: "reduce",
  });
  type Case = {
    id: string;
    questionId: string;
    count: number;
    user: string;
    readonly: boolean;
    decision?: boolean;
    expectedStatus?: "CLARIFICATION_REQUIRED" | "PARTIAL";
  };
  let projectId: string;
  let cases: Case[];
  let source: string;
  const measurements: unknown[] = [];
  test.beforeAll(async ({ browser }) => {
    test.setTimeout(240000);
    const file = process.env.ACTA_DIRECTION_C_VISUAL_FIXTURE;
    if (file) {
      const fixture = JSON.parse(await readFile(file, "utf8")) as {
        projectId: string;
        users: Record<string, { username: string }>;
        cases: Record<string, { id: string }>;
      };
      projectId = fixture.projectId;
      source = "Direction C · fixture importado por API";
      cases = [
        {
          id: "V-04",
          questionId: fixture.cases["review-1"]!.id,
          count: 1,
          user: fixture.users.elena!.username,
          readonly: false,
        },
        {
          id: "V-05",
          questionId: fixture.cases["review-3-conflict"]!.id,
          count: 3,
          user: fixture.users.elena!.username,
          readonly: false,
        },
        {
          id: "V-06",
          questionId: fixture.cases["review-12"]!.id,
          count: 12,
          user: fixture.users.elena!.username,
          readonly: false,
        },
        {
          id: "V-08",
          questionId: fixture.cases["review-0"]!.id,
          count: 0,
          user: fixture.users.elena!.username,
          readonly: false,
        },
        {
          id: "V-13-admin",
          questionId: fixture.cases["review-3-conflict"]!.id,
          count: 3,
          user: fixture.users.marco!.username,
          readonly: true,
        },
        {
          id: "V-14-viewer",
          questionId: fixture.cases["decision-validated"]!.id,
          count: 3,
          user: fixture.users.gabriela!.username,
          readonly: true,
          decision: true,
        },
        {
          id: "V-07",
          questionId: fixture.cases["review-50"]!.id,
          count: 50,
          user: fixture.users.elena!.username,
          readonly: false,
          expectedStatus: "CLARIFICATION_REQUIRED",
        },
        {
          id: "V-07-partial",
          questionId: fixture.cases["review-partial"]!.id,
          count: 1,
          user: fixture.users.elena!.username,
          readonly: false,
          expectedStatus: "PARTIAL",
        },
      ];
    } else {
      // Autonomous API fixture for ordinary E2E runs; never mislabeled as the
      // approved 3/12/50-person visual dataset. The report records its actual size.
      const f = await prepare(browser);
      projectId = f.project.id;
      source = "Fixture autónomo de API · 0/1/2 aportaciones";
      cases = [
        {
          id: "API-single",
          questionId: f.questions[2]!.id,
          count: 1,
          user: "analyst",
          readonly: false,
        },
        {
          id: "API-conflict",
          questionId: f.questions[0]!.id,
          count: 2,
          user: "analyst",
          readonly: false,
        },
        {
          id: "API-clarification",
          questionId: f.questions[1]!.id,
          count: 1,
          user: "analyst",
          readonly: false,
        },
        {
          id: "API-empty",
          questionId: f.questions[4]!.id,
          count: 0,
          user: "analyst",
          readonly: false,
        },
        {
          id: "API-admin",
          questionId: f.questions[0]!.id,
          count: 2,
          user: "admin",
          readonly: true,
        },
        {
          id: "API-viewer",
          questionId: f.questions[3]!.id,
          count: 1,
          user: "viewer",
          readonly: true,
          decision: true,
        },
      ];
    }
  });
  if (process.env.ACTA_DIRECTION_C_VISUAL_FIXTURE)
    test("DEV-25 · cincuenta aportaciones conservan los permisos reales", async ({
      page,
    }) => {
      const fixture = JSON.parse(
        await readFile(process.env.ACTA_DIRECTION_C_VISUAL_FIXTURE!, "utf8"),
      ) as {
        projectId: string;
        users: Record<string, { username: string }>;
        cases: Record<string, { id: string }>;
      };
      const id = fixture.cases["review-50"]!.id;
      const apiPath = `/api/v1/projects/${fixture.projectId}/questions/${id}/review`;
      await login(page, fixture.users.marco!.username);
      const response = await page.request.get(apiPath);
      expect(response.status()).toBe(200);
      const data =
        (await response.json()) as import("@requirements/contracts").ReviewDetail;
      expect(data.status).toBe("CLARIFICATION_REQUIRED");
      expect(data.canReview).toBe(false);
      expect(data.submissions.filter((s) => s.current)).toHaveLength(50);
      await page.goto(`/projects/${fixture.projectId}/review/${id}`);
      await expect(page.locator("main h1")).toHaveText(data.question.question);
      await expect(
        page.getByText("Consulta de solo lectura.", { exact: true }),
      ).toBeVisible();
      await expect(page.getByText("Otras acciones")).toHaveCount(0);
      await expect(page.getByText("Te toca a ti", { exact: true })).toHaveCount(
        0,
      );
      // An account without access to unvalidated review data cannot obtain it.
      await page.context().clearCookies();
      await login(page, fixture.users.gabriela!.username);
      expect((await page.request.get(apiPath)).status()).toBe(404);
      await page.context().clearCookies();
      await login(page, fixture.users.lucia!.username);
      expect((await page.request.get(apiPath)).status()).toBe(403);
      await page.context().clearCookies();
      expect((await page.request.get(apiPath)).status()).toBe(401);
    });
  test.afterAll(async () => {
    if (!measurements.length) return;
    await mkdir(`${output}/cp4`, { recursive: true });
    await writeFile(
      `${output}/metrics-cp4.json`,
      JSON.stringify(
        { checkpoint: 4, source, records: measurements },
        null,
        2,
      ) + "\n",
    );
  });
  for (const [width, height] of widths)
    for (
      let index = 0;
      index < (process.env.ACTA_DIRECTION_C_VISUAL_FIXTURE ? 8 : 6);
      index++
    ) {
      test(`pregunta, aportaciones y permisos ${index} · ${width}`, async ({
        page,
        baseURL,
      }) => {
        const item = cases[index]!;
        await page.setViewportSize({ width, height });
        await login(page, item.user);
        const response = await page.request.get(
          `/api/v1/projects/${projectId}/questions/${item.questionId}/review`,
        );
        expect(response.status()).toBe(200);
        const data =
          (await response.json()) as import("@requirements/contracts").ReviewDetail;
        expect(data.canReview).toBe(!item.readonly);
        const current = data.submissions.filter((s) => s.current);
        expect(current).toHaveLength(item.count);
        if (item.expectedStatus) {
          // DEV-25: use the backend projection, never the prototype's label.
          expect(data.status).toBe(item.expectedStatus);
          expect(
            data.conflicts.filter((c) => c.status === "OPEN"),
          ).toHaveLength(0);
          const required = data.participants.filter(
            (p) => p.required && p.applicability === "ENABLED",
          );
          if (item.count === 50) {
            expect(data.threads).toHaveLength(3);
            expect(
              data.threads.filter((t) => t.status !== "CLOSED"),
            ).toHaveLength(2);
            expect(required).toHaveLength(50);
            expect(required.filter((p) => !p.currentRevisionId)).toHaveLength(
              0,
            );
          } else {
            expect(required).toHaveLength(2);
            expect(required.filter((p) => !p.currentRevisionId)).toHaveLength(
              1,
            );
            expect(data.threads).toHaveLength(0);
            expect(data.partialReviewReason).toBeNull();
          }
        }
        const path = `/projects/${projectId}/review/${item.questionId}`;
        await page.goto(path);
        await expect(page).toHaveURL(new URL(path, baseURL!).href);
        await expect(page.locator("main h1")).toHaveText(
          data.question.question,
        );
        await expect(page.locator("main h1")).toHaveCount(1);
        if (item.expectedStatus) {
          await expect(page.locator(".ac-state-card .ac-status")).toHaveText(
            item.expectedStatus === "PARTIAL"
              ? "Respuesta parcial"
              : "Requiere aclaración",
          );
          await expect(
            page.getByText("Te toca a ti", { exact: true }),
          ).toHaveCount(0);
          await expect(
            page.getByText(
              item.expectedStatus === "PARTIAL"
                ? "Falta 1 de 2 personas asignadas"
                : "En espera de aclaración",
              { exact: true },
            ),
          ).toBeVisible();
        }
        const initial = data.validations.some((v) => !v.invalidatedAt)
          ? "Decisión"
          : data.conflicts.some((c) => c.status === "OPEN")
            ? "Contraste"
            : `Aportaciones (${item.count})`;
        await expect(
          page.getByRole("tab", { name: initial, exact: true }),
        ).toHaveAttribute("aria-selected", "true");
        if (item.readonly) {
          await expect(
            page.getByText("Consulta de solo lectura.", { exact: true }),
          ).toBeVisible();
          await expect(
            page.getByText("Te toca a ti", { exact: true }),
          ).toHaveCount(0);
          await expect(page.getByText("Otras acciones")).toHaveCount(0);
          await expect(
            page.getByRole("button", {
              name: /^(Registrar decisión|Resolver conflicto|Reabrir pregunta|Cerrar aclaración|Preguntar nuevamente)$/,
            }),
          ).toHaveCount(0);
        }
        if (item.decision)
          await expect(
            page.getByRole("article", {
              name: "Decisión vigente",
              exact: true,
            }),
          ).toBeVisible();
        await page.evaluate(async () => {
          await document.fonts.ready;
          scrollTo(0, 0);
        });
        await mkdir(`${output}/cp4`, { recursive: true });
        await page.screenshot({
          path: `${output}/cp4/${item.id}-${width}-default.png`,
        });
        const initialAxe = (
          await new AxeBuilder({ page })
            .withTags([
              "wcag2a",
              "wcag2aa",
              "wcag21a",
              "wcag21aa",
              "wcag22aa",
              "best-practice",
            ])
            .analyze()
        ).violations;
        expect(initialAxe).toEqual([]);
        await page
          .getByRole("tab", {
            name: `Aportaciones (${item.count})`,
            exact: true,
          })
          .click();
        await expect(page).toHaveURL(
          new URL(`${path}?tab=contributions`, baseURL!).href,
        );
        const panel = page.getByRole("tabpanel", {
          name: `Aportaciones (${item.count})`,
          exact: true,
        });
        await expect(
          panel.getByRole("heading", {
            name: `${item.count} ${item.count === 1 ? "aportación" : "aportaciones"}`,
            exact: true,
          }),
        ).toBeVisible();
        if (item.count === 0) {
          await expect(page.locator(".ac-contribution-rail")).toHaveCount(0);
          await expect(
            page.getByRole("heading", { name: "Sin aportaciones vigentes" }),
          ).toBeVisible();
        } else if (item.count === 1) {
          await expect(page.locator(".ac-contribution-rail")).toHaveCount(0);
          await expect(panel.locator(".ac-answer").first()).toBeVisible();
        } else {
          // UX-06: with an open clarification or conflict on a current
          // contribution the narrow layout opens on that contribution (the
          // desktop layout already shows the list and the pane together).
          // The list stays one step away and every check below still runs on it.
          const relevantName = relevantContribution(data);
          if (width < 900 && relevantName) {
            await expect(page.locator(".ac-contribution-pane")).toHaveCount(1);
            await expect(page.locator(".ac-contribution-rail")).toHaveCount(0);
            await expect(
              page.locator(".ac-contribution-pane").getByRole("heading", {
                name: relevantName,
                exact: true,
              }),
            ).toBeVisible();
            await page.screenshot({
              path: `${output}/cp4/${item.id}-${width}-relevant.png`,
            });
            await page
              .getByRole("button", {
                name: `← Volver a ${item.count} aportaciones`,
                exact: true,
              })
              .click();
          }
          await expect(
            page
              .getByRole("list", { name: "Aportaciones vigentes" })
              .getByRole("listitem"),
          ).toHaveCount(item.count);
          if (width >= 900)
            await expect(page.locator(".ac-contribution-pane")).toHaveCount(1);
          else
            await expect(page.locator(".ac-contribution-pane")).toHaveCount(0);
        }
        if (item.count >= 10) {
          await page
            .getByRole("searchbox", { name: "Buscar por actor o área" })
            .fill(current[0]!.respondent.displayName);
          await expect(page.locator(".ac-contribution-count")).toHaveText(
            `1 de ${item.count} aportaciones`,
          );
          await expect(
            page.getByRole("combobox", { name: "Situación de la aportación" }),
          ).toBeVisible();
          await page.getByRole("searchbox").clear();
          await expect(page.locator(".ac-contribution-count")).toHaveText(
            `${item.count} de ${item.count} aportaciones`,
          );
        }
        await page.evaluate(() => scrollTo(0, 0));
        const surface = await surfaceMetrics(page, ".ac-review");
        const containment = await panel.evaluate(
          (root, names) => {
            const elements = [
              ...root.querySelectorAll<HTMLElement>("*"),
            ].filter(
              (el) =>
                el.checkVisibility() &&
                !el.closest('.sr-only,svg,[aria-hidden="true"],option'),
            );
            const childOverflow = elements
              .filter((el) => {
                const parent = el.parentElement;
                if (!parent || getComputedStyle(parent).display === "inline")
                  return false;
                const style = getComputedStyle(el);
                if (style.position === "absolute" || style.position === "fixed")
                  return false;
                const r = el.getBoundingClientRect(),
                  p = parent.getBoundingClientRect();
                return (
                  r.width > 0 &&
                  p.width > 0 &&
                  (r.right > p.right + 2 || r.left < p.left - 2)
                );
              })
              .map((el) => ({
                element: el.className || el.tagName,
                parent: el.parentElement?.className,
              }));
            const squeezedText = elements
              .filter(
                (el) =>
                  el.getBoundingClientRect().height > 0 &&
                  el.getBoundingClientRect().width < 8 &&
                  [...el.childNodes].some(
                    (n) =>
                      n.nodeType === Node.TEXT_NODE &&
                      (n.textContent?.trim().length ?? 0) > 6,
                  ),
              )
              .map((el) => el.className || el.tagName);
            const text = elements
              .flatMap((el) =>
                [...el.childNodes]
                  .filter((n) => n.nodeType === Node.TEXT_NODE)
                  .map((n) => n.textContent ?? ""),
              )
              .join("\n");
            const actorOccurrences = names.map((name) => ({
              name,
              count: text.split(name).length - 1,
            }));
            return { childOverflow, squeezedText, actorOccurrences };
          },
          current.map((s) => s.respondent.displayName),
        );
        expect(containment.childOverflow).toEqual([]);
        expect(containment.squeezedText).toEqual([]);
        for (const actor of containment.actorOccurrences)
          expect(actor.count).toBeLessThanOrEqual(3);
        const geometry = await page.locator(".ac-review").evaluate((root) => {
          const h = root.querySelector("h1")!,
            css = getComputedStyle(h);
          const answer = [
            ...root.querySelectorAll<HTMLElement>(".ac-answer"),
          ].find((e) => e.checkVisibility());
          const rail = root.querySelector<HTMLElement>(".ac-contribution-rail");
          const primary = [
            ...root.querySelectorAll<HTMLElement>(".button.primary"),
          ].filter((e) => e.checkVisibility());
          return {
            questionY: h.getBoundingClientRect().y,
            questionSize: parseFloat(css.fontSize),
            questionWeight: Number(css.fontWeight),
            questionFont: css.fontFamily,
            answerY: answer?.getBoundingClientRect().y ?? null,
            railWidth: rail?.getBoundingClientRect().width ?? null,
            primaryCount: primary.length,
          };
        });
        expect(geometry.primaryCount).toBeLessThanOrEqual(1);
        if (width === 1440) {
          expect(geometry.questionY).toBeLessThanOrEqual(140);
          expect(geometry.questionSize).toBeGreaterThanOrEqual(22);
          expect(geometry.questionSize).toBeLessThanOrEqual(24);
          expect(geometry.questionWeight).toBeGreaterThanOrEqual(600);
          expect(geometry.questionFont).toContain("Plex Sans");
          if (item.count > 0) {
            expect(geometry.answerY).not.toBeNull();
            expect(geometry.answerY!).toBeLessThanOrEqual(640);
          }
        }
        if (width >= 900 && item.count > 1) {
          expect(geometry.railWidth!).toBeGreaterThanOrEqual(280);
          expect(geometry.railWidth!).toBeLessThanOrEqual(340);
        }
        await page.screenshot({
          path: `${output}/cp4/${item.id}-${width}-after.png`,
        });
        if (width < 900 && item.count > 1) {
          const trigger = page.getByRole("button", {
            name: `Abrir aportación de ${current[0]!.respondent.displayName}`,
            exact: true,
          });
          await trigger.focus();
          await page.keyboard.press("Enter");
          await expect(
            page.getByRole("heading", {
              name: current[0]!.respondent.displayName,
              exact: true,
            }),
          ).toBeFocused();
          await expect(page.locator(".ac-contribution-rail")).toHaveCount(0);
          await expect(panel.locator(".ac-answer").first()).toBeVisible();
          await surfaceMetrics(page, ".ac-review");
          await page.screenshot({
            path: `${output}/cp4/${item.id}-${width}-detail.png`,
          });
        }
        const evidence = await panel
          .locator(".ac-evidence-name")
          .evaluateAll((elements) =>
            elements
              .filter((e) => e.checkVisibility())
              .map((el) => ({
                name: el.querySelector("strong")?.textContent,
                width: el.getBoundingClientRect().width,
                size: el.querySelector("span")?.textContent,
              })),
          );
        for (const file of evidence) {
          expect(file.width).toBeGreaterThan(40);
          expect(file.name).toBeTruthy();
          expect(file.size).toMatch(/bytes$/);
        }
        const axe = (
          await new AxeBuilder({ page })
            .withTags([
              "wcag2a",
              "wcag2aa",
              "wcag21a",
              "wcag21aa",
              "wcag22aa",
              "best-practice",
            ])
            .analyze()
        ).violations;
        expect(axe).toEqual([]);
        if (width < 900 && item.count > 1) {
          await page
            .getByRole("button", {
              name: `← Volver a ${item.count} aportaciones`,
              exact: true,
            })
            .click();
          await expect(
            page.getByRole("button", {
              name: `Abrir aportación de ${current[0]!.respondent.displayName}`,
              exact: true,
            }),
          ).toBeFocused();
        }
        if (item.count === 50) {
          const search = page.getByRole("searchbox", {
            name: "Buscar por actor o área",
          });
          const situation = page.getByRole("combobox", {
            name: "Situación de la aportación",
          });
          const list = page.getByRole("list", {
            name: "Aportaciones vigentes",
          });
          await situation.selectOption("clarification");
          await expect(list.getByRole("listitem")).toHaveCount(2);
          await expect(page.locator(".ac-contribution-count")).toHaveText(
            "2 de 50 aportaciones",
          );
          await situation.selectOption("conflict");
          await expect(list.getByRole("listitem")).toHaveCount(0);
          await expect(page.locator(".ac-contribution-count")).toHaveText(
            "0 de 50 aportaciones",
          );
          await situation.selectOption("");
          const area = current[0]!.area.name;
          const expectedAreaCount = current.filter(
            (s) => s.area.name === area,
          ).length;
          await search.fill(area);
          await expect(list.getByRole("listitem")).toHaveCount(
            expectedAreaCount,
          );
          await search.clear();
          const first = list.getByRole("button").first();
          await first.focus();
          await page.keyboard.press("End");
          const last = list.getByRole("button").last();
          await expect(last).toBeFocused();
          await page.keyboard.press("Enter");
          await expect(
            page.getByRole("heading", {
              name: current[49]!.respondent.displayName,
              exact: true,
            }),
          ).toBeFocused();
          await expect(panel.locator(".ac-answer").first()).toBeVisible();
          if (width >= 900) {
            await search.fill(current[0]!.respondent.displayName);
            await expect(
              page.getByRole("heading", {
                name: current[49]!.respondent.displayName,
                exact: true,
              }),
            ).toBeVisible();
            await search.clear();
          } else {
            await page
              .getByRole("button", {
                name: "← Volver a 50 aportaciones",
                exact: true,
              })
              .click();
            await expect(list.getByRole("button").last()).toBeFocused();
          }
        }
        const tabs = page.getByRole("tab", {
          name: `Aportaciones (${item.count})`,
          exact: true,
        });
        // UX-09: the review team always has the four tabs; a read-only
        // reader only gets the ones that have something to show.
        const readOnlyTabs = [
          `Aportaciones (${item.count})`,
          ...(data.conflicts.length > 0 || current.length >= 2
            ? ["Contraste"]
            : []),
          ...(data.validations.length > 0 || data.dispositions.length > 0
            ? ["Decisión"]
            : []),
          ...(data.threads.length > 0 ||
          data.dispositions.length > 0 ||
          data.references.length > 0
            ? ["Historial"]
            : []),
        ];
        await expect(page.getByRole("tab")).toHaveText(
          item.readonly
            ? readOnlyTabs
            : [
                `Aportaciones (${item.count})`,
                "Contraste",
                "Decisión",
                "Historial",
              ],
        );
        const lastTab = page.getByRole("tab").last();
        await tabs.focus();
        await page.keyboard.press("End");
        await expect(lastTab).toBeFocused();
        if (!item.readonly || (await lastTab.innerText()) === "Historial") {
          await expect(lastTab).toHaveText("Historial");
          await expect(
            page.getByRole("heading", { name: "Historial de la pregunta" }),
          ).toBeVisible();
        }
        await page.keyboard.press("Home");
        await expect(tabs).toBeFocused();
        measurements.push({
          id: item.id,
          width,
          height,
          path,
          contributions: item.count,
          backendStatus: data.status,
          openClarifications: data.threads.filter((t) => t.status !== "CLOSED")
            .length,
          missingRequiredRespondents: data.participants.filter(
            (p) =>
              p.required &&
              p.applicability === "ENABLED" &&
              !p.currentRevisionId,
          ).length,
          readonly: item.readonly,
          containment,
          surface,
          geometry,
          evidence,
          axe: axe.length,
          initialAxe: initialAxe.length,
        });
      });
    }
});
