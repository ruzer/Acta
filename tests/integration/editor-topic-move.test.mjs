import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import { config } from "dotenv";
import pg from "pg";
config({ quiet: true });
const name = "editor_move_test_" + randomBytes(6).toString("hex");
const ownerUrl = new URL(process.env.MIGRATION_DATABASE_URL);
const appUrl = new URL(process.env.DATABASE_URL);
const adminDb = new pg.Client({ connectionString: ownerUrl.href });
let app, db, createApp, admin, project, section, area;
const port = 5398;
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
const create = (externalId, extra = {}) =>
  request(`/projects/${project.id}/questions`, {
    session: admin,
    method: "POST",
    body: { ...input(externalId), ...extra },
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

async function ok(path, body, method = "POST") {
  const r = await request(path, { session: admin, method, body });
  assert.ok([200, 201].includes(r.status), `${r.status}: ${r.data.message}`);
  return r.data;
}
function editable(q, extra = {}) {
  const {
    id: _id,
    publication: _publication,
    status: _status,
    lockVersion,
    revisionNumber: _revisionNumber,
    assignments: _assignments,
    ...d
  } = q;
  return { ...d, expectedVersion: lockVersion, ...extra };
}
let serial = 0;
async function fixture({ nested = true } = {}) {
  serial++;
  project = await ok("/projects", {
    externalId: `MOVE-${serial}`,
    name: "Proyecto ficticio",
    description: "",
  });
  const sections = [];
  for (let i = 0; i < 3; i++)
    sections.push(
      await ok(`/projects/${project.id}/sections`, {
        externalId: `T-${i}`,
        title: `Tema ${i}`,
        description: "",
        order: i,
      }),
    );
  section = sections[0];
  const root = (await create("ROOT", { order: 0 })).data;
  const child = nested
    ? (
        await create("CHILD", {
          order: 1,
          groupParentId: root.id,
          condition: {
            parentQuestionId: root.id,
            operator: "EQUALS",
            value: true,
          },
        })
      ).data
    : null;
  const grandchild = nested
    ? (await create("GRANDCHILD", { order: 2, groupParentId: child.id })).data
    : null;
  const destination = (
    await create("DEST", { sectionId: sections[1].id, order: 0 })
  ).data;
  return {
    project: { ...project },
    sections,
    root,
    child,
    grandchild,
    destination,
  };
}
const snapshot = (p) => ok(`/projects/${p.id}/questionnaire`, undefined, "GET");
const edit = (p, q, extra) =>
  request(`/projects/${p.id}/questions/${q.id}/draft`, {
    session: admin,
    method: "PUT",
    body: editable(q, extra),
  });
function moveCommand(view, sections, ids) {
  return {
    expectedVersion: view.structureVersion,
    sections: sections.slice(0, 2).map((s, i) => {
      const rows = view.questions
        .filter((q) => q.sectionId === s.id)
        .sort((a, b) => a.order - b.order);
      return {
        sectionId: s.id,
        expected: rows.map(({ id, order, lockVersion }) => ({
          id,
          order,
          lockVersion,
        })),
        orderedIds: [
          ...rows
            .filter((q) => q.publication !== "ARCHIVED" && !ids.includes(q.id))
            .map((q) => q.id),
          ...(i ? ids : []),
        ],
      };
    }),
  };
}
async function ledger(p) {
  return db.auditEvent.findMany({
    where: { projectId: p.id },
    orderBy: { id: "asc" },
  });
}
async function unchanged(p, before, auditBefore) {
  assert.deepEqual(await snapshot(p), before);
  assert.deepEqual(await ledger(p), auditBefore);
}

test("edición y tema se guardan juntos al final, reservando archivadas y auditando una sola vez", async () => {
  const f = await fixture({ nested: false });
  const reserved = (
    await create("RESERVED", { sectionId: f.sections[1].id, order: 1 })
  ).data;
  await db.question.update({
    where: { id: reserved.id },
    data: { publication: "ARCHIVED" },
  });
  const before = await snapshot(f.project);
  const result = await edit(f.project, f.root, {
    sectionId: f.sections[1].id,
    order: 0,
    question: "¿Texto nuevo?",
  });
  assert.equal(result.status, 200, result.data.message);
  assert.equal(result.data.order, 2);
  assert.equal(result.data.lockVersion, f.root.lockVersion + 1);
  assert.equal(result.data.revisionNumber, f.root.revisionNumber + 1);
  assert.equal(
    (await snapshot(f.project)).structureVersion,
    before.structureVersion + 1,
  );
  const revision = await db.questionRevision.findFirstOrThrow({
    where: { questionId: f.root.id },
    orderBy: { number: "desc" },
  });
  assert.equal(revision.snapshot.order, 2);
  const events = (await ledger(f.project)).filter((e) =>
    ["QUESTION_UPDATED", "QUESTION_MOVED"].includes(e.action),
  );
  assert.equal(events.length, 2);
  assert.deepEqual(events.map((e) => e.eventIndex).sort(), [0, 1]);
  assert.equal(new Set(events.map((e) => e.requestId)).size, 1);
  const after = await snapshot(f.project),
    auditAfter = await ledger(f.project);
  assert.equal(
    (
      await edit(f.project, f.root, {
        sectionId: f.sections[1].id,
        order: 0,
        question: "¿Texto nuevo?",
      })
    ).status,
    409,
  );
  await unchanged(f.project, after, auditAfter);
});

for (const selected of ["root", "child", "grandchild"])
  test(`editar ${selected} mueve la familia anidada entera sin alterar otros contenidos`, async () => {
    const f = await fixture();
    const before = await snapshot(f.project);
    const r = await edit(f.project, f[selected], {
      sectionId: f.sections[1].id,
      order: 500,
      question: "¿Contenido corregido?",
    });
    assert.equal(r.status, 200, r.data.message);
    const after = await snapshot(f.project);
    for (const key of ["root", "child", "grandchild"]) {
      const old = before.questions.find((q) => q.id === f[key].id),
        next = after.questions.find((q) => q.id === f[key].id);
      assert.equal(next.sectionId, f.sections[1].id);
      assert.equal(next.lockVersion, old.lockVersion + 1);
      assert.equal(
        next.revisionNumber,
        old.revisionNumber + Number(key === selected),
      );
      assert.deepEqual(next.assignments, old.assignments);
      assert.deepEqual(next.references, old.references);
      assert.deepEqual(next.condition, old.condition);
      assert.equal(next.groupParentId, old.groupParentId);
      if (key !== selected) assert.equal(next.question, old.question);
    }
    assert.deepEqual(
      after.questions
        .filter((q) => q.sectionId === f.sections[1].id)
        .sort((a, b) => a.order - b.order)
        .map((q) => q.id),
      [f.destination.id, f.root.id, f.child.id, f.grandchild.id],
    );
    assert.equal(after.structureVersion, before.structureVersion + 1);
  });

for (const state of ["PUBLISHED", "ARCHIVED"])
  test(`un seguimiento ${state} bloquea toda la familia con su nombre`, async () => {
    const f = await fixture();
    await db.question.update({
      where: { id: f.grandchild.id },
      data: {
        publication: state,
        ...(state === "PUBLISHED" ? { publishedRevisionNumber: 1 } : {}),
      },
    });
    const before = await snapshot(f.project),
      auditBefore = await ledger(f.project);
    const r = await edit(f.project, f.child, { sectionId: f.sections[1].id });
    assert.equal(r.status, 409);
    assert.match(r.data.message, /GRANDCHILD|Título ficticio/);
    await unchanged(f.project, before, auditBefore);
  });

test("rechaza cambiar tema y vínculo a la vez y un destino de otro proyecto", async () => {
  const f = await fixture(),
    foreign = await fixture({ nested: false });
  const before = await snapshot(f.project),
    auditBefore = await ledger(f.project);
  assert.equal(
    (
      await edit(f.project, f.child, {
        sectionId: f.sections[1].id,
        groupParentId: null,
      })
    ).status,
    409,
  );
  assert.equal(
    (await edit(f.project, f.root, { sectionId: foreign.sections[0].id }))
      .status,
    404,
  );
  await unchanged(f.project, before, auditBefore);
});

test("reorder mueve familia completa, rechaza parcial/no relacionada y el reintento queda obsoleto", async () => {
  const f = await fixture(),
    before = await snapshot(f.project),
    auditBefore = await ledger(f.project);
  const path = `/projects/${f.project.id}/questions/reorder`;
  for (const ids of [[f.root.id], [f.child.id, f.grandchild.id]]) {
    const r = await request(path, {
      session: admin,
      method: "POST",
      body: moveCommand(before, f.sections, ids),
    });
    assert.equal(r.status, 409);
    await unchanged(f.project, before, auditBefore);
  }
  const body = moveCommand(before, f.sections, [
    f.root.id,
    f.child.id,
    f.grandchild.id,
  ]);
  const moved = await ok(path, body);
  assert.equal(moved.structureVersion, before.structureVersion + 1);
  const after = await snapshot(f.project),
    auditAfter = await ledger(f.project);
  for (const old of before.questions)
    assert.equal(
      after.questions.find((q) => q.id === old.id).revisionNumber,
      old.revisionNumber,
    );
  assert.equal(
    (await request(path, { session: admin, method: "POST", body })).status,
    409,
  );
  await unchanged(f.project, after, auditAfter);
});

test("dos ediciones concurrentes tienen un ganador; ninguna revisión ni traslado se duplica", async () => {
  const f = await fixture();
  const results = await Promise.all([
    edit(f.project, f.root, { sectionId: f.sections[1].id }),
    edit(f.project, f.root, { sectionId: f.sections[2].id }),
  ]);
  assert.deepEqual(results.map((r) => r.status).sort(), [200, 409]);
  const view = await snapshot(f.project);
  assert.equal(
    view.questions.find((q) => q.id === f.root.id).revisionNumber,
    f.root.revisionNumber + 1,
  );
  assert.equal(
    (await ledger(f.project)).filter((e) => e.action === "QUESTION_MOVED")
      .length,
    1,
  );
});

test("fallo al escribir el segundo evento revierte temas, contenido, revisiones y auditoría", async () => {
  const f = await fixture(),
    before = await snapshot(f.project),
    auditBefore = await ledger(f.project);
  const owner = new pg.Client({ connectionString: ownerUrl.href });
  await owner.connect();
  await owner.query(
    `CREATE FUNCTION topic_move_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW."projectId"='${f.project.id}'::uuid AND NEW.action='QUESTION_MOVED' THEN RAISE EXCEPTION 'injected failure'; END IF; RETURN NEW; END $$; CREATE TRIGGER topic_move_failure BEFORE INSERT ON "AuditEvent" FOR EACH ROW EXECUTE FUNCTION topic_move_failure()`,
  );
  try {
    assert.equal(
      (
        await edit(f.project, f.root, {
          sectionId: f.sections[1].id,
          question: "¿No debe persistir?",
        })
      ).status,
      500,
    );
    await unchanged(f.project, before, auditBefore);
  } finally {
    await owner.query(
      'DROP TRIGGER topic_move_failure ON "AuditEvent"; DROP FUNCTION topic_move_failure()',
    );
    await owner.end();
  }
});

test("reorder rechaza dos preguntas sin relación y grupos con un descendiente archivado", async () => {
  const f = await fixture();
  const unrelated = (await create("UNRELATED", { order: 5 })).data;
  const before = await snapshot(f.project),
    auditBefore = await ledger(f.project);
  const path = `/projects/${f.project.id}/questions/reorder`;
  const ids = [f.root.id, f.child.id, f.grandchild.id, unrelated.id];
  assert.equal(
    (
      await request(path, {
        session: admin,
        method: "POST",
        body: moveCommand(before, f.sections, ids),
      })
    ).status,
    409,
  );
  await unchanged(f.project, before, auditBefore);
  await db.question.update({
    where: { id: f.grandchild.id },
    data: { publication: "ARCHIVED" },
  });
  const archived = await snapshot(f.project);
  const r = await request(path, {
    session: admin,
    method: "POST",
    body: moveCommand(archived, f.sections, [f.root.id, f.child.id]),
  });
  assert.equal(r.status, 409);
  assert.match(r.data.message, /GRANDCHILD/);
  await unchanged(f.project, archived, auditBefore);
});

test("mover desde otro integrante invalida una edición abierta y el orden no depende del orden físico de filas", async () => {
  const f = await fixture();
  await db.question.update({ where: { id: f.root.id }, data: { order: 10 } });
  const before = await snapshot(f.project);
  const oldRoot = before.questions.find((q) => q.id === f.root.id);
  assert.equal(
    (await edit(f.project, f.child, { sectionId: f.sections[1].id })).status,
    200,
  );
  const after = await snapshot(f.project),
    auditAfter = await ledger(f.project);
  assert.deepEqual(
    after.questions
      .filter((q) => q.sectionId === f.sections[1].id)
      .sort((a, b) => a.order - b.order)
      .map((q) => q.id),
    [f.destination.id, f.child.id, f.grandchild.id, f.root.id],
  );
  assert.equal(
    (await edit(f.project, oldRoot, { question: "¿Edición antigua?" })).status,
    409,
  );
  await unchanged(f.project, after, auditAfter);
});

test("una referencia, una condición entre temas y asignaciones existentes se conservan", async () => {
  const f = await fixture();
  const reference = await ok(`/projects/${f.project.id}/references`, {
    type: "REQUIREMENT",
    externalId: "REF-1",
    label: "Referencia ficticia",
    description: "",
    url: null,
    priority: null,
  });
  const user = await db.user.findFirstOrThrow({
    where: { username: "stakeholder" },
  });
  const member = await ok(`/projects/${f.project.id}/members`, {
    userId: user.id,
    role: "STAKEHOLDER",
    areaId: area.id,
    active: true,
  });
  await ok(`/projects/${f.project.id}/questions/${f.root.id}/assign`, {
    projectMemberId: member.id,
    required: true,
    active: true,
    expectedVersion: f.root.lockVersion,
  });
  await ok(`/projects/${f.project.id}/questions/${f.child.id}/assign`, {
    projectMemberId: member.id,
    required: true,
    active: true,
    expectedVersion: f.child.lockVersion,
  });
  const view = await snapshot(f.project);
  const child = view.questions.find((q) => q.id === f.child.id);
  const referenced = await edit(f.project, child, {
    references: [{ referenceId: reference.id, scopeNote: "Alcance ficticio" }],
  });
  assert.equal(referenced.status, 200);
  const destination = (
    await edit(f.project, f.destination, {
      condition: {
        parentQuestionId: f.root.id,
        operator: "EQUALS",
        value: true,
      },
    })
  ).data;
  const before = await snapshot(f.project);
  const oldRelatedRows = await db.questionAssignment.findMany({
    where: { projectId: f.project.id },
    orderBy: { id: "asc" },
  });
  const r = await edit(f.project, referenced.data, {
    sectionId: f.sections[2].id,
  });
  assert.equal(r.status, 200, r.data.message);
  const after = await snapshot(f.project);
  assert.deepEqual(
    after.questions.find((q) => q.id === destination.id),
    before.questions.find((q) => q.id === destination.id),
  );
  assert.deepEqual(r.data.references, referenced.data.references);
  assert.deepEqual(
    await db.questionAssignment.findMany({
      where: { projectId: f.project.id },
      orderBy: { id: "asc" },
    }),
    oldRelatedRows,
  );
});

test("el rango temporal agotado rechaza sin cambiar ninguna fila", async () => {
  const f = await fixture({ nested: false });
  await db.question.update({
    where: { id: f.destination.id },
    data: { order: 2147483647 },
  });
  const before = await snapshot(f.project),
    auditBefore = await ledger(f.project);
  const r = await edit(f.project, f.root, { sectionId: f.sections[1].id });
  assert.equal(r.status, 409);
  assert.match(r.data.message, /rango/);
  await unchanged(f.project, before, auditBefore);
});
