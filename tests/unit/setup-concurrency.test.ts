import { afterEach, expect, it, vi } from "vitest";
import { SetupService } from "../../app/backend/src/setup/setup.service";

afterEach(() => vi.unstubAllEnvs());

it.each(["verify", "checks", "complete"] as const)(
  "%s reports a completed installation when the code is consumed during authorization",
  async (operation) => {
    vi.stubEnv("DATABASE_URL", "postgresql://unused:unused@localhost/unused");
    vi.stubEnv("ORGANIZATION_CODE", "DEFAULT");
    vi.stubEnv("APP_ORIGIN", "https://example.test");
    vi.stubEnv("COOKIE_SECURE", "true");
    vi.stubEnv("SETUP_WIZARD", "auto");
    const failedAttempt = vi.fn();
    const tx = {
      $queryRaw: vi.fn(),
      loginAttempt: { count: async () => 0, create: failedAttempt },
      installationSetup: {
        findUnique: async () => ({
          state: "COMPLETED",
          tokenHash: null,
          tokenExpiresAt: null,
        }),
      },
    };
    const db = {
      // The installation completes after the initial guard, before the locked token read.
      installationSetup: { findUnique: async () => ({ state: "PENDING" }) },
      user: { count: async () => 0 },
      $transaction: async (run: (client: typeof tx) => Promise<unknown>) =>
        run(tx),
    };
    const service = new SetupService(db as never, {} as never);
    const token = "x".repeat(43);
    const result =
      operation === "complete"
        ? service.complete(
            {
              token,
              administrator: {
                username: "admin",
                displayName: "Example",
                password: "Test-" + token,
              },
              organization: { name: "Example Organization" },
              appearance: {},
            },
            "127.0.0.1",
            "setup-race",
          )
        : service[operation](token, "127.0.0.1");
    await expect(result).rejects.toMatchObject({
      status: 409,
      message: "La instalación ya está configurada.",
    });
    expect(failedAttempt).not.toHaveBeenCalled();
  },
);
