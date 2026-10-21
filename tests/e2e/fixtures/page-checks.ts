import { expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdir } from "node:fs/promises";

/** The widths of the acceptance matrix (CODEX-VISUAL-ACCEPTANCE §6.8). */
export const matrixWidths = [
  [1440, 900],
  [1024, 768],
  [768, 1024],
  [390, 844],
  [320, 640],
] as const;

export const axeTags = [
  "wcag2a",
  "wcag2aa",
  "wcag21a",
  "wcag21aa",
  "wcag22aa",
  "best-practice",
];

/**
 * What every screen must satisfy at every width: no axe violations (automatic
 * scope only; it is not WCAG conformance), no horizontal page scroll, one h1,
 * no child sticking out of its container, no text squeezed to nothing.
 * Takes the capture that goes into the evidence folder.
 */
export async function checkedPage(
  page: Page,
  folder: string,
  id: string,
  width: number,
  options: { capture?: boolean } = {},
) {
  const axe = await new AxeBuilder({ page }).withTags(axeTags).analyze();
  expect(
    axe.violations.map((v) => `${v.id}: ${v.nodes.length}`),
    `axe en ${id} a ${width}px`,
  ).toEqual([]);
  const surface = await page.evaluate(() => ({
    overflow: document.documentElement.scrollWidth > innerWidth + 1,
    h1: document.querySelectorAll("main h1").length,
  }));
  expect(surface.overflow, `desborde horizontal en ${id} a ${width}px`).toBe(
    false,
  );
  expect(surface.h1, `un único h1 en ${id}`).toBe(1);
  const contained = await containment(page);
  expect(
    contained.childOverflow,
    `hijos fuera de su contenedor en ${id}`,
  ).toEqual([]);
  expect(contained.squeezedText, `texto colapsado en ${id}`).toEqual([]);
  if (options.capture !== false) {
    await mkdir(folder, { recursive: true });
    await page.screenshot({ path: `${folder}/${id}-${width}.png` });
  }
}

/** Children that cross their parent's box, and visible text squeezed to a sliver. */
export async function containment(page: Page, root = "main") {
  return page
    .locator(root)
    .first()
    .evaluate((container) => {
      // The visually-hidden pattern (a 1px clipped box, kept for screen
      // readers) is on purpose and not a collapsed text.
      const visuallyHidden = (el: HTMLElement) => {
        const style = getComputedStyle(el);
        return (
          style.position === "absolute" &&
          parseFloat(style.width) <= 1 &&
          style.overflow === "hidden"
        );
      };
      const hiddenByPattern = (el: HTMLElement) => {
        for (let n: HTMLElement | null = el; n && n !== container;)
          if (visuallyHidden(n)) return true;
          else n = n.parentElement;
        return false;
      };
      const elements = [...container.querySelectorAll<HTMLElement>("*")].filter(
        (el) =>
          el.checkVisibility() &&
          !hiddenByPattern(el) &&
          !el.closest(
            '.sr-only,svg,[aria-hidden="true"],option,details:not([open]) > :not(summary)',
          ),
      );
      const childOverflow = elements
        .filter((el) => {
          const parent = el.parentElement;
          if (!parent || getComputedStyle(parent).display === "inline")
            return false;
          const style = getComputedStyle(el);
          if (style.position === "absolute" || style.position === "fixed")
            return false;
          if (style.position === "sticky") return false;
          const r = el.getBoundingClientRect(),
            p = parent.getBoundingClientRect();
          return (
            r.width > 0 &&
            p.width > 0 &&
            (r.right > p.right + 2 || r.left < p.left - 2)
          );
        })
        .map((el) => `${el.tagName}.${el.className}`);
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
        .map((el) => `${el.tagName}.${el.className}`);
      return { childOverflow, squeezedText };
    });
}

/** Interactive targets below 44 px on small screens (standalone links count; links in running text do not). */
export async function smallTargets(page: Page) {
  return page.evaluate(() =>
    [
      ...document.querySelectorAll<HTMLElement>(
        "a[href], button, summary, select, input:not([type=hidden])",
      ),
    ]
      .filter(
        (el) =>
          el.checkVisibility() && !el.closest('.sr-only,[aria-hidden="true"]'),
      )
      .filter(
        (el) =>
          !(
            el.tagName === "A" &&
            el.closest("p, li") &&
            getComputedStyle(el).display === "inline"
          ),
      )
      .map((el) => {
        const r = el.getBoundingClientRect();
        return {
          name: (el.getAttribute("aria-label") ?? el.textContent ?? "")
            .trim()
            .slice(0, 40),
          w: Math.round(r.width),
          h: Math.round(r.height),
        };
      })
      .filter((t) => t.w > 0 && (t.h < 44 || t.w < 44)),
  );
}
