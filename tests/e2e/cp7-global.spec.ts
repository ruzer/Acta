import { test, expect, type Page } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { login } from "./login-helper";
import {
  seedParticipantCases,
  type ParticipantCases,
} from "./fixtures/review-cases";
import {
  checkedPage,
  matrixWidths,
  smallTargets,
} from "./fixtures/page-checks";

// Checkpoint 7 — global consistency (Direction C). The same real browser, real
// API and disposable data as the earlier checkpoints, five widths. What is
// checked is that the organisation screens (projects, administration, members,
// invitations, questionnaire, tools, password, login, 404) share one grammar:
// one page-specific h1 in the same face and scale, one main action, data tables
// that stack into labelled cards on a phone, and no screen of its own.
const folder =
  (process.env.ACTA_DIRECTION_C_EVIDENCE_DIR ??
    "docs/design/acta-direction-c-evidence") + "/cp7";
const records: Record<string, unknown>[] = [];
test.use({
  locale: "es-MX",
  timezoneId: "America/Mexico_City",
  reducedMotion: "reduce",
});
test.describe.configure({ mode: "serial" });
test.afterAll(async () => {
  await mkdir(folder, { recursive: true });
  await writeFile(
    `${folder}/metrics-cp7.json`,
    JSON.stringify({ checkpoint: 7, records }, null, 2) + "\n",
  );
});

let cases: ParticipantCases;
test.beforeAll(async ({ baseURL }) => {
  test.setTimeout(600000);
  cases = await seedParticipantCases(baseURL!);
});
const go = async (page: Page, path: string) => {
  await page.goto(path);
  await expect(page.locator("main h1")).toHaveCount(1);
  await page.evaluate(async () => {
    await document.fonts.ready;
    scrollTo(0, 0);
  });
};
const primaryCount = (page: Page) =>
  page.locator("main .button.primary:visible").count();
const h1Metrics = (page: Page) =>
  page.locator("main h1").evaluate((el) => {
    const css = getComputedStyle(el);
    return {
      text: el.textContent?.trim() ?? "",
      size: parseFloat(css.fontSize),
      weight: Number(css.fontWeight),
      family: css.fontFamily,
    };
  });

test("V-27 · heredadas: una sola h1 propia de la página, con la misma voz y escala, a cinco anchos", async ({
  page,
}) => {
  test.setTimeout(900000);
  const project = cases.project;
  const pages: {
    id: string;
    role: string;
    path: string;
    heading: RegExp;
  }[] = [
    { id: "projects", role: "analyst", path: "/", heading: /^Mis proyectos$/ },
    {
      id: "review-inbox",
      role: "analyst",
      path: "/review",
      heading: /^Revisar respuestas$/,
    },
    {
      id: "attention",
      role: "analyst",
      path: `/projects/${project.id}/dashboard`,
      heading: /^Atención$/,
    },
    {
      id: "questionnaire",
      role: "analyst",
      path: `/projects/${project.id}/editor`,
      heading: /^Cuestionario$/,
    },
    {
      id: "decisions",
      role: "analyst",
      path: `/projects/${project.id}/decisions`,
      heading: /^Decisiones$/,
    },
    {
      id: "invitations",
      role: "analyst",
      path: `/projects/${project.id}/invitations`,
      heading: /^Invitaciones$/,
    },
    {
      id: "members",
      role: "admin",
      path: `/projects/${project.id}/members`,
      heading: /^Miembros del proyecto$/,
    },
    {
      id: "import",
      role: "analyst",
      path: `/projects/${project.id}/import`,
      heading: /^Importar cuestionario$/,
    },
    {
      id: "export",
      role: "analyst",
      path: `/projects/${project.id}/export`,
      heading: /^Exportar proyecto$/,
    },
    {
      id: "history",
      role: "analyst",
      path: `/projects/${project.id}/history`,
      heading: /^Bitácora del proyecto$/,
    },
    {
      id: "traceability",
      role: "analyst",
      path: `/projects/${project.id}/traceability`,
      heading: /^Trazabilidad$/,
    },
    {
      id: "admin",
      role: "admin",
      path: "/admin",
      heading: /^Administración$/,
    },
    {
      id: "password",
      role: "analyst",
      path: "/password",
      heading: /^Cambiar contraseña$/,
    },
    {
      id: "not-found",
      role: "analyst",
      path: "/no-existe",
      heading: /^Página no encontrada$/,
    },
  ];
  let role = "";
  for (const item of pages) {
    if (role !== item.role) {
      await page.context().clearCookies();
      await login(page, item.role);
      role = item.role;
    }
    for (const [width, height] of matrixWidths) {
      await page.setViewportSize({ width, height });
      await go(page, item.path);
      // The data is part of the evidence: wait for the screen to be ready.
      await expect(page.getByText("Cargando…")).toHaveCount(0);
      const h1 = await h1Metrics(page);
      expect(h1.text, `${item.id}: título propio de la página`).toMatch(
        item.heading,
      );
      // UX-02: the project name belongs to the shell, never to the heading.
      expect(h1.text).not.toBe(project.name);
      expect(h1.family, `${item.id}: voz de interfaz`).toContain("Plex Sans");
      expect(h1.size, `${item.id}: escala del título`).toBeGreaterThanOrEqual(
        24,
      );
      expect(h1.size, `${item.id}: escala del título`).toBeLessThanOrEqual(26);
      expect(h1.weight).toBeGreaterThanOrEqual(600);
      await checkedPage(page, folder, `V-27-${item.id}`, width, {
        capture: width === 1440 || width === 390,
      });
      records.push({
        id: `V-27 ${item.id}`,
        width,
        h1: h1.text,
        size: h1.size,
        weight: h1.weight,
      });
    }
  }
});

test("V-23 · tablas de Administración y Miembros: columnas en escritorio, tarjetas con etiqueta en móvil, semántica intacta", async ({
  page,
}) => {
  test.setTimeout(300000);
  await login(page, "admin");
  for (const [width, height] of matrixWidths) {
    await page.setViewportSize({ width, height });
    await go(page, "/admin");
    const table = page.getByRole("table", {
      name: "Usuarios de la institución",
    });
    await expect(table).toBeVisible();
    // Semantics survive the stacked layout: rows, headers and cells exist.
    expect(await table.getByRole("row").count()).toBeGreaterThan(2);
    await expect(
      table.getByRole("columnheader", { name: "Estado" }),
    ).toHaveCount(1);
    expect(await table.getByRole("cell").count()).toBeGreaterThan(6);
    const surface = await page.evaluate(() => {
      const row = document.querySelector<HTMLElement>(".data-table tbody tr")!;
      const state = row.querySelector<HTMLElement>('td[data-label="Estado"]')!;
      const head = document
        .querySelector<HTMLElement>(".data-table thead")!
        .getBoundingClientRect();
      return {
        overflow: document.documentElement.scrollWidth > innerWidth + 1,
        label: getComputedStyle(state, "::before").content,
        display: getComputedStyle(row).display,
        headVisible: head.width > 2 && head.height > 2,
        tableWidth: document
          .querySelector(".data-table")!
          .getBoundingClientRect().width,
      };
    });
    expect(surface.overflow).toBe(false);
    if (width < 760) {
      expect(surface.display, "cada fila es una tarjeta").toBe("block");
      expect(surface.label).toContain("Estado");
      expect(
        surface.headVisible,
        "encabezados solo para lector de pantalla",
      ).toBe(false);
    } else {
      expect(surface.headVisible).toBe(true);
      expect(surface.display).toBe("table-row");
    }
    // The same rule for the project members table.
    await go(page, `/projects/${cases.project.id}/members`);
    await expect(
      page.getByRole("table", { name: "Acceso al proyecto" }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth + 1,
      ),
    ).toBe(false);
    records.push({ id: "V-23 tablas", width, ...surface });
  }
});

test("V-23 · Administración: una acción principal por pestaña, formularios en diálogo y foco de regreso", async ({
  page,
}) => {
  test.setTimeout(300000);
  await login(page, "admin");
  await page.setViewportSize({ width: 1440, height: 900 });
  await go(page, "/admin");
  const create: Record<string, string> = {
    Usuarios: "Crear usuario",
    Áreas: "Crear área",
    Proyectos: "Crear proyecto",
  };
  for (const [tab, action] of Object.entries(create)) {
    await page.getByRole("button", { name: tab, exact: true }).click();
    await expect(
      page.getByRole("button", { name: tab, exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    // One primary control in the page: the action that creates what the tab lists.
    const primaries = page.locator("main .button.primary:visible");
    await expect(primaries).toHaveCount(1);
    await expect(primaries).toHaveText(action);
    const trigger = page.getByRole("button", { name: action, exact: true });
    await trigger.click();
    const dialog = page.getByRole("dialog", { name: action });
    await expect(dialog).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(
      trigger,
      "el foco vuelve a quien abrió el diálogo",
    ).toBeFocused();
  }
  await page.getByRole("button", { name: "Usuarios", exact: true }).click();
  // The dialog form is labelled and does not widen what anyone can see.
  await page.getByRole("button", { name: "Crear usuario" }).click();
  const dialog = page.getByRole("dialog", { name: "Crear usuario" });
  await expect(dialog.getByLabel("Nombre para mostrar")).toBeVisible();
  await expect(dialog.getByLabel("Usuario", { exact: true })).toBeVisible();
  await expect(dialog.getByLabel("Contraseña temporal")).toHaveAttribute(
    "type",
    "password",
  );
  await page.keyboard.press("Escape");
  records.push({ id: "V-23 administración", tabs: Object.keys(create) });
});

test("V-24 · Invitaciones: cabecera de página, estado con texto y color, ayuda plegada", async ({
  page,
}) => {
  test.setTimeout(300000);
  await login(page, "analyst");
  for (const [width, height] of matrixWidths) {
    await page.setViewportSize({ width, height });
    await go(page, `/projects/${cases.project.id}/invitations`);
    await expect(
      page.getByRole("button", { name: "Crear invitación" }),
    ).toBeVisible();
    // One primary control: the one that creates an invitation.
    await expect(page.locator("main .button.primary:visible")).toHaveCount(1);
    // The explanation stays out of the way until it is asked for.
    const help = page.locator("details.ac-help");
    await expect(help).not.toHaveAttribute("open", "");
    await help.locator("summary").click();
    await expect(
      page.getByText(/Abrió» registra el uso del enlace/),
    ).toBeVisible();
    await help.locator("summary").click();
    // The state of the link is text plus an icon, never colour alone.
    const row = page.locator("ul.invitation-management > li").first();
    await expect(
      row.locator(".ac-status", { hasText: "Activo" }),
    ).toBeVisible();
    await expect(row.locator(".ac-status svg").first()).toBeVisible();
    // The end of the link is said in days while it can be used, date under it.
    await expect(row.locator(".ac-expiry")).toHaveText(
      /^Vence (en \d+ días|hoy o mañana)$/,
    );
    await expect(row.locator(".ac-expiry-date")).toBeVisible();
    // Progress is said in words; the bar only repeats it.
    await expect(row.getByText(/\d+ de \d+ preguntas con envío/)).toBeVisible();
    await expect(row.locator(".ac-mini-bar")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
    // Pagination only appears when there is another page.
    await expect(page.getByRole("button", { name: "Siguiente" })).toHaveCount(
      0,
    );
    if (width <= 390)
      expect(await smallTargets(page)).toEqual(
        expect.not.arrayContaining([
          expect.objectContaining({ name: "Crear invitación" }),
        ]),
      );
    const box = await row.boundingBox();
    expect(box!.x + box!.width).toBeLessThanOrEqual(width + 1);
    records.push({ id: "V-24 invitaciones", width, rowWidth: box!.width });
  }
});

test("V-27 · Cuestionario (UX-10): los controles ocupan dos filas y la tabla empieza arriba", async ({
  page,
}) => {
  test.setTimeout(300000);
  await login(page, "analyst");
  for (const [width, height] of matrixWidths) {
    await page.setViewportSize({ width, height });
    await go(page, `/projects/${cases.project.id}/editor`);
    const geometry = await page.evaluate(() => {
      const box = (el: Element | null) => {
        const r = el?.getBoundingClientRect();
        return r ? { x: r.x, y: r.y + scrollY, w: r.width, h: r.height } : null;
      };
      const q = (selector: string) => document.querySelector(selector);
      return {
        mode: box(q('.an-approach [role="group"]')),
        create: box(
          [...document.querySelectorAll(".an-approach > .button")].find(
            (b) => b.textContent?.trim() === "Nueva pregunta",
          ) ?? null,
        ),
        search: box(q(".an-approach .field input")),
        topic: box(q(".qe-outline summary strong")),
        area: box(q(".qe-filters .field select")),
        table: box(q(".ac-questionnaire-table")),
        toggle: box(q(".ac-filter-toggle")),
        toggleVisible: !!q(".ac-filter-toggle")?.checkVisibility(),
      };
    });
    if (width >= 900) {
      // Mode and main action share a row; search and the filters share another.
      expect(
        Math.abs(
          geometry.mode!.y +
            geometry.mode!.h / 2 -
            (geometry.create!.y + geometry.create!.h / 2),
        ),
        "modo y acción principal en la misma fila",
      ).toBeLessThan(10);
      for (const filter of [geometry.topic, geometry.area])
        expect(
          Math.abs(
            filter!.y + filter!.h - (geometry.search!.y + geometry.search!.h),
          ),
          "búsqueda y filtros alineados",
        ).toBeLessThan(10);
      expect(
        geometry.toggleVisible,
        "sin botón Filtros en pantalla ancha",
      ).toBe(false);
    }
    if (width === 1440)
      expect(
        geometry.table!.y,
        "la tabla de preguntas empieza dentro del primer viewport",
      ).toBeLessThanOrEqual(430);
    if (width < 900) {
      expect(geometry.toggleVisible).toBe(true);
      const toggle = page.getByRole("button", { name: "Filtros" });
      await expect(toggle).toHaveAttribute("aria-expanded", "false");
      await toggle.click();
      await expect(toggle).toHaveAttribute("aria-expanded", "true");
      await expect(page.getByLabel("Área responsable")).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(toggle).toBeFocused();
    }
    records.push({
      id: "V-27 cuestionario",
      width,
      tableTop: geometry.table?.y,
    });
  }
});

test("V-27 · Mis proyectos (UX-16): una acción principal por proyecto, lenguaje de cada rol", async ({
  page,
}) => {
  test.setTimeout(300000);
  await login(page, "analyst");
  for (const [width, height] of matrixWidths) {
    await page.setViewportSize({ width, height });
    await go(page, "/");
    await expect(page.locator("main h1")).toHaveText("Mis proyectos");
    const cards = page.locator(".project-list > li");
    expect(await cards.count()).toBeGreaterThan(0);
    for (const card of await cards.all())
      await expect(card.locator("a.button.primary")).toHaveCount(1);
    if (width <= 390) {
      const outside = await page.evaluate(
        () =>
          [...document.querySelectorAll(".project-list > li")].filter(
            (el) => el.getBoundingClientRect().right > innerWidth + 1,
          ).length,
      );
      expect(outside).toBe(0);
    }
    records.push({ id: "V-27 proyectos", width, cards: await cards.count() });
  }
});

test("V-27 · inicio de sesión: la página trata de entrar y la institución se ve sin ser el título", async ({
  browser,
}) => {
  test.setTimeout(300000);
  for (const [width, height] of matrixWidths) {
    const context = await browser.newContext({
      viewport: { width, height },
      locale: "es-MX",
      reducedMotion: "reduce",
    });
    const page = await context.newPage();
    await page.goto("/");
    await expect(
      page.getByRole("heading", { level: 1, name: "Iniciar sesión" }),
    ).toBeVisible();
    await expect(page.locator("h1")).toHaveCount(1);
    await expect(page.locator(".access-institution")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Iniciar sesión", exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth + 1,
      ),
    ).toBe(false);
    await mkdir(folder, { recursive: true });
    await page.screenshot({ path: `${folder}/V-27-login-${width}.png` });
    records.push({ id: "V-27 login", width });
    await context.close();
  }
});

test("V-25 · asistente de invitación: cuatro pasos, acciones al pie del diálogo y foco de regreso", async ({
  page,
}) => {
  test.setTimeout(300000);
  await login(page, "analyst");
  for (const [width, height] of matrixWidths) {
    await page.setViewportSize({ width, height });
    await go(page, `/projects/${cases.project.id}/invitations`);
    const trigger = page.getByRole("button", { name: "Crear invitación" });
    await trigger.click();
    const dialog = page.getByRole("dialog", {
      name: "Invitar mediante enlace",
    });
    await expect(dialog).toBeVisible();
    // Four named steps; the current one is marked for assistive technology.
    const steps = dialog.getByRole("list", { name: "Pasos de la invitación" });
    await expect(steps.getByRole("listitem")).toHaveCount(4);
    await expect(steps.locator('[aria-current="step"]')).toContainText(
      "Destinatario",
    );
    // The recipient data describes the intended person: it is context, not a warning.
    await expect(dialog.locator(".ac-note").first()).toBeVisible();
    const footer = dialog.locator(".next-invitation-step-actions");
    const labels = await footer.getByRole("button").allTextContents();
    expect(labels, "cancelar primero; la acción principal al final").toEqual([
      "Cancelar",
      "Continuar",
    ]);
    await mkdir(folder, { recursive: true });
    await page.screenshot({ path: `${folder}/V-25-asistente-${width}.png` });
    // The footer stays inside the dialog: the action never scrolls away.
    const boxes = await page.evaluate(() => {
      const d = document.querySelector("dialog")!.getBoundingClientRect();
      const f = document
        .querySelector(".next-invitation-step-actions")!
        .getBoundingClientRect();
      return {
        insideTop: f.top >= d.top - 1,
        insideBottom: f.bottom <= d.bottom + 1,
        overflow: document.documentElement.scrollWidth > innerWidth + 1,
      };
    });
    expect(boxes.insideTop && boxes.insideBottom).toBe(true);
    expect(boxes.overflow).toBe(false);
    // Going forward needs the required data; going back is offered only afterwards.
    await dialog.getByLabel("Referencia de la invitación").fill("Revisión CP7");
    await dialog.getByLabel("Nombre de la persona").fill("Persona ficticia");
    await dialog.getByRole("button", { name: "Continuar" }).click();
    await expect(steps.locator('[aria-current="step"]')).toContainText(
      "Preguntas",
    );
    await expect(dialog.getByRole("button", { name: "Atrás" })).toBeVisible();
    expect(await footer.getByRole("button").allTextContents()).toEqual([
      "Cancelar",
      "Atrás",
      "Continuar",
    ]);
    await dialog.getByRole("button", { name: "Cancelar" }).click();
    await expect(dialog).toBeHidden();
    await expect(
      trigger,
      "el foco vuelve al botón que abrió el asistente",
    ).toBeFocused();
    records.push({ id: "V-25 asistente", width });
  }
});

test("V-26 · lector de consulta: la pregunta manda, el estado es un chip y solo hay lo que el servidor entrega", async ({
  page,
}) => {
  test.setTimeout(300000);
  await login(page, "viewer");
  for (const [width, height] of matrixWidths) {
    await page.setViewportSize({ width, height });
    await go(page, `/projects/${cases.project.id}`);
    await expect(page.locator("main h1")).toHaveText("Preguntas publicadas");
    await expect(page.locator(".eyebrow").first()).toContainText("Consulta");
    // Same chip (glyph and word) as everywhere; no controls to answer or validate.
    const cards = page.locator(".ac-viewer-list > li");
    expect(await cards.count()).toBeGreaterThan(0);
    await expect(cards.first().locator(".ac-status")).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Enviar|Guardar|Registrar|Validar/ }),
    ).toHaveCount(0);
    expect(await primaryCount(page)).toBe(0);
    // The question text leads: document voice, larger than its short title.
    const type = await cards.first().evaluate((li) => {
      const q = getComputedStyle(li.querySelector(".question-text")!);
      const t = getComputedStyle(li.querySelector("h3")!);
      return {
        family: q.fontFamily,
        size: parseFloat(q.fontSize),
        titleSize: parseFloat(t.fontSize),
      };
    });
    expect(type.family).toContain("Plex Serif");
    expect(type.size).toBeGreaterThan(type.titleSize);
    await checkedPage(page, folder, "V-26-lector", width, {
      capture: width === 1440 || width === 390,
    });
    if (width <= 390)
      expect(
        (await smallTargets(page)).filter((t) => /Consultar/.test(t.name)),
      ).toEqual([]);
    records.push({ id: "V-26 lector", width, ...type });
  }
});
