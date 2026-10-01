import { randomBytes } from "node:crypto";
import { writeFileSync, existsSync } from "node:fs";
const owner = randomBytes(24).toString("base64url");
const app = randomBytes(24).toString("base64url");
const demo = randomBytes(24).toString("base64url");
const content = `POSTGRES_PASSWORD=${owner}
APP_DB_PASSWORD=${app}
DEMO_PASSWORD=${demo}
ORGANIZATION_CODE=DEFAULT
ORGANIZATION_NAME=Demonstration organization
APP_PORT=4317
DB_PORT=55439
APP_ORIGIN=http://localhost:4317
COOKIE_SECURE=false
DEMO_SEED=true
NODE_ENV=development
DATABASE_URL=postgresql://requirements_app:${app}@127.0.0.1:55439/requirements
MIGRATION_DATABASE_URL=postgresql://requirements_owner:${owner}@127.0.0.1:55439/requirements
`;
if (process.argv.includes("--stdout")) process.stdout.write(content);
else {
  if (existsSync(".env")) throw new Error(".env ya existe; no se modifica.");
  writeFileSync(".env", content, { mode: 0o600, flag: "wx" });
  console.log(
    "Configuración demo creada en .env. Guarda su contraseña temporal en un lugar privado.",
  );
}
