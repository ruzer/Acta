import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { config } from "dotenv";
import pg from "pg";
config({ quiet: true });
const name = "bulk_users_test_" + randomBytes(6).toString("hex");
const ownerUrl = new URL(process.env.MIGRATION_DATABASE_URL),
  appUrl = new URL(process.env.DATABASE_URL);
const adminDb = new pg.Client({ connectionString: ownerUrl.href });
const origin = "http://localhost:4394",
  base = origin + "/api/v1";
const password = randomBytes(24).toString("base64url");
let app, db, admin, analyst, stakeholder, viewer, org, project, area, foreign;
const logs = [];
const oldError = console.error,
  oldLog = console.log;
async function request(
  path,
  { session, method = "GET", body, headers = {} } = {},
) {
  const r = await fetch(base + path, {
    method,
    headers: {
      Origin: origin,
      "Content-Type": "application/json",
      ...(session
        ? { Cookie: session.cookie, "X-CSRF-Token": session.csrf }
        : {}),
      ...headers,
    },
    ...(method === "GET" ? {} : { body: JSON.stringify(body ?? {}) }),
  });
  return {
    status: r.status,
    data: await r.json(),
    cookie: r.headers.get("set-cookie"),
    cache: r.headers.get("cache-control"),
  };
}
async function login(username, pass = password) {
  const r = await request("/auth/login", {
    method: "POST",
    body: { username, password: pass },
  });
  assert.equal(r.status, 201);
  return {
    cookie: r.cookie.split(";")[0],
    csrf: r.data.csrfToken,
    user: r.data.user,
  };
}
async function ok(path, body, session = admin, method = "POST") {
  const r = await request(path, { session, method, body });
  assert.ok(
    [200, 201].includes(r.status),
    `${path}: ${r.status} ${r.data.message}`,
  );
  return r.data;
}
const header = "Usuario\tNombre\tProyecto\tRol\tÁrea\n";
function table(prefix = randomBytes(5).toString("hex"), count = 2) {
  return (
    header +
    Array.from(
      { length: count },
      (_, i) =>
        `u-${prefix}-${i}\tPersona ficticia ${i}\t${project.externalId}\tParticipante\t${area.code}`,
    ).join("\n")
  );
}
async function command(text) {
  const p = await ok("/users/bulk/preview", { text });
  assert.equal(p.canConfirm, true, JSON.stringify(p.errors));
  return { text, previewHash: p.previewHash, requestId: randomUUID() };
}
const confirm = (body, session = admin) =>
  request("/users/bulk/confirm", { method: "POST", body, session });
const counts = async () => ({
  users: await db.user.count(),
  memberships: await db.projectMember.count(),
  audit: await db.auditEvent.count(),
});
before(
  async () => {
    await adminDb.connect();
    await adminDb.query(`CREATE DATABASE "${name}"`);
    ownerUrl.pathname = "/" + name;
    appUrl.pathname = "/" + name;
    const migrated = spawnSync(
      "npx",
      [
        "prisma",
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
    assert.equal(migrated.status, 0, migrated.stderr);
    Object.assign(process.env, {
      DATABASE_URL: appUrl.href,
      APP_ORIGIN: origin,
      PORT: "4394",
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
    const { PrismaClient } = await import("@prisma/client"),
      { PrismaPg } = await import("@prisma/adapter-pg");
    db = new PrismaClient({
      adapter: new PrismaPg({ connectionString: appUrl.href }),
    });
    await db.user.updateMany({ data: { mustChangePassword: false } });
    const { createApp } = await import("../../app/backend/dist/main.js");
    app = await createApp();
    admin = await login("admin");
    analyst = await login("analyst");
    stakeholder = await login("stakeholder");
    viewer = await login("viewer");
    org = await db.organization.findUnique({ where: { code: "DEFAULT" } });
    area = await db.area.findFirst({ where: { organizationId: org.id } });
    project = await ok("/projects", {
      externalId: "BULK-USERS-DEMO",
      name: "Proyecto ficticio para accesos",
      description: "",
    });
    foreign = await db.organization.create({
      data: { code: "BULK-OTHER", name: "Otra institución ficticia" },
    });
    await db.project.create({
      data: {
        organizationId: foreign.id,
        externalId: "FOREIGN",
        name: "Proyecto ajeno",
      },
    });
    await db.area.create({
      data: { organizationId: foreign.id, code: "FOREIGN", name: "Área ajena" },
    });
    console.error = (...args) => {
      logs.push(args.map(String).join(" "));
    };
    console.log = (...args) => {
      logs.push(args.map(String).join(" "));
    };
  },
  { timeout: 120000 },
);
after(async () => {
  console.error = oldError;
  console.log = oldLog;
  if (app) await app.close();
  if (db) await db.$disconnect();
  await adminDb.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
  await adminDb.end();
});

test("vista previa no escribe y rechaza errores por fila/columna sin filtrar otra institución", async () => {
  const before = await counts();
  const p = await ok("/users/bulk/preview", { text: table() });
  assert.equal(p.canConfirm, true);
  assert.deepEqual(await counts(), before);
  const text = header + "nuevo.demo\tPersona\tFOREIGN\tParticipante\tFOREIGN";
  const bad = await ok("/users/bulk/preview", { text });
  assert.equal(bad.canConfirm, false);
  assert.deepEqual(
    bad.errors.map((e) => e.column),
    ["Proyecto", "Área"],
  );
  assert.ok(bad.errors.every((e) => e.row === 2));
  assert.ok(!JSON.stringify(bad).includes("Proyecto ajeno"));
  assert.ok(!JSON.stringify(bad).includes("Área ajena"));
  const rejected = await confirm({
    text,
    requestId: randomUUID(),
    previewHash: bad.previewHash,
  });
  assert.equal(rejected.status, 400);
  assert.deepEqual(await counts(), before);
});
test("solo administración institucional; CSRF y datos ajenos no habilitan el lote", async () => {
  const body = await command(table());
  for (const session of [analyst, stakeholder, viewer])
    for (const path of ["preview", "confirm"])
      assert.equal(
        (
          await request("/users/bulk/" + path, {
            session,
            method: "POST",
            body: path === "preview" ? { text: body.text } : body,
          })
        ).status,
        403,
      );
  assert.equal(
    (
      await request("/users/bulk/preview", {
        method: "POST",
        body: { text: body.text },
      })
    ).status,
    401,
  );
  assert.equal(
    (
      await request("/users/bulk/confirm", {
        session: admin,
        method: "POST",
        body,
        headers: { "X-CSRF-Token": "incorrecto" },
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await request("/users/bulk/confirm", {
        session: admin,
        method: "POST",
        body,
        headers: { Origin: "http://otra.invalid" },
      })
    ).status,
    403,
  );
  const before = await counts();
  assert.equal(
    (await confirm({ ...body, organizationId: foreign.id })).status,
    400,
  );
  assert.deepEqual(await counts(), before);
});
test("confirma cuentas/membresías atómicas, entrega solo una vez y fuerza cambio sin secretos persistidos", async () => {
  const text = table();
  const cmd = await command(text);
  const result = await confirm(cmd);
  assert.equal(result.status, 201, logs.slice(-3).join("\n"));
  assert.equal(result.cache, "no-store");
  assert.equal(result.data.delivery, "NEW");
  assert.equal(result.data.users.length, 2);
  assert.equal(result.data.memberships, 2);
  const secrets = result.data.credentials.map((c) => c.temporaryPassword);
  const users = await db.user.findMany({
    where: { id: { in: result.data.users.map((u) => u.id) } },
  });
  assert.ok(
    users.every(
      (u) =>
        u.mustChangePassword &&
        !u.isOrganizationAdmin &&
        u.organizationId === org.id,
    ),
  );
  const audit = await db.auditEvent.findMany({
    where: { actorId: admin.user.id },
  });
  assert.ok(
    secrets.every(
      (p) => !JSON.stringify(audit).includes(p) && !logs.join("\n").includes(p),
    ),
  );
  assert.ok(!JSON.stringify(audit).includes("passwordHash"));
  const before = await counts();
  const replay = await confirm(cmd);
  assert.equal(replay.data.delivery, "REPLAY");
  assert.equal(Object.hasOwn(replay.data, "credentials"), false);
  assert.deepEqual(await counts(), before);
  assert.equal((await confirm({ ...cmd, text: table() })).status, 409);
  const c = result.data.credentials[0];
  const account = await login(c.username, c.temporaryPassword);
  assert.equal(account.user.mustChangePassword, true);
  assert.equal((await request("/projects", { session: account })).status, 403);
  const changed = await request("/auth/change-password", {
    session: account,
    method: "POST",
    body: {
      currentPassword: c.temporaryPassword,
      newPassword: randomBytes(24).toString("base64url"),
    },
  });
  assert.ok([200, 201].includes(changed.status), String(changed.status));
});
test("misma solicitud simultánea: una entrega y un recibo; usuarios distintos en solicitudes cruzadas no se duplican", async () => {
  const cmd = await command(table());
  const results = await Promise.all([confirm(cmd), confirm(cmd)]);
  assert.ok(results.every((r) => r.status === 201));
  assert.deepEqual(results.map((r) => r.data.delivery).sort(), [
    "NEW",
    "REPLAY",
  ]);
  const text = table();
  const a = await command(text),
    b = { ...a, requestId: randomUUID() };
  const overlap = await Promise.all([confirm(a), confirm(b)]);
  assert.equal(overlap.filter((r) => r.status === 201).length, 1);
  assert.ok(overlap.some((r) => [400, 409].includes(r.status)));
});
test("revalida nombre/estado de áreas, proyecto, permisos y cuentas entre revisión y confirmación", async () => {
  const cmd = await command(table());
  const original = area.name;
  await db.area.update({
    where: { id: area.id },
    data: { name: "Nombre cambiado" },
  });
  assert.equal((await confirm(cmd)).status, 409);
  await db.area.update({ where: { id: area.id }, data: { name: original } });
  await db.area.update({ where: { id: area.id }, data: { active: false } });
  assert.equal((await confirm(cmd)).status, 400);
  await db.area.update({ where: { id: area.id }, data: { active: true } });
  await db.project.update({
    where: { id: project.id },
    data: { lifecycle: "ARCHIVED" },
  });
  assert.equal((await confirm(cmd)).status, 400);
  await db.project.update({
    where: { id: project.id },
    data: { lifecycle: "ACTIVE" },
  });
  await db.user.update({
    where: { id: admin.user.id },
    data: { isOrganizationAdmin: false },
  });
  assert.equal((await confirm(cmd)).status, 403);
  await db.user.update({
    where: { id: admin.user.id },
    data: { isOrganizationAdmin: true },
  });
});
test("un fallo al crear la segunda membresía revierte cuentas, membresías y todos los eventos", async () => {
  const client = new pg.Client({ connectionString: ownerUrl.href });
  await client.connect();
  const prefix = "rollback" + randomBytes(4).toString("hex");
  const cmd = await command(table(prefix));
  const before = await counts();
  try {
    await client.query(
      `CREATE FUNCTION reject_bulk_test() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF EXISTS (SELECT 1 FROM "User" WHERE id=NEW."userId" AND username='u-${prefix}-1') THEN RAISE EXCEPTION 'rollback fixture'; END IF; RETURN NEW; END $$`,
    );
    await client.query(
      'CREATE TRIGGER reject_bulk_test BEFORE INSERT ON "ProjectMember" FOR EACH ROW EXECUTE FUNCTION reject_bulk_test()',
    );
    assert.equal((await confirm(cmd)).status, 500);
    assert.deepEqual(await counts(), before);
  } finally {
    await client.query(
      'DROP TRIGGER IF EXISTS reject_bulk_test ON "ProjectMember"',
    );
    await client.query("DROP FUNCTION IF EXISTS reject_bulk_test()");
    await client.end();
  }
});
test("aislamiento: un nombre ajeno no bloquea una cuenta local y administración de proyecto no basta", async () => {
  const username = "tenant-" + randomBytes(5).toString("hex");
  await db.user.create({
    data: {
      organizationId: foreign.id,
      username,
      displayName: "Persona de otra institución",
      passwordHash: null,
    },
  });
  const text =
    header +
    `${username}\tPersona local\t${project.externalId}\tAdministración del proyecto\t`;
  const result = await confirm(await command(text));
  assert.equal(result.status, 201);
  const created = result.data.users[0];
  assert.equal(
    (await db.user.findUnique({ where: { id: created.id } })).organizationId,
    org.id,
  );
  const credential = result.data.credentials[0];
  const session = await login(username, credential.temporaryPassword);
  await db.user.update({
    where: { id: created.id },
    data: { mustChangePassword: false },
  });
  assert.equal(
    (
      await request("/users/bulk/preview", {
        session,
        method: "POST",
        body: { text: table() },
      })
    ).status,
    403,
  );
  assert.equal(await db.user.count({ where: { username } }), 2);
});
test("50 filas y una cuenta en varios proyectos; límites sin escrituras", async () => {
  const text = table(undefined, 50);
  const cmd = await command(text);
  const begin = performance.now();
  const result = await confirm(cmd);
  assert.equal(result.status, 201, logs.slice(-3).join("\n"));
  assert.equal(result.data.users.length, 50);
  assert.equal(result.data.memberships, 50);
  oldLog(
    `BULK_MEASUREMENT 50 cuentas: ${Math.round(performance.now() - begin)} ms; RSS proceso: ${Math.round(process.memoryUsage().rss / 1024 / 1024)} MiB`,
  );
  const second = await ok("/projects", {
    externalId: "BULK-SECOND",
    name: "Segundo proyecto",
    description: "",
  });
  const repeat = table(undefined, 1);
  const shared = await confirm(
    await command(
      repeat +
        "\n" +
        repeat.split("\n")[1].replace(project.externalId, second.externalId),
    ),
  );
  assert.equal(shared.data.users.length, 1);
  assert.equal(shared.data.memberships, 2);
  const before = await counts();
  assert.equal(
    (
      await request("/users/bulk/preview", {
        method: "POST",
        session: admin,
        body: { text: "é".repeat(32769) },
      })
    ).status,
    400,
  );
  assert.deepEqual(await counts(), before);
});
