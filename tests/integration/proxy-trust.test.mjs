import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { config } from "dotenv";
import pg from "pg";
config({ quiet: true });
const name = "acta_proxy_" + randomBytes(6).toString("hex");
const ownerUrl = new URL(process.env.MIGRATION_DATABASE_URL);
const runtimeUrl = new URL(process.env.DATABASE_URL);
const owner = new pg.Client({ connectionString: ownerUrl.href });
const origin = "http://localhost:4374";
const password = randomBytes(24).toString("base64url");
const code = randomBytes(32).toString("base64url");
const sha = (s) => createHash("sha256").update(s).digest("hex");
const a = "192.0.2.10",
  b = "192.0.2.20";
let app, db, root;
async function post(path, body, ip = a) {
  const r = await fetch(origin + "/api/v1" + path, {
    method: "POST",
    headers: {
      Origin: origin,
      "Content-Type": "application/json",
      "X-Forwarded-For": ip,
    },
    body: JSON.stringify(body),
  });
  await r.arrayBuffer();
  return r.status;
}
const login = (username, ip = a, pass = password) =>
  post("/auth/login", { username, password: pass }, ip);
before(
  async () => {
    await owner.connect();
    await owner.query(`CREATE DATABASE "${name}"`);
    ownerUrl.pathname = runtimeUrl.pathname = "/" + name;
    const migration = spawnSync(
      process.execPath,
      [
        "node_modules/prisma/build/index.js",
        "migrate",
        "deploy",
        "--config",
        "app/backend/prisma.config.ts",
      ],
      {
        encoding: "utf8",
        env: { ...process.env, DATABASE_URL: ownerUrl.href },
      },
    );
    assert.equal(migration.status, 0, migration.stdout + migration.stderr);
    root = await mkdtemp(join(tmpdir(), "acta-proxy-storage-"));
    Object.assign(process.env, {
      DATABASE_URL: runtimeUrl.href,
      APP_ORIGIN: origin,
      PORT: "4374",
      COOKIE_SECURE: "false",
      NODE_ENV: "test",
      ORGANIZATION_CODE: "DEFAULT",
      ORGANIZATION_NAME: "Example Organization",
      STORAGE_PROVIDER: "LOCAL",
      EVIDENCE_ROOT: root,
      DEMO_SEED: "false",
      SETUP_WIZARD: "auto",
      TRUSTED_PROXY_HOPS: "1",
    });
    const { PrismaClient } = await import("@prisma/client");
    const { PrismaPg } = await import("@prisma/adapter-pg");
    db = new PrismaClient({
      adapter: new PrismaPg({ connectionString: runtimeUrl.href }),
    });
    await db.installationSetup.create({
      data: {
        id: "installation",
        tokenHash: sha(code),
        tokenExpiresAt: new Date(Date.now() + 600000),
      },
    });
    const { createApp } = await import("../../app/backend/dist/main.js");
    app = await createApp();
  },
  { timeout: 120000 },
);
after(async () => {
  await app?.close();
  await db?.$disconnect();
  await owner.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
  await owner.end();
  if (root) await rm(root, { recursive: true, force: true });
});
test("setup codes: ten failures from A block A, not a valid code from B", async () => {
  for (let i = 0; i < 10; i++)
    assert.equal(await post("/setup/verify", { token: "x".repeat(43) }), 403);
  assert.equal(await post("/setup/verify", { token: code }), 429);
  assert.equal(await post("/setup/verify", { token: code }, b), 200);
  assert.equal(
    await db.loginAttempt.count({ where: { ipKeyHash: sha("setup:" + a) } }),
    10,
  );
});
test("login: ten nonexistent accounts from A do not block viewer or admin from B", async () => {
  Object.assign(process.env, { DEMO_SEED: "true", DEMO_PASSWORD: password });
  const seed = spawnSync(process.execPath, ["app/backend/dist/seed.js"], {
    encoding: "utf8",
    env: process.env,
  });
  assert.equal(seed.status, 0, seed.stderr);
  await db.loginAttempt.deleteMany();
  for (let i = 0; i < 10; i++) assert.equal(await login(`missing_${i}`), 401);
  assert.equal(await login("viewer"), 429);
  assert.equal(await login("viewer", b), 201);
  assert.equal(await login("admin", b), 201);
  assert.equal(
    await db.loginAttempt.count({
      where: { ipKeyHash: sha(a), success: false },
    }),
    10,
  );
  assert.equal(
    await db.loginAttempt.count({
      where: { ipKeyHash: sha(b), success: true },
    }),
    2,
  );
});
test("the account limit still applies across different client addresses", async () => {
  await db.loginAttempt.deleteMany();
  for (let i = 0; i < 10; i++)
    assert.equal(
      await login("viewer", `192.0.2.${40 + i}`, "incorrect-example-password"),
      401,
    );
  assert.equal(await login("viewer", b), 429);
  assert.equal(await login("admin", b), 201);
});
test("mapped IPv4 and canonical IPv6 use one hashed network key", async () => {
  await db.loginAttempt.deleteMany();
  assert.equal(await login("missing_mapped", "::ffff:192.0.2.10"), 401);
  assert.equal(await login("missing_v4", a), 401);
  assert.equal(
    await db.loginAttempt.count({ where: { ipKeyHash: sha(a) } }),
    2,
  );
  assert.equal(await login("missing_v6", "2001:0DB8:0:0::0001"), 401);
  assert.equal(await login("missing_v6_other", "2001:db8::1"), 401);
  assert.equal(
    await db.loginAttempt.count({ where: { ipKeyHash: sha("2001:db8::1") } }),
    2,
  );
});
test("invitation exchange limits are isolated by the trusted client address", async (t) => {
  const now = Date.now();
  t.mock.method(Date, "now", () => now);
  await db.invitationRateBucket.deleteMany();
  const token = randomBytes(32).toString("base64url");
  for (let i = 0; i < 30; i++)
    assert.equal(await post("/invitations/access/exchange", { token }), 401);
  assert.equal(await post("/invitations/access/exchange", { token }), 429);
  assert.equal(await post("/invitations/access/exchange", { token }, b), 401);
  const bucket = Math.floor(now / 900000);
  assert.equal(
    (
      await db.invitationRateBucket.findUniqueOrThrow({
        where: { key: sha(`invitation:invalid-exchange:${bucket}:${b}`) },
      })
    ).count,
    1,
  );
  // Malformed payloads are limited in the guard, before the input pipe/controller.
  assert.equal(
    await post("/invitations/access/exchange", { token: "malformed" }),
    429,
  );
  assert.equal(
    await post("/invitations/access/exchange", { token: "malformed" }, b),
    400,
  );
});
test("invitation session failures also use the normalized trusted address", async (t) => {
  const now = Date.now();
  t.mock.method(Date, "now", () => now);
  await db.invitationRateBucket.deleteMany();
  for (const ip of [a, "::ffff:192.0.2.10", b]) {
    const r = await fetch(origin + "/api/v1/invitations/access", {
      headers: { "X-Forwarded-For": ip },
    });
    assert.equal(r.status, 401);
    await r.arrayBuffer();
  }
  const bucket = Math.floor(now / 60000);
  for (const [ip, count] of [
    [a, 2],
    [b, 1],
  ])
    assert.equal(
      (
        await db.invitationRateBucket.findUniqueOrThrow({
          where: { key: sha(`invitation:invalid-access:${bucket}:${ip}`) },
        })
      ).count,
      count,
    );
});
