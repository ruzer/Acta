import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { cp, mkdir, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { crc32, deflateSync } from "node:zlib";
import pg from "pg";
import { config } from "dotenv";
config({ quiet: true });

// The second-logo migration on an installation that already has saved settings and
// images: nothing is rewritten, nothing is lost, and the new kind works afterwards.
// Runs only in a randomly named disposable database.
const added = "202610130001_secondary_logo";
const port = 4399;
const origin = "http://localhost:" + port;
const brandingVariables = [
  "APP_NAME",
  "APP_SHORT_NAME",
  "APP_LOGO",
  "APP_LOGO_SECONDARY",
  "APP_SECONDARY_NAME",
  "APP_FAVICON",
  "APP_ACCENT",
  "DEFAULT_LOCALE",
  "DEFAULT_TIMEZONE",
];
function png(size) {
  const chunk = (type, data) => {
    const body = Buffer.concat([Buffer.from(type), data]);
    const out = Buffer.alloc(12 + data.length);
    out.writeUInt32BE(data.length, 0);
    body.copy(out, 4);
    out.writeUInt32BE(crc32(body), 8 + data.length);
    return out;
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header.set([8, 2, 0, 0, 0], 8);
  const row = Buffer.concat([Buffer.from([0]), Buffer.alloc(size * 3, 0x55)]);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk(
      "IDAT",
      deflateSync(Buffer.concat(Array.from({ length: size }, () => row))),
    ),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

test(
  "an installation with saved settings and logos keeps them through the second-logo migration",
  { timeout: 180000 },
  async () => {
    const name = "acta_branding_upgrade_" + randomBytes(6).toString("hex");
    const ownerUrl = new URL(process.env.MIGRATION_DATABASE_URL);
    const runtimeUrl = new URL(process.env.DATABASE_URL);
    const admin = new pg.Client({ connectionString: ownerUrl.href });
    const root = await mkdtemp(join(tmpdir(), "acta-branding-upgrade-"));
    let app, owner;
    await admin.connect();
    try {
      await admin.query(`CREATE DATABASE "${name}"`);
      ownerUrl.pathname = runtimeUrl.pathname = "/" + name;
      owner = new pg.Client({ connectionString: ownerUrl.href });
      await owner.connect();
      const migrations = resolve("app/backend/prisma/migrations");
      const previous = join(root, "migrations");
      await mkdir(previous);
      for (const entry of await readdir(migrations))
        if (entry < added)
          await cp(join(migrations, entry), join(previous, entry), {
            recursive: true,
          });
      const oldConfig = join(root, "prisma-old.config.mjs");
      await writeFile(
        oldConfig,
        `export default ${JSON.stringify({
          schema: resolve("app/backend/prisma/schema.prisma"),
          migrations: { path: previous },
          datasource: { url: ownerUrl.href },
        })}`,
        { mode: 0o600 },
      );
      const deploy = (path) => {
        const result = spawnSync(
          process.execPath,
          [
            "node_modules/prisma/build/index.js",
            "migrate",
            "deploy",
            "--config",
            path,
          ],
          {
            encoding: "utf8",
            env: { ...process.env, DATABASE_URL: ownerUrl.href },
          },
        );
        assert.equal(
          result.status,
          0,
          (result.stdout + result.stderr).replaceAll(
            ownerUrl.href,
            "[test database]",
          ),
        );
      };
      deploy(oldConfig);
      const insert = (table, data) => {
        const keys = Object.keys(data);
        return owner.query(
          `INSERT INTO "${table}" (${keys.map((k) => `"${k}"`).join(",")}) VALUES (${keys.map((_, i) => `$${i + 1}`).join(",")})`,
          Object.values(data),
        );
      };
      const { hashPassword } =
        await import("../../app/backend/dist/auth/auth.service.js");
      const secret = randomBytes(24).toString("base64url");
      const org = randomUUID();
      const adminId = randomUUID();
      const now = new Date();
      await insert("Organization", {
        id: org,
        code: "DEFAULT",
        name: "Institución existente",
        updatedAt: now,
      });
      await insert("User", {
        id: adminId,
        organizationId: org,
        username: "admin.existente",
        displayName: "Administración",
        passwordHash: await hashPassword(secret),
        mustChangePassword: false,
        isOrganizationAdmin: true,
        updatedAt: now,
      });
      await insert("OrganizationSettings", {
        organizationId: org,
        appName: "Nombre guardado",
        accent: "#1b4b8c",
        lockVersion: 4,
        updatedAt: now,
        updatedById: adminId,
      });
      const mark = png(64);
      const sha = (b) => createHash("sha256").update(b).digest("hex");
      for (const [kind, bytes] of [
        ["LOGO", mark],
        ["FAVICON", png(32)],
      ])
        await insert("BrandingAsset", {
          id: randomUUID(),
          organizationId: org,
          kind,
          contentType: "image/png",
          byteSize: bytes.length,
          sha256: sha(bytes),
          content: bytes,
          createdById: adminId,
        });
      const settingsBefore = (
        await owner.query('SELECT * FROM "OrganizationSettings"')
      ).rows[0];
      const assetsBefore = (
        await owner.query('SELECT * FROM "BrandingAsset" ORDER BY kind')
      ).rows;

      deploy("app/backend/prisma.config.ts");

      const settingsAfter = (
        await owner.query('SELECT * FROM "OrganizationSettings"')
      ).rows[0];
      const { secondaryName, ...kept } = settingsAfter;
      assert.equal(secondaryName, null);
      assert.deepEqual(kept, settingsBefore);
      assert.deepEqual(
        (await owner.query('SELECT * FROM "BrandingAsset" ORDER BY kind')).rows,
        assetsBefore,
      );
      assert.ok(
        (
          await owner.query(
            'SELECT unnest(enum_range(NULL::"BrandingAssetKind"))::text AS v',
          )
        ).rows.some((r) => r.v === "LOGO_SECONDARY"),
      );

      for (const variable of brandingVariables) delete process.env[variable];
      Object.assign(process.env, {
        DATABASE_URL: runtimeUrl.href,
        APP_ORIGIN: origin,
        PORT: String(port),
        COOKIE_SECURE: "false",
        NODE_ENV: "test",
        DEMO_SEED: "false",
        STORAGE_PROVIDER: "LOCAL",
        EVIDENCE_ROOT: join(root, "evidence"),
        ORGANIZATION_CODE: "DEFAULT",
        ORGANIZATION_NAME: "Institución existente",
      });
      const { createApp } = await import("../../app/backend/dist/main.js");
      app = await createApp();
      const api = "/api/v1";
      const branding = await (
        await fetch(origin + api + "/configuration/public")
      ).json();
      // Existing installations look exactly as before; there is simply no second logo.
      assert.deepEqual(
        [
          branding.appName,
          branding.accent,
          branding.logoSecondary,
          branding.secondaryName,
        ],
        ["Nombre guardado", "#1b4b8c", "", ""],
      );
      assert.match(branding.logo, /assets\/logo\?v=/);
      assert.deepEqual(
        Buffer.from(await (await fetch(origin + branding.logo)).arrayBuffer()),
        mark,
      );
      assert.equal(
        (await fetch(origin + api + "/configuration/assets/logoSecondary"))
          .status,
        404,
      );
      // The migrated database accepts the new kind for the runtime role.
      const login = await fetch(origin + api + "/auth/login", {
        method: "POST",
        headers: { Origin: origin, "Content-Type": "application/json" },
        body: JSON.stringify({ username: "admin.existente", password: secret }),
      });
      assert.equal(login.status, 201);
      const session = {
        cookie: login.headers.get("set-cookie").split(";")[0],
        csrf: (await login.json()).csrfToken,
      };
      const uploaded = await fetch(
        origin + api + "/settings/assets/logoSecondary",
        {
          method: "POST",
          headers: {
            Origin: origin,
            "Content-Type": "application/octet-stream",
            Cookie: session.cookie,
            "X-CSRF-Token": session.csrf,
            "X-Expected-Version": "4",
          },
          body: png(48),
        },
      );
      assert.equal(
        uploaded.status,
        201,
        JSON.stringify(await uploaded.clone().json()),
      );
      const after = await (
        await fetch(origin + api + "/configuration/public")
      ).json();
      assert.match(after.logoSecondary, /assets\/logoSecondary\?v=/);
      assert.equal(after.logo, branding.logo);
    } finally {
      await app?.close();
      await owner?.end();
      await admin.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
      await admin.end();
      await rm(root, { recursive: true, force: true });
    }
  },
);
