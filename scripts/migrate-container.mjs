import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
const password = readFileSync("/run/db-secrets/owner", "utf8");
const result = spawnSync(
  "./node_modules/.bin/prisma",
  ["migrate", "deploy", "--config", "app/backend/prisma.config.ts"],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      DATABASE_URL: `postgresql://requirements_owner:${encodeURIComponent(password)}@postgres:5432/requirements`,
    },
  },
);
process.exit(result.status ?? 1);
