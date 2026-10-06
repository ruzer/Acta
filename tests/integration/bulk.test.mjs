import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { config } from "dotenv";
import pg from "pg";
config({ quiet: true });
const name = "bulk_test_" + randomBytes(6).toString("hex");
const ownerUrl = new URL(process.env.MIGRATION_DATABASE_URL);
const appUrl = new URL(process.env.DATABASE_URL);
const adminDb = new pg.Client({ connectionString: ownerUrl.href });
let app, db, createApp;
const port = 4349;
const origin = "http://localhost:" + port;
const base = origin + "/api/v1";
const password = "Test-" + randomBytes(24).toString("base64url");
let admin, analyst, stakeholder, viewer, otherOrg, outsider;
let org, project, second, area, section, member, foreignMember, foreignProject;
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
    ...(method === "GET"
      ? {}
      : { body: typeof body === "string" ? body : JSON.stringify(body ?? {}) }),
  });
  const data = await r.json();
  return { status: r.status, data, cookie: r.headers.get("set-cookie") };
}
async function login(username, pass = password) {
  const r = await request("/auth/login", {
    method: "POST",
    body: { username, password: pass },
  });
  assert.equal(r.status, 201, r.data.message);
  return {
    cookie: r.cookie.split(";")[0],
    csrf: r.data.csrfToken,
    user: r.data.user,
    header: r.cookie,
  };
}
async function ok(path, body, session = admin, method = "POST") {
  const r = await request(path, { session, method, body });
  assert.ok(
    r.status === 200 || r.status === 201,
    `${path}: ${r.status} ${r.data.message}`,
  );
  return r.data;
}
let questionOrder = 0;
function input(externalId, extra = {}) {
  return {
    externalId,
    sectionId: section.id,
    title: "Título ficticio",
    question: "¿Cómo se realiza este proceso ficticio?",
    helpText: "Sin información real",
    type: "YES_NO",
    required: true,
    priority: "P1",
    responsibleAreaId: area.id,
    order: ++questionOrder,
    groupParentId: null,
    supersedesQuestionId: null,
    config: null,
    options: [],
    condition: null,
    references: [],
    ...extra,
  };
}
async function question(externalId, extra = {}) {
  return ok(`/projects/${project.id}/questions`, input(externalId, extra));
}
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
    org = await db.organization.findUnique({ where: { code: "DEFAULT" } });
    area = await db.area.findFirst({ where: { organizationId: org.id } });
    project = await ok("/projects", {
      externalId: "TEST-CORE",
      name: "Proyecto de pruebas",
      description: "Aislado y efímero",
    });
    second = await ok("/projects", {
      externalId: "TEST-SECOND",
      name: "Otro proyecto",
      description: "",
    });
    section = await ok(`/projects/${project.id}/sections`, {
      externalId: "TEST-S",
      title: "Sección de prueba",
      description: "",
      order: 1,
    });
    for (const [session, role] of [
      [analyst, "ANALYST"],
      [stakeholder, "STAKEHOLDER"],
      [viewer, "VIEWER"],
    ]) {
      const m = await ok(`/projects/${project.id}/members`, {
        userId: session.user.id,
        role,
        areaId: area.id,
        active: true,
      });
      if (role === "STAKEHOLDER") member = m;
    }
    foreignMember = await ok(`/projects/${second.id}/members`, {
      userId: stakeholder.user.id,
      role: "STAKEHOLDER",
      areaId: area.id,
      active: true,
    });
    const u = await ok("/users", {
      username: "outsider",
      displayName: "Sin membresía",
      temporaryPassword: password,
      isOrganizationAdmin: false,
    });
    await db.user.update({
      where: { id: u.id },
      data: { mustChangePassword: false },
    });
    outsider = await login("outsider");
    const org2 = await db.organization.create({
      data: { code: "OTHER-DEMO", name: "Otra organización ficticia" },
    });
    const { hashPassword } =
      await import("../../app/backend/dist/auth/auth.service.js");
    await db.user.create({
      data: {
        organizationId: org2.id,
        username: "otheradmin",
        displayName: "Administración externa ficticia",
        passwordHash: await hashPassword(password),
        mustChangePassword: false,
        isOrganizationAdmin: true,
      },
    });
    process.env.ORGANIZATION_CODE = "OTHER-DEMO";
    otherOrg = await login("otheradmin");
    foreignProject = await ok(
      "/projects",
      { externalId: "OTHER-P", name: "Privado externo", description: "" },
      otherOrg,
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
async function otherTenantRequest(path, options) {
  // Authenticate against that tenant, then verify project isolation separately.
  const previous = process.env.ORGANIZATION_CODE;
  process.env.ORGANIZATION_CODE = "OTHER-DEMO";
  try {
    return await request(path, options);
  } finally {
    process.env.ORGANIZATION_CODE = previous;
  }
}
const root = () => `/projects/${project.id}/questions/bulk`;
const snapshot = async () =>
  ok(`/projects/${project.id}/questionnaire`, undefined, admin, "GET");
const selected = (rows) =>
  rows.map((q) => ({ id: q.id, expectedVersion: q.lockVersion }));
const areaCommand = (rows, target, source = null) => ({
  requestId: randomUUID(),
  questions: selected(rows),
  targetAreaId: target,
  sourceAreaId: source,
});
const peopleCommand = (rows, required = true) => ({
  requestId: randomUUID(),
  questions: selected(rows),
  participants: [{ projectMemberId: member.id, required }],
});
const publishCommand = (rows) => ({
  requestId: randomUUID(),
  questions: selected(rows),
});
async function preview(kind, command, session = admin) {
  return ok(`${root()}/${kind}/preview`, command, session);
}
async function confirm(kind, command, p, session = admin) {
  return ok(
    `${root()}/${kind}/confirm`,
    { ...command, previewHash: p.previewHash },
    session,
  );
}
async function current(id) {
  return (await snapshot()).questions.find((q) => q.id === id);
}
async function newArea() {
  return ok("/areas", {
    code: "AREA-" + randomUUID().slice(0, 8),
    name: "Example destination",
  });
}

test("bulk area: preview is read-only; source filtering and only area changes; correlated audit and idempotency", async () => {
  const parent = await question("AREA-P"),
    child = await question("AREA-C", { groupParentId: parent.id }),
    untouched = await question("AREA-U");
  const target = await newArea();
  const command = areaCommand([parent, child, untouched], target.id, area.id);
  const before = await snapshot(),
    audits = await db.auditEvent.count();
  const p = await preview("area", command);
  assert.equal(p.counts.applicable, 3);
  assert.equal(p.canConfirm, true);
  assert.deepEqual(await snapshot(), before);
  assert.equal(await db.auditEvent.count(), audits);
  const result = await confirm("area", command, p);
  assert.equal(result.changedIds.length, 3);
  for (const q of [parent, child, untouched]) {
    const next = await current(q.id);
    assert.deepEqual(next, {
      ...q,
      responsibleAreaId: target.id,
      lockVersion: q.lockVersion + 1,
    });
  }
  assert.equal(await db.auditEvent.count(), audits + 1);
  const event = await db.auditEvent.findFirst({
    where: { requestId: command.requestId },
  });
  assert.equal(event.action, "QUESTIONNAIRE_BATCH_APPLIED");
  assert.equal(event.actorId, admin.user.id);
  assert.equal(event.projectId, project.id);
  assert.deepEqual(new Set(event.after.ids), new Set(result.changedIds));
  assert.deepEqual(await confirm("area", command, p), result);
  assert.equal(await db.auditEvent.count(), audits + 1);
  const misuse = await request(`${root()}/area/confirm`, {
    session: admin,
    method: "POST",
    body: { ...command, previewHash: p.previewHash, targetAreaId: area.id },
  });
  assert.equal(misuse.status, 409);
  const fresh = await question("AREA-FRESH");
  const c = areaCommand([await current(parent.id), fresh], area.id, target.id);
  const p2 = await preview("area", c);
  assert.equal(p2.counts.applicable, 1);
  assert.equal(p2.counts.ignored, 1);
  await confirm("area", c, p2);
  assert.equal((await current(fresh.id)).lockVersion, fresh.lockVersion);
});

test("participants: adds, keeps active required values, no duplicates, independently of area; reactivation explicit", async () => {
  const p = await question("ADD-P"),
    child = await question("ADD-C", { groupParentId: p.id });
  await ok(`/projects/${project.id}/questions/${p.id}/assign`, {
    projectMemberId: member.id,
    active: true,
    required: false,
    expectedVersion: p.lockVersion,
  });
  const q = await current(p.id),
    command = peopleCommand([q, child], true),
    plan = await preview("participants", command);
  assert.equal(plan.counts.newAssignments, 1);
  assert.equal(plan.counts.existingAssignments, 1);
  const result = await confirm("participants", command, plan);
  assert.deepEqual(result.changedIds, [child.id]);
  assert.equal((await current(p.id)).assignments[0].required, false);
  assert.equal((await current(child.id)).assignments[0].required, true);
  assert.equal(
    (await current(child.id)).responsibleAreaId,
    child.responsibleAreaId,
  );
  assert.deepEqual(await confirm("participants", command, plan), result);
  assert.equal(
    await db.questionAssignment.count({ where: { questionId: child.id } }),
    1,
  );
  const latest = await current(child.id);
  await ok(`/projects/${project.id}/questions/${child.id}/assign`, {
    projectMemberId: member.id,
    active: false,
    required: true,
    expectedVersion: latest.lockVersion,
  });
  const re = peopleCommand([await current(child.id)], false),
    rp = await preview("participants", re);
  assert.equal(rp.counts.reactivatedAssignments, 1);
  await confirm("participants", re, rp);
  assert.equal((await current(child.id)).assignments[0].active, true);
  assert.equal((await current(child.id)).assignments[0].required, false);
});

test("conditional assignment requires parent; grouping alone does not; adding complete chain succeeds", async () => {
  const p = await question("ASSIGN-COND-P");
  const child = await question("ASSIGN-COND-C", {
    condition: { parentQuestionId: p.id, operator: "EQUALS", value: true },
  });
  const alone = peopleCommand([child]),
    bad = await preview("participants", alone);
  assert.equal(bad.canConfirm, false);
  assert.equal(bad.dependencies[0].dependsOnId, p.id);
  const denied = await request(`${root()}/participants/confirm`, {
    session: admin,
    method: "POST",
    body: { ...alone, previewHash: bad.previewHash },
  });
  assert.equal(denied.status, 409);
  assert.equal((await current(child.id)).assignments.length, 0);
  const all = peopleCommand([child, p]),
    good = await preview("participants", all);
  assert.equal(good.canConfirm, true);
  await confirm("participants", all, good);
  assert.equal((await current(child.id)).assignments.length, 1);
  assert.equal((await current(p.id)).assignments.length, 1);
  const grouped = await question("GROUP-NO-COND", { groupParentId: p.id });
  const gc = peopleCommand([grouped]),
    gp = await preview("participants", gc);
  assert.equal(gp.canConfirm, true);
});

test("publish: external dependencies blocked; explicit selection publishes in order, preserves revisions and ignores published", async () => {
  const p = await question("PUB-P"),
    c = await question("PUB-C", {
      groupParentId: p.id,
      condition: { parentQuestionId: p.id, operator: "EQUALS", value: true },
    });
  const alone = publishCommand([c]),
    blocked = await preview("publish", alone);
  assert.equal(blocked.canConfirm, false);
  assert.equal(blocked.counts.blocked, 1);
  assert.equal(
    blocked.dependencies.every((d) => !d.inSelection),
    true,
  );
  assert.equal((await current(p.id)).publication, "DRAFT");
  const both = publishCommand([c, p]),
    plan = await preview("publish", both);
  assert.equal(plan.canConfirm, true);
  assert.equal(plan.counts.warnings, 2);
  const result = await confirm("publish", both, plan);
  assert.equal(result.changedIds.length, 2);
  assert.deepEqual(await confirm("publish", both, plan), result);
  for (const q of [p, c]) {
    const next = await current(q.id);
    assert.equal(next.publication, "PUBLISHED");
    assert.equal(next.externalId, q.externalId);
    assert.equal(next.revisionNumber, q.revisionNumber);
    assert.deepEqual(next.condition, q.condition);
    assert.equal(next.groupParentId, q.groupParentId);
  }
  const fresh = await question("PUB-NEW"),
    cmd = publishCommand([await current(p.id), fresh]),
    pr = await preview("publish", cmd);
  assert.equal(pr.counts.ignored, 1);
  assert.equal(pr.items[0].state, "ALREADY_PUBLISHED");
  await confirm("publish", cmd, pr);
});

test("stale question version and changed dependency prevent any writes", async () => {
  const p = await question("STALE-P"),
    c = await question("STALE-C", { groupParentId: p.id });
  const command = publishCommand([p, c]),
    plan = await preview("publish", command);
  await ok(`/projects/${project.id}/questions/${p.id}/metadata`, {
    priority: "P0",
    responsibleAreaId: area.id,
    order: p.order,
    expectedVersion: p.lockVersion,
  });
  const before = await snapshot();
  const fail = await request(`${root()}/publish/confirm`, {
    session: admin,
    method: "POST",
    body: { ...command, previewHash: plan.previewHash },
  });
  assert.equal(fail.status, 409);
  assert.deepEqual(await snapshot(), before);
  const stale = await preview("publish", command);
  assert.equal(stale.canConfirm, false);
  assert.equal(
    stale.items[0].errors.some((e) => e.field === "version"),
    true,
  );
});

test("two analysts concurrently confirm competing area plans: one succeeds and one conflicts", async () => {
  const u = await ok("/users", {
    username: "analyst.second",
    displayName: "Second example analyst",
    temporaryPassword: password,
    isOrganizationAdmin: false,
  });
  await db.user.update({
    where: { id: u.id },
    data: { mustChangePassword: false },
  });
  await ok(`/projects/${project.id}/members`, {
    userId: u.id,
    role: "ANALYST",
    areaId: area.id,
    active: true,
  });
  const secondAnalyst = await login("analyst.second"),
    q = await question("RACE"),
    a = await newArea(),
    b = await newArea();
  const ca = areaCommand([q], a.id),
    cb = areaCommand([q], b.id);
  const pa = await preview("area", ca, analyst),
    pb = await preview("area", cb, secondAnalyst);
  const results = await Promise.all(
    [
      [ca, pa, analyst],
      [cb, pb, secondAnalyst],
    ].map(([command, plan, session]) =>
      request(`${root()}/area/confirm`, {
        session,
        method: "POST",
        body: { ...command, previewHash: plan.previewHash },
      }),
    ),
  );
  assert.deepEqual(results.map((r) => r.status).sort(), [201, 409]);
  const latest = await current(q.id);
  assert.equal(latest.lockVersion, q.lockVersion + 1);
  assert.equal(
    latest.responsibleAreaId,
    results[0].status === 201 ? a.id : b.id,
  );
});

test("late database error rolls back question updates and audit as one transaction", async () => {
  const q1 = await question("ROLLBACK-1"),
    q2 = await question("ROLLBACK-2"),
    target = await newArea();
  const command = areaCommand([q1, q2], target.id),
    plan = await preview("area", command),
    before = await snapshot();
  const owner = new pg.Client({ connectionString: ownerUrl.href });
  await owner.connect();
  try {
    await owner.query(
      `CREATE FUNCTION fail_batch_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW."requestId" = '${command.requestId}'::uuid THEN RAISE EXCEPTION 'Test-only late audit failure'; END IF; RETURN NEW; END $$`,
    );
    await owner.query(
      'CREATE TRIGGER fail_batch_audit BEFORE INSERT ON "AuditEvent" FOR EACH ROW EXECUTE FUNCTION fail_batch_audit()',
    );
    const r = await request(`${root()}/area/confirm`, {
      session: admin,
      method: "POST",
      body: { ...command, previewHash: plan.previewHash },
    });
    assert.equal(r.status, 500);
    assert.deepEqual(await snapshot(), before);
    assert.equal(
      await db.auditEvent.count({ where: { requestId: command.requestId } }),
      0,
    );
  } finally {
    await owner.query(
      'DROP TRIGGER IF EXISTS fail_batch_audit ON "AuditEvent"',
    );
    await owner.query("DROP FUNCTION IF EXISTS fail_batch_audit()");
    await owner.end();
  }
  await confirm("area", command, plan);
});

for (const kind of ["area", "participants", "publish"])
  test(`${kind}: roles, project/organization isolation, duplicate/missing IDs and mass assignment`, async () => {
    const q = await question("SECURITY-" + kind),
      target = await newArea();
    const command =
      kind === "area"
        ? areaCommand([q], target.id)
        : kind === "participants"
          ? peopleCommand([q])
          : publishCommand([q]);
    for (const session of [stakeholder, viewer]) {
      const r = await request(`${root()}/${kind}/preview`, {
        session,
        method: "POST",
        body: command,
      });
      assert.equal(r.status, 403);
    }
    for (const session of [outsider, otherOrg]) {
      const r = await (session === otherOrg ? otherTenantRequest : request)(
        `${root()}/${kind}/preview`,
        {
          session,
          method: "POST",
          body: command,
        },
      );
      assert.equal(r.status, 404);
    }
    const cross = await request(
      `/projects/${second.id}/questions/bulk/${kind}/preview`,
      { session: admin, method: "POST", body: command },
    );
    assert.equal(cross.status, 404);
    for (const questions of [
      [...command.questions, ...command.questions],
      [{ id: randomUUID(), expectedVersion: 0 }],
    ]) {
      const r = await request(`${root()}/${kind}/preview`, {
        session: admin,
        method: "POST",
        body: { ...command, questions },
      });
      assert.equal(r.status, questions.length === 2 ? 400 : 404);
    }
    const mass = await request(`${root()}/${kind}/preview`, {
      session: admin,
      method: "POST",
      body: { ...command, priority: "P0" },
    });
    assert.equal(mass.status, 400);
    const plan = await preview(kind, command);
    for (const session of [stakeholder, viewer, outsider, otherOrg]) {
      const r = await (session === otherOrg ? otherTenantRequest : request)(
        `${root()}/${kind}/confirm`,
        {
          session,
          method: "POST",
          body: { ...command, previewHash: plan.previewHash },
        },
      );
      assert.equal(
        r.status,
        session === stakeholder || session === viewer ? 403 : 404,
      );
    }
  });

test("invalid target area / foreign member / archived question are rejected without writes", async () => {
  const q = await question("BAD-TARGET");
  const foreignArea = await db.area.create({
    data: {
      organizationId:
        foreignProject.organizationId ??
        (await db.project.findUnique({ where: { id: foreignProject.id } }))
          .organizationId,
      code: "EXTERNAL",
      name: "External example",
    },
  });
  const areaBad = await request(`${root()}/area/preview`, {
    session: admin,
    method: "POST",
    body: areaCommand([q], foreignArea.id),
  });
  assert.equal(areaBad.status, 400);
  const memberBad = await request(`${root()}/participants/preview`, {
    session: admin,
    method: "POST",
    body: {
      ...peopleCommand([q]),
      participants: [{ projectMemberId: foreignMember.id, required: true }],
    },
  });
  assert.equal(memberBad.status, 400);
  await ok(`/projects/${project.id}/questions/${q.id}/archive`, {
    expectedVersion: q.lockVersion,
  });
  const p = await preview("publish", publishCommand([await current(q.id)]));
  assert.equal(p.canConfirm, false);
  assert.equal(p.counts.blocked, 1);
});

test(
  "304 questions: area, participant and publish each use one command; bounded PostgreSQL queries and measured timings",
  { timeout: 120000 },
  async () => {
    const questions = [];
    for (let i = 0; i < 304; i++) questions.push(await question("SCALE-" + i));
    const target = await newArea();
    async function measured(label, fn) {
      let queries = 0;
      const original = pg.Client.prototype.query;
      pg.Client.prototype.query = function (...args) {
        queries++;
        return original.apply(this, args);
      };
      const start = performance.now();
      try {
        const result = await fn();
        const ms = Math.round((performance.now() - start) * 10) / 10;
        console.log(
          "BULK_PERFORMANCE " +
            JSON.stringify({ label, questions: 304, queries, ms }),
        );
        assert.ok(
          queries < 100,
          `${label} unexpectedly used ${queries} queries`,
        );
        return result;
      } finally {
        pg.Client.prototype.query = original;
      }
    }
    for (const kind of ["area", "participants", "publish"]) {
      const all = (await snapshot()).questions.filter((q) =>
        q.externalId.startsWith("SCALE-"),
      );
      const command =
        kind === "area"
          ? areaCommand(all, target.id)
          : kind === "participants"
            ? peopleCommand(all)
            : publishCommand(all);
      const p = await measured(kind + " preview", () => preview(kind, command));
      assert.equal(p.counts.applicable, 304);
      const r = await measured(kind + " confirm", () =>
        confirm(kind, command, p),
      );
      assert.equal(r.changedIds.length, 304);
    }
    const all = (await snapshot()).questions.filter((q) =>
      q.externalId.startsWith("SCALE-"),
    );
    assert.equal(all.length, 304);
    assert.ok(
      all.every(
        (q) =>
          q.publication === "PUBLISHED" &&
          q.assignments.length === 1 &&
          q.responsibleAreaId === target.id,
      ),
    );
  },
);

test("simultaneous retry of the same request produces one audit; replay still requires current role", async () => {
  const q = await question("REPLAY"),
    target = await newArea(),
    command = areaCommand([q], target.id),
    p = await preview("area", command, analyst);
  const results = await Promise.all([
    confirm("area", command, p, analyst),
    confirm("area", command, p, analyst),
  ]);
  assert.deepEqual(results[0], results[1]);
  assert.equal(
    await db.auditEvent.count({ where: { requestId: command.requestId } }),
    1,
  );
  await ok(`/projects/${project.id}/members`, {
    userId: analyst.user.id,
    role: "VIEWER",
    areaId: null,
    active: true,
  });
  try {
    const denied = await request(`${root()}/area/confirm`, {
      session: analyst,
      method: "POST",
      body: { ...command, previewHash: p.previewHash },
    });
    assert.equal(denied.status, 403);
  } finally {
    await ok(`/projects/${project.id}/members`, {
      userId: analyst.user.id,
      role: "ANALYST",
      areaId: area.id,
      active: true,
    });
  }
});
test("combined grouping/condition publication cycle is blocked, without changing either relation", async () => {
  const p = await question("CYCLE-P"),
    c = await question("CYCLE-C", { groupParentId: p.id });
  const {
    id: _id,
    publication: _publication,
    status: _status,
    lockVersion,
    revisionNumber: _revision,
    assignments: _assignments,
    ...input
  } = p;
  await ok(
    `/projects/${project.id}/questions/${p.id}/draft`,
    {
      ...input,
      expectedVersion: lockVersion,
      condition: { parentQuestionId: c.id, operator: "EQUALS", value: true },
    },
    admin,
    "PUT",
  );
  const command = publishCommand([await current(p.id), c]),
    plan = await preview("publish", command),
    before = await snapshot();
  assert.equal(plan.canConfirm, false);
  assert.ok(
    plan.items.some((i) => i.errors.some((e) => e.message.includes("ciclo"))),
  );
  const denied = await request(`${root()}/publish/confirm`, {
    session: admin,
    method: "POST",
    body: { ...command, previewHash: plan.previewHash },
  });
  assert.equal(denied.status, 409);
  assert.deepEqual(await snapshot(), before);
});
