import "./runtime-env.mjs";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { createInterface } from "node:readline/promises";
import { Writable } from "node:stream";
import { randomUUID } from "node:crypto";
import { createUserInput } from "@requirements/contracts";
import { hashPassword } from "../app/backend/dist/auth/auth.service.js";
import { loadConfig } from "../app/backend/dist/common/config.js";
import { audit } from "../app/backend/dist/common/http.js";
const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: loadConfig().DATABASE_URL }),
});
try {
  let input;
  if (process.stdin.isTTY) {
    let muted = false;
    const output = new Writable({
      write(chunk, encoding, done) {
        if (!muted) process.stdout.write(chunk, encoding);
        done();
      },
    });
    const rl = createInterface({
      input: process.stdin,
      output,
      terminal: true,
    });
    const username = await rl.question("Primer administrador — usuario: ");
    const displayName = await rl.question("Nombre visible: ");
    process.stdout.write(
      "Contraseña temporal (mínimo 20 caracteres, oculta): ",
    );
    muted = true;
    const temporaryPassword = await rl.question("");
    muted = false;
    process.stdout.write("\n");
    rl.close();
    input = { username, displayName, temporaryPassword };
  } else {
    let raw = "";
    for await (const chunk of process.stdin) {
      raw += chunk;
      if (raw.length > 4096) throw Error("Bootstrap input exceeds limit");
    }
    input = JSON.parse(raw);
  }
  const parsed = createUserInput.safeParse(input);
  if (
    !parsed.success ||
    parsed.data.temporaryPassword.length < 20 ||
    /REPLACE|changeme/i.test(parsed.data.temporaryPassword)
  )
    throw Error(
      "Bootstrap input invalid; provide username, displayName and a private temporaryPassword of 20–128 characters",
    );
  const { temporaryPassword, ...identity } = parsed.data;
  const passwordHash = await hashPassword(temporaryPassword);
  await db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(18002901)`;
    if (await tx.user.count({ where: { isOrganizationAdmin: true } }))
      throw Error(
        "Bootstrap is closed: an administrator already exists; no account was changed",
      );
    const org = await tx.organization.upsert({
      where: { code: loadConfig().ORGANIZATION_CODE },
      create: {
        code: loadConfig().ORGANIZATION_CODE,
        name: process.env.ORGANIZATION_NAME || "My organization",
      },
      update: {},
    });
    const actor = await tx.user.create({
      data: {
        ...identity,
        organizationId: org.id,
        passwordHash,
        mustChangePassword: true,
        isOrganizationAdmin: true,
      },
    });
    await audit(
      tx,
      actor,
      "INSTALLATION_BOOTSTRAPPED",
      "User",
      actor.id,
      null,
      null,
      { firstAdministrator: true },
      randomUUID(),
    );
  });
  console.log(
    "Administrator created. Sign in and replace the temporary password. No password was logged.",
  );
} catch (error) {
  // Only own safe messages; never print ORM/input details.
  const message = error instanceof Error ? error.message : "";
  console.error(
    message.startsWith("Bootstrap")
      ? message
      : "Bootstrap failed; check input and installation configuration. No existing account was changed.",
  );
  process.exitCode = 1;
} finally {
  await db.$disconnect();
}
