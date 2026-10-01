import { spawnSync } from "node:child_process";
if (!process.env.MIGRATION_DATABASE_URL)
  throw new Error("Configura MIGRATION_DATABASE_URL fuera del repositorio.");
const result = spawnSync(
  "npx",
  ["prisma", "migrate", "deploy", "--config", "app/backend/prisma.config.ts"],
  {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: process.env.MIGRATION_DATABASE_URL },
  },
);
process.exit(result.status ?? 1);
