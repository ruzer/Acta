import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import { get } from "node:http";
import { crc32, deflateSync } from "node:zlib";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { config } from "dotenv";
import pg from "pg";
config({ quiet: true });

// The administration center against a real database: who may change what, what the
// infrastructure keeps for itself, and what a visitor finally sees.
const name = "acta_settings_" + randomBytes(6).toString("hex");
const port = 4379;
const origin = "http://localhost:" + port;
const base = origin + "/api/v1";
const ownerUrl = new URL(process.env.MIGRATION_DATABASE_URL);
const appUrl = new URL(process.env.DATABASE_URL);
const adminDb = new pg.Client({ connectionString: ownerUrl.href });
const password = "Settings-" + randomBytes(18).toString("base64url");
const variables = [
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
let owner, db, app, evidenceRoot, admin, analyst, stakeholder, viewer;

async function request(
  path,
  { session, method = "GET", body, headers = {}, raw = false } = {},
) {
  const response = await fetch(base + path, {
    method,
    headers: {
      Origin: origin,
      "Content-Type": "application/json",
      ...(session
        ? { Cookie: session.cookie, "X-CSRF-Token": session.csrf }
        : {}),
      ...headers,
    },
    ...(method === "GET"
      ? {}
      : { body: raw ? body : JSON.stringify(body ?? {}) }),
  });
  const type = response.headers.get("content-type") ?? "";
  return {
    status: response.status,
    response,
    data: type.includes("json") ? await response.json() : null,
  };
}
async function login(username) {
  const r = await request("/auth/login", {
    method: "POST",
    body: { username, password },
  });
  assert.equal(r.status, 201);
  return {
    cookie: r.response.headers.get("set-cookie").split(";")[0],
    csrf: r.data.csrfToken,
  };
}
const settings = async () =>
  (await request("/settings", { session: admin })).data;
const save = (changes, version, session = admin) =>
  request("/settings", {
    session,
    method: "POST",
    body: { expectedVersion: version, ...changes },
  });
const upload = (
  kind,
  bytes,
  version,
  { session = admin, type = "application/octet-stream" } = {},
) =>
  request(`/settings/assets/${kind}`, {
    session,
    method: "POST",
    raw: true,
    body: bytes,
    headers: { "Content-Type": type, "X-Expected-Version": String(version) },
  });
const branding = async () => (await request("/configuration/public")).data;
const audited = (action) =>
  db.auditEvent.findMany({ where: { action }, orderBy: { occurredAt: "asc" } });

// Minimal valid images, built from their specifications.
function chunk(type, data) {
  const body = Buffer.concat([Buffer.from(type), data]);
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  body.copy(out, 4);
  out.writeUInt32BE(crc32(body), 8 + data.length);
  return out;
}
function png(width, height = width) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header.set([8, 2, 0, 0, 0], 8);
  const row = Buffer.concat([Buffer.from([0]), Buffer.alloc(width * 3, 0x44)]);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk(
      "IDAT",
      deflateSync(Buffer.concat(Array.from({ length: height }, () => row))),
    ),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}
function jpeg(width, height) {
  const frame = Buffer.alloc(17);
  frame.writeUInt16BE(17, 0);
  frame[2] = 8;
  frame.writeUInt16BE(height, 3);
  frame.writeUInt16BE(width, 5);
  frame[7] = 3;
  return Buffer.concat([
    Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 4, 0, 0, 0xff, 0xc0]),
    frame,
    Buffer.from([0xff, 0xd9]),
  ]);
}
function ico(embedded) {
  const header = Buffer.alloc(22);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(1, 4);
  header[6] = 32;
  header[7] = 32;
  header.writeUInt32LE(embedded.length, 14);
  header.writeUInt32LE(22, 18);
  return Buffer.concat([header, embedded]);
}

before(async () => {
  await adminDb.connect();
  await adminDb.query(`CREATE DATABASE "${name}"`);
  ownerUrl.pathname = appUrl.pathname = "/" + name;
  owner = new pg.Client({ connectionString: ownerUrl.href });
  await owner.connect();
  const migrated = spawnSync(
    "npx",
    ["prisma", "migrate", "deploy", "--config", "app/backend/prisma.config.ts"],
    { encoding: "utf8", env: { ...process.env, DATABASE_URL: ownerUrl.href } },
  );
  assert.equal(migrated.status, 0, migrated.stdout + migrated.stderr);
  evidenceRoot = await mkdtemp(join(tmpdir(), "acta-settings-"));
  for (const variable of variables) delete process.env[variable];
  Object.assign(process.env, {
    DATABASE_URL: appUrl.href,
    APP_ORIGIN: origin,
    PORT: String(port),
    COOKIE_SECURE: "false",
    NODE_ENV: "test",
    DEMO_SEED: "true",
    DEMO_PASSWORD: password,
    STORAGE_PROVIDER: "LOCAL",
    EVIDENCE_ROOT: evidenceRoot,
    ORGANIZATION_CODE: "DEFAULT",
    ORGANIZATION_NAME: "Example organization",
  });
  const seeded = spawnSync("node", ["app/backend/dist/seed.js"], {
    encoding: "utf8",
    env: process.env,
  });
  assert.equal(seeded.status, 0, seeded.stderr);
  const { PrismaClient } = await import("@prisma/client");
  const { PrismaPg } = await import("@prisma/adapter-pg");
  db = new PrismaClient({
    adapter: new PrismaPg({ connectionString: appUrl.href }),
  });
  await db.user.updateMany({ data: { mustChangePassword: false } });
  const { createApp } = await import("../../app/backend/dist/main.js");
  app = await createApp();
  [admin, analyst, stakeholder, viewer] = await Promise.all(
    ["admin", "analyst", "stakeholder", "viewer"].map(login),
  );
});
after(async () => {
  await app?.close();
  await db?.$disconnect();
  await owner?.end();
  await adminDb.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
  await adminDb.end();
  if (evidenceRoot) await rm(evidenceRoot, { recursive: true, force: true });
});

test("only an active organization administrator reaches the administration routes", async () => {
  const routes = [
    ["/settings", "GET"],
    ["/settings", "POST", { expectedVersion: 0, appName: "X" }],
    ["/system", "GET"],
    ["/system/storage-test", "POST", {}],
    ["/settings/assets/logo/remove", "POST", { expectedVersion: 0 }],
  ];
  for (const [path, method, body] of routes) {
    assert.equal(
      (await request(path, { method, body })).status,
      401,
      "anonymous " + path,
    );
    for (const session of [analyst, stakeholder, viewer])
      assert.equal(
        (await request(path, { method, session, body })).status,
        403,
        path,
      );
  }
  assert.equal((await request("/settings", { session: admin })).status, 200);
  // Writes need the application's origin and the session's CSRF token.
  assert.equal(
    (
      await request("/settings", {
        method: "POST",
        session: { cookie: admin.cookie, csrf: "wrong" },
        body: { expectedVersion: 0, appName: "X" },
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await request("/settings", {
        method: "POST",
        session: admin,
        headers: { Origin: "http://attacker.example" },
        body: { expectedVersion: 0, appName: "X" },
      })
    ).status,
    403,
  );
  assert.equal((await settings()).version, 0);
  // A deactivated administrator loses access at once.
  const spare = await db.user.findFirstOrThrow({
    where: { username: "admin" },
  });
  await db.user.update({ where: { id: spare.id }, data: { active: false } });
  assert.equal((await request("/settings", { session: admin })).status, 401);
  await db.user.update({ where: { id: spare.id }, data: { active: true } });
  admin = await login("admin");
});

test("an installation without saved choices looks exactly as its environment says (compatibility)", async () => {
  const view = await settings();
  assert.equal(view.version, 0);
  for (const key of [
    "appName",
    "shortName",
    "accent",
    "locale",
    "timezone",
    "secondaryName",
  ])
    assert.equal(view[key].source, "default", key);
  assert.deepEqual(
    [
      view.appName.value,
      view.accent.value,
      view.locale.value,
      view.timezone.value,
    ],
    ["Acta", "#2b4d7c", "es-MX", "UTC"],
  );
  const before = await branding();
  assert.equal(before.appName, "Acta");
  assert.equal(before.logo, "");
  // The same installation configured only through the environment: values win and are labelled so.
  Object.assign(process.env, {
    APP_NAME: "Nombre de infraestructura",
    APP_ACCENT: "#8a1c1c",
    DEFAULT_TIMEZONE: "Europe/Madrid",
  });
  try {
    const external = await settings();
    assert.deepEqual(
      [
        external.appName.source,
        external.appName.variable,
        external.appName.value,
      ],
      ["external", "APP_NAME", "Nombre de infraestructura"],
    );
    assert.equal(external.accent.source, "external");
    assert.equal(external.shortName.source, "default");
    const publicView = await branding();
    assert.deepEqual(
      [publicView.appName, publicView.accent, publicView.timezone],
      ["Nombre de infraestructura", "#8a1c1c", "Europe/Madrid"],
    );
  } finally {
    for (const variable of variables) delete process.env[variable];
  }
});

test("choices are saved with their version, applied everywhere and recorded without secrets", async () => {
  const done = await save(
    {
      organizationName: "Institución nueva",
      appName: "Acta Interna",
      locale: "es-ES",
      timezone: "America/Mexico_City",
      accent: "#1b4b8c",
    },
    0,
  );
  assert.equal(done.status, 201, JSON.stringify(done.data));
  assert.equal(done.data.version, 1);
  assert.equal(done.data.appName.source, "saved");
  assert.equal(done.data.shortName.source, "default");
  const publicView = await branding();
  assert.deepEqual(
    [
      publicView.organizationName,
      publicView.appName,
      publicView.locale,
      publicView.timezone,
      publicView.accent,
    ],
    [
      "Institución nueva",
      "Acta Interna",
      "es-ES",
      "America/Mexico_City",
      "#1b4b8c",
    ],
  );
  assert.equal(
    (await request("/auth/context")).data.institutionName,
    "Institución nueva",
  );
  assert.equal(
    (await request("/organization", { session: admin })).data.name,
    "Institución nueva",
  );
  const [event] = await audited("SETTINGS_UPDATED");
  assert.equal(event.objectType, "Organization");
  assert.equal(event.after.appName, "Acta Interna");
  assert.equal(event.before.organizationName, "Example organization");
  assert.ok(!JSON.stringify(event).includes(password));
  // The version the editor saw is stale: nothing changes.
  const stale = await save({ appName: "Otra" }, 0);
  assert.equal(stale.status, 409);
  assert.equal((await settings()).appName.value, "Acta Interna");
  // Two editors at once: exactly one wins.
  const race = await Promise.all([
    save({ shortName: "A" }, 1),
    save({ shortName: "B" }, 1),
  ]);
  assert.deepEqual(race.map((r) => r.status).sort(), [201, 409]);
  assert.equal((await settings()).version, 2);
});

test("what is not valid is refused with a reason next to the field", async () => {
  const version = (await settings()).version;
  const cases = [
    [{ accent: "#ffffff" }, "accent"],
    [{ accent: "azul" }, "accent"],
    [{ timezone: "Mars/Olympus" }, "timezone"],
    [{ locale: "xx-XX" }, "locale"],
    [{ appName: "   " }, "appName"],
    [{ organizationName: "x".repeat(201) }, "organizationName"],
  ];
  for (const [change, field] of cases) {
    const r = await save(change, version);
    assert.equal(r.status, 400, JSON.stringify(change));
    assert.ok(r.data.fieldErrors[field], JSON.stringify(r.data));
  }
  assert.equal((await save({}, version)).status, 400);
  assert.equal(
    (await save({ appName: "X", css: "body{}" }, version)).status,
    400,
  );
  assert.equal(
    (await save({ appName: "X", reset: ["appName"] }, version)).status,
    409,
  );
  assert.equal((await settings()).version, version);
});

test("a value the infrastructure controls cannot be changed from the panel, and it wins over a saved one", async () => {
  const before = await settings();
  process.env.APP_NAME = "Controlado por .env";
  try {
    const refused = await save(
      { appName: "Intento", shortName: "Corto" },
      before.version,
    );
    assert.equal(refused.status, 409);
    assert.match(refused.data.message, /APP_NAME/);
    assert.ok(refused.data.fieldErrors.appName);
    assert.equal(
      (await save({ reset: ["appName"] }, before.version)).status,
      409,
    );
    // Nothing was written, not even the open field sent alongside.
    const after = await settings();
    assert.equal(after.version, before.version);
    assert.equal(after.shortName.value, before.shortName.value);
    assert.equal(after.appName.value, "Controlado por .env");
    assert.equal((await branding()).appName, "Controlado por .env");
    // The open fields still work.
    assert.equal(
      (await save({ shortName: "Libre" }, before.version)).status,
      201,
    );
  } finally {
    delete process.env.APP_NAME;
  }
  // Without the variable the saved choice applies again: nothing was lost.
  assert.equal((await branding()).appName, "Acta Interna");
});

test("resetting a choice goes back to the default", async () => {
  const view = await settings();
  const done = await save({ reset: ["appName", "accent"] }, view.version);
  assert.equal(done.status, 201);
  assert.deepEqual(
    [done.data.appName.source, done.data.appName.value, done.data.accent.value],
    ["default", "Acta", "#2b4d7c"],
  );
  assert.equal((await branding()).appName, "Acta");
});

test("logos and favicons are checked by their bytes, stored privately and served safely", async () => {
  let version = (await settings()).version;
  // Refused: vector images, disguised files, damaged, wrong size or shape, wrong kind.
  const svg = Buffer.from(
    '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"/>',
  );
  const html = Buffer.from("<html><script>alert(1)</script></html>");
  const refused = [
    ["logo", svg, "SVG"],
    ["logo", html, "Formato"],
    ["logo", png(64).subarray(0, 60), "dañado"],
    ["logo", png(8), "pequeña"],
    ["logo", png(2100, 16), "grande"],
    ["logo", jpeg(8, 8), "pequeña"],
    ["favicon", png(64, 32), "cuadrado"],
    ["favicon", jpeg(32, 32), "Formato"],
    ["logo", Buffer.alloc(0), "vacío"],
  ];
  for (const [kind, bytes, hint] of refused) {
    const r = await upload(kind, bytes, version);
    assert.equal(r.status, 400, `${kind} ${hint}`);
    assert.match(r.data.message, new RegExp(hint, "i"));
  }
  assert.equal(
    (await upload("logo", Buffer.alloc(513 * 1024, 1), version)).status,
    413,
  );
  assert.equal(
    (await upload("logo", png(64), version, { type: "image/png" })).status,
    403,
  );
  assert.equal(
    (await upload("logo", png(64), version, { session: analyst })).status,
    403,
  );
  assert.equal((await upload("banner", png(64), version)).status, 400);
  assert.equal(await db.brandingAsset.count(), 0);
  // Accepted.
  const image = png(64);
  const stored = await upload("logo", image, version);
  assert.equal(stored.status, 201, JSON.stringify(stored.data));
  version = stored.data.version;
  assert.equal(stored.data.asset.source, "saved");
  assert.match(
    stored.data.asset.url,
    /^\/api\/v1\/configuration\/assets\/logo\?v=[0-9a-f]{12}$/,
  );
  assert.equal((await branding()).logo, stored.data.asset.url);
  // Anyone can see the logo (the sign-in page needs it) but only as an inert image.
  const served = await fetch(origin + stored.data.asset.url);
  assert.equal(served.status, 200);
  assert.equal(served.headers.get("content-type"), "image/png");
  assert.equal(served.headers.get("x-content-type-options"), "nosniff");
  assert.match(
    served.headers.get("content-security-policy"),
    /default-src 'none'/,
  );
  assert.deepEqual(Buffer.from(await served.arrayBuffer()), image);
  // fetch adds "no-cache" to conditional requests; a browser revalidating its cache does not.
  const revalidated = await new Promise((resolve) =>
    get(
      origin + stored.data.asset.url,
      { headers: { "If-None-Match": served.headers.get("etag") } },
      (res) => {
        res.resume();
        resolve(res.statusCode);
      },
    ),
  );
  assert.equal(revalidated, 304);
  // Replace with a different image, then a favicon as ICO and as PNG.
  const replaced = await upload("logo", jpeg(300, 80), version);
  assert.equal(replaced.status, 201);
  version = replaced.data.version;
  assert.equal(
    (await fetch(origin + replaced.data.asset.url)).headers.get("content-type"),
    "image/jpeg",
  );
  assert.equal(await db.brandingAsset.count({ where: { kind: "LOGO" } }), 1);
  const icon = await upload("favicon", ico(png(32)), version);
  assert.equal(icon.status, 201);
  version = icon.data.version;
  assert.equal(
    (await fetch(origin + icon.data.asset.url)).headers.get("content-type"),
    "image/x-icon",
  );
  const events = await audited("BRANDING_ASSET_CHANGED");
  assert.equal(events.length, 3);
  assert.ok(
    events.every((e) => !JSON.stringify(e).includes(image.toString("base64"))),
  );
  // The version the editor saw is stale.
  assert.equal(
    (await upload("favicon", ico(png(32)), version - 1)).status,
    409,
  );
  // The infrastructure's own logo wins and the panel cannot replace it.
  process.env.APP_LOGO = "/branding/institucion.png";
  try {
    assert.equal((await upload("logo", image, version)).status, 409);
    assert.equal(
      (
        await request("/settings/assets/logo/remove", {
          session: admin,
          method: "POST",
          body: { expectedVersion: version },
        })
      ).status,
      409,
    );
    assert.equal((await branding()).logo, "/branding/institucion.png");
    assert.equal((await settings()).logo.source, "external");
    assert.equal(
      (await fetch(origin + "/api/v1/configuration/assets/logo")).status,
      404,
    );
  } finally {
    delete process.env.APP_LOGO;
  }
  // Removing returns to no image.
  const removed = await request("/settings/assets/logo/remove", {
    session: admin,
    method: "POST",
    body: { expectedVersion: version },
  });
  assert.equal(removed.status, 201);
  assert.equal(removed.data.asset.source, "default");
  assert.equal((await branding()).logo, "");
  assert.equal(
    (await fetch(origin + "/api/v1/configuration/assets/logo")).status,
    404,
  );
  assert.equal(
    (
      await request("/settings/assets/logo/remove", {
        session: admin,
        method: "POST",
        body: { expectedVersion: removed.data.version },
      })
    ).status,
    404,
  );
  assert.equal((await audited("BRANDING_ASSET_REMOVED")).length, 1);
});

test("system status reports the installation without exposing any secret", async () => {
  const system = await request("/system", { session: admin });
  assert.equal(system.status, 200);
  const s = system.data;
  assert.match(s.version, /^\d+\.\d+\.\d+/);
  assert.equal(s.database.status, "ok");
  assert.equal(s.storage.provider, "LOCAL");
  assert.equal(s.storage.status, "ok");
  assert.equal(s.security.origin, origin);
  const text = JSON.stringify(s);
  for (const secret of [
    password,
    process.env.DATABASE_URL,
    "requirements_app",
    "S3_SECRET",
    "DATABASE_URL",
  ])
    assert.ok(!text.includes(secret), secret);
  const probe = await request("/system/storage-test", {
    session: admin,
    method: "POST",
  });
  assert.equal(probe.status, 201);
  assert.equal(probe.data.status, "ok");
  const [event] = await audited("STORAGE_CONNECTION_TESTED");
  assert.equal(event.after.status, "ok");
});

test("the second logo is optional, independent of the main one, checked like it, and the infrastructure can define it", async () => {
  // An installation that never uses it sees nothing change.
  const none = await settings();
  assert.deepEqual(
    [none.logoSecondary.source, none.secondaryName.source],
    ["default", "default"],
  );
  const bare = await branding();
  assert.deepEqual([bare.logoSecondary, bare.secondaryName], ["", ""]);
  let version = none.version;
  // Its entity is saved trimmed; the main logo and every other value are untouched.
  const named = await save(
    { secondaryName: "  Coordinación General de Sistemas e Informática " },
    version,
  );
  assert.equal(named.status, 201, JSON.stringify(named.data));
  version = named.data.version;
  assert.deepEqual(
    [named.data.secondaryName.value, named.data.secondaryName.source],
    ["Coordinación General de Sistemas e Informática", "saved"],
  );
  assert.equal(
    (await branding()).secondaryName,
    "Coordinación General de Sistemas e Informática",
  );
  // The same byte-level checks as the main logo.
  for (const [bytes, hint] of [
    [
      Buffer.from(
        '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"/>',
      ),
      "SVG",
    ],
    [Buffer.from("<html><script>alert(1)</script></html>"), "Formato"],
    [png(8), "pequeña"],
    [png(64).subarray(0, 60), "dañado"],
  ]) {
    const r = await upload("logoSecondary", bytes, version);
    assert.equal(r.status, 400, hint);
    assert.match(r.data.message, new RegExp(hint, "i"));
  }
  assert.equal(
    (await upload("logoSecondary", Buffer.alloc(513 * 1024, 1), version))
      .status,
    413,
  );
  assert.equal(
    (await upload("logoSecondary", png(64), version, { session: analyst }))
      .status,
    403,
  );
  assert.equal(
    await db.brandingAsset.count({ where: { kind: "LOGO_SECONDARY" } }),
    0,
  );
  // Accepted, served as an inert image, and a different address from the main logo.
  const mark = png(120, 40);
  const stored = await upload("logoSecondary", mark, version);
  assert.equal(stored.status, 201, JSON.stringify(stored.data));
  version = stored.data.version;
  assert.match(
    stored.data.asset.url,
    /^\/api\/v1\/configuration\/assets\/logoSecondary\?v=[0-9a-f]{12}$/,
  );
  const served = await fetch(origin + stored.data.asset.url);
  assert.equal(served.headers.get("content-type"), "image/png");
  assert.equal(served.headers.get("x-content-type-options"), "nosniff");
  assert.deepEqual(Buffer.from(await served.arrayBuffer()), mark);
  const both = await upload("logo", png(64), version);
  assert.equal(both.status, 201);
  version = both.data.version;
  const shown = await branding();
  assert.match(shown.logo, /assets\/logo\?v=/);
  assert.match(shown.logoSecondary, /assets\/logoSecondary\?v=/);
  assert.notEqual(shown.logo, shown.logoSecondary);
  assert.equal(
    await db.brandingAsset.count({
      where: { kind: { in: ["LOGO", "LOGO_SECONDARY"] } },
    }),
    2,
  );
  // Removing the main logo keeps the second, and the other way round.
  const noMain = await request("/settings/assets/logo/remove", {
    session: admin,
    method: "POST",
    body: { expectedVersion: version },
  });
  assert.equal(noMain.status, 201);
  version = noMain.data.version;
  assert.equal((await branding()).logo, "");
  assert.equal((await fetch(origin + shown.logoSecondary)).status, 200);
  // What the infrastructure defines wins and cannot be changed from the panel.
  Object.assign(process.env, {
    APP_LOGO_SECONDARY: "/branding/area.png",
    APP_SECONDARY_NAME: "Definida en .env",
  });
  try {
    const external = await settings();
    assert.deepEqual(
      [
        external.logoSecondary.source,
        external.logoSecondary.variable,
        external.secondaryName.source,
        external.secondaryName.variable,
      ],
      ["external", "APP_LOGO_SECONDARY", "external", "APP_SECONDARY_NAME"],
    );
    assert.equal((await upload("logoSecondary", png(64), version)).status, 409);
    assert.equal(
      (
        await request("/settings/assets/logoSecondary/remove", {
          session: admin,
          method: "POST",
          body: { expectedVersion: version },
        })
      ).status,
      409,
    );
    assert.equal(
      (await save({ secondaryName: "Intento" }, version)).status,
      409,
    );
    assert.equal(
      (await save({ reset: ["secondaryName"] }, version)).status,
      409,
    );
    const publicView = await branding();
    assert.deepEqual(
      [publicView.logoSecondary, publicView.secondaryName],
      ["/branding/area.png", "Definida en .env"],
    );
    assert.equal(
      (await fetch(origin + "/api/v1/configuration/assets/logoSecondary"))
        .status,
      404,
    );
  } finally {
    delete process.env.APP_LOGO_SECONDARY;
    delete process.env.APP_SECONDARY_NAME;
  }
  // Without the variables the saved choices apply again: nothing was lost.
  assert.match((await branding()).logoSecondary, /assets\/logoSecondary\?v=/);
  // Deleting the image and emptying the name leaves an installation with no second logo at all.
  const gone = await request("/settings/assets/logoSecondary/remove", {
    session: admin,
    method: "POST",
    body: { expectedVersion: version },
  });
  assert.equal(gone.status, 201);
  assert.equal(gone.data.asset.source, "default");
  const cleared = await save({ secondaryName: "" }, gone.data.version);
  assert.equal(cleared.status, 201);
  assert.equal(cleared.data.secondaryName.source, "default");
  const final = await branding();
  assert.deepEqual([final.logoSecondary, final.secondaryName], ["", ""]);
  assert.equal(
    (await fetch(origin + "/api/v1/configuration/assets/logoSecondary")).status,
    404,
  );
  const kinds = (await audited("BRANDING_ASSET_CHANGED")).map(
    (e) => e.after.kind,
  );
  assert.ok(kinds.includes("logoSecondary"));
  assert.ok(
    (await audited("BRANDING_ASSET_REMOVED")).some(
      (e) => e.before.kind === "logoSecondary",
    ),
  );
});

test("settings, images and the setup record survive a restart", async () => {
  await save({ shortName: "Persistente" }, (await settings()).version);
  const logo = await upload("logo", png(48), (await settings()).version);
  assert.equal(logo.status, 201);
  await app.close();
  const { createApp } = await import("../../app/backend/dist/main.js");
  app = await createApp();
  admin = await login("admin");
  const view = await settings();
  assert.equal(view.shortName.value, "Persistente");
  assert.equal(view.logo.source, "saved");
  assert.equal((await fetch(origin + view.logo.url)).status, 200);
  assert.deepEqual((await request("/setup/status")).data, {
    state: "COMPLETED",
  });
});
