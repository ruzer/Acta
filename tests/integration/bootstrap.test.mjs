import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { config } from "dotenv";
import pg from "pg";
config({ quiet: true });
test("First-admin bootstrap is private, atomic, concurrent-safe and never resets an existing account", async () => {
  const name = "requirements_bootstrap_" + randomBytes(6).toString("hex");
  const ownerUrl = new URL(process.env.MIGRATION_DATABASE_URL),
    appUrl = new URL(process.env.DATABASE_URL);
  const owner = new pg.Client({ connectionString: ownerUrl.href });
  await owner.connect();
  let app, db;
  try {
    await owner.query(`CREATE DATABASE "${name}"`);
    ownerUrl.pathname = "/" + name;
    appUrl.pathname = "/" + name;
    const env = {
      ...process.env,
      DATABASE_URL: appUrl.href,
      MIGRATION_DATABASE_URL: ownerUrl.href,
      ORGANIZATION_CODE: "DEFAULT",
      ORGANIZATION_NAME: "Example organization",
      APP_ORIGIN: "http://localhost:4338",
      PORT: "4338",
      COOKIE_SECURE: "false",
      NODE_ENV: "test",
      DEMO_SEED: "false",
      STORAGE_PROVIDER: "LOCAL",
    };
    const migration = spawnSync(
      "npx",
      [
        "prisma",
        "migrate",
        "deploy",
        "--config",
        "app/backend/prisma.config.ts",
      ],
      { encoding: "utf8", env: { ...env, DATABASE_URL: ownerUrl.href } },
    );
    assert.equal(migration.status, 0, migration.stderr);
    const run = (input) =>
      new Promise((resolve, reject) => {
        const child = spawn(process.execPath, ["scripts/bootstrap-admin.mjs"], {
          env,
          stdio: ["pipe", "pipe", "pipe"],
        });
        let output = "";
        child.stdout.on("data", (b) => (output += b));
        child.stderr.on("data", (b) => (output += b));
        child.on("error", reject);
        child.on("close", (status) => resolve({ status, output }));
        child.stdin.end(JSON.stringify(input));
      });
    const secret = randomBytes(32).toString("base64url");
    const command = {
      username: "first_admin",
      displayName: "Fictional operator",
      temporaryPassword: secret,
    };
    assert.notEqual(
      (await run({ ...command, temporaryPassword: "weak" })).status,
      0,
    );
    const results = await Promise.all([run(command), run(command)]);
    assert.equal(results.filter((r) => r.status === 0).length, 1);
    for (const r of results) assert.ok(!r.output.includes(secret));
    const { PrismaClient } = await import("@prisma/client");
    const { PrismaPg } = await import("@prisma/adapter-pg");
    db = new PrismaClient({
      adapter: new PrismaPg({ connectionString: appUrl.href }),
    });
    assert.equal(await db.user.count(), 1);
    assert.equal(await db.organization.count(), 1);
    assert.equal(
      await db.auditEvent.count({
        where: { action: "INSTALLATION_BOOTSTRAPPED" },
      }),
      1,
    );
    const before = await db.user.findFirst();
    assert.equal(before.mustChangePassword, true);
    assert.equal(before.isOrganizationAdmin, true);
    assert.notEqual(
      (
        await run({
          ...command,
          temporaryPassword: randomBytes(32).toString("base64url"),
        })
      ).status,
      0,
    );
    assert.equal((await db.user.findFirst()).passwordHash, before.passwordHash);
    Object.assign(process.env, env);
    const { createApp } = await import("../../app/backend/dist/main.js");
    app = await createApp();
    const login = await fetch(env.APP_ORIGIN + "/api/v1/auth/login", {
      method: "POST",
      headers: { Origin: env.APP_ORIGIN, "Content-Type": "application/json" },
      body: JSON.stringify({ username: command.username, password: secret }),
    });
    assert.equal(login.status, 201);
    assert.equal((await login.json()).user.mustChangePassword, true);
    const branding = await (
      await fetch(env.APP_ORIGIN + "/api/v1/configuration/public")
    ).json();
    assert.equal(branding.organizationName, "Example organization");
    assert.ok(!JSON.stringify(branding).includes(secret));
    assert.ok(!("DATABASE_URL" in branding));
  } finally {
    await app?.close();
    await db?.$disconnect();
    await owner.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
    await owner.end();
  }
});
