import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { spawnSync, spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { config } from "dotenv";
import pg from "pg";
config({ quiet: true });

// A new installation, from an empty database to a signed-in administrator, as an
// operator and a stranger on the network would each experience it.
const name = "acta_setup_" + randomBytes(6).toString("hex");
const port = 4369;
const origin = "http://localhost:" + port;
const base = origin + "/api/v1";
const ownerUrl = new URL(process.env.MIGRATION_DATABASE_URL);
const appUrl = new URL(process.env.DATABASE_URL);
const admin = new pg.Client({ connectionString: ownerUrl.href });
const sha = (value) => createHash("sha256").update(value).digest("hex");
const password = "Setup-" + randomBytes(18).toString("base64url");
const brandingVariables = [
  "APP_NAME",
  "APP_SHORT_NAME",
  "APP_LOGO",
  "APP_FAVICON",
  "APP_ACCENT",
  "DEFAULT_LOCALE",
  "DEFAULT_TIMEZONE",
];
let owner, db, app, evidenceRoot;

async function request(
  path,
  { method = "GET", body, origin: from = origin } = {},
) {
  const response = await fetch(base + path, {
    method,
    headers: {
      ...(from ? { Origin: from } : {}),
      "Content-Type": "application/json",
    },
    ...(method === "GET" ? {} : { body: JSON.stringify(body ?? {}) }),
  });
  return { status: response.status, data: await response.json(), response };
}
function operator(script, args = []) {
  const result = spawnSync(process.execPath, [script, ...args], {
    encoding: "utf8",
    env: process.env,
  });
  return {
    status: result.status,
    out: result.stdout.trim(),
    err: result.stderr.trim(),
  };
}
const issue = () => {
  const result = operator("scripts/setup-token.mjs", ["--url"]);
  assert.equal(result.status, 0, result.err);
  const code = new URL(result.out).hash.replace("#setup=", "");
  assert.ok(code.length >= 40);
  return code;
};
const payload = (token, extra = {}) => ({
  token,
  administrator: {
    username: "First_Admin",
    displayName: "Persona administradora",
    password,
  },
  organization: { name: "Institución de prueba" },
  appearance: {
    appName: "Mi Acta",
    shortName: "Acta MX",
    accent: "#1b4b8c",
    locale: "es-MX",
    timezone: "America/Mexico_City",
  },
  ...extra,
});

before(async () => {
  await admin.connect();
  await admin.query(`CREATE DATABASE "${name}"`);
  ownerUrl.pathname = appUrl.pathname = "/" + name;
  owner = new pg.Client({ connectionString: ownerUrl.href });
  await owner.connect();
  const migrated = spawnSync(
    "npx",
    ["prisma", "migrate", "deploy", "--config", "app/backend/prisma.config.ts"],
    { encoding: "utf8", env: { ...process.env, DATABASE_URL: ownerUrl.href } },
  );
  assert.equal(migrated.status, 0, migrated.stdout + migrated.stderr);
  evidenceRoot = await mkdtemp(join(tmpdir(), "acta-setup-"));
  for (const variable of brandingVariables) delete process.env[variable];
  Object.assign(process.env, {
    DATABASE_URL: appUrl.href,
    APP_ORIGIN: origin,
    PORT: String(port),
    COOKIE_SECURE: "false",
    NODE_ENV: "test",
    DEMO_SEED: "false",
    STORAGE_PROVIDER: "LOCAL",
    EVIDENCE_ROOT: evidenceRoot,
    ORGANIZATION_CODE: "DEFAULT",
    ORGANIZATION_NAME: "Example Organization",
    SETUP_WIZARD: "auto",
  });
  const { PrismaClient } = await import("@prisma/client");
  const { PrismaPg } = await import("@prisma/adapter-pg");
  db = new PrismaClient({
    adapter: new PrismaPg({ connectionString: appUrl.href }),
  });
  const { createApp } = await import("../../app/backend/dist/main.js");
  app = await createApp();
});
after(async () => {
  await app?.close();
  await db?.$disconnect();
  await owner?.end();
  await admin.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
  await admin.end();
  if (evidenceRoot) await rm(evidenceRoot, { recursive: true, force: true });
});

test("a new installation offers the wizard but nothing works without the operator's code", async () => {
  assert.deepEqual((await request("/setup/status")).data, { state: "PENDING" });
  // The sign-in page is not available yet: there is no organization.
  assert.equal((await request("/auth/context")).status, 503);
  // Public branding still answers from the environment alone.
  const branding = (await request("/configuration/public")).data;
  assert.equal(branding.appName, "Acta");
  assert.equal(branding.accent, "#2b4d7c");
  // No code issued yet: every wizard route refuses.
  const stranger = randomBytes(32).toString("base64url");
  for (const [path, body] of [
    ["/setup/verify", { token: stranger }],
    ["/setup/checks", { token: stranger }],
    ["/setup/complete", payload(stranger)],
  ])
    assert.equal(
      (await request(path, { method: "POST", body })).status,
      403,
      path,
    );
  // A request that does not come from the application's own origin is refused outright.
  assert.equal(
    (
      await request("/setup/verify", {
        method: "POST",
        body: { token: stranger },
        origin: "http://attacker.example",
      })
    ).status,
    403,
  );
  assert.equal((await db.user.count()) + (await db.organization.count()), 0);
});

test("the code is shown once to the operator and stored only as a hash; a new one replaces the old", async () => {
  const first = issue();
  const row = await owner.query('SELECT * FROM "InstallationSetup"');
  assert.equal(row.rowCount, 1);
  assert.equal(row.rows[0].tokenHash, sha(first));
  assert.ok(!JSON.stringify(row.rows[0]).includes(first));
  assert.equal(row.rows[0].state, "PENDING");
  assert.equal(
    (await request("/setup/verify", { method: "POST", body: { token: first } }))
      .status,
    200,
  );
  const second = issue();
  assert.notEqual(first, second);
  assert.equal(
    (await request("/setup/verify", { method: "POST", body: { token: first } }))
      .status,
    403,
  );
  const verified = await request("/setup/verify", {
    method: "POST",
    body: { token: second },
  });
  assert.equal(verified.status, 200);
  assert.equal(verified.data.defaults.organizationCode, "DEFAULT");
  // The sample placeholder is not suggested as the institution's name.
  assert.equal(verified.data.defaults.organizationName, "");
  assert.equal(verified.data.defaults.appearance.appName.source, "default");
  assert.equal(verified.data.defaults.appearance.accent.value, "#2b4d7c");
  const checks = await request("/setup/checks", {
    method: "POST",
    body: { token: second },
  });
  assert.deepEqual(
    {
      database: checks.data.database,
      storage: checks.data.storage,
      provider: checks.data.storageProvider,
    },
    { database: "ok", storage: "ok", provider: "LOCAL" },
  );
  assert.equal(checks.data.secureOrigin, true);
  assert.ok(!JSON.stringify(checks.data).includes("DATABASE_URL"));
});

test("an expired code is refused and the operator can issue another", async () => {
  const code = issue();
  await owner.query(
    `UPDATE "InstallationSetup" SET "tokenExpiresAt" = now() - interval '1 minute'`,
  );
  assert.equal(
    (await request("/setup/verify", { method: "POST", body: { token: code } }))
      .status,
    403,
  );
  assert.equal(
    (await request("/setup/complete", { method: "POST", body: payload(code) }))
      .status,
    403,
  );
  assert.equal(await db.user.count(), 0);
});

test("wrong codes are counted and the endpoint stops answering after ten", async () => {
  await owner.query('DELETE FROM "LoginAttempt"');
  const outcomes = [];
  for (let i = 0; i < 12; i++)
    outcomes.push(
      (
        await request("/setup/verify", {
          method: "POST",
          body: { token: randomBytes(32).toString("base64url") },
        })
      ).status,
    );
  assert.deepEqual(
    outcomes,
    [403, 403, 403, 403, 403, 403, 403, 403, 403, 403, 429, 429],
  );
  // Even the right code waits out the window: the limit protects the endpoint, not a single code.
  const code = issue();
  assert.equal(
    (await request("/setup/verify", { method: "POST", body: { token: code } }))
      .status,
    429,
  );
  await owner.query('DELETE FROM "LoginAttempt"');
  assert.equal(
    (await request("/setup/verify", { method: "POST", body: { token: code } }))
      .status,
    200,
  );
});

test("an interrupted or rejected attempt creates nothing and keeps the code usable", async () => {
  const code = issue();
  // Invalid administrator, then a value the infrastructure controls, then a bad timezone.
  const invalid = await request("/setup/complete", {
    method: "POST",
    body: payload(code, {
      administrator: { username: "x", displayName: "A", password: "short" },
    }),
  });
  assert.equal(invalid.status, 400);
  process.env.APP_NAME = "Nombre de infraestructura";
  const external = await request("/setup/complete", {
    method: "POST",
    body: payload(code),
  });
  assert.equal(external.status, 409);
  assert.match(external.data.message, /APP_NAME/);
  assert.ok(external.data.fieldErrors.appName);
  delete process.env.APP_NAME;
  const zone = await request("/setup/complete", {
    method: "POST",
    body: payload(code, { appearance: { timezone: "Mars/Olympus" } }),
  });
  assert.equal(zone.status, 400);
  assert.equal(await db.user.count(), 0);
  assert.equal(await db.organization.count(), 0);
  assert.equal(
    (await owner.query('SELECT state FROM "InstallationSetup"')).rows[0].state,
    "PENDING",
  );
  assert.equal(
    (await request("/setup/verify", { method: "POST", body: { token: code } }))
      .status,
    200,
  );
});

test("the wizard can be turned off from the environment", async () => {
  const code = issue();
  process.env.SETUP_WIZARD = "disabled";
  try {
    assert.deepEqual((await request("/setup/status")).data, {
      state: "DISABLED",
    });
    assert.equal(
      (
        await request("/setup/verify", {
          method: "POST",
          body: { token: code },
        })
      ).status,
      404,
    );
    assert.equal(
      (
        await request("/setup/complete", {
          method: "POST",
          body: payload(code),
        })
      ).status,
      404,
    );
    const refused = operator("scripts/setup-token.mjs");
    assert.notEqual(refused.status, 0);
    assert.match(refused.err, /SETUP_WIZARD=disabled/);
  } finally {
    process.env.SETUP_WIZARD = "auto";
  }
  assert.deepEqual((await request("/setup/status")).data, { state: "PENDING" });
});

test("simultaneous completions create exactly one administrator", async () => {
  const code = issue();
  const attempts = await Promise.all(
    Array.from({ length: 6 }, () =>
      request("/setup/complete", { method: "POST", body: payload(code) }),
    ),
  );
  const statuses = attempts.map((a) => a.status).sort();
  assert.equal(statuses.filter((s) => s === 201).length, 1, statuses.join());
  assert.ok(
    statuses.every((s) => s === 201 || s === 409),
    statuses.join(),
  );
  assert.equal(await db.user.count(), 1);
  assert.equal(await db.organization.count(), 1);
  assert.equal(
    await db.auditEvent.count({
      where: { action: "INSTALLATION_BOOTSTRAPPED" },
    }),
    1,
  );
  const setup = (await owner.query('SELECT * FROM "InstallationSetup"'))
    .rows[0];
  assert.equal(setup.state, "COMPLETED");
  assert.equal(setup.tokenHash, null);
  assert.ok(setup.completedAt && setup.completedById);
});

test("what the wizard created works: sign-in, names, appearance, audit, no secrets", async () => {
  const user = await db.user.findFirstOrThrow();
  assert.equal(user.username, "first_admin");
  assert.equal(user.isOrganizationAdmin, true);
  assert.equal(user.mustChangePassword, false);
  assert.ok(user.passwordHash.startsWith("$argon2id$"));
  const context = await request("/auth/context");
  assert.equal(context.data.institutionName, "Institución de prueba");
  const login = await request("/auth/login", {
    method: "POST",
    body: { username: "First_Admin", password },
  });
  assert.equal(login.status, 201);
  assert.equal(login.data.user.mustChangePassword, false);
  const branding = (await request("/configuration/public")).data;
  assert.deepEqual(
    [
      branding.appName,
      branding.shortName,
      branding.accent,
      branding.timezone,
      branding.organizationName,
    ],
    [
      "Mi Acta",
      "Acta MX",
      "#1b4b8c",
      "America/Mexico_City",
      "Institución de prueba",
    ],
  );
  // A value equal to the product default is not stored as a choice.
  const saved = await db.organizationSettings.findFirstOrThrow();
  assert.equal(saved.locale, null);
  assert.equal(saved.appName, "Mi Acta");
  const audit = await db.auditEvent.findFirstOrThrow({
    where: { action: "INSTALLATION_BOOTSTRAPPED" },
  });
  const text = JSON.stringify(audit);
  assert.ok(!text.includes(password) && !text.includes("argon2"));
  assert.equal(audit.actorId, user.id);
});

test("once completed the wizard is closed for good, for every route and for the command line", async () => {
  assert.deepEqual((await request("/setup/status")).data, {
    state: "COMPLETED",
  });
  const code = randomBytes(32).toString("base64url");
  for (const [path, body] of [
    ["/setup/verify", { token: code }],
    ["/setup/checks", { token: code }],
    [
      "/setup/complete",
      payload(code, {
        administrator: { username: "second", displayName: "Segunda", password },
      }),
    ],
  ])
    assert.equal(
      (await request(path, { method: "POST", body })).status,
      409,
      path,
    );
  const issuer = operator("scripts/setup-token.mjs");
  assert.notEqual(issuer.status, 0);
  assert.match(issuer.err, /already has an administrator/);
  const bootstrap = await new Promise((resolve) => {
    const child = spawn(process.execPath, ["scripts/bootstrap-admin.mjs"], {
      env: process.env,
      stdio: ["pipe", "pipe", "pipe"],
    });
    let output = "";
    child.stdout.on("data", (b) => (output += b));
    child.stderr.on("data", (b) => (output += b));
    child.on("close", (status) => resolve({ status, output }));
    child.stdin.end(
      JSON.stringify({
        username: "second",
        displayName: "Segunda",
        temporaryPassword: randomBytes(32).toString("base64url"),
      }),
    );
  });
  assert.notEqual(bootstrap.status, 0);
  assert.match(bootstrap.output, /Bootstrap is closed/);
  assert.equal(await db.user.count(), 1);
});

test("a restart keeps the installation configured and the wizard closed", async () => {
  await app.close();
  const { createApp } = await import("../../app/backend/dist/main.js");
  app = await createApp();
  assert.deepEqual((await request("/setup/status")).data, {
    state: "COMPLETED",
  });
  const login = await request("/auth/login", {
    method: "POST",
    body: { username: "first_admin", password },
  });
  assert.equal(login.status, 201);
  assert.equal(
    (await request("/configuration/public")).data.appName,
    "Mi Acta",
  );
});
