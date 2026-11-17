import { expect, test } from "@playwright/test";
import { login, logout } from "./login-helper";

for (const username of ["viewer", "analyst"])
  test(`la sesión anterior de ${username} continúa y el siguiente acceso usa la cookie de Acta`, async ({
    page,
    context,
  }) => {
    await login(page, username);
    const current = (await context.cookies()).find(
      (c) => c.name === "acta_session",
    );
    expect(current).toBeDefined();
    expect(
      (await context.cookies()).some((c) => c.name === "fgeo_session"),
    ).toBe(false);
    const legacy = { ...current!, name: "fgeo_session" };
    await context.clearCookies({ name: "acta_session" });
    await context.addCookies([legacy]);
    await page.reload();
    await expect(
      page.getByRole("heading", { name: "Mis proyectos", exact: true }),
    ).toBeVisible();
    expect(
      (await context.cookies()).some((c) => c.name === "acta_session"),
    ).toBe(false);
    await logout(page);
    await expect(
      page.getByRole("heading", { name: "Iniciar sesión", exact: true }),
    ).toBeVisible();
    expect(
      (await context.cookies()).some((c) =>
        ["acta_session", "fgeo_session"].includes(c.name),
      ),
    ).toBe(false);
    await context.addCookies([legacy]);
    await login(page, username);
    expect(
      (await context.cookies()).some((c) => c.name === "acta_session"),
    ).toBe(true);
    expect(
      (await context.cookies()).some((c) => c.name === "fgeo_session"),
    ).toBe(false);
  });
