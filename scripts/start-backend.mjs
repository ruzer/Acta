import "./runtime-env.mjs";
import { spawnSync } from "node:child_process";
import { loadConfig } from "../app/backend/dist/common/config.js";
loadConfig();
// Compatibility for older installs; new Compose uses a separate migration job.
if (process.env.MIGRATION_DATABASE_URL) {
  const result = spawnSync(
    "./node_modules/.bin/prisma",
    ["migrate", "deploy", "--config", "app/backend/prisma.config.ts"],
    {
      stdio: "inherit",
      env: { ...process.env, DATABASE_URL: process.env.MIGRATION_DATABASE_URL },
    },
  );
  if (result.status !== 0) process.exit(1);
  delete process.env.MIGRATION_DATABASE_URL;
}
const seed = spawnSync(process.execPath, ["app/backend/dist/seed.js"], {
  stdio: "inherit",
  env: process.env,
});
if (seed.status !== 0) process.exit(1);
const { createApp } = await import("../app/backend/dist/main.js");
await createApp();
