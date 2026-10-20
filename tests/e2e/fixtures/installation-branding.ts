import { test as base, expect } from "@playwright/test";
import type { SettingsView } from "@requirements/contracts";

function expectDefaultBranding(settings: SettingsView) {
  for (const key of ["logo", "logoSecondary", "secondaryName"] as const)
    expect(settings[key].source, `${key} debe quedar predeterminado`).toBe(
      "default",
    );
}

/** Restore only this test's branding, even if its page closes or times out. */
export const test = base.extend<{ restoreBranding: () => Promise<void> }>({
  restoreBranding: [
    async ({ request, baseURL }, use) => {
      let armed = false;
      let csrf = "";
      const headers = () => ({
        Origin: new URL(baseURL!).origin,
        "X-CSRF-Token": csrf,
      });
      const settings = async (): Promise<SettingsView> => {
        const response = await request.get("/api/v1/settings");
        expect(response.status(), "Consultar configuración").toBe(200);
        return response.json();
      };
      try {
        await use(async () => {
          // Separate cookies keep this session valid after the UI logs out.
          // Match the demo login helper's two supported passwords.
          const temporary = process.env.DEMO_PASSWORD!;
          let response = await request.post("/api/v1/auth/login", {
            headers: headers(),
            data: { username: "admin", password: temporary + "-Reviewed2B" },
          });
          if (response.status() === 401)
            response = await request.post("/api/v1/auth/login", {
              headers: headers(),
              data: { username: "admin", password: temporary },
            });
          expect(response.status(), "Sesión de limpieza independiente").toBe(
            201,
          );
          csrf = (await response.json()).csrfToken;
          // Refuse to erase settings that were not created by this test.
          expectDefaultBranding(await settings());
          armed = true;
        });
      } finally {
        if (armed) {
          for (const kind of ["logo", "logoSecondary"] as const) {
            const current = await settings();
            if (current[kind].source === "saved") {
              const response = await request.post(
                `/api/v1/settings/assets/${kind}/remove`,
                {
                  headers: headers(),
                  data: { expectedVersion: current.version },
                },
              );
              expect(response.status(), `Restablecer ${kind}`).toBe(201);
            }
          }
          const current = await settings();
          if (current.secondaryName.source === "saved") {
            const response = await request.post("/api/v1/settings", {
              headers: headers(),
              data: { expectedVersion: current.version, secondaryName: "" },
            });
            expect(response.status(), "Restablecer entidad secundaria").toBe(
              201,
            );
          }
          expectDefaultBranding(await settings());
        }
      }
    },
    // Teardown has its own budget; cleanup errors do not replace the test error.
    { timeout: 30000 },
  ],
});
