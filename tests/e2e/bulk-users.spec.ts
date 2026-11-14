import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { login } from "./login-helper";
// No trazas/capturas automáticas durante la entrega de credenciales, aunque sean ficticias.
test.use({ trace: "off", screenshot: "off", video: "off" });
async function call(page: Page, path: string, body?: unknown) {
  return page.evaluate(
    async ({ path, body }) => {
      const me = await (await fetch("/api/v1/auth/me")).json();
      const response = await fetch("/api/v1" + path, {
        method: body ? "POST" : "GET",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": me.csrfToken,
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      if (!response.ok)
        throw new Error(`Operación de fixture falló: ${response.status}`);
      return response.json();
    },
    { path, body },
  );
}
async function fixture(page: Page) {
  await login(page, "admin");
  const code = "BULK-" + randomUUID().slice(0, 8);
  const project = await call(page, "/projects", {
    externalId: code,
    name: "Proyecto ficticio de accesos",
    description: "",
  });
  const area = await call(page, "/areas", {
    code: "BULK-" + randomUUID().slice(0, 8),
    name: "Área ficticia de ejemplo",
  });
  return { project, area };
}
async function capture(page: Page, name: string) {
  if (!process.env.ACTA_BULK_EVIDENCE_DIR) return;
  await mkdir(process.env.ACTA_BULK_EVIDENCE_DIR, { recursive: true });
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.getByRole("dialog").evaluate((dialog) => {
      dialog.scrollTo(0, 0);
    });
    await page.screenshot({
      path: `${process.env.ACTA_BULK_EVIDENCE_DIR}/${name}-${width}.png`,
      mask: [page.locator("[data-secret]")],
    });
    if (name === "usuarios-entrega") {
      await page
        .getByRole("button", { name: "Imprimir hoja de entrega" })
        .scrollIntoViewIfNeeded();
      await page.screenshot({
        path: `${process.env.ACTA_BULK_EVIDENCE_DIR}/${name}-imprimir-${width}.png`,
        mask: [page.locator("[data-secret]")],
      });
    }
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
}
test("usuarios en lote: corrección, teclado, entrega privada, impresión explícita y cambio obligatorio", async ({
  page,
  browser,
}) => {
  const { project, area } = await fixture(page);
  const prefix = "u" + randomUUID().slice(0, 8);
  const text = `Usuario\tNombre\tProyecto\tRol\tÁrea\n${prefix}a\tPersona ficticia A\t${project.externalId}\tParticipante\t${area.code}\n${prefix}b\tPersona ficticia B\t${project.externalId}\tConsulta\t`;
  const messages: string[] = [];
  page.on("console", (msg) => messages.push(msg.text()));
  try {
    await page.goto("/admin");
    await page
      .getByRole("button", { name: "Crear varios usuarios", exact: true })
      .focus();
    await page.keyboard.press("Enter");
    await expect(
      page.getByRole("textbox", { name: "Tabla de usuarios", exact: true }),
    ).toBeFocused();
    await page
      .getByRole("textbox", { name: "Tabla de usuarios", exact: true })
      .fill(text.replace("Participante", "Rol no admitido"));
    await page
      .getByRole("button", { name: "Revisar usuarios", exact: true })
      .click();
    await expect(page.getByRole("link", { name: /Fila 2, Rol/ })).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Crear 2 cuentas y sus membresías" }),
    ).toBeDisabled();
    await page
      .getByRole("textbox", { name: "Tabla de usuarios", exact: true })
      .fill(text);
    await page
      .getByRole("button", { name: "Revisar usuarios", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Revisar el lote" }),
    ).toBeFocused();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await capture(page, "usuarios-vista-previa");
    await page
      .getByRole("button", { name: "Crear 2 cuentas y sus membresías" })
      .click();
    await expect(
      page.getByRole("heading", { name: "Entrega de acceso" }),
    ).toBeFocused();
    const secrets = await page
      .locator(".bulk-user-delivery [data-secret]")
      .allTextContents();
    expect(
      secrets.every((p) =>
        /^[A-HJ-NP-Za-km-z2-9]{4}(?:-[A-HJ-NP-Za-km-z2-9]{4}){3}$/.test(p),
      ),
    ).toBe(true);
    const saved = await page.evaluate(() =>
      JSON.stringify({
        local: { ...localStorage },
        session: { ...sessionStorage },
        history: history.state,
        url: location.href,
      }),
    );
    expect(
      secrets.every(
        (p) => !saved.includes(p) && !messages.join("\n").includes(p),
      ),
    ).toBe(true);
    await capture(page, "usuarios-entrega");
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.emulateMedia({ media: "print" });
    expect(await page.locator(".bulk-user-delivery").isVisible()).toBe(false);
    await page.emulateMedia({ media: "screen" });
    const printResult = await page.evaluate(() => {
      let result = { calls: 0, sheets: 0, labels: false };
      window.print = () => {
        result = {
          calls: result.calls + 1,
          sheets: document.querySelectorAll(".bulk-users-sheet").length,
          labels: [...document.querySelectorAll(".bulk-users-sheet")].every(
            (e) =>
              e.textContent?.includes("Contraseña temporal") &&
              e.textContent?.includes("primer acceso"),
          ),
        };
      };
      (window as unknown as { readPrint: () => typeof result }).readPrint =
        () => result;
      return result;
    });
    expect(printResult.calls).toBe(0);
    await page
      .getByRole("button", { name: "Imprimir hoja de entrega" })
      .click();
    expect(
      await page.evaluate(() =>
        (window as unknown as { readPrint: () => unknown }).readPrint(),
      ),
    ).toEqual({ calls: 1, sheets: 2, labels: true });
    await expect(page.locator(".bulk-users-print")).toHaveCount(0);
    // El acceso usa la contraseña en una sesión aparte; no se incorpora a errores ni capturas.
    const context = await browser.newContext({ baseURL: process.env.E2E_URL });
    try {
      const response = await context.request.post("/api/v1/auth/login", {
        headers: { Origin: process.env.E2E_URL! },
        data: { username: prefix + "a", password: secrets[0] },
      });
      expect(response.status()).toBe(201);
      const session = await response.json();
      expect(session.user.mustChangePassword).toBe(true);
      const participant = await context.newPage();
      await participant.goto("/");
      await expect(
        participant.getByRole("heading", {
          name: "Cambia tu contraseña temporal",
        }),
      ).toBeVisible();
      await participant.getByLabel("Contraseña actual").fill(secrets[0]!);
      await participant
        .getByLabel("Nueva contraseña", { exact: true })
        .fill(randomUUID());
      await participant
        .getByLabel("Repetir nueva contraseña")
        .fill(
          await participant
            .getByLabel("Nueva contraseña", { exact: true })
            .inputValue(),
        );
      await participant
        .getByRole("button", { name: "Actualizar contraseña" })
        .click();
      await expect(
        participant.getByRole("heading", { name: "Iniciar sesión" }),
      ).toBeVisible();
    } finally {
      await context.close();
    }
    await page.getByRole("button", { name: "Cerrar entrega" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await page
      .getByRole("button", { name: "Crear varios usuarios", exact: true })
      .click();
    await expect(
      page.getByRole("textbox", { name: "Tabla de usuarios", exact: true }),
    ).toHaveValue("");
    await expect(
      page.getByRole("heading", { name: "Entrega de acceso" }),
    ).toHaveCount(0);
    await page.keyboard.press("Escape");
    await expect(
      page.getByRole("button", { name: "Crear varios usuarios", exact: true }),
    ).toBeFocused();
  } finally {
    await page
      .evaluate(() => {
        document
          .querySelectorAll("[data-secret]")
          .forEach((e) => (e.textContent = "[oculto]"));
        document
          .querySelectorAll("input[type=password]")
          .forEach((e) => ((e as HTMLInputElement).value = ""));
      })
      .catch(() => undefined);
  }
});
test("una confirmación cuya respuesta se pierde no vuelve a entregar las claves", async ({
  page,
}) => {
  const { project } = await fixture(page);
  const username = "u" + randomUUID().slice(0, 8);
  await page.goto("/admin");
  await page
    .getByRole("button", { name: "Crear varios usuarios", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Tabla de usuarios", exact: true })
    .fill(
      `Usuario\tNombre\tProyecto\tRol\tÁrea\n${username}\tPersona ficticia\t${project.externalId}\tConsulta\t`,
    );
  await page
    .getByRole("button", { name: "Revisar usuarios", exact: true })
    .click();
  let first = true;
  await page.route("**/api/v1/users/bulk/confirm", async (route) => {
    if (first) {
      first = false;
      await route.fetch();
      await route.abort("failed");
    } else await route.continue();
  });
  await page
    .getByRole("button", { name: "Crear 1 cuentas y sus membresías" })
    .click();
  await expect(page.getByRole("alert")).toContainText("No hay conexión");
  await page
    .getByRole("button", { name: "Crear 1 cuentas y sus membresías" })
    .click();
  await expect(
    page.getByRole("status").filter({ hasText: "Este lote ya se confirmó" }),
  ).toContainText("Este lote ya se confirmó");
  await expect(
    page.getByRole("button", { name: "Imprimir hoja de entrega" }),
  ).toHaveCount(0);
  await expect(page.locator("[data-secret]")).toHaveCount(0);
});

test("lote accesible: ejemplo alineado y acciones juntas a 1280, 800, 640 y 390 px", async ({
  page,
}) => {
  await fixture(page);
  for (const width of [1280, 800, 640, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/admin");
    const header = page.locator(".ac-page-header");
    const single = header.getByRole("button", {
      name: "Crear usuario",
      exact: true,
    });
    const bulk = header.getByRole("button", {
      name: "Crear varios usuarios",
      exact: true,
    });
    await expect(single).toBeVisible();
    await expect(bulk).toBeVisible();
    const a = (await single.boundingBox())!,
      b = (await bulk.boundingBox())!;
    if (width < 640) expect(b.y).toBeGreaterThanOrEqual(a.y + a.height);
    else expect(Math.abs(a.y - b.y)).toBeLessThan(2);
    await bulk.focus();
    await page.keyboard.press("Enter");
    const example = page.getByRole("table", {
      name: "Ejemplo de tabla de usuarios",
    });
    await expect(example.getByRole("columnheader")).toHaveCount(5);
    const region = page.getByRole("region", {
      name: "Ejemplo de tabla de usuarios",
    });
    await region.focus();
    await expect(region).toBeFocused();
    for (let i = 0; i < 20; i++) await region.press("ArrowRight");
    await expect(
      example.getByRole("cell", { name: "AREA-DEMO", exact: true }),
    ).toBeInViewport();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.keyboard.press("Escape");
  }
});

test("50 filas compactas, tarjetas móviles y errores ordenados que enfocan su celda", async ({
  page,
}) => {
  const { project, area } = await fixture(page);
  const prefix = "p" + randomUUID().slice(0, 8);
  const header = "Usuario\tNombre\tProyecto\tRol\tÁrea\n";
  const errors =
    header +
    [
      `${prefix}2\tPersona 2\tFALTA\tConsulta\t`,
      `x\tPersona 3\t${project.externalId}\tConsulta\t`,
      `${prefix}4\tPersona 4\tFALTA\tRol inválido\tFALTA\textra`,
    ].join("\n");
  const fifty =
    header +
    Array.from(
      { length: 50 },
      (_, i) =>
        `${prefix}.${i}\tPersona ficticia ${i + 1}\t${project.externalId}\tParticipante\t${area.code}`,
    ).join("\n");
  await page.goto("/admin");
  await page
    .getByRole("button", { name: "Crear varios usuarios", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Tabla de usuarios", exact: true })
    .fill(errors);
  await page
    .getByRole("button", { name: "Revisar usuarios", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Revisar el lote" }),
  ).toBeFocused();
  const messages = await page
    .getByRole("alert")
    .getByRole("listitem")
    .allTextContents();
  expect(messages.map((t) => t.match(/^Fila \d+, [^:]+/)?.[0])).toEqual([
    "Fila 4, Fila",
    "Fila 2, Proyecto",
    "Fila 3, Usuario",
    "Fila 4, Proyecto",
    "Fila 4, Rol",
    "Fila 4, Área",
  ]);
  const link = page.getByRole("link", { name: /Fila 4, Área:/ });
  await link.focus();
  await page.keyboard.press("Enter");
  const cell = page.locator("#bulk-cell-4-Área");
  await expect(cell).toBeFocused();
  await expect(cell).toHaveAttribute("aria-invalid", "true");
  const errorId = await cell.getAttribute("aria-describedby");
  expect(errorId).toContain("bulk-error-5");
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page
    .getByRole("textbox", { name: "Tabla de usuarios", exact: true })
    .fill(fifty);
  await page
    .getByRole("button", { name: "Revisar usuarios", exact: true })
    .click();
  const table = page.getByRole("table", {
    name: "Usuarios y membresías por crear",
  });
  await expect(table.getByRole("row")).toHaveCount(51);
  await expect(table.getByText("Participante", { exact: true })).toHaveCount(
    50,
  );
  for (const width of [1280, 800, 640, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    const first = table.getByRole("row").nth(1);
    if (width >= 640) {
      expect(await first.evaluate((e) => getComputedStyle(e).display)).toBe(
        "table-row",
      );
      await expect(first.getByRole("cell").nth(1)).toHaveCSS(
        "display",
        "table-cell",
      );
      expect((await first.boundingBox())!.height, `${width} px`).toBeLessThan(
        180,
      );
      expect(
        (await page
          .getByRole("region", { name: "Filas del lote" })
          .boundingBox())!.height,
      ).toBeLessThanOrEqual(520);
    } else {
      expect(await first.evaluate((e) => getComputedStyle(e).display)).toBe(
        "block",
      );
    }
    await table.getByRole("row").last().scrollIntoViewIfNeeded();
    await expect(page.locator("#bulk-cell-51-Usuario")).toBeInViewport();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  }
});
