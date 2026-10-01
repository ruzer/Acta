import { existsSync, readFileSync } from "node:fs";
const file =
  process.env.RUNTIME_SECRETS_FILE || "/run/app-secrets/runtime.json";
if (existsSync(file)) {
  const values = JSON.parse(readFileSync(file, "utf8"));
  for (const key of [
    "DATABASE_URL",
    "MIGRATION_DATABASE_URL",
    "S3_ACCESS_KEY",
    "S3_SECRET_KEY",
  ])
    if (!process.env[key] && typeof values[key] === "string")
      process.env[key] = values[key];
}
