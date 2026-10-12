// Issues the one-time code that authorizes the first-run wizard. Run it where you
// operate the installation (docker compose exec backend node scripts/setup-token.mjs).
// The code is shown once, only on this terminal; the database keeps a SHA-256 of it.
import "./runtime-env.mjs";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { loadConfig } from "../app/backend/dist/common/config.js";
import {
  SETUP_CODE_MINUTES,
  issueSetupCode,
  lockInstallation,
  setupIsClosed,
} from "../app/backend/dist/setup/setup-core.js";
const config = loadConfig();
const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: config.DATABASE_URL }),
});
try {
  if (config.SETUP_WIZARD === "disabled")
    throw new Error(
      "Setup: the wizard is turned off (SETUP_WIZARD=disabled). Create the administrator with scripts/bootstrap-admin.mjs.",
    );
  if (await setupIsClosed(db))
    throw new Error(
      "Setup: this installation already has an administrator; no code was issued.",
    );
  const { code, expiresAt } = await db.$transaction(async (tx) => {
    await lockInstallation(tx);
    return issueSetupCode(tx);
  });
  const address = `${config.APP_ORIGIN.replace(/\/$/, "")}/#setup=${code}`;
  if (process.argv.includes("--url")) console.log(address);
  else
    console.log(
      [
        "Código de instalación de Acta (un solo uso, válido " +
          `${SETUP_CODE_MINUTES} minutos, hasta ${expiresAt.toISOString()}):`,
        "",
        `  ${code}`,
        "",
        "Abre esta dirección para crear al administrador y configurar la institución:",
        "",
        `  ${address}`,
        "",
        "Si caduca, vuelve a ejecutar este comando: genera un código nuevo y anula el anterior.",
      ].join("\n"),
    );
} catch (error) {
  const message = error instanceof Error ? error.message : "";
  console.error(
    message.startsWith("Setup")
      ? message
      : "No fue posible emitir el código; revisa la configuración de la instalación.",
  );
  process.exitCode = 1;
} finally {
  await db.$disconnect();
}
