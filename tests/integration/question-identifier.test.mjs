import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import { config } from "dotenv";
import pg from "pg";
config({ quiet: true });
const name = "identifier_test_" + randomBytes(6).toString("hex");
const ownerUrl = new URL(process.env.MIGRATION_DATABASE_URL);
const appUrl = new URL(process.env.DATABASE_URL);
const adminDb = new pg.Client({ connectionString: ownerUrl.href });
let app, db, createApp, admin, project, section, area;
const port = 4359;
const origin = "http://localhost:" + port;
const base = origin + "/api/v1";
const password = "Test-" + randomBytes(24).toString("base64url");
async function request(path, { session, method = "GET", body } = {}) {
  const r = await fetch(base + path, {
    method,
    headers: {
      Origin: origin,
      "Content-Type": "application/json",
      ...(session
        ? { Cookie: session.cookie, "X-CSRF-Token": session.csrf }
        : {}),
    },
    ...(method === "GET" ? {} : { body: JSON.stringify(body ?? {}) }),
  });
  return {
    status: r.status,
    data: await r.json(),
    cookie: r.headers.get("set-cookie"),
  };
}
let order = 0;
const input = (externalId) => ({
  externalId,
  sectionId: section.id,
  title: "Título ficticio",
  question: "¿Cómo se realiza este proceso ficticio?",
  helpText: "",
  type: "YES_NO",
  required: true,
  priority: "P1",
  responsibleAreaId: area.id,
  order: ++order,
  groupParentId: null,
  supersedesQuestionId: null,
  config: null,
  options: [],
  condition: null,
  references: [],
});
const create = (externalId) =>
  request(`/projects/${project.id}/questions`, {
    session: admin,
    method: "POST",
    body: input(externalId),
  });
before(async () => {
  await adminDb.connect();
  await adminDb.query(`CREATE DATABASE "${name}"`);
  ownerUrl.pathname = "/" + name;
  appUrl.pathname = "/" + name;
  const migrated = spawnSync(
    "npx",
    ["prisma", "migrate", "deploy", "--config", "app/backend/prisma.config.ts"],
    { encoding: "utf8", env: { ...process.env, DATABASE_URL: ownerUrl.href } },
  );
  assert.equal(migrated.status, 0, migrated.stdout + migrated.stderr);
  Object.assign(process.env, {
    DATABASE_URL: appUrl.href,
    APP_ORIGIN: origin,
    PORT: String(port),
    COOKIE_SECURE: "false",
    DEMO_SEED: "true",
    DEMO_PASSWORD: password,
    NODE_ENV: "test",
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
  ({ createApp } = await import("../../app/backend/dist/main.js"));
  app = await createApp();
  const r = await request("/auth/login", {
    method: "POST",
    body: { username: "admin", password },
  });
  assert.equal(r.status, 201, r.data.message);
  admin = { cookie: r.cookie.split(";")[0], csrf: r.data.csrfToken };
  area = await db.area.findFirstOrThrow({});
  project = (
    await request("/projects", {
      session: admin,
      method: "POST",
      body: {
        externalId: "TEST-ID",
        name: "Proyecto de pruebas",
        description: "",
      },
    })
  ).data;
  section = (
    await request(`/projects/${project.id}/sections`, {
      session: admin,
      method: "POST",
      body: { externalId: "TEST-S", title: "Tema", description: "", order: 1 },
    })
  ).data;
});
after(async () => {
  if (app) await app.close();
  if (db) await db.$disconnect();
  await adminDb.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
  await adminDb.end();
});

test("an identifier already used is refused next to its field", async () => {
  assert.equal((await create("P-001")).status, 201);
  const again = await create("P-001");
  assert.equal(again.status, 400);
  assert.match(again.data.fieldErrors.externalId, /Ya existe/);
  assert.equal(await db.question.count({ where: { externalId: "P-001" } }), 1);
});

test("two people saving the same suggestion at once: one wins, the other is told which field to change", async () => {
  const results = await Promise.all([
    create("P-002"),
    create("P-002"),
    create("P-002"),
  ]);
  const statuses = results.map((r) => r.status).sort();
  assert.deepEqual(statuses, [201, 400, 400]);
  for (const r of results.filter((r) => r.status === 400))
    assert.ok(r.data.fieldErrors.externalId);
  assert.equal(await db.question.count({ where: { externalId: "P-002" } }), 1);
  // The next free suggestion works, and existing identifiers are never changed.
  assert.equal((await create("P-003")).status, 201);
  const ids = (
    await db.question.findMany({
      where: { projectId: project.id },
      select: { externalId: true },
    })
  )
    .map((q) => q.externalId)
    .sort();
  assert.deepEqual(ids, ["P-001", "P-002", "P-003"]);
});
