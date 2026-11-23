import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { randomUUID } from "node:crypto";
import { dashboardView, reviewStates } from "@requirements/contracts";
import fixture from "../fixtures/analyst-visual.json";

// The real application and Chromium, with a read-only fictional API fixture.
// Every API call is intercepted: this spec cannot mutate the disposable DB.
async function dashboardFixture(page: Page) {
  const projectId = fixture.projectId;
  const base = dashboardView.parse(fixture.dashboard);
  const counts = {
    NOT_REVIEWED: 1,
    PENDING: 1,
    PARTIAL: 46,
    ANSWERED: 6,
    CLARIFICATION_REQUIRED: 14,
    VALIDATED: 17,
    NOT_APPLICABLE: 1,
    CONFLICT: 2,
  };
  const questions = reviewStates.flatMap((status) =>
    Array.from({ length: counts[status] }, (_, index) => ({
      ...base.questions[0]!,
      id: randomUUID(),
      externalId: `P-${reviewStates.indexOf(status) + 1}-${index + 1}`,
      title: `Pregunta ficticia ${reviewStates.indexOf(status) + 1}.${index + 1}`,
      status,
      submittedRespondents: ["NOT_REVIEWED", "PENDING"].includes(status)
        ? 0
        : 1,
      requiredRespondents: status === "PARTIAL" ? 2 : 1,
    })),
  );
  const metric = (numerator: number) => ({
    numerator,
    denominator: 88,
    percentage: Math.round((numerator / 88) * 10000) / 100,
  });
  const metrics = {
    validation: metric(17),
    closure: metric(18),
    submission: metric(86),
  };
  const dashboard = {
    ...base,
    role: "ANALYST",
    projectName: "Revisión de procesos ficticios",
    metrics,
    states: reviewStates.map((status) => ({ status, count: counts[status] })),
    questions,
    breakdowns: [
      {
        dimension: "section",
        key: "section",
        label: "Recepción de solicitudes",
        metrics,
      },
      { dimension: "area", key: "area", label: "Atención al público", metrics },
    ],
  };
  const unexpected: string[] = [];
  let participationRequests = 0;
  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace("/api/v1", "");
    const json = (body: unknown) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(body),
      });
    if (request.method() !== "GET") {
      unexpected.push(`${request.method()} ${path}`);
      return route.abort();
    }
    if (path === "/configuration/public")
      return json({
        appName: "Acta",
        shortName: "Acta",
        organizationName: "Institución ficticia",
        logo: "",
        logoSecondary: "",
        secondaryName: "",
        favicon: "",
        accent: "#2b4d7c",
        locale: "es-MX",
        timezone: "UTC",
      });
    if (path === "/auth/me")
      return json({
        user: {
          id: "6771ed99-97aa-469f-9502-84bb48b86015",
          username: "analista.ficticio",
          displayName: "Analista de prueba",
          active: true,
          isOrganizationAdmin: false,
          mustChangePassword: false,
        },
        organization: {
          id: "ce978577-3ab2-40e6-9afb-c1773823dfb2",
          code: "DEMO",
          name: "Institución ficticia",
        },
        csrfToken: "",
      });
    if (path === "/projects")
      return json([
        {
          id: projectId,
          externalId: "DEMO",
          name: dashboard.projectName,
          description: "",
          lifecycle: "ACTIVE",
          role: "ANALYST",
          lockVersion: 0,
          questionCount: 88,
        },
      ]);
    if (path === `/projects/${projectId}/dashboard`) return json(dashboard);
    if (path === `/projects/${projectId}/response-deadline`)
      return json({ responseDueAt: null, lockVersion: 0 });
    if (path === `/projects/${projectId}/invitations`)
      return json({ items: [], total: 0, page: 1 });
    if (path === `/projects/${projectId}/participation`) {
      participationRequests++;
      return json({
        projectName: dashboard.projectName,
        role: "ANALYST",
        participants: [11, 8, 5, 2, 0].map((pending, index) => ({
          memberId: randomUUID(),
          name: `Persona ficticia ${index + 1}`,
          area: null,
          assigned: 12,
          required: 12,
          drafts: 0,
          sent: 12 - pending,
          pending,
          lastActivity: null,
          state: pending ? "Envió parte" : "Completo",
        })),
      });
    }
    if (path === "/review")
      return json({
        items: questions.map((question) => ({
          questionId: question.id,
          projectId,
          projectName: dashboard.projectName,
          sectionId: question.sectionId,
          sectionTitle: question.sectionTitle,
          question: question.title,
          status: question.status,
          priority: question.priority,
          areaId: question.areaId,
          areaName: question.areaName,
          respondents: [],
          lastContributionAt: null,
          hasEvidence: false,
          openClarifications:
            question.status === "CLARIFICATION_REQUIRED" ? 1 : 0,
        })),
        total: 88,
        page: 1,
        pageSize: 100,
        filters: { projects: [], sections: [], areas: [], participants: [] },
      });
    unexpected.push(`${request.method()} ${path}`);
    return route.abort();
  });
  return {
    projectId,
    unexpected,
    setValidated: (value: number) => {
      const difference = value - dashboard.metrics.validation.numerator;
      dashboard.metrics = { ...dashboard.metrics, validation: metric(value) };
      dashboard.states = dashboard.states.map((state) => ({
        ...state,
        count:
          state.count +
          (state.status === "VALIDATED"
            ? difference
            : state.status === "PARTIAL"
              ? -difference
              : 0),
      }));
      dashboard.breakdowns = dashboard.breakdowns.map((row) => ({
        ...row,
        metrics: dashboard.metrics,
      }));
    },
    participationRequests: () => participationRequests,
  };
}

test.use({ locale: "es-MX", reducedMotion: "reduce", actionTimeout: 15000 });
for (const colorScheme of ["light", "dark"] as const) {
  for (const [width, height] of [
    [1440, 900],
    [390, 844],
    [320, 640],
  ] as const) {
    test(`F3.6 Atención: cifras, barra y accesibilidad a ${width}px (${colorScheme})`, async ({
      page,
    }, testInfo) => {
      const data = await dashboardFixture(page);
      await page.setViewportSize({ width, height });
      await page.emulateMedia({ colorScheme });
      await page.goto(`/projects/${data.projectId}/dashboard`);
      const board = page.getByRole("region", { name: "Avance del proyecto" });
      await expect(board).toBeVisible();
      await expect(
        board.getByRole("button", { name: /^Validadas 17 de 88/ }),
      ).toBeVisible();
      await expect(
        board.getByRole("button", { name: /^Esperando a otras personas 46/ }),
      ).toBeVisible();
      await expect(
        board.getByRole("button", { name: /^Requieren aclaración 14/ }),
      ).toBeVisible();
      await expect(
        board.getByRole("button", { name: /^Conflictos 2/ }),
      ).toBeVisible();
      await expect(board.getByText("Persona ficticia 1")).toBeVisible();
      await expect(page.locator(".ac-attention-group").first()).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      await page.evaluate(() => window.scrollTo(0, 0));
      const geometry = await page.evaluate(() => {
        const rect = (selector: string) => {
          const node = document.querySelector(selector)!;
          const box = node.getBoundingClientRect();
          return {
            top: box.top,
            bottom: box.bottom,
            width: box.width,
            height: box.height,
          };
        };
        const nav = document.querySelector(".ac-shell-mobile")!;
        return {
          pageWidth: document.documentElement.scrollWidth,
          pageHeight: document.documentElement.scrollHeight,
          usableBottom:
            getComputedStyle(nav).display === "none"
              ? innerHeight
              : nav.getBoundingClientRect().top,
          metrics: rect(".pb-metrics"),
          bar: rect(".pb-stack"),
          legend: rect(".pb-legend"),
          firstGroup: rect(".ac-attention-group"),
          buttons: [...document.querySelectorAll(".pb-metric")].map((node) => {
            const box = node.getBoundingClientRect();
            return { width: box.width, height: box.height };
          }),
        };
      });
      expect(geometry.pageWidth).toBeLessThanOrEqual(width);
      for (const button of geometry.buttons) {
        expect(button.width).toBeGreaterThanOrEqual(44);
        expect(button.height).toBeGreaterThanOrEqual(44);
      }
      if (width >= 390) {
        expect(geometry.metrics.top).toBeGreaterThanOrEqual(0);
        expect(geometry.metrics.bottom).toBeLessThanOrEqual(
          geometry.usableBottom,
        );
        expect(geometry.bar.bottom).toBeLessThanOrEqual(geometry.usableBottom);
        expect(geometry.legend.bottom).toBeLessThanOrEqual(
          geometry.usableBottom,
        );
      }
      const axe = await new AxeBuilder({ page })
        .include(".pb-board")
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
      await testInfo.attach("medidas-tablero", {
        body: JSON.stringify(geometry, null, 2),
        contentType: "application/json",
      });
      await testInfo.attach(`tablero-${width}-${colorScheme}`, {
        body: await page.screenshot(),
        contentType: "image/png",
      });
      const topic = board
        .locator(".pb-breakdown")
        .filter({ has: page.locator("summary", { hasText: "Por tema" }) });
      await topic.locator("summary").focus();
      await page.keyboard.press("Enter");
      await expect(topic).toHaveAttribute("open", "");
      await page.keyboard.press("Space");
      await expect(topic).not.toHaveAttribute("open", "");
      await board
        .getByRole("button", { name: /^Requieren aclaración 14/ })
        .click();
      await expect(page).toHaveURL(/status=CLARIFICATION_REQUIRED/);
      await expect(page.getByLabel("Filtrar estado")).toHaveValue(
        "CLARIFICATION_REQUIRED",
      );
      expect(data.participationRequests()).toBe(1);
      expect(data.unexpected).toEqual([]);
    });
  }
}

type MotionRecord = {
  target: string;
  duration: number;
  easing: string;
  frames: Record<string, unknown>[];
};
type MotionEvidence = {
  animations: MotionRecord[];
  scrolls: { time: number; top: number }[];
};
type MotionWindow = Window & { f3Motion: MotionEvidence };
async function observeMotion(page: Page) {
  await page.addInitScript(() => {
    const evidence: MotionEvidence = { animations: [], scrolls: [] };
    (window as MotionWindow).f3Motion = evidence;
    const seen = new WeakSet<Animation>();
    let scrollStart: number | null = null;
    window.addEventListener(
      "click",
      (event) => {
        if (
          event.target instanceof Element &&
          event.target.closest(".pb-metric")
        ) {
          scrollStart = performance.now();
          evidence.scrolls = [];
        }
      },
      true,
    );
    const record = (now: number) => {
      for (const animation of document.getAnimations()) {
        const effect = animation.effect;
        if (
          !(effect instanceof KeyframeEffect) ||
          !(effect.target instanceof Element) ||
          !effect.target.closest(".pb-board,.pb-list-emphasis")
        )
          continue;
        if (seen.has(animation)) continue;
        seen.add(animation);
        const timing = effect.getTiming();
        evidence.animations.push({
          target:
            effect.target.getAttribute("data-pb-motion") ??
            effect.target.className,
          duration: Number(timing.duration),
          easing: timing.easing,
          frames: effect
            .getKeyframes()
            .map((frame) =>
              Object.fromEntries(
                Object.entries(frame).filter(
                  ([key]) =>
                    ![
                      "offset",
                      "computedOffset",
                      "easing",
                      "composite",
                    ].includes(key),
                ),
              ),
            ),
        });
      }
      if (scrollStart !== null && now - scrollStart <= 1100)
        evidence.scrolls.push({ time: now - scrollStart, top: scrollY });
      requestAnimationFrame(record);
    };
    requestAnimationFrame(record);
  });
}
async function motionEvidence(page: Page) {
  return page.evaluate(() => (window as MotionWindow).f3Motion);
}
async function snapshotSaved(page: Page, projectId: string, value: number) {
  await expect
    .poll(() =>
      page.evaluate(
        ({ projectId }) => {
          const raw = sessionStorage.getItem(
            `acta-ux:6771ed99-97aa-469f-9502-84bb48b86015:${projectId}:progress`,
          );
          return raw ? JSON.parse(raw).values["value:VALIDATED"].value : null;
        },
        { projectId },
      ),
    )
    .toBe(value);
}

test("F3.7: solo los cambios entre visitas animan transform y opacity con duración medida", async ({
  page,
}, testInfo) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await observeMotion(page);
  const data = await dashboardFixture(page);
  await page.goto(`/projects/${data.projectId}/dashboard`);
  await snapshotSaved(page, data.projectId, 17);
  expect((await motionEvidence(page)).animations).toEqual([]);
  await page.mouse.click(10, 10);
  await page.reload();
  await snapshotSaved(page, data.projectId, 17);
  expect((await motionEvidence(page)).animations).toEqual([]);
  data.setValidated(18);
  await page.mouse.click(10, 10);
  await page.reload();
  await snapshotSaved(page, data.projectId, 18);
  await expect
    .poll(async () => (await motionEvidence(page)).animations.length)
    .toBeGreaterThan(0);
  const evidence = await motionEvidence(page);
  expect(evidence.animations.some((item) => item.duration === 250)).toBe(true);
  expect(evidence.animations.some((item) => item.duration === 380)).toBe(true);
  for (const item of evidence.animations) {
    expect([250, 380]).toContain(item.duration);
    expect(item.easing.replaceAll(" ", "")).toBe("cubic-bezier(0.22,1,0.36,1)");
    for (const frame of item.frames)
      expect(
        Object.keys(frame).every((key) =>
          ["transform", "opacity"].includes(key),
        ),
      ).toBe(true);
  }
  expect(
    evidence.animations.filter((item) => item.target === "value:CONFLICT"),
  ).toEqual([]);
  await testInfo.attach("movimiento-entre-visitas", {
    body: JSON.stringify(evidence, null, 2),
    contentType: "application/json",
  });
  expect(data.unexpected).toEqual([]);
});

test("F3.7: reduced-motion cambia al instante y usa resalte estático600ms", async ({
  page,
}, testInfo) => {
  await observeMotion(page);
  const data = await dashboardFixture(page);
  await page.goto(`/projects/${data.projectId}/dashboard`);
  await snapshotSaved(page, data.projectId, 17);
  data.setValidated(18);
  await page.addInitScript(() => {
    const w = window as Window & {
      f3Highlight?: { start: number; end: number };
    };
    let start: number | null = null;
    const record = (now: number) => {
      if (document.querySelector(".pb-changed")) start ??= now;
      else if (start !== null) {
        w.f3Highlight = { start, end: now };
        return;
      }
      requestAnimationFrame(record);
    };
    requestAnimationFrame(record);
  });
  await page.reload();
  await snapshotSaved(page, data.projectId, 18);
  await expect
    .poll(() =>
      page.evaluate(
        () => (window as Window & { f3Highlight?: unknown }).f3Highlight,
      ),
    )
    .toBeTruthy();
  const highlight = await page.evaluate(
    () =>
      (window as Window & { f3Highlight?: { start: number; end: number } })
        .f3Highlight!,
  );
  expect(highlight.end - highlight.start).toBeGreaterThanOrEqual(570);
  expect(highlight.end - highlight.start).toBeLessThanOrEqual(650);
  expect((await motionEvidence(page)).animations).toEqual([]);
  await testInfo.attach("resalte-reduced-motion", {
    body: JSON.stringify(highlight),
    contentType: "application/json",
  });
  expect(data.unexpected).toEqual([]);
});

test("F3.7: clic desplaza250ms y contorno800ms; teclado no anima", async ({
  page,
}, testInfo) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await observeMotion(page);
  const data = await dashboardFixture(page);
  await page.goto(`/projects/${data.projectId}/dashboard`);
  await snapshotSaved(page, data.projectId, 17);
  await page.getByRole("button", { name: /^Requieren aclaración 14/ }).click();
  await expect(page).toHaveURL(/status=CLARIFICATION_REQUIRED/);
  await expect
    .poll(
      async () =>
        (await motionEvidence(page)).animations.find(
          (item) => item.target === "pb-list-outline",
        )?.duration,
    )
    .toBe(800);
  await expect(page.locator(".pb-list-outline")).toHaveCount(0);
  const evidence = await motionEvidence(page);
  const outline = evidence.animations.find(
    (item) => item.target === "pb-list-outline",
  )!;
  expect(outline.frames.map((frame) => Object.keys(frame))).toEqual([
    ["opacity"],
    ["opacity"],
  ]);
  const moving = evidence.scrolls.filter(
    (sample, index) =>
      index > 0 &&
      Math.abs(sample.top - evidence.scrolls[index - 1]!.top) >= 0.1,
  );
  expect(moving.length).toBeGreaterThan(2);
  // Animation frames quantize the exact250ms program duration by up to two frames.
  expect(moving.at(-1)!.time).toBeGreaterThanOrEqual(230);
  expect(moving.at(-1)!.time).toBeLessThanOrEqual(320);
  await testInfo.attach("desplazamiento-y-contorno", {
    body: JSON.stringify(evidence, null, 2),
    contentType: "application/json",
  });
  await page.evaluate(() => {
    (window as MotionWindow).f3Motion.animations = [];
  });
  await page.getByRole("button", { name: /^Conflictos 2/ }).focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/status=CONFLICT/);
  await expect(page.locator("#dashboard-questions")).toBeInViewport();
  expect((await motionEvidence(page)).animations).toEqual([]);
  await expect(page.locator(".pb-list-outline")).toHaveCount(0);
  expect(data.unexpected).toEqual([]);
});

test("F3.7 regresión: entrar desde Participación con Enter no anima los valores nuevos", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await observeMotion(page);
  const data = await dashboardFixture(page);
  await page.goto(`/projects/${data.projectId}/dashboard`);
  await snapshotSaved(page, data.projectId, 17);
  await page.locator(".pb-blockers a").focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("heading", { name: "Participación", exact: true }),
  ).toBeVisible();
  data.setValidated(18);
  await page
    .getByRole("link", { name: "Volver a Atención", exact: true })
    .focus();
  await page.keyboard.press("Enter");
  await snapshotSaved(page, data.projectId, 18);
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
  expect((await motionEvidence(page)).animations).toEqual([]);
  expect(data.unexpected).toEqual([]);
});

test("F3.7 regresión: primer filtro reducido resalta600ms el encabezado conectado de la nueva lista", async ({
  page,
}, testInfo) => {
  await observeMotion(page);
  const data = await dashboardFixture(page);
  await page.goto(`/projects/${data.projectId}/dashboard`);
  await snapshotSaved(page, data.projectId, 17);
  await page.evaluate(() => {
    const w = window as Window & {
      f3FilterHighlight?: { start: number; end: number; heading: string };
    };
    let start: number | null = null;
    let heading = "";
    const record = (now: number) => {
      const node = document.querySelector(".ac-attention-group h2.pb-changed");
      if (node?.isConnected) {
        start ??= now;
        heading = node.textContent ?? "";
      } else if (start !== null) {
        w.f3FilterHighlight = { start, end: now, heading };
        return;
      }
      requestAnimationFrame(record);
    };
    requestAnimationFrame(record);
  });
  await page.getByRole("button", { name: /^Validadas 17 de 88/ }).click();
  await expect(page).toHaveURL(/status=VALIDATED/);
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as Window & { f3FilterHighlight?: unknown })
            .f3FilterHighlight,
      ),
    )
    .toBeTruthy();
  const timing = await page.evaluate(
    () =>
      (
        window as Window & {
          f3FilterHighlight: { start: number; end: number; heading: string };
        }
      ).f3FilterHighlight,
  );
  expect(timing.heading).not.toBe("");
  expect(timing.end - timing.start).toBeGreaterThanOrEqual(570);
  expect(timing.end - timing.start).toBeLessThanOrEqual(650);
  expect((await motionEvidence(page)).animations).toEqual([]);
  await testInfo.attach("resalte-de-lista-filtrada", {
    body: JSON.stringify(timing),
    contentType: "application/json",
  });
  expect(data.unexpected).toEqual([]);
});

test("F3.7 regresión: sesión401 al recargar retira las cifras guardadas de esa sesión", async ({
  page,
}) => {
  const data = await dashboardFixture(page);
  await page.goto(`/projects/${data.projectId}/dashboard`);
  await snapshotSaved(page, data.projectId, 17);
  await page.route("**/api/v1/auth/me", (route) =>
    route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({ message: "Sesión expirada de prueba" }),
    }),
  );
  await page.route("**/api/v1/setup/status", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ state: "COMPLETED" }),
    }),
  );
  await page.route("**/api/v1/auth/context", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        mode: "single-organization",
        institutionName: "Institución ficticia",
      }),
    }),
  );
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Iniciar sesión", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(() =>
      Object.keys(sessionStorage).filter((key) => key.startsWith("acta-ux:")),
    ),
  ).toEqual([]);
  expect(data.unexpected).toEqual([]);
});
