import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { config } from "dotenv";
import pg from "pg";
config({ quiet: true });
const name = "areas_test_" + randomBytes(6).toString("hex");
const ownerUrl = new URL(process.env.MIGRATION_DATABASE_URL);
const appUrl = new URL(process.env.DATABASE_URL);
const adminDb = new pg.Client({ connectionString: ownerUrl.href });
let app, db, createApp;
const port = 4339;
const origin = "http://localhost:" + port;
const base = origin + "/api/v1";
const password = "Test-" + randomBytes(24).toString("base64url");
let admin, analyst, stakeholder, viewer, project, section, stakeholderMember;
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
async function login(username) {
  const r = await request("/auth/login", {
    method: "POST",
    body: { username, password },
  });
  assert.equal(r.status, 201, r.data.message);
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
const update = (id, body, session = admin) =>
  request(`/areas/${id}`, { session, method: "POST", body });
const newArea = (code, areaName = "Área " + code) =>
  ok("/areas", { code, name: areaName });
let order = 0;
const input = (externalId, areaId, extra = {}) => ({
  externalId,
  sectionId: section.id,
  title: "Título ficticio",
  question: "¿Cómo se realiza este proceso ficticio?",
  helpText: "",
  type: "YES_NO",
  required: true,
  priority: "P1",
  responsibleAreaId: areaId,
  order: ++order,
  groupParentId: null,
  supersedesQuestionId: null,
  config: null,
  options: [],
  condition: null,
  references: [],
  ...extra,
});
const createQuestion = (externalId, areaId, session = admin) =>
  request(`/projects/${project.id}/questions`, {
    session,
    method: "POST",
    body: input(externalId, areaId),
  });
const version = async (id) =>
  (await db.question.findUniqueOrThrow({ where: { id } })).lockVersion;
const audits = (areaId) =>
  db.auditEvent.findMany({
    where: { action: "AREA_UPDATED", objectId: areaId },
    orderBy: { occurredAt: "asc" },
  });

before(async () => {
  await adminDb.connect();
  await adminDb.query(`CREATE DATABASE "${name}"`);
  ownerUrl.pathname = "/" + name;
  appUrl.pathname = "/" + name;
  const migrated = spawnSync(
    "npx",
    ["prisma", "migrate", "deploy", "--config", "app/backend/prisma.config.ts"],
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
  project = await ok("/projects", {
    externalId: "AREAS",
    name: "Proyecto de pruebas",
    description: "",
  });
  section = await ok(`/projects/${project.id}/sections`, {
    externalId: "S",
    title: "Tema",
    description: "",
    order: 1,
  });
});
after(async () => {
  if (app) await app.close();
  if (db) await db.$disconnect();
  await adminDb.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
  await adminDb.end();
});

test("only the organization administration edits areas", async () => {
  const a = await newArea("PERM");
  assert.equal(
    (await request(`/areas/${a.id}`, { method: "POST", body: { name: "X" } }))
      .status,
    401,
  );
  for (const session of [analyst, stakeholder, viewer]) {
    assert.equal(
      (await update(a.id, { name: "Intruso" }, session)).status,
      403,
    );
  }
  assert.equal(
    (await db.area.findUniqueOrThrow({ where: { id: a.id } })).name,
    "Área PERM",
  );
  assert.equal((await audits(a.id)).length, 0);
});

test("rename: the name changes, the code never does, and bad requests change nothing", async () => {
  const a = await newArea("REN");
  const renamed = await ok(`/areas/${a.id}`, {
    name: "  Dirección de Recursos Humanos ",
  });
  assert.deepEqual(renamed, {
    id: a.id,
    code: "REN",
    name: "Dirección de Recursos Humanos",
    active: true,
  });
  for (const body of [
    {},
    { name: "" },
    { name: "   " },
    { code: "OTRO" },
    { name: "Ok", code: "OTRO" },
    { active: "no" },
    { id: randomUUID() },
  ])
    assert.equal((await update(a.id, body)).status, 400, JSON.stringify(body));
  const row = await db.area.findUniqueOrThrow({ where: { id: a.id } });
  assert.equal(row.code, "REN");
  assert.equal(row.name, "Dirección de Recursos Humanos");
  assert.equal((await update(randomUUID(), { name: "Nada" })).status, 404);
  const events = await audits(a.id);
  assert.equal(events.length, 1);
  assert.deepEqual(events[0].before, { name: "Área REN", active: true });
  assert.deepEqual(events[0].after, {
    name: "Dirección de Recursos Humanos",
    active: true,
  });
  assert.equal(events[0].objectType, "Area");
  // Saying what is already true writes nothing and leaves no audit trail.
  await ok(`/areas/${a.id}`, {
    name: "Dirección de Recursos Humanos",
    active: true,
  });
  assert.equal((await audits(a.id)).length, 1);
});

test("deactivated areas stay listed with their state and can be reactivated; none is ever deleted", async () => {
  const a = await newArea("TOG");
  assert.equal((await ok(`/areas/${a.id}`, { active: false })).active, false);
  const listed = (await ok("/areas", undefined, admin, "GET")).find(
    (x) => x.id === a.id,
  );
  assert.deepEqual([listed.code, listed.active], ["TOG", false]);
  assert.equal((await ok(`/areas/${a.id}`, { active: true })).active, true);
  const events = await audits(a.id);
  assert.deepEqual(
    events.map((e) => [e.before.active, e.after.active]),
    [
      [true, false],
      [false, true],
    ],
  );
  assert.equal(
    (await request(`/areas/${a.id}`, { session: admin, method: "DELETE" }))
      .status,
    404,
  );
  // Referential integrity: an area with history cannot be removed from the database either.
  await createQuestion("TOG-1", a.id);
  await assert.rejects(db.area.delete({ where: { id: a.id } }));
});

test("an area of another organization is not found and not changed", async () => {
  const other = await db.organization.create({
    data: { code: "OTHER-AREAS", name: "Otra institución" },
  });
  const foreign = await db.area.create({
    data: { organizationId: other.id, code: "F", name: "Ajena" },
  });
  assert.equal(
    (await update(foreign.id, { name: "Cambiada", active: false })).status,
    404,
  );
  const row = await db.area.findUniqueOrThrow({ where: { id: foreign.id } });
  assert.deepEqual([row.name, row.active], ["Ajena", true]);
});

test("deactivating keeps what exists working and unchanged", async () => {
  const retiring = await newArea("RET");
  const keep = await newArea("KEEP");
  stakeholderMember = await ok(`/projects/${project.id}/members`, {
    userId: stakeholder.user.id,
    role: "STAKEHOLDER",
    areaId: retiring.id,
    active: true,
  });
  await ok(`/projects/${project.id}/members`, {
    userId: analyst.user.id,
    role: "ANALYST",
    areaId: null,
    active: true,
  });
  const published = await ok(
    `/projects/${project.id}/questions`,
    input("RET-PUB", retiring.id),
  );
  await ok(`/projects/${project.id}/questions/${published.id}/publish`, {
    expectedVersion: await version(published.id),
  });
  await ok(`/projects/${project.id}/questions/${published.id}/assign`, {
    projectMemberId: stakeholderMember.id,
    required: true,
    active: true,
    expectedVersion: await version(published.id),
  });
  const draft = await ok(
    `/projects/${project.id}/questions`,
    input("RET-DRAFT", retiring.id),
  );
  const snapshot = async () =>
    JSON.stringify({
      questions: (
        await db.question.findMany({
          where: { projectId: project.id },
          orderBy: { externalId: "asc" },
        })
      ).map((q) => [
        q.externalId,
        q.responsibleAreaId,
        q.publication,
        q.lockVersion,
      ]),
      assignments: await db.questionAssignment.findMany({
        where: { projectId: project.id },
        select: {
          questionId: true,
          projectMemberId: true,
          active: true,
          required: true,
        },
      }),
      members: await db.projectMember.findMany({
        where: { projectId: project.id },
        select: { userId: true, areaId: true, active: true, role: true },
        orderBy: { userId: "asc" },
      }),
    });
  const before = await snapshot();
  await ok(`/areas/${retiring.id}`, { active: false });
  assert.equal(
    await snapshot(),
    before,
    "no question, assignment or member is touched",
  );
  // The participant keeps working on what was already assigned.
  const mine = await request(
    `/projects/${project.id}/questions/${published.id}/clarifications`,
    { session: stakeholder },
  );
  assert.equal(mine.status, 200, JSON.stringify(mine.data));
  // The draft is still editable while it keeps its area; so are the member and the metadata.
  const edited = await ok(
    `/projects/${project.id}/questions/${draft.id}/draft`,
    {
      ...input("RET-DRAFT", retiring.id),
      question: "¿Se conserva la redacción?",
      expectedVersion: await version(draft.id),
    },
    admin,
    "PUT",
  );
  assert.equal(edited.responsibleAreaId, retiring.id);
  await ok(`/projects/${project.id}/questions/${draft.id}/metadata`, {
    priority: "P2",
    responsibleAreaId: retiring.id,
    order: 900,
    expectedVersion: await version(draft.id),
  });
  await ok(`/projects/${project.id}/members`, {
    userId: stakeholder.user.id,
    role: "STAKEHOLDER",
    areaId: retiring.id,
    active: true,
  });

  // New choices are refused, with the reason next to the field.
  const refused = await createQuestion("RET-NEW", retiring.id);
  assert.equal(refused.status, 400);
  assert.match(refused.data.fieldErrors.responsibleAreaId, /desactivada/);
  const other = await newArea("RET2");
  await ok(`/areas/${other.id}`, { active: false });
  const toOther = await request(
    `/projects/${project.id}/questions/${draft.id}/metadata`,
    {
      session: admin,
      method: "POST",
      body: {
        priority: "P2",
        responsibleAreaId: other.id,
        order: 900,
        expectedVersion: await version(draft.id),
      },
    },
  );
  assert.equal(toOther.status, 400);
  const member = await request(`/projects/${project.id}/members`, {
    session: admin,
    method: "POST",
    body: {
      userId: viewer.user.id,
      role: "STAKEHOLDER",
      areaId: retiring.id,
      active: true,
    },
  });
  assert.equal(member.status, 400);
  assert.match(member.data.fieldErrors.areaId, /desactivada/);
  const publish = await request(
    `/projects/${project.id}/questions/${draft.id}/publish`,
    {
      session: admin,
      method: "POST",
      body: { expectedVersion: await version(draft.id) },
    },
  );
  assert.equal(
    publish.status,
    400,
    "a question in a deactivated area is not published until it moves",
  );
  const invitation = await request(`/projects/${project.id}/invitations`, {
    session: admin,
    method: "POST",
    body: {
      requestId: randomUUID(),
      label: "Prueba",
      questionIds: [published.id],
      areaId: retiring.id,
      identity: { name: "Persona ficticia" },
      nonNominal: false,
      allowEvidence: false,
    },
  });
  assert.equal(invitation.status, 400);
  assert.match(invitation.data.message, /área activa/);

  // Moving the draft to an active area works; reactivating brings the old one back.
  await ok(`/projects/${project.id}/questions/${draft.id}/metadata`, {
    priority: "P2",
    responsibleAreaId: keep.id,
    order: 900,
    expectedVersion: await version(draft.id),
  });
  await ok(`/areas/${retiring.id}`, { active: true });
  assert.equal((await createQuestion("RET-BACK", retiring.id)).status, 201);
});

test("import names the exact problem with an existing area", async () => {
  const a = await newArea("IMP", "Área de importación");
  const empty = await ok("/projects", {
    externalId: "AREAS-IMPORT",
    name: "Proyecto vacío",
    description: "",
  });
  const file = JSON.parse(
    readFileSync("examples/questionnaire-template.minimal.json", "utf8"),
  );
  file.project.externalId = empty.externalId;
  file.areas = [{ code: "IMP", name: "Área de importación" }];
  file.questions.forEach((q) => (q.responsibleAreaCode = "IMP"));
  const preview = async (payload) => {
    const r = await fetch(`${base}/projects/${empty.id}/imports/preview`, {
      method: "POST",
      headers: {
        Origin: origin,
        Cookie: admin.cookie,
        "X-CSRF-Token": admin.csrf,
        "Content-Type": "application/octet-stream",
      },
      body: JSON.stringify(payload),
    });
    return (await r.json()).errors.map((e) => e.message);
  };
  assert.deepEqual(await preview(file), []);
  await ok(`/areas/${a.id}`, { name: "Nombre nuevo" });
  assert.match((await preview(file))[0], /«Nombre nuevo»/);
  await ok(`/areas/${a.id}`, { active: false });
  assert.match(
    (
      await preview({ ...file, areas: [{ code: "IMP", name: "Nombre nuevo" }] })
    )[0],
    /desactivada/,
  );
});

test("simultaneous edits of the same area all succeed and end in a consistent state", async () => {
  const a = await newArea("RACE");
  const attempts = Array.from({ length: 8 }, (_, i) =>
    update(a.id, { name: `Nombre ${i}`, active: i % 2 === 0 }),
  );
  const results = await Promise.all(attempts);
  assert.deepEqual([...new Set(results.map((r) => r.status))], [201]);
  const row = await db.area.findUniqueOrThrow({ where: { id: a.id } });
  const winners = results
    .map((r) => r.data)
    .filter((d) => d.name === row.name && d.active === row.active);
  assert.ok(
    winners.length >= 1,
    "the stored state is one of the requested ones",
  );
  const events = await audits(a.id);
  assert.ok(events.length >= 1 && events.length <= 8);
  // The audit trail chains: each change starts where the previous one ended.
  for (let i = 1; i < events.length; i++)
    assert.deepEqual(events[i].before, events[i - 1].after);
});

test("saving questions while an area is being deactivated never fails with a server error", async () => {
  const a = await newArea("LATE");
  const results = await Promise.all([
    update(a.id, { active: false }),
    ...Array.from({ length: 5 }, (_, i) => createQuestion(`LATE-${i}`, a.id)),
  ]);
  for (const r of results)
    assert.ok(
      [200, 201, 400].includes(r.status),
      `${r.status} ${JSON.stringify(r.data)}`,
    );
  assert.equal(results[0].status, 201);
});
