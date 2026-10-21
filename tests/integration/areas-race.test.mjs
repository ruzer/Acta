import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";
import { config } from "dotenv";
import pg from "pg";
config({ quiet: true });
const name = "areas_race_" + randomBytes(6).toString("hex");
const ownerUrl = new URL(process.env.MIGRATION_DATABASE_URL);
const appUrl = new URL(process.env.DATABASE_URL);
const adminDb = new pg.Client({ connectionString: ownerUrl.href });
let holder, app, db, createApp, admin, stakeholder, project, section, fallback;
const port = 4329;
const origin = "http://localhost:" + port;
const base = origin + "/api/v1";
const password = "Test-" + randomBytes(24).toString("base64url");
async function request(path, { session, method = "GET", body, headers } = {}) {
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
    ...(method === "GET"
      ? {}
      : { body: typeof body === "string" ? body : JSON.stringify(body ?? {}) }),
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
let order = 0;
const input = (externalId, areaId) => ({
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
});
const version = async (id) =>
  (await db.question.findUniqueOrThrow({ where: { id } })).lockVersion;
const newArea = (code) => ok("/areas", { code, name: "Área " + code });

/**
 * Another transaction is deactivating `areaId` and has not committed. `action` is the write under
 * test: it must wait for that transaction instead of reading the old state, and then be refused.
 */
async function duringDeactivation(areaId, action) {
  await holder.query("BEGIN");
  await holder.query('UPDATE "Area" SET active=false WHERE id=$1', [areaId]);
  const pending = action();
  const state = await Promise.race([
    pending.then(() => "answered"),
    sleep(700).then(() => "waiting"),
  ]);
  const answer = state === "waiting" ? undefined : await pending;
  await holder.query("COMMIT");
  assert.equal(
    state,
    "waiting",
    `the write answered ${answer?.status} without waiting for the deactivation`,
  );
  return pending;
}

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
  holder = new pg.Client({ connectionString: ownerUrl.href });
  await holder.connect();
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
  stakeholder = await login("stakeholder");
  fallback = await newArea("FALLBACK");
  project = await ok("/projects", {
    externalId: "RACE",
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
  if (holder) await holder.end();
  await adminDb.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
  await adminDb.end();
});

test("a question cannot be created or moved into an area that is being deactivated", async () => {
  const a = await newArea("Q-RACE");
  const created = await duringDeactivation(a.id, () =>
    request(`/projects/${project.id}/questions`, {
      session: admin,
      method: "POST",
      body: input("RACE-NEW", a.id),
    }),
  );
  assert.equal(created.status, 400);
  assert.ok(created.data.fieldErrors.responsibleAreaId);
  assert.equal(
    await db.question.count({ where: { externalId: "RACE-NEW" } }),
    0,
  );

  const b = await newArea("Q-RACE-2");
  const draft = await ok(
    `/projects/${project.id}/questions`,
    input("RACE-MOVE", fallback.id),
  );
  const moved = await duringDeactivation(b.id, async () =>
    request(`/projects/${project.id}/questions/${draft.id}/metadata`, {
      session: admin,
      method: "POST",
      body: {
        priority: "P2",
        responsibleAreaId: b.id,
        order: 900,
        expectedVersion: await version(draft.id),
      },
    }),
  );
  assert.equal(moved.status, 400);
  assert.equal(
    (await db.question.findUniqueOrThrow({ where: { id: draft.id } }))
      .responsibleAreaId,
    fallback.id,
  );
});

test("a member cannot join an area that is being deactivated, and its participants cannot receive new assignments", async () => {
  const a = await newArea("M-RACE");
  const joined = await duringDeactivation(a.id, () =>
    request(`/projects/${project.id}/members`, {
      session: admin,
      method: "POST",
      body: {
        userId: stakeholder.user.id,
        role: "STAKEHOLDER",
        areaId: a.id,
        active: true,
      },
    }),
  );
  assert.equal(joined.status, 400);
  assert.equal(
    await db.projectMember.count({
      where: { projectId: project.id, userId: stakeholder.user.id },
    }),
    0,
  );

  // A participant of an area that is being deactivated gets no new assignment either.
  const b = await newArea("P-RACE");
  const member = await ok(`/projects/${project.id}/members`, {
    userId: stakeholder.user.id,
    role: "STAKEHOLDER",
    areaId: b.id,
    active: true,
  });
  const question = await ok(
    `/projects/${project.id}/questions`,
    input("RACE-ASSIGN", fallback.id),
  );
  await ok(`/projects/${project.id}/questions/${question.id}/publish`, {
    expectedVersion: await version(question.id),
  });
  const assigned = await duringDeactivation(b.id, async () =>
    request(`/projects/${project.id}/questions/${question.id}/assign`, {
      session: admin,
      method: "POST",
      body: {
        projectMemberId: member.id,
        required: true,
        active: true,
        expectedVersion: await version(question.id),
      },
    }),
  );
  assert.equal(assigned.status, 400);
  assert.equal(
    await db.questionAssignment.count({ where: { questionId: question.id } }),
    0,
  );

  // What was assigned before the deactivation stays: the participant keeps its access.
  const other = await newArea("P-KEEP");
  await ok(`/projects/${project.id}/members`, {
    userId: stakeholder.user.id,
    role: "STAKEHOLDER",
    areaId: other.id,
    active: true,
  });
  await ok(`/projects/${project.id}/questions/${question.id}/assign`, {
    projectMemberId: member.id,
    required: true,
    active: true,
    expectedVersion: await version(question.id),
  });
  await ok(`/areas/${other.id}`, { active: false });
  const mine = await request(
    `/projects/${project.id}/questions/${question.id}/clarifications`,
    { session: stakeholder },
  );
  assert.equal(mine.status, 200, JSON.stringify(mine.data));
  assert.equal(
    await db.questionAssignment.count({
      where: { questionId: question.id, active: true },
    }),
    1,
  );
});

test("an invitation cannot be created for an area that is being deactivated", async () => {
  const a = await newArea("I-RACE");
  const question = await ok(
    `/projects/${project.id}/questions`,
    input("RACE-INVITE", fallback.id),
  );
  await ok(`/projects/${project.id}/questions/${question.id}/publish`, {
    expectedVersion: await version(question.id),
  });
  const invited = await duringDeactivation(a.id, () =>
    request(`/projects/${project.id}/invitations`, {
      session: admin,
      method: "POST",
      body: {
        requestId: randomUUID(),
        label: "Prueba",
        questionIds: [question.id],
        areaId: a.id,
        identity: { name: "Persona ficticia" },
        nonNominal: false,
        allowEvidence: false,
      },
    }),
  );
  assert.equal(invited.status, 400);
  assert.match(invited.data.message, /área activa/);
  assert.equal(
    await db.responseInvitation.count({ where: { areaId: a.id } }),
    0,
  );
});

test("a bulk area change or participant addition does not reach an area that is being deactivated", async () => {
  const target = await newArea("B-RACE");
  const draft = await ok(
    `/projects/${project.id}/questions`,
    input("RACE-BULK", fallback.id),
  );
  const command = {
    requestId: randomUUID(),
    questions: [{ id: draft.id, expectedVersion: await version(draft.id) }],
    targetAreaId: target.id,
    sourceAreaId: null,
  };
  const preview = await ok(
    `/projects/${project.id}/questions/bulk/area/preview`,
    command,
  );
  const confirmed = await duringDeactivation(target.id, () =>
    request(`/projects/${project.id}/questions/bulk/area/confirm`, {
      session: admin,
      method: "POST",
      body: { ...command, previewHash: preview.previewHash },
    }),
  );
  assert.equal(confirmed.status, 400);
  assert.equal(
    (await db.question.findUniqueOrThrow({ where: { id: draft.id } }))
      .responsibleAreaId,
    fallback.id,
  );
});

test("an import confirmed while an area it names is being deactivated is refused", async () => {
  const a = await newArea("IMPORT-RACE");
  const empty = await ok("/projects", {
    externalId: "RACE-IMPORT",
    name: "Importación",
    description: "",
  });
  const file = JSON.parse(
    readFileSync("examples/questionnaire-template.minimal.json", "utf8"),
  );
  file.project.externalId = empty.externalId;
  file.areas = [{ code: a.code, name: a.name }];
  file.questions.forEach((q) => (q.responsibleAreaCode = a.code));
  const send = (command) =>
    fetch(
      `${base}/projects/${empty.id}/imports/${command ? "confirm" : "preview"}`,
      {
        method: "POST",
        headers: {
          Origin: origin,
          Cookie: admin.cookie,
          "X-CSRF-Token": admin.csrf,
          "Content-Type": "application/octet-stream",
          ...(command
            ? {
                "X-Import-Command": encodeURIComponent(JSON.stringify(command)),
              }
            : {}),
        },
        body: JSON.stringify(file),
      },
    ).then(async (r) => ({ status: r.status, data: await r.json() }));
  const preview = await send();
  assert.deepEqual(preview.data.errors, []);
  const refused = await duringDeactivation(a.id, () =>
    send({
      payloadHash: preview.data.payloadHash,
      expectedProjectVersion: preview.data.expectedProjectVersion,
      requestId: randomUUID(),
      createMissingAreas: false,
    }),
  );
  assert.equal(refused.status, 400);
  assert.equal(await db.question.count({ where: { projectId: empty.id } }), 0);
});
