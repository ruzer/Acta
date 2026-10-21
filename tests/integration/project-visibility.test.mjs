import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { config } from "dotenv";
import pg from "pg";
config({ quiet: true });
const name = "visibility_test_" + randomBytes(6).toString("hex");
const ownerUrl = new URL(process.env.MIGRATION_DATABASE_URL);
const appUrl = new URL(process.env.DATABASE_URL);
const adminDb = new pg.Client({ connectionString: ownerUrl.href });
let app, db, createApp;
const port = 4319;
const origin = "http://localhost:" + port;
const base = origin + "/api/v1";
const password = "Test-" + randomBytes(24).toString("base64url");
let admin,
  admin2,
  analyst,
  stakeholder,
  viewer,
  otherAdmin,
  shared,
  secret,
  foreign;
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
    data: await r.json().catch(() => null),
    cookie: r.headers.get("set-cookie"),
  };
}
async function login(username) {
  const r = await request("/auth/login", {
    method: "POST",
    body: { username, password },
  });
  assert.equal(r.status, 201, r.data?.message);
  return {
    cookie: r.cookie.split(";")[0],
    csrf: r.data.csrfToken,
    user: r.data.user,
  };
}
async function ok(path, body, session = admin, method = "POST") {
  const r = await request(path, { session, method, body });
  assert.ok(
    r.status === 200 || r.status === 201,
    `${path}: ${r.status} ${JSON.stringify(r.data)}`,
  );
  return r.data;
}
const listing = (session) => request("/administration/projects", { session });
const members = (projectId) =>
  db.projectMember.findMany({
    where: { projectId },
    select: { userId: true, role: true, active: true },
    orderBy: { userId: "asc" },
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
    admin = await login("admin");
    analyst = await login("analyst");
    stakeholder = await login("stakeholder");
    viewer = await login("viewer");
    const second = await ok("/users", {
      username: "admin2",
      displayName: "Segunda administración",
      temporaryPassword: password,
      isOrganizationAdmin: true,
    });
    await db.user.update({
      where: { id: second.id },
      data: { mustChangePassword: false },
    });
    admin2 = await login("admin2");
    // The first administrator creates two projects; nobody else belongs to the second one.
    shared = await ok("/projects", {
      externalId: "SHARED",
      name: "Proyecto compartido",
      description: "",
    });
    secret = await ok("/projects", {
      externalId: "SECRET",
      name: "Proyecto reservado",
      description: "",
    });
    await ok(`/projects/${shared.id}/members`, {
      userId: analyst.user.id,
      role: "ANALYST",
      areaId: null,
      active: true,
    });
    await ok(`/projects/${shared.id}/members`, {
      userId: viewer.user.id,
      role: "VIEWER",
      areaId: null,
      active: true,
    });
    // Another institution, with its own administrator and project.
    const { hashPassword } =
      await import("../../app/backend/dist/auth/auth.service.js");
    const org2 = await db.organization.create({
      data: { code: "OTHER-VIS", name: "Otra institución ficticia" },
    });
    await db.user.create({
      data: {
        organizationId: org2.id,
        username: "otheradmin",
        displayName: "Administración externa",
        passwordHash: await hashPassword(password),
        mustChangePassword: false,
        isOrganizationAdmin: true,
      },
    });
    process.env.ORGANIZATION_CODE = "OTHER-VIS";
    otherAdmin = await login("otheradmin");
    foreign = await ok(
      "/projects",
      {
        externalId: "FOREIGN",
        name: "Proyecto de otra institución",
        description: "",
      },
      otherAdmin,
    );
    process.env.ORGANIZATION_CODE = "DEFAULT";
  },
  { timeout: 120000 },
);
after(async () => {
  if (app) await app.close();
  if (db) await db.$disconnect();
  await adminDb.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
  await adminDb.end();
});

test("a second administrator finds every project of the institution, with who runs it and no access of its own", async () => {
  const mine = (await request("/projects", { session: admin2 })).data;
  assert.deepEqual(mine, [], "Mis proyectos stays about participation");
  const r = await listing(admin2);
  assert.equal(r.status, 200);
  const byId = Object.fromEntries(r.data.map((p) => [p.externalId, p]));
  // The demo data brings two projects of its own; all four belong to this institution.
  assert.deepEqual(Object.keys(byId).sort(), [
    "DEMO-PRINCIPAL",
    "DEMO-SECUNDARIO",
    "SECRET",
    "SHARED",
  ]);
  assert.equal(byId.SECRET.myRole, null);
  assert.equal(byId.SECRET.adminCount, 1);
  assert.deepEqual(byId.SECRET.admins, [admin.user.displayName]);
  assert.equal(byId.SHARED.memberCount, 3);
  // The first administrator sees the same two, with the role it holds.
  const first = Object.fromEntries(
    (await listing(admin)).data.map((p) => [p.externalId, p]),
  );
  assert.equal(first.SECRET.myRole, "ADMIN");
  // The listing is metadata only: nothing of the content comes with it.
  assert.deepEqual(
    Object.keys(byId.SECRET).sort(),
    [
      "admins",
      "adminCount",
      "description",
      "externalId",
      "id",
      "lifecycle",
      "memberCount",
      "myRole",
      "name",
    ].sort(),
  );
});

test("listing a project opens none of its content: questionnaire, decisions, history and evidence stay behind membership", async () => {
  for (const path of [
    "questionnaire",
    "decisions",
    "history",
    "dashboard",
    `evidence/${randomUUID()}/download`,
  ]) {
    const r = await request(`/projects/${secret.id}/${path}`, {
      session: admin2,
    });
    assert.equal(r.status, 404, `${path}: ${r.status}`);
    assert.match(r.data.message, /no tienes acceso/, path);
  }
  // The same routes answer the member (the evidence id does not exist, but the project does).
  assert.equal(
    (await request(`/projects/${secret.id}/questionnaire`, { session: admin }))
      .status,
    200,
  );
  const own = await request(
    `/projects/${secret.id}/evidence/${randomUUID()}/download`,
    { session: admin },
  );
  assert.doesNotMatch(own.data.message ?? "", /no tienes acceso/);
  // Managing who belongs is the one thing the administration may do without belonging.
  assert.equal(
    (await request(`/projects/${secret.id}/members`, { session: admin2 }))
      .status,
    200,
  );
});

test("everyone who is not organization administration is refused, members or not", async () => {
  for (const session of [analyst, stakeholder, viewer]) {
    assert.equal((await listing(session)).status, 403);
  }
  // Their own list holds only what they belong to.
  assert.deepEqual(
    (await request("/projects", { session: analyst })).data
      .map((p) => p.externalId)
      .sort(),
    ["DEMO-PRINCIPAL", "SHARED"],
  );
  for (const session of [stakeholder, viewer])
    assert.ok(
      !(await request("/projects", { session })).data.some(
        (p) => p.externalId === "SECRET",
      ),
    );
  assert.equal((await request("/administration/projects")).status, 401);
  // Without membership the project does not exist for them.
  for (const session of [analyst, stakeholder, viewer])
    assert.equal(
      (await request(`/projects/${secret.id}/questionnaire`, { session }))
        .status,
      404,
    );
});

test("nobody can raise their own privileges through the project list or the members route", async () => {
  const before =
    JSON.stringify(await members(secret.id)) +
    JSON.stringify(await members(shared.id));
  for (const session of [analyst, viewer, stakeholder]) {
    const add = await request(`/projects/${shared.id}/members`, {
      session,
      method: "POST",
      body: {
        userId: session.user.id,
        role: "ADMIN",
        areaId: null,
        active: true,
      },
    });
    assert.ok([403, 404].includes(add.status), `${add.status}`);
    const secretAdd = await request(`/projects/${secret.id}/members`, {
      session,
      method: "POST",
      body: {
        userId: session.user.id,
        role: "ADMIN",
        areaId: null,
        active: true,
      },
    });
    assert.ok([403, 404].includes(secretAdd.status));
    assert.equal(
      (
        await request("/users", {
          session,
          method: "POST",
          body: {
            username: "ascenso",
            displayName: "x",
            temporaryPassword: password,
            isOrganizationAdmin: true,
          },
        })
      ).status,
      403,
    );
  }
  assert.equal(
    JSON.stringify(await members(secret.id)) +
      JSON.stringify(await members(shared.id)),
    before,
    "no membership changed",
  );
});

test("joining a project is an explicit, audited act of the administration, never automatic", async () => {
  const joined = await ok(
    `/projects/${secret.id}/members`,
    { userId: admin2.user.id, role: "ADMIN", areaId: null, active: true },
    admin2,
  );
  assert.equal(joined.role, "ADMIN");
  const events = await db.auditEvent.findMany({
    where: {
      action: "PROJECT_MEMBER_CHANGED",
      projectId: secret.id,
      actorId: admin2.user.id,
    },
  });
  assert.equal(events.length, 1);
  assert.equal(events[0].before, null);
  assert.equal(events[0].after.role, "ADMIN");
  assert.equal(
    (await request(`/projects/${secret.id}/questionnaire`, { session: admin2 }))
      .status,
    200,
  );
  assert.deepEqual(
    (await request("/projects", { session: admin2 })).data.map(
      (p) => p.externalId,
    ),
    ["SECRET"],
  );
  assert.equal(
    (await listing(admin2)).data.find((p) => p.externalId === "SECRET").myRole,
    "ADMIN",
  );
});

test("a project without an active administrator is listed so it can be given one", async () => {
  const orphan = await ok("/projects", {
    externalId: "ORPHAN",
    name: "Proyecto huérfano",
    description: "",
  });
  const before = JSON.stringify(await members(orphan.id));
  await ok(`/users/${admin.user.id}/set-active`, { active: false }, admin2);
  const row = (await listing(admin2)).data.find(
    (p) => p.externalId === "ORPHAN",
  );
  assert.deepEqual([row.adminCount, row.admins, row.memberCount], [0, [], 0]);
  assert.equal(
    JSON.stringify(await members(orphan.id)),
    before,
    "deactivating a user rewrites no membership",
  );
  // The administration gives it a new administrator; the deactivated one stays out of the count.
  await ok(
    `/projects/${orphan.id}/members`,
    { userId: analyst.user.id, role: "ADMIN", areaId: null, active: true },
    admin2,
  );
  const fixed = (await listing(admin2)).data.find(
    (p) => p.externalId === "ORPHAN",
  );
  assert.deepEqual(
    [fixed.adminCount, fixed.admins],
    [1, [analyst.user.displayName]],
  );
  await ok(`/users/${admin.user.id}/set-active`, { active: true }, admin2);
});

test("archived projects are listed and their membership is protected", async () => {
  await db.project.update({
    where: { id: shared.id },
    data: { lifecycle: "ARCHIVED" },
  });
  const row = (await listing(admin2)).data.find(
    (p) => p.externalId === "SHARED",
  );
  assert.equal(row.lifecycle, "ARCHIVED");
  const add = await request(`/projects/${shared.id}/members`, {
    session: admin2,
    method: "POST",
    body: { userId: admin2.user.id, role: "ADMIN", areaId: null, active: true },
  });
  assert.equal(add.status, 409);
  await db.project.update({
    where: { id: shared.id },
    data: { lifecycle: "ACTIVE" },
  });
});

test("another organization sees nothing of this one, and this one nothing of it", async () => {
  process.env.ORGANIZATION_CODE = "OTHER-VIS";
  try {
    const theirs = await listing(otherAdmin);
    assert.deepEqual(
      theirs.data.map((p) => p.externalId),
      ["FOREIGN"],
    );
    for (const path of [
      `${secret.id}/questionnaire`,
      `${secret.id}/members`,
      `${secret.id}/decisions`,
    ])
      assert.equal(
        (await request(`/projects/${path}`, { session: otherAdmin })).status,
        404,
        path,
      );
    const add = await request(`/projects/${secret.id}/members`, {
      session: otherAdmin,
      method: "POST",
      body: {
        userId: otherAdmin.user.id,
        role: "ADMIN",
        areaId: null,
        active: true,
      },
    });
    assert.equal(add.status, 404);
  } finally {
    process.env.ORGANIZATION_CODE = "DEFAULT";
  }
  const ours = (await listing(admin2)).data.map((p) => p.externalId);
  assert.ok(!ours.includes("FOREIGN"));
  assert.equal(
    (await request(`/projects/${foreign.id}/members`, { session: admin2 }))
      .status,
    404,
  );
});

test("a deactivated administrator loses the listing with the rest of their access", async () => {
  // The first administrator's sessions were closed when it was deactivated above: use the second.
  const temp = await ok(
    "/users",
    {
      username: "admin3",
      displayName: "Tercera administración",
      temporaryPassword: password,
      isOrganizationAdmin: true,
    },
    admin2,
  );
  await db.user.update({
    where: { id: temp.id },
    data: { mustChangePassword: false },
  });
  const session = await login("admin3");
  assert.equal((await listing(session)).status, 200);
  await ok(`/users/${temp.id}/set-active`, { active: false }, admin2);
  assert.ok([401, 403].includes((await listing(session)).status));
});
