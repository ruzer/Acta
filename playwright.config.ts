import { defineConfig } from "@playwright/test";
import { config } from "dotenv";
config({ quiet: true });
export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 45000,
  use: {
    baseURL: process.env.E2E_URL || "http://localhost:4317",
    trace: "off",
    screenshot: "only-on-failure",
  },
  reporter: [["list"], ["html", { open: "never" }]],
  projects: [
    {
      name: "chromium",
      use: {
        browserName: "chromium",
        ...(process.env.E2E_CHANNEL
          ? { channel: process.env.E2E_CHANNEL }
          : {}),
        viewport: { width: 1440, height: 1000 },
      },
    },
  ],
});
