import { expect, type Page } from "@playwright/test";

// F3 adds a visible board before the historical queue. Measure its net flow
// footprint without removing it or discounting any of the queue's own spacing.
export async function attentionBoardFootprint(page: Page) {
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() => window.scrollTo(0, 0));
  const board = page.getByRole("region", { name: "Avance del proyecto" });
  await expect(board).toBeVisible();
  await expect(board.locator(".pb-metric")).toHaveCount(4);
  for (const label of [
    "Validadas",
    "Esperando a otras personas",
    "Requieren aclaración",
    "Conflictos",
  ]) {
    const metric = board.getByRole("button", {
      name: new RegExp(`^${label} \\d+`),
    });
    await expect(metric).toBeVisible();
    await expect(metric.locator(".pb-metric-number")).toBeVisible();
  }
  await expect(board.getByRole("img", { name: /^Estados de / })).toBeVisible();
  const geometry = await board.evaluate((element) => {
    const previous = element.previousElementSibling!;
    const attention = element.nextElementSibling!;
    const intro = attention.querySelector(".ac-attention-intro")!;
    const rect = (node: Element) => {
      const { top, bottom, height } = node.getBoundingClientRect();
      return { top, bottom, height };
    };
    const box = rect(element);
    const margin = (node: Element, edge: "marginTop" | "marginBottom") =>
      parseFloat(getComputedStyle(node)[edge]);
    const margins = {
      previousBottom: margin(previous, "marginBottom"),
      boardTop: margin(element, "marginTop"),
      boardBottom: margin(element, "marginBottom"),
      attentionTop: margin(attention, "marginTop"),
      introTop: margin(intro, "marginTop"),
    };
    // These block siblings collapse adjoining margins. The intro's negative
    // top margin also collapses through the unbordered attention section.
    const collapse = (...values: number[]) =>
      Math.max(0, ...values) + Math.min(0, ...values);
    const gapBefore = box.top - rect(previous).bottom;
    const gapAfter = rect(attention).top - box.bottom;
    const historicalGap = collapse(
      margins.previousBottom,
      margins.attentionTop,
      margins.introTop,
    );
    const marginContribution = gapBefore + gapAfter - historicalGap;
    const nav = document.querySelector(".ac-shell-mobile")!;
    return {
      ...box,
      margins,
      gapBefore,
      gapAfter,
      historicalGap,
      marginContribution,
      footprint: box.height + marginContribution,
      expectedGapBefore: collapse(margins.previousBottom, margins.boardTop),
      expectedGapAfter: collapse(
        margins.boardBottom,
        margins.attentionTop,
        margins.introTop,
      ),
      followedByAttention: attention.matches(".ac-attention"),
      metrics: rect(element.querySelector(".pb-metrics")!),
      bar: rect(element.querySelector(".pb-stack")!),
      usableBottom:
        getComputedStyle(nav).display === "none"
          ? innerHeight
          : nav.getBoundingClientRect().top,
      viewportWidth: innerWidth,
    };
  });
  return geometry;
}

export function expectAttentionBoardFootprint(
  geometry: Awaited<ReturnType<typeof attentionBoardFootprint>>,
) {
  // Fail if the layout stops matching this measured block-flow model, rather
  // than silently subtracting unrelated space or making the budget looser.
  expect(geometry.followedByAttention).toBe(true);
  expect(geometry.height).toBeGreaterThan(0);
  expect(
    Math.abs(geometry.gapBefore - geometry.expectedGapBefore),
  ).toBeLessThanOrEqual(1);
  expect(
    Math.abs(geometry.gapAfter - geometry.expectedGapAfter),
  ).toBeLessThanOrEqual(1);
  if (geometry.viewportWidth >= 390) {
    expect(geometry.metrics.top).toBeGreaterThanOrEqual(0);
    expect(geometry.metrics.bottom).toBeLessThanOrEqual(geometry.usableBottom);
    expect(geometry.bar.bottom).toBeLessThanOrEqual(geometry.usableBottom);
  }
}
