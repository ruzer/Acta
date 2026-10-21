import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { config } from "dotenv";
import pg from "pg";
config({ quiet: true });
const s3Test = process.env.STORAGE_TEST_S3 === "true";
if (s3Test)
  assert.equal(
    process.env.SELFHOST_STORAGE_TEST_ALLOWED,
    "true",
    "Dedicated disposable bucket opt-in required",
  );
const name = "acta_invitations_" + randomBytes(6).toString("hex");
const ownerUrl = new URL(process.env.MIGRATION_DATABASE_URL);
const runtimeUrl = new URL(process.env.DATABASE_URL);
const adminDb = new pg.Client({ connectionString: ownerUrl.href });
const password = "Demo-" + randomBytes(24).toString("base64url");
const origin = "http://localhost:4359";
let app,
  db,
  owner,
  root,
  manager,
  auth,
  responses,
  access,
  review,
  project,
  otherProject,
  question,
  otherQuestion,
  area,
  analyst,
  participant,
  admin;
const context = (actor) => ({ actor, requestId: randomUUID() });
const blank = {
  answer: null,
  comment: "",
  example: "",
  consultationRequested: false,
};
async function create(extra = {}, actor = analyst) {
  return manager.create(context(actor), project.id, {
    requestId: randomUUID(),
    label: "Example recipient",
    questionIds: [question.id],
    areaId: area.id,
    identity: { name: "Example Recipient" },
    nonNominal: false,
    allowEvidence: true,
    ...extra,
  });
}
const token = (link) => new URL(link.url).hash.slice(1);
async function enter(link) {
  return auth.exchange(token(link), randomUUID());
}
async function unavailable(work) {
  await assert.rejects(work, /Invitación no disponible/);
}
before(
  async () => {
    await adminDb.connect();
    await adminDb.query(`CREATE DATABASE "${name}"`);
    ownerUrl.pathname = "/" + name;
    runtimeUrl.pathname = "/" + name;
    const migrated = spawnSync(
      "node",
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
    assert.equal(migrated.status, 0, migrated.stdout + migrated.stderr);
    root = await mkdtemp(join(tmpdir(), "acta-invitations-"));
    Object.assign(process.env, {
      DATABASE_URL: runtimeUrl.href,
      APP_ORIGIN: origin,
      PORT: "4359",
      COOKIE_SECURE: "false",
      NODE_ENV: "test",
      ORGANIZATION_CODE: "DEFAULT",
      DEMO_SEED: "true",
      DEMO_PASSWORD: password,
      STORAGE_PROVIDER: s3Test ? "S3" : "LOCAL",
      EVIDENCE_ROOT: root,
      INVITATION_IDENTITY: "NAME",
      INVITATION_DEFAULT_DAYS: "7",
      INVITATION_MAX_DAYS: "30",
    });
    const seeded = spawnSync("node", ["app/backend/dist/seed.js"], {
      encoding: "utf8",
      env: process.env,
    });
    assert.equal(seeded.status, 0, seeded.stderr);
    const { PrismaClient } = await import("@prisma/client"),
      { PrismaPg } = await import("@prisma/adapter-pg");
    db = new PrismaClient({
      adapter: new PrismaPg({ connectionString: runtimeUrl.href }),
    });
    owner = new pg.Client({ connectionString: ownerUrl.href });
    await owner.connect();
    await db.user.updateMany({ data: { mustChangePassword: false } });
    ({ createApp: globalThis.createInvitationTestApp } =
      await import("../../app/backend/dist/main.js"));
    app = await globalThis.createInvitationTestApp();
    const { STORAGE } =
      await import("../../app/backend/dist/responses/storage.js");
    assert.equal(app.get(STORAGE).backend, s3Test ? "S3" : "LOCAL");
    await app.get(STORAGE).health();
    const { InvitationsService } =
      await import("../../app/backend/dist/invitations/invitations.service.js");
    const { InvitationAuthService } =
      await import("../../app/backend/dist/auth/invitation-auth.service.js");
    const { ResponsesService } =
      await import("../../app/backend/dist/responses/responses.service.js");
    const { AccessService } =
      await import("../../app/backend/dist/administration/access.service.js");
    const { ReviewReadService } =
      await import("../../app/backend/dist/review/review-read.service.js");
    manager = app.get(InvitationsService);
    auth = app.get(InvitationAuthService);
    responses = app.get(ResponsesService);
    access = app.get(AccessService);
    review = app.get(ReviewReadService);
    analyst = await db.user.findFirstOrThrow({
      where: { username: "analyst" },
    });
    participant = await db.user.findFirstOrThrow({
      where: { username: "stakeholder" },
    });
    admin = await db.user.findFirstOrThrow({ where: { username: "admin" } });
    project = await db.project.findFirstOrThrow({
      where: { externalId: "DEMO-PRINCIPAL" },
    });
    otherProject = await db.project.findFirstOrThrow({
      where: { externalId: "DEMO-SECUNDARIO" },
    });
    const questions = await db.question.findMany({
      where: {
        projectId: project.id,
        publication: "PUBLISHED",
        QuestionCondition_child: null,
      },
      include: { QuestionRevision_questionRecord: true },
    });
    question = questions.find((q) =>
      q.QuestionRevision_questionRecord.some((v) => v.type === "SHORT_TEXT"),
    );
    assert.ok(question);
    otherQuestion = questions.find((q) => q.id !== question.id);
    const member = await db.projectMember.findFirstOrThrow({
      where: { projectId: project.id, userId: participant.id },
    });
    area = await db.area.findUniqueOrThrow({ where: { id: member.areaId } });
  },
  { timeout: 120000 },
);
after(async () => {
  await app?.close();
  await db?.$disconnect();
  await owner?.end();
  await adminDb.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
  await adminDb.end();
  if (root) await rm(root, { recursive: true, force: true });
  delete globalThis.createInvitationTestApp;
});

test("management requires analyst/admin; explicit scope, identity policy and bounded expiration", async () => {
  await assert.rejects(() => create({}, participant), /perfil/);
  await assert.rejects(
    () => create({ identity: { email: "example@example.test" } }),
    /identidad/,
  );
  await assert.rejects(
    () => create({ nonNominal: true, identity: {} }),
    /no nominales/,
  );
  await assert.rejects(
    () => create({ expiresAt: new Date(Date.now() - 1000).toISOString() }),
    /vencimiento/,
  );
  await assert.rejects(
    () =>
      create({
        expiresAt: new Date(Date.now() + 366 * 86400000).toISOString(),
      }),
    /vencimiento/,
  );
  await assert.rejects(
    () => create({ questionIds: [randomUUID()] }),
    /publicadas/,
  );
  const id = randomUUID();
  await create({ requestId: id });
  await assert.rejects(() => create({ requestId: id }), /ya fue creada/);
});

test("three invitations to one question retain separate drafts, submissions and attribution", async () => {
  const links = await Promise.all([
    create({ label: "Example A" }),
    create({ label: "Example B" }),
    create({ label: "Example C" }),
  ]);
  const sessions = await Promise.all(links.map((l) => enter(l)));
  assert.equal(new Set(sessions.map((s) => s.actor.id)).size, 3);
  for (const [n, s] of sessions.entries()) {
    const saved = await responses.save(
      context(s.actor),
      project.id,
      question.id,
      {
        ...blank,
        answer: `Fictional answer ${n}`,
        requestId: randomUUID(),
        expectedVersion: 0,
      },
    );
    assert.equal(saved.draft.answer, `Fictional answer ${n}`);
  }
  for (const [n, s] of sessions.entries()) {
    const resumed = await enter(links[n]);
    const view = await responses.get(resumed.actor, project.id, question.id);
    assert.equal(view.draft.answer, `Fictional answer ${n}`);
    const command = {
      requestId: randomUUID(),
      expectedVersion: view.lockVersion,
    };
    const submitted = await responses.submit(
      { actor: resumed.actor, requestId: randomUUID() },
      project.id,
      question.id,
      command,
    );
    assert.equal(submitted.revisions[0].answer, `Fictional answer ${n}`);
    const replay = await responses.submit(
      context(resumed.actor),
      project.id,
      question.id,
      command,
    );
    assert.deepEqual(replay, submitted);
    await assert.rejects(() =>
      responses.submit(context(resumed.actor), project.id, question.id, {
        ...command,
        requestId: randomUUID(),
      }),
    );
    assert.equal(
      (await responses.get(s.actor, project.id, question.id)).revisions.length,
      1,
    );
  }
  const detail = await review.detail(analyst, project.id, question.id);
  assert.ok(detail);
  const stored = await db.response.findMany({
    where: {
      questionId: question.id,
      respondentId: { in: sessions.map((s) => s.actor.id) },
    },
  });
  assert.equal(stored.length, 3);
});

test("capability cannot access other question/project, forged principal or account session", async () => {
  const link = await create();
  const s = await enter(link);
  await assert.rejects(() =>
    responses.get(s.actor, project.id, otherQuestion.id),
  );
  await assert.rejects(() =>
    responses.get(s.actor, otherProject.id, question.id),
  );
  await unavailable(() =>
    responses.get({ ...s.actor }, project.id, question.id),
  );
  await assert.rejects(() => access.organizationAdmin(db, s.actor));
  await assert.rejects(() => access.membershipAdmin(db, s.actor, project.id));
  await assert.rejects(() =>
    db.session.create({
      data: {
        userId: s.actor.id,
        tokenHash: randomBytes(32).toString("hex"),
        csrfSecretHash: randomBytes(32).toString("hex"),
        expiresAt: new Date(Date.now() + 60000),
      },
    }),
  );
  await assert.rejects(() =>
    db.user.update({
      where: { id: s.actor.id },
      data: { invitationOnly: false },
    }),
  );
  await assert.rejects(() =>
    db.user.update({
      where: { id: s.actor.id },
      data: { passwordHash: "forbidden-test-value" },
    }),
  );
  await assert.rejects(() =>
    db.projectMember.create({
      data: {
        userId: s.actor.id,
        projectId: otherProject.id,
        role: "STAKEHOLDER",
        areaId: area.id,
      },
    }),
  );
  await assert.rejects(() =>
    db.invitationQuestion.create({
      data: {
        invitationId: link.invitation.id,
        projectId: project.id,
        questionId: otherQuestion.id,
      },
    }),
  );
});

test("renewal invalidates old token and sessions; revoke preserves submitted history", async () => {
  const link = await create();
  const s = await enter(link);
  await responses.save(context(s.actor), project.id, question.id, {
    ...blank,
    answer: "Fictional history",
    expectedVersion: 0,
    requestId: randomUUID(),
  });
  await responses.submit(context(s.actor), project.id, question.id, {
    expectedVersion: 1,
    requestId: randomUUID(),
  });
  const renewed = await manager.renew(
    context(analyst),
    project.id,
    link.invitation.id,
    { expectedVersion: 0 },
  );
  await unavailable(() => enter(link));
  await unavailable(() => responses.get(s.actor, project.id, question.id));
  const resumed = await enter(renewed);
  assert.equal(
    (await responses.get(resumed.actor, project.id, question.id)).revisions[0]
      .answer,
    "Fictional history",
  );
  await manager.revoke(
    context(analyst),
    project.id,
    link.invitation.id,
    renewed.invitation.lockVersion,
  );
  await unavailable(() => enter(renewed));
  await unavailable(() =>
    responses.get(resumed.actor, project.id, question.id),
  );
  assert.ok(await review.detail(analyst, project.id, question.id));
  assert.equal(
    await db.responseRevision.count({
      where: { response: { respondentId: s.actor.id } },
    }),
    1,
  );
  await assert.rejects(
    () =>
      manager.renew(context(analyst), project.id, link.invitation.id, {
        expectedVersion: 2,
      }),
    /revocada/,
  );
});

test("invalid, modified and expired tokens are generic; multi-tab identity cannot switch", async () => {
  const link = await create();
  const s = await enter(link);
  await unavailable(() => auth.exchange("invalid", randomUUID()));
  await unavailable(() =>
    auth.exchange(
      randomBytes(32).toString("base64url"),
      randomUUID(),
      randomUUID(),
    ),
  );
  await unavailable(() =>
    auth.exchange(token(link).slice(1) + "!", randomUUID()),
  );
  await unavailable(() =>
    auth.authenticate(s.token, randomUUID(), randomUUID()),
  );
  await assert.rejects(() =>
    owner.query(
      'UPDATE "ResponseInvitation" SET "createdAt"=now()-interval \'2 days\' WHERE id=$1',
      [link.invitation.id],
    ),
  );
  await db.responseInvitation.update({
    where: { id: link.invitation.id },
    data: { expiresAt: new Date(Date.now() + 20) },
  });
  await new Promise((resolve) => setTimeout(resolve, 40));
  await unavailable(() => enter(link));
  await unavailable(() =>
    auth.authenticate(s.token, link.invitation.id, randomUUID()),
  );
});

test("non-nominal policy requires owner and installation opt-in", async () => {
  let p = await manager.policy(admin, project.id);
  await assert.rejects(() =>
    manager.setPolicy(context(analyst), project.id, {
      expectedVersion: p.expectedVersion,
      allowNonNominal: true,
    }),
  );
  p = await manager.setPolicy(context(admin), project.id, {
    expectedVersion: p.expectedVersion,
    allowNonNominal: true,
  });
  await assert.rejects(() => create({ nonNominal: true, identity: {} }));
  process.env.INVITATION_IDENTITY = "NONE";
  try {
    const link = await create({
      nonNominal: true,
      identity: {},
      label: "Non-nominal sample",
    });
    assert.deepEqual(link.invitation.identity, {});
  } finally {
    process.env.INVITATION_IDENTITY = "NAME";
  }
});

test("stored invitation/session tokens are hashes and never appear in audit", async () => {
  const link = await create();
  const s = await enter(link);
  const i = await db.responseInvitation.findUniqueOrThrow({
    where: { id: link.invitation.id },
  });
  assert.match(i.tokenHash, /^[a-f0-9]{64}$/);
  assert.notEqual(i.tokenHash, token(link));
  const events = await db.auditEvent.findMany({
    where: { OR: [{ objectId: i.id }, { actorId: s.actor.id }] },
  });
  const content = JSON.stringify(events);
  assert.ok(!content.includes(token(link)));
  assert.ok(!content.includes(s.token));
  assert.ok(events.some((e) => e.action === "INVITATION_CREATED"));
  assert.equal(
    events.filter((e) => e.action === "INVITATION_OPENED").length,
    1,
  );
  assert.ok(events.some((e) => e.actorSnapshot.identityKind === "INVITATION"));
});

async function http(
  path,
  {
    method = "GET",
    body,
    session,
    originHeader = origin,
    csrf = session?.csrf,
    expected = session?.id,
  } = {},
) {
  const response = await fetch(origin + "/api/v1" + path, {
    method,
    headers: {
      Origin: originHeader,
      "Content-Type": "application/json",
      ...(session ? { Cookie: session.cookie } : {}),
      ...(csrf ? { "X-CSRF-Token": csrf } : {}),
      ...(expected ? { "X-Invitation-Id": expected } : {}),
    },
    ...(method === "GET" ? {} : { body: JSON.stringify(body ?? {}) }),
  });
  return {
    status: response.status,
    body: await response.json(),
    headers: response.headers,
  };
}
async function httpEnter(link) {
  const r = await http("/invitations/access/exchange", {
    method: "POST",
    body: { token: token(link) },
  });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  return {
    cookie: r.headers.get("set-cookie").split(";")[0],
    csrf: r.body.csrfToken,
    id: r.body.invitationId,
  };
}

test("HTTP exchange, private-route isolation, csrf/origin, no-store and independent browser bindings", async () => {
  const link = await create();
  const exchange = await http("/invitations/access/exchange", {
    method: "POST",
    body: { token: token(link) },
  });
  assert.equal(exchange.status, 201);
  assert.equal(exchange.headers.get("cache-control"), "no-store");
  const cookie = exchange.headers.get("set-cookie");
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /SameSite=Strict/);
  assert.match(cookie, /Path=\/api\/v1\/invitations\/access/);
  assert.ok(!JSON.stringify(exchange.body).includes(token(link)));
  const s = {
    cookie: cookie.split(";")[0],
    csrf: exchange.body.csrfToken,
    id: exchange.body.invitationId,
  };
  const path = `/invitations/access/questions/${question.id}`;
  assert.equal((await http(path, { session: s })).status, 200);
  assert.equal(
    (
      await http(`/projects/${project.id}/questions/${question.id}/response`, {
        session: s,
      })
    ).status,
    401,
  );
  assert.equal((await http("/users", { session: s })).status, 401);
  assert.equal(
    (await http(path, { session: s, expected: randomUUID() })).status,
    401,
  );
  const body = {
    ...blank,
    answer: "Example HTTP draft",
    requestId: randomUUID(),
    expectedVersion: 0,
  };
  assert.equal(
    (
      await http(path + "/draft", {
        session: s,
        method: "PUT",
        body,
        csrf: "invalid",
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await http(path + "/draft", {
        session: s,
        method: "PUT",
        body,
        originHeader: "https://outside.example.test",
      })
    ).status,
    403,
  );
  assert.equal(
    (await http(path + "/draft", { session: s, method: "PUT", body })).status,
    200,
  );
  assert.equal(
    (
      await http(`/invitations/access/questions/${otherQuestion.id}`, {
        session: s,
      })
    ).status,
    404,
  );
  assert.equal(
    (await http("/invitations/access/logout", { session: s, method: "POST" }))
      .status,
    201,
  );
  assert.equal((await http(path, { session: s })).status, 401);
  const again = await httpEnter(link);
  assert.equal(
    (await http(path, { session: again })).body.draft.answer,
    body.answer,
  );
});

test("concurrent saves and duplicate submits produce one revision without lost updates", async () => {
  const link = await create();
  const s = await httpEnter(link);
  const path = `/invitations/access/questions/${question.id}`;
  const saves = await Promise.all(
    ["First example", "Second example"].map((answer) =>
      http(path + "/draft", {
        session: s,
        method: "PUT",
        body: { ...blank, answer, expectedVersion: 0, requestId: randomUUID() },
      }),
    ),
  );
  assert.deepEqual(saves.map((r) => r.status).sort(), [200, 409]);
  const command = { requestId: randomUUID(), expectedVersion: 1 };
  const submitted = await Promise.all(
    [1, 2].map(() =>
      http(path + "/submit", { session: s, method: "POST", body: command }),
    ),
  );
  assert.deepEqual(
    submitted.map((r) => r.status),
    [201, 201],
  );
  assert.deepEqual(submitted[0].body, submitted[1].body);
  assert.equal(submitted[0].body.revisions.length, 1);
});

test("revocation wins a queued write race under the shared project lock", async () => {
  const link = await create();
  const s = await enter(link);
  async function waitForBlocked(count) {
    for (let n = 0; n < 200; n++) {
      const waiting = await owner.query(
        "SELECT count(*)::int AS n FROM pg_stat_activity WHERE datname=$1 AND wait_event_type='Lock'",
        [name],
      );
      if (waiting.rows[0].n >= count) return;
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    assert.fail("Expected writers to wait on the project lock");
  }
  await owner.query("BEGIN");
  let revocation, write;
  try {
    await owner.query('SELECT id FROM "Project" WHERE id=$1 FOR UPDATE', [
      project.id,
    ]);
    revocation = manager.revoke(
      context(analyst),
      project.id,
      link.invitation.id,
      0,
    );
    await waitForBlocked(1);
    write = responses.save(context(s.actor), project.id, question.id, {
      ...blank,
      answer: "Must not persist",
      expectedVersion: 0,
      requestId: randomUUID(),
    });
    // Attach rejection handler before releasing the lock.
    const result = Promise.allSettled([revocation, write]);
    await waitForBlocked(2);
    await owner.query("COMMIT");
    const outcomes = await result;
    assert.equal(outcomes[0].status, "fulfilled");
    assert.equal(outcomes[1].status, "rejected");
    assert.match(outcomes[1].reason.message, /Invitación no disponible/);
    assert.equal(
      await db.response.count({ where: { respondentId: s.actor.id } }),
      0,
    );
  } finally {
    await owner.query("ROLLBACK");
    await Promise.allSettled([revocation, write].filter(Boolean));
  }
});

test("malformed exchange attempts are rate-limited before schema validation", async () => {
  await db.invitationRateBucket.deleteMany();
  for (let n = 0; n < 30; n++) {
    const r = await http("/invitations/access/exchange", {
      method: "POST",
      body: { token: "malformed" },
    });
    assert.equal(r.status, 400);
  }
  assert.equal(
    (
      await http("/invitations/access/exchange", {
        method: "POST",
        body: { token: "malformed" },
      })
    ).status,
    429,
  );
});

test("independent invitations behind one proxy do not consume one another's limits", async (t) => {
  const now = Date.now();
  t.mock.method(Date, "now", () => now);
  await db.invitationRateBucket.deleteMany();
  const sessions = [];
  const links = [];
  for (let n = 0; n < 35; n++) {
    const link = await create({ label: `Example recipient ${n + 1}` });
    links.push(link);
    sessions.push(await httpEnter(link));
  }
  // More than 240 requests at the same network address, still individually bounded.
  for (const session of sessions)
    for (let n = 0; n < 8; n++)
      assert.equal(
        (await http("/invitations/access", { session })).status,
        200,
      );
  for (let n = 8; n < 240; n++)
    assert.equal(
      (await http("/invitations/access", { session: sessions[0] })).status,
      200,
    );
  assert.equal(
    (await http("/invitations/access", { session: sessions[0] })).status,
    429,
  );
  assert.equal(
    (await http("/invitations/access", { session: sessions[1] })).status,
    200,
  );
  // Repeated exchange of a single link is bounded without blocking other links.
  for (let n = 1; n < 30; n++) await httpEnter(links[0]);
  assert.equal(
    (
      await http("/invitations/access/exchange", {
        method: "POST",
        body: { token: token(links[0]) },
      })
    ).status,
    429,
  );
  await httpEnter(links[1]);
});

test("invalid-token abuse is bounded and security events never contain credentials or identity", async (t) => {
  const now = Date.now();
  t.mock.method(Date, "now", () => now);
  const { Logger } = await import("@nestjs/common");
  const events = [];
  t.mock.method(Logger.prototype, "warn", (...args) => events.push(args));
  await db.invitationRateBucket.deleteMany();
  const link = await create();
  const session = await httpEnter(link);
  const badToken = randomBytes(32).toString("base64url");
  for (let n = 0; n < 30; n++)
    assert.equal(
      (
        await http("/invitations/access/exchange", {
          method: "POST",
          body: { token: badToken },
        })
      ).status,
      401,
    );
  assert.equal(
    (
      await http("/invitations/access/exchange", {
        method: "POST",
        body: { token: badToken },
      })
    ).status,
    429,
  );
  // Bad attempts from a shared proxy cannot lock out already valid capabilities.
  await httpEnter(link);
  assert.equal((await http("/invitations/access", { session })).status, 200);
  assert.equal(
    (
      await http("/invitations/access", {
        session,
        expected: randomUUID(),
      })
    ).status,
    401,
  );
  const logs = JSON.stringify(events);
  assert.ok(logs.includes("INVITATION_ACCESS_DENIED"));
  assert.ok(logs.includes("INVITATION_RATE_LIMITED"));
  for (const value of [
    badToken,
    token(link),
    session.cookie.split("=")[1],
    session.csrf,
    link.invitation.id,
    "Example Recipient",
    "127.0.0.1",
  ])
    assert.ok(!logs.includes(value));
  const buckets = JSON.stringify(await db.invitationRateBucket.findMany());
  for (const value of [badToken, token(link), session.cookie.split("=")[1]])
    assert.ok(!buckets.includes(value));
});

test("external clarification resumes through a renewed link and cannot be read or answered by another invitee", async () => {
  await db.invitationRateBucket.deleteMany();
  const link = await create();
  const other = await httpEnter(await create());
  const s = await httpEnter(link);
  const path = `/invitations/access/questions/${question.id}`;
  assert.equal(
    (
      await http(path + "/draft", {
        session: s,
        method: "PUT",
        body: {
          ...blank,
          answer: "Fictional scope",
          expectedVersion: 0,
          requestId: randomUUID(),
        },
      })
    ).status,
    200,
  );
  const submitted = await http(path + "/submit", {
    session: s,
    method: "POST",
    body: { expectedVersion: 1, requestId: randomUUID() },
  });
  assert.equal(submitted.status, 201);
  const { ReviewService } =
    await import("../../app/backend/dist/review/review.service.js");
  const commands = app.get(ReviewService);
  const requested = await commands.request(
    context(analyst),
    project.id,
    question.id,
    {
      requestId: randomUUID(),
      expectedVersion: (await review.detail(analyst, project.id, question.id))
        .lockVersion,
      responseRevisionId: submitted.body.revisions[0].id,
      body: "Please clarify the fictional scope.",
    },
  );
  const own = await http(path + "/clarifications", { session: s });
  assert.equal(own.status, 200);
  assert.equal(own.body.threads.length, 1);
  assert.equal(own.body.threads[0].id, requested.threadId);
  assert.equal(
    (await http(path + "/clarifications", { session: other })).body.threads
      .length,
    0,
  );
  const reply = {
    requestId: randomUUID(),
    expectedVersion: own.body.lockVersion,
    threadId: requested.threadId,
    expectedThreadVersion: own.body.threads[0].lockVersion,
    body: "The scope is only the fictional example.",
  };
  assert.equal(
    (
      await http(path + "/clarifications/reply", {
        session: other,
        method: "POST",
        body: reply,
      })
    ).status,
    404,
  );
  const renewed = await manager.renew(
    context(analyst),
    project.id,
    link.invitation.id,
    { expectedVersion: 0 },
  );
  assert.equal(
    (await http(path + "/clarifications", { session: s })).status,
    401,
  );
  const continued = await httpEnter(renewed);
  const answered = await http(path + "/clarifications/reply", {
    session: continued,
    method: "POST",
    body: reply,
  });
  assert.equal(answered.status, 201, JSON.stringify(answered.body));
  const replay = await http(path + "/clarifications/reply", {
    session: continued,
    method: "POST",
    body: reply,
  });
  assert.equal(replay.status, 201);
  assert.deepEqual(answered.body, replay.body);
  const result = await http(path + "/clarifications", { session: continued });
  assert.equal(result.body.threads[0].messages.length, 2);
  assert.equal(result.body.threads[0].messages[1].body, reply.body);
  const events = await db.auditEvent.findMany({
    where: {
      actorId: (
        await db.responseInvitation.findUniqueOrThrow({
          where: { id: link.invitation.id },
        })
      ).respondentId,
    },
  });
  assert.ok(
    events.some(
      (e) =>
        e.action.includes("CLARIFICATION") &&
        e.actorSnapshot.identityKind === "INVITATION",
    ),
  );
});

test("external evidence uses private authorization, real MIME, size and SHA-256 validation", async () => {
  const { PDFDocument } = await import("pdf-lib");
  const { createHash } = await import("node:crypto");
  const pdf = await PDFDocument.create();
  pdf.addPage().drawText("Fictional invitation evidence");
  const bytes = Buffer.from(await pdf.save());
  const link = await create();
  const s = await httpEnter(link);
  const other = await httpEnter(await create());
  const disallowed = await httpEnter(await create({ allowEvidence: false }));
  async function upload(session, body = bytes, originalName = "example.pdf") {
    const r = await fetch(
      origin + `/api/v1/invitations/access/questions/${question.id}/evidence`,
      {
        method: "POST",
        headers: {
          Origin: origin,
          Cookie: session.cookie,
          "X-CSRF-Token": session.csrf,
          "X-Invitation-Id": session.id,
          "Content-Type": "application/octet-stream",
          "X-Evidence-Metadata": encodeURIComponent(
            JSON.stringify({ requestId: randomUUID(), originalName }),
          ),
        },
        body,
      },
    );
    return { status: r.status, body: await r.json() };
  }
  const staged = await upload(s);
  assert.equal(staged.status, 201, JSON.stringify(staged.body));
  assert.equal(
    staged.body.sha256,
    createHash("sha256").update(bytes).digest("hex"),
  );
  assert.equal(staged.body.detectedMimeType, "application/pdf");
  assert.equal((await upload(disallowed)).status, 404);
  assert.equal((await upload(s, Buffer.from("not a pdf"))).status, 422);
  const originalLimit = process.env.EVIDENCE_MAX_BYTES;
  try {
    process.env.EVIDENCE_MAX_BYTES = "100";
    assert.equal((await upload(s)).status, 413);
  } finally {
    if (originalLimit === undefined) delete process.env.EVIDENCE_MAX_BYTES;
    else process.env.EVIDENCE_MAX_BYTES = originalLimit;
  }
  async function download(session) {
    return fetch(
      origin + `/api/v1/invitations/access/evidence/${staged.body.id}/download`,
      {
        headers: { Cookie: session.cookie, "X-Invitation-Id": session.id },
      },
    );
  }
  const own = await download(s);
  assert.equal(own.status, 200);
  assert.equal(own.headers.get("cache-control"), "no-store");
  assert.equal(own.headers.get("x-content-type-options"), "nosniff");
  assert.deepEqual(Buffer.from(await own.arrayBuffer()), bytes);
  assert.equal((await download(other)).status, 404);
  assert.equal((await download(disallowed)).status, 404);
  const path = `/invitations/access/questions/${question.id}`;
  for (const session of [s, other]) {
    assert.equal(
      (
        await http(path + "/draft", {
          session,
          method: "PUT",
          body: {
            ...blank,
            answer: "Fictional evidence scope",
            expectedVersion: 0,
            requestId: randomUUID(),
          },
        })
      ).status,
      200,
    );
  }
  const foreignAttach = await http(path + "/evidence/attach", {
    session: other,
    method: "POST",
    body: {
      requestId: randomUUID(),
      expectedVersion: 1,
      evidenceId: staged.body.id,
    },
  });
  assert.equal(foreignAttach.status, 404);
  const attached = await http(path + "/evidence/attach", {
    session: s,
    method: "POST",
    body: {
      requestId: randomUUID(),
      expectedVersion: 1,
      evidenceId: staged.body.id,
    },
  });
  assert.equal(attached.status, 201);
  const sent = await http(path + "/submit", {
    session: s,
    method: "POST",
    body: {
      requestId: randomUUID(),
      expectedVersion: attached.body.lockVersion,
    },
  });
  assert.equal(sent.status, 201);
  assert.equal(sent.body.revisions[0].evidence[0].evidence.id, staged.body.id);
  assert.equal(
    sent.body.revisions[0].evidence[0].evidence.sha256,
    staged.body.sha256,
  );
  assert.equal((await download(other)).status, 404);
  await manager.revoke(context(analyst), project.id, link.invitation.id, 0);
  assert.equal((await download(s)).status, 401);
});

test("foreign organization scope is denied and invitation principals stay out of account administration", async () => {
  const org = await db.organization.create({
    data: {
      code: `OTHER-${randomUUID()}`,
      name: "Other fictional organization",
    },
  });
  const foreignUser = await db.user.create({
    data: {
      organizationId: org.id,
      username: "example.owner",
      displayName: "Other Example Owner",
      mustChangePassword: false,
      isOrganizationAdmin: true,
    },
  });
  const foreignArea = await db.area.create({
    data: {
      organizationId: org.id,
      code: "EXAMPLE",
      name: "Other Example Area",
    },
  });
  const foreignProject = await db.project.create({
    data: {
      organizationId: org.id,
      externalId: "OTHER-EXAMPLE",
      name: "Other Example Project",
    },
  });
  const link = await create();
  const s = await enter(link);
  const denied = (work) => assert.rejects(work, (e) => e.getStatus?.() === 404);
  await denied(() => responses.get(s.actor, foreignProject.id, question.id));
  await denied(() => manager.list(foreignUser, project.id, 1));
  await denied(() =>
    manager.revoke(context(foreignUser), project.id, link.invitation.id, 0),
  );
  await assert.rejects(
    () => create({ areaId: foreignArea.id }),
    (e) =>
      e.getStatus?.() === 400 &&
      e.message === "Selecciona un área activa de este proyecto.",
  );
  await denied(() => create({}, foreignUser));
  const { AdministrationService } =
    await import("../../app/backend/dist/administration/administration.service.js");
  const accounts = app.get(AdministrationService);
  assert.ok(!(await accounts.users(admin)).some((u) => u.id === s.actor.id));
  assert.ok(
    !(await accounts.members(admin, project.id)).some(
      (m) => m.userId === s.actor.id,
    ),
  );
  await denied(() => accounts.setActive(context(admin), s.actor.id, false));
  await denied(() =>
    accounts.resetPassword(context(admin), s.actor.id, password),
  );
  await denied(() =>
    accounts.setMember(context(admin), project.id, {
      userId: s.actor.id,
      role: "STAKEHOLDER",
      areaId: area.id,
      active: true,
    }),
  );
  assert.equal(
    (await db.user.findUniqueOrThrow({ where: { id: s.actor.id } }))
      .passwordHash,
    null,
  );
  assert.ok(await responses.get(s.actor, project.id, question.id));
});

test("one invitation keeps several answers and MATRIX validation independent of an account participant", async () => {
  const matrix = await db.question.findFirstOrThrow({
    where: {
      projectId: project.id,
      publication: "PUBLISHED",
      QuestionCondition_child: null,
      QuestionRevision_questionRecord: { some: { type: "MATRIX" } },
    },
  });
  const accountBefore = await responses.get(
    participant,
    project.id,
    question.id,
  );
  const link = await create({ questionIds: [question.id, matrix.id] });
  const s = await enter(link);
  const own = await responses.personal(s.actor, project.id);
  assert.deepEqual(
    own.sections
      .flatMap((section) => section.questions.map((q) => q.id))
      .sort(),
    [question.id, matrix.id].sort(),
  );
  await responses.save(context(s.actor), project.id, question.id, {
    ...blank,
    answer: "First independent answer",
    expectedVersion: 0,
    requestId: randomUUID(),
  });
  await responses.submit(context(s.actor), project.id, question.id, {
    expectedVersion: 1,
    requestId: randomUUID(),
  });
  const partial = { RECIBIR: "SOLICITANTE" };
  await responses.save(context(s.actor), project.id, matrix.id, {
    ...blank,
    answer: partial,
    expectedVersion: 0,
    requestId: randomUUID(),
  });
  await assert.rejects(
    () =>
      responses.submit(context(s.actor), project.id, matrix.id, {
        expectedVersion: 1,
        requestId: randomUUID(),
      }),
    (e) => e.getStatus?.() === 422,
  );
  const resumed = await enter(link);
  const matrixView = await responses.get(resumed.actor, project.id, matrix.id);
  assert.deepEqual(matrixView.draft.answer, partial);
  assert.equal(
    (await responses.get(resumed.actor, project.id, question.id)).revisions[0]
      .answer,
    "First independent answer",
  );
  const answer = { ...partial, REVISAR: "REVISORA" };
  const saved = await responses.save(
    context(resumed.actor),
    project.id,
    matrix.id,
    {
      ...blank,
      answer,
      expectedVersion: matrixView.lockVersion,
      requestId: randomUUID(),
    },
  );
  const sent = await responses.submit(
    context(resumed.actor),
    project.id,
    matrix.id,
    { expectedVersion: saved.lockVersion, requestId: randomUUID() },
  );
  assert.deepEqual(sent.revisions[0].answer, answer);
  const finished = (await manager.list(analyst, project.id, 1)).items.find(
    (i) => i.id === link.invitation.id,
  );
  assert.equal(finished.status, "SUBMITTED");
  assert.equal(finished.submitted, 2);
  assert.equal(finished.total, 2);
  assert.deepEqual(
    await responses.get(participant, project.id, question.id),
    accountBefore,
  );
});

test("invited writes roll back on audit/storage failure, reconcile orphans and survive application restart", async (t) => {
  const { PDFDocument } = await import("pdf-lib");
  const { STORAGE, sha256 } =
    await import("../../app/backend/dist/responses/storage.js");
  const storage = app.get(STORAGE);
  const pdf = await PDFDocument.create();
  pdf.addPage().drawText("Fictional restart evidence");
  const bytes = Buffer.from(await pdf.save());
  const link = await create();
  const guest = await enter(link);
  const browserSession = await httpEnter(link);
  const stage = () =>
    responses.stage(
      context(guest.actor),
      project.id,
      question.id,
      { requestId: randomUUID(), originalName: "example.pdf" },
      bytes,
    );
  const saved = await responses.save(
    context(guest.actor),
    project.id,
    question.id,
    {
      ...blank,
      answer: "Persistent fictional draft",
      expectedVersion: 0,
      requestId: randomUUID(),
    },
  );
  const count = await db.evidence.count();
  const unavailablePut = t.mock.method(storage, "put", async () => {
    throw new Error("injected unavailable storage");
  });
  try {
    await assert.rejects(stage, /injected unavailable storage/);
    assert.equal(await db.evidence.count(), count);
    assert.deepEqual(
      await responses.get(guest.actor, project.id, question.id),
      saved,
    );
  } finally {
    unavailablePut.mock.restore();
  }
  const realPut = storage.put.bind(storage);
  let orphan;
  const capturedPut = t.mock.method(storage, "put", async (data) => {
    orphan = await realPut(data);
    return orphan;
  });
  await owner.query(
    `CREATE FUNCTION invitation_test_audit_fail() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action IN ('RESPONSE_DRAFTED','RESPONSE_SUBMITTED','EVIDENCE_STAGED') THEN RAISE EXCEPTION 'invitation audit failure injection'; END IF; RETURN NEW; END $$; CREATE TRIGGER invitation_test_audit_fail BEFORE INSERT ON "AuditEvent" FOR EACH ROW EXECUTE FUNCTION invitation_test_audit_fail()`,
  );
  try {
    await assert.rejects(
      () =>
        responses.save(context(guest.actor), project.id, question.id, {
          ...blank,
          answer: "Must roll back",
          expectedVersion: saved.lockVersion,
          requestId: randomUUID(),
        }),
      /invitation audit failure injection/,
    );
    await assert.rejects(
      () =>
        responses.submit(context(guest.actor), project.id, question.id, {
          expectedVersion: saved.lockVersion,
          requestId: randomUUID(),
        }),
      /invitation audit failure injection/,
    );
    await assert.rejects(stage, /invitation audit failure injection/);
    assert.deepEqual(
      await responses.get(guest.actor, project.id, question.id),
      saved,
    );
    assert.equal(await db.evidence.count(), count);
    assert.ok(orphan);
    assert.deepEqual(await storage.read(orphan), bytes);
  } finally {
    capturedPut.mock.restore();
    await owner.query(
      'DROP TRIGGER invitation_test_audit_fail ON "AuditEvent"; DROP FUNCTION invitation_test_audit_fail()',
    );
  }
  const reconciled = await responses.reconcile(
    new Date(Date.now() + 25 * 60 * 60 * 1000),
  );
  assert.ok(reconciled.removed >= 1);
  await assert.rejects(() => storage.read(orphan));
  const staged = await stage();
  const attached = await responses.attachment(
    context(guest.actor),
    project.id,
    question.id,
    {
      requestId: randomUUID(),
      expectedVersion: saved.lockVersion,
      evidenceId: staged.id,
    },
    false,
  );
  assert.equal(attached.draft.evidence[0].evidence.sha256, sha256(bytes));
  await app.close();
  app = await globalThis.createInvitationTestApp();
  const path = `/invitations/access/questions/${question.id}`;
  const resumed = await http(path, { session: browserSession });
  assert.equal(resumed.status, 200);
  assert.equal(resumed.body.draft.answer, "Persistent fictional draft");
  assert.equal(resumed.body.draft.evidence[0].evidence.sha256, sha256(bytes));
  const originalLink = await httpEnter(link);
  assert.deepEqual(
    (await http(path, { session: originalLink })).body,
    resumed.body,
  );
  const sent = await http(path + "/submit", {
    method: "POST",
    session: originalLink,
    body: {
      requestId: randomUUID(),
      expectedVersion: resumed.body.lockVersion,
    },
  });
  assert.equal(sent.status, 201);
  assert.equal(sent.body.revisions[0].answer, "Persistent fictional draft");
  const download = () =>
    fetch(
      origin + `/api/v1/invitations/access/evidence/${staged.id}/download`,
      {
        headers: {
          Cookie: originalLink.cookie,
          "X-Invitation-Id": originalLink.id,
        },
      },
    );
  const downloaded = await download();
  assert.equal(downloaded.status, 200);
  assert.equal(
    sha256(Buffer.from(await downloaded.arrayBuffer())),
    sha256(bytes),
  );
  const row = await db.evidence.findUniqueOrThrow({ where: { id: staged.id } });
  await app.get(STORAGE).remove(row.storageKey);
  assert.equal(
    (await download()).status,
    503,
    "missing object is never reported as a successful download",
  );
  assert.equal(
    (await http(path, { session: originalLink })).body.revisions.length,
    1,
    "unavailable storage does not erase the submitted history",
  );
});
