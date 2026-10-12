import { test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { cp, mkdir, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import pg from "pg";
import { config } from "dotenv";
config({ quiet: true });

// Existing installations are upgraded by the official migration, not reinstalled: their
// users, organization and appearance stay as they are and the wizard never appears.
// Runs only in randomly named disposable databases.
const added = "202610120001_installation_setup_settings";
const port = 4389;
const origin = "http://localhost:" + port;
const brandingVariables = [
  "APP_NAME",
  "APP_SHORT_NAME",
  "APP_LOGO",
  "APP_FAVICON",
  "APP_ACCENT",
  "DEFAULT_LOCALE",
  "DEFAULT_TIMEZONE",
];

test(
  "an installation created before the wizard keeps its users and never sees it; an empty one still can",
  { timeout: 180000 },
  async () => {
    const suffix = randomBytes(6).toString("hex");
    const ownerUrl = new URL(process.env.MIGRATION_DATABASE_URL);
    const runtimeUrl = new URL(process.env.DATABASE_URL);
    const admin = new pg.Client({ connectionString: ownerUrl.href });
    const root = await mkdtemp(join(tmpdir(), "acta-setup-upgrade-"));
    const databases = [];
    let app;
    await admin.connect();
    try {
      const migrations = resolve("app/backend/prisma/migrations");
      const previous = join(root, "migrations");
      await mkdir(previous);
      for (const entry of await readdir(migrations))
        if (entry !== added)
          await cp(join(migrations, entry), join(previous, entry), {
            recursive: true,
          });
      const deploy = (config, url) => {
        const result = spawnSync(
          process.execPath,
          [
            "node_modules/prisma/build/index.js",
            "migrate",
            "deploy",
            "--config",
            config,
          ],
          { encoding: "utf8", env: { ...process.env, DATABASE_URL: url } },
        );
        assert.equal(
          result.status,
          0,
          (result.stdout + result.stderr).replaceAll(url, "[test database]"),
        );
      };
      const prepare = async (label) => {
        const name = `acta_setup_upgrade_${label}_${suffix}`;
        databases.push(name);
        await admin.query(`CREATE DATABASE "${name}"`);
        const owner = new URL(ownerUrl.href);
        const runtime = new URL(runtimeUrl.href);
        owner.pathname = runtime.pathname = "/" + name;
        const oldConfig = join(root, `prisma-${label}.config.mjs`);
        await writeFile(
          oldConfig,
          `export default ${JSON.stringify({
            schema: resolve("app/backend/prisma/schema.prisma"),
            migrations: { path: previous },
            datasource: { url: owner.href },
          })}`,
          { mode: 0o600 },
        );
        deploy(oldConfig, owner.href);
        const client = new pg.Client({ connectionString: owner.href });
        await client.connect();
        return { client, owner, runtime };
      };
      const insert = (client, table, data) => {
        const keys = Object.keys(data);
        return client.query(
          `INSERT INTO "${table}" (${keys.map((key) => `"${key}"`).join(",")}) VALUES (${keys.map((_, i) => `$${i + 1}`).join(",")})`,
          Object.values(data),
        );
      };
      const { hashPassword } =
        await import("../../app/backend/dist/auth/auth.service.js");
      const secret = randomBytes(24).toString("base64url");
      const passwordHash = await hashPassword(secret);

      // 1. A populated installation from before the wizard.
      const old = await prepare("old");
      const org = randomUUID();
      const adminId = randomUUID();
      const colleague = randomUUID();
      const now = new Date();
      await insert(old.client, "Organization", {
        id: org,
        code: "DEFAULT",
        name: "Institución existente",
        updatedAt: now,
      });
      for (const [id, username, isAdmin] of [
        [adminId, "admin.existente", true],
        [colleague, "analista.existente", false],
      ])
        await insert(old.client, "User", {
          id,
          organizationId: org,
          username,
          displayName: username,
          passwordHash,
          mustChangePassword: false,
          isOrganizationAdmin: isAdmin,
          updatedAt: now,
        });
      const before = (
        await old.client.query('SELECT * FROM "User" ORDER BY username')
      ).rows;
      assert.equal(
        (
          await old.client.query(
            "SELECT to_regclass('\"InstallationSetup\"') AS t",
          )
        ).rows[0].t,
        null,
      );
      deploy("app/backend/prisma.config.ts", old.owner.href);
      assert.deepEqual(
        (await old.client.query('SELECT * FROM "User" ORDER BY username')).rows,
        before,
      );
      const setup = (
        await old.client.query('SELECT * FROM "InstallationSetup"')
      ).rows;
      assert.equal(setup.length, 1);
      assert.equal(setup[0].state, "COMPLETED");
      assert.equal(setup[0].tokenHash, null);
      for (const table of ["OrganizationSettings", "BrandingAsset"])
        assert.equal(
          (await old.client.query(`SELECT count(*)::int AS n FROM "${table}"`))
            .rows[0].n,
          0,
        );

      for (const variable of brandingVariables) delete process.env[variable];
      Object.assign(process.env, {
        DATABASE_URL: old.runtime.href,
        APP_ORIGIN: origin,
        PORT: String(port),
        COOKIE_SECURE: "false",
        NODE_ENV: "test",
        DEMO_SEED: "false",
        STORAGE_PROVIDER: "LOCAL",
        EVIDENCE_ROOT: join(root, "evidence"),
        ORGANIZATION_CODE: "DEFAULT",
        ORGANIZATION_NAME: "Institución existente",
        APP_NAME: "Nombre definido en .env",
        SETUP_WIZARD: "auto",
      });
      const { createApp } = await import("../../app/backend/dist/main.js");
      app = await createApp();
      const get = async (path, init) =>
        (await fetch(origin + "/api/v1" + path, init)).json();
      assert.deepEqual(await get("/setup/status"), { state: "COMPLETED" });
      const branding = await get("/configuration/public");
      // Environment-defined appearance is untouched by the upgrade.
      assert.equal(branding.appName, "Nombre definido en .env");
      assert.equal(branding.organizationName, "Institución existente");
      const login = await fetch(origin + "/api/v1/auth/login", {
        method: "POST",
        headers: { Origin: origin, "Content-Type": "application/json" },
        body: JSON.stringify({ username: "admin.existente", password: secret }),
      });
      assert.equal(login.status, 201);
      assert.equal(
        (
          await fetch(origin + "/api/v1/setup/verify", {
            method: "POST",
            headers: { Origin: origin, "Content-Type": "application/json" },
            body: JSON.stringify({
              token: randomBytes(32).toString("base64url"),
            }),
          })
        ).status,
        409,
      );
      await app.close();
      app = undefined;

      // 2. An installation that was started but never configured can still use the wizard.
      const empty = await prepare("empty");
      await insert(empty.client, "Organization", {
        id: randomUUID(),
        code: "DEFAULT",
        name: "Sin administrador",
        updatedAt: now,
      });
      deploy("app/backend/prisma.config.ts", empty.owner.href);
      assert.equal(
        (
          await empty.client.query(
            'SELECT count(*)::int AS n FROM "InstallationSetup"',
          )
        ).rows[0].n,
        0,
      );
      process.env.DATABASE_URL = empty.runtime.href;
      app = await createApp();
      assert.deepEqual(await get("/setup/status"), { state: "PENDING" });
      await empty.client.end();
      await old.client.end();
    } finally {
      await app?.close();
      for (const name of databases)
        await admin.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
      await admin.end();
      await rm(root, { recursive: true, force: true });
    }
  },
);
