import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { config } from "dotenv";
import pg from "pg";
import { PDFDocument } from "pdf-lib";
let reviewEvidenceId;
import { template } from "../fixtures-template.mjs";
config({ quiet: true });
const name = "requirements_2e_" + randomBytes(6).toString("hex"),
  origin = "http://localhost:4331",
  password = "Test-" + randomBytes(24).toString("base64url");
const ownerUrl = new URL(process.env.MIGRATION_DATABASE_URL),
  runtimeUrl = new URL(process.env.DATABASE_URL),
  adminDb = new pg.Client({ connectionString: ownerUrl.href });
let app,
  db,
  owner,
  root,
  project,
  _otherProject,
  questions,
  admin,
  analyst,
  stakeholder,
  viewer,
  other,
  member;
const path = (q) => `/projects/${project.id}/questions/${q.id}`;
async function req(url, { session = analyst, method = "GET", body } = {}) {
  const r = await fetch(origin + "/api/v1" + url, {
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
  return { status: r.status, data: await r.json(), headers: r.headers };
}
async function ok(url, opts) {
  const r = await req(url, opts);
  assert.ok(
    [200, 201].includes(r.status),
    `${url}: ${r.status} ${JSON.stringify(r.data)}`,
  );
  return r.data;
}
async function login(username) {
  const r = await req("/auth/login", {
    session: null,
    method: "POST",
    body: { username, password },
  });
  assert.equal(r.status, 201);
  return {
    cookie: r.headers.get("set-cookie").split(";")[0],
    csrf: r.data.csrfToken,
    user: r.data.user,
  };
}
const detail = (q) => ok(path(q) + "/review");
async function cmd(q, suffix, body = {}, session = analyst) {
  const d = await detail(q);
  return req(path(q) + "/review/" + suffix, {
    session,
    method: "POST",
    body: { requestId: randomUUID(), expectedVersion: d.lockVersion, ...body },
  });
}
async function command(q, suffix, body = {}, session = analyst) {
  const r = await cmd(q, suffix, body, session);
  assert.equal(r.status, 201, JSON.stringify(r.data));
  return r.data;
}
async function save(q, answer, session = stakeholder) {
  const v = await ok(path(q) + "/response", { session });
  return ok(path(q) + "/response/draft", {
    session,
    method: "PUT",
    body: {
      answer,
      comment: "",
      example: "",
      consultationRequested: false,
      requestId: randomUUID(),
      expectedVersion: v.lockVersion,
    },
  });
}
async function submit(q, answer, session = stakeholder) {
  await save(q, answer, session);
  const v = await ok(path(q) + "/response", { session });
  return ok(path(q) + "/response/submit", {
    session,
    method: "POST",
    body: { requestId: randomUUID(), expectedVersion: v.lockVersion },
  });
}
const decision = (ids) => ({
  decisionText: "Decisión ficticia documentada",
  scope: "Procedimiento de prueba",
  exceptions: "",
  validationComment: "Revisado contra las fuentes",
  responseRevisionIds: ids,
  clarificationMessageIds: [],
  conflictResolutionIds: [],
});
const of = (type) => questions.find((q) => q.type === type);
before(
  async () => {
    root = await mkdtemp(join(tmpdir(), "requirements-2e-"));
    await adminDb.connect();
    await adminDb.query(`CREATE DATABASE "${name}"`);
    ownerUrl.pathname = "/" + name;
    runtimeUrl.pathname = "/" + name;
    const migrate = spawnSync(
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
    assert.equal(migrate.status, 0, migrate.stdout + migrate.stderr);
    Object.assign(process.env, {
      DATABASE_URL: runtimeUrl.href,
      APP_ORIGIN: origin,
      PORT: "4331",
      COOKIE_SECURE: "false",
      DEMO_SEED: "true",
      DEMO_PASSWORD: password,
      NODE_ENV: "test",
      ORGANIZATION_CODE: "DEFAULT",
      ORGANIZATION_NAME: "Example organization",
      EVIDENCE_ROOT: root,
    });
    const seed = spawnSync("node", ["app/backend/dist/seed.js"], {
      encoding: "utf8",
      env: process.env,
    });
    assert.equal(seed.status, 0, seed.stderr);
    const { PrismaClient } = await import("@prisma/client"),
      { PrismaPg } = await import("@prisma/adapter-pg");
    db = new PrismaClient({
      adapter: new PrismaPg({ connectionString: runtimeUrl.href }),
    });
    owner = new pg.Client({ connectionString: ownerUrl.href });
    await owner.connect();
    await db.user.updateMany({ data: { mustChangePassword: false } });
    const { createApp } = await import("../../app/backend/dist/main.js");
    app = await createApp();
    admin = await login("admin");
    analyst = await login("analyst");
    stakeholder = await login("stakeholder");
    viewer = await login("viewer");
    const projects = await ok("/projects", { session: admin });
    project = projects.find((p) => p.externalId === "DEMO-PRINCIPAL");
    _otherProject = projects.find((p) => p.externalId === "DEMO-SECUNDARIO");
    questions = (await ok(`/projects/${project.id}/questionnaire`)).questions;
    member = await db.projectMember.findFirst({
      where: { projectId: project.id, userId: stakeholder.user.id },
    });
    const u = await ok("/users", {
      session: admin,
      method: "POST",
      body: {
        username: "reviewother",
        displayName: "Segundo participante ficticio",
        temporaryPassword: password,
      },
    });
    await db.user.update({
      where: { id: u.id },
      data: { mustChangePassword: false },
    });
    other = await login("reviewother");
    const m = await ok(`/projects/${project.id}/members`, {
      session: admin,
      method: "POST",
      body: {
        userId: u.id,
        role: "STAKEHOLDER",
        areaId: member.areaId,
        active: true,
      },
    });
    for (const q of questions.filter(
      (q) => q.publication === "PUBLISHED" && !q.condition,
    )) {
      await ok(path(q) + "/assign", {
        method: "POST",
        body: {
          projectMemberId: m.id,
          active: true,
          required: false,
          expectedVersion: q.lockVersion,
        },
      });
    }
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
});

async function emptyProject(code) {
  const p = await ok("/projects", {
    session: admin,
    method: "POST",
    body: {
      externalId: code,
      name: "Proyecto ficticio " + code,
      description: "",
    },
  });
  await ok(`/projects/${p.id}/members`, {
    session: admin,
    method: "POST",
    body: {
      userId: analyst.user.id,
      role: "ANALYST",
      areaId: null,
      active: true,
    },
  });
  return p;
}
async function importFile(p, file, command, session = admin) {
  const r = await fetch(
    origin +
      `/api/v1/projects/${p.id}/imports/${command ? "confirm" : "preview"}`,
    {
      method: "POST",
      headers: {
        Origin: origin,
        Cookie: session.cookie,
        "X-CSRF-Token": session.csrf,
        "Content-Type": "application/octet-stream",
        ...(command
          ? { "X-Import-Command": encodeURIComponent(JSON.stringify(command)) }
          : {}),
      },
      body: typeof file === "string" ? file : JSON.stringify(file),
    },
  );
  return { status: r.status, data: await r.json() };
}
const confirmation = (preview, extra = {}) => ({
  payloadHash: preview.payloadHash,
  expectedProjectVersion: preview.expectedProjectVersion,
  requestId: randomUUID(),
  createMissingAreas: true,
  ...extra,
});
async function exported(
  format = "JSON",
  session = analyst,
  scope = "full",
  p = project,
) {
  const r = await fetch(origin + `/api/v1/projects/${p.id}/exports`, {
    method: "POST",
    headers: {
      Origin: origin,
      Cookie: session.cookie,
      "X-CSRF-Token": session.csrf,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ format, scope, requestId: randomUUID() }),
  });
  const text = await r.text();
  return {
    status: r.status,
    text,
    data: format === "JSON" || !r.ok ? JSON.parse(text) : null,
  };
}

test("T07/T14 import preserves exact IDs, source locations and traces; atomic/idempotent concurrent confirm", async () => {
  const p = await emptyProject("IMPORT-OK"),
    file = template(p.externalId),
    before = await db.auditEvent.count({ where: { projectId: p.id } });
  const preview = await importFile(p, file);
  assert.equal(preview.status, 201);
  assert.deepEqual(preview.data.errors, []);
  assert.equal(preview.data.counts.questions, 2);
  assert.equal(await db.section.count({ where: { projectId: p.id } }), 0);
  assert.equal(
    await db.auditEvent.count({ where: { projectId: p.id } }),
    before,
  );
  const cmd = confirmation(preview.data),
    results = await Promise.all([
      importFile(p, file, cmd),
      importFile(p, file, cmd),
    ]);
  for (const r of results) assert.equal(r.status, 201, JSON.stringify(r.data));
  assert.deepEqual(results[0].data, results[1].data);
  assert.equal(await db.importBatch.count({ where: { projectId: p.id } }), 1);
  assert.equal(
    await db.auditEvent.count({
      where: { projectId: p.id, action: "PROJECT_IMPORTED" },
    }),
    1,
  );
  const qs = await db.question.findMany({
    where: { projectId: p.id },
    orderBy: { order: "asc" },
  });
  assert.deepEqual(
    qs.map((q) => q.externalId),
    ["FORM-14", "FORM-014"],
  );
  assert.ok(
    qs.every((q) => q.publication === "DRAFT" && q.status === "NOT_REVIEWED"),
  );
  const rev = await db.questionRevision.findFirst({
    where: { questionId: qs[0].id },
  });
  assert.deepEqual(rev.sourceLocator, file.questions[0].sourceLocator);
  assert.equal(
    await db.questionTraceability.count({ where: { projectId: p.id } }),
    1,
  );
  assert.ok((await importFile(p, file)).data.errors.length);
  const changed = structuredClone(file);
  changed.project.name = "Distinto";
  assert.equal((await importFile(p, changed, cmd)).status, 409);
  const trace = await ok(`/projects/${p.id}/traceability`, { session: admin });
  assert.equal(trace.references[0].externalId, "REQ-14");
  assert.equal("status" in trace.references[0], false);
});
test("T13 preview rejects duplicates, cycles, orphans, malicious state and malformed bytes without writes", async () => {
  const p = await emptyProject("IMPORT-BAD"),
    base = template(p.externalId, "BAD-AREA");
  const cases = [
    (s) => {
      s.questions.push({ ...s.questions[0] });
    },
    (s) => {
      s.questions[0].groupParentExternalId = "FORM-014";
    },
    (s) => {
      s.conditions.push({
        parentQuestionExternalId: "FORM-014",
        childQuestionExternalId: "FORM-14",
        operator: "NOT_EQUALS",
        value: "x",
      });
    },
    (s) => {
      s.questions[0].sectionExternalId = "OTHER";
    },
    (s) => {
      s.questions[0].references[0].externalId = "MISSING";
    },
    (s) => {
      s.questions[0].status = "VALIDATED";
    },
    (s) => {
      s.roles = ["ADMIN"];
    },
    (s) => {
      s.formatVersion = "2.0";
    },
    (s) => {
      s.kind = "project-export";
    },
    (s) => {
      s.conditions[0].operator = "CONTAINS";
    },
    (s) => {
      s.questions[0].externalId = " FORM-14";
    },
  ];
  for (const modify of cases) {
    const file = structuredClone(base);
    modify(file);
    const r = await importFile(p, file);
    assert.equal(r.status, 201);
    assert.ok(r.data.errors.length, JSON.stringify(file));
    assert.ok(r.data.errors[0].path.startsWith("/"));
  }
  for (const text of [
    '{"kind":"a","kind":"b"}',
    '{"__proto__":{"polluted":true}}',
    "[".repeat(21) + "]".repeat(21),
  ])
    assert.ok((await importFile(p, text)).data.errors.length);
  assert.equal(
    (await importFile(p, " ".repeat(5 * 1024 * 1024 + 1))).status,
    413,
  );
  assert.equal(await db.section.count({ where: { projectId: p.id } }), 0);
  assert.equal(await db.importBatch.count({ where: { projectId: p.id } }), 0);
  assert.equal(await db.area.count({ where: { code: "BAD-AREA" } }), 0);
});
test("T14 permissions, stale version/hash and rollback after injected database failure", async () => {
  const p = await emptyProject("IMPORT-ROLLBACK"),
    file = template(p.externalId, "ROLLBACK-AREA");
  const a = await importFile(p, file, undefined, analyst);
  assert.ok(a.data.errors.some((e) => e.path.startsWith("/areas")));
  const preview = (await importFile(p, file)).data;
  assert.equal(
    (
      await importFile(
        p,
        file,
        confirmation(preview, { expectedProjectVersion: 99 }),
      )
    ).status,
    409,
  );
  assert.equal(
    (
      await importFile(
        p,
        file,
        confirmation(preview, { payloadHash: "0".repeat(64) }),
      )
    ).status,
    409,
  );
  assert.equal(
    (
      await importFile(
        p,
        file,
        confirmation(preview, { createMissingAreas: false }),
      )
    ).status,
    400,
  );
  await owner.query(
    `CREATE FUNCTION fail_import_test() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'test rollback'; END $$; CREATE TRIGGER fail_import_test BEFORE INSERT ON "ImportBatch" FOR EACH ROW EXECUTE FUNCTION fail_import_test()`,
  );
  try {
    assert.equal(
      (await importFile(p, file, confirmation(preview))).status,
      500,
    );
  } finally {
    await owner.query(
      'DROP TRIGGER fail_import_test ON "ImportBatch"; DROP FUNCTION fail_import_test()',
    );
  }
  for (const table of [
    "section",
    "question",
    "questionRevision",
    "traceabilityReference",
    "importBatch",
  ])
    assert.equal(await db[table].count({ where: { projectId: p.id } }), 0);
  assert.equal(await db.area.count({ where: { code: "ROLLBACK-AREA" } }), 0);
  const c1 = confirmation(preview),
    c2 = confirmation(preview),
    race = await Promise.all([
      importFile(p, file, c1),
      importFile(p, file, c2),
    ]);
  assert.equal(race.filter((r) => r.status === 201).length, 1);
  assert.equal(await db.importBatch.count({ where: { projectId: p.id } }), 1);
});
test("T17 dashboard exact universe, independent denominators and empty !=100%", async () => {
  const p = await emptyProject("EMPTY-METRICS"),
    empty = await ok(`/projects/${p.id}/dashboard`);
  assert.equal(empty.metrics.validation.denominator, 0);
  assert.equal(empty.metrics.validation.percentage, null);
  const data = await ok(`/projects/${project.id}/dashboard`),
    count = await db.question.count({
      where: { projectId: project.id, publication: "PUBLISHED" },
    });
  assert.equal(data.states.length, 8);
  assert.equal(
    data.states.reduce((n, s) => n + s.count, 0),
    count,
  );
  assert.equal(data.metrics.validation.denominator, count);
  for (const b of data.breakdowns) {
    const subset = data.questions.filter((q) =>
      b.dimension === "section"
        ? q.sectionId === b.key
        : b.dimension === "area"
          ? q.areaId === b.key
          : q[b.dimension] === b.key,
    );
    assert.equal(b.metrics.closure.denominator, subset.length);
  }
  assert.ok(
    data.questions.some(
      (q) => q.conditionalWithoutCase && q.status !== "NOT_APPLICABLE",
    ),
  );
});
test("T08/T11/T18/T20 exported decisions, evidence, escaping, privacy, invalidation and role isolation", async () => {
  const q = of("SHORT_TEXT");
  await save(q, "Respuesta ficticia <img src=x onerror=alert(1)>");
  const pdf = await PDFDocument.create();
  pdf.addPage().drawText("Evidence fictitious 2E");
  const bytes = Buffer.from(await pdf.save());
  const upload = await fetch(origin + "/api/v1" + path(q) + "/evidence", {
    method: "POST",
    headers: {
      Origin: origin,
      Cookie: stakeholder.cookie,
      "X-CSRF-Token": stakeholder.csrf,
      "Content-Type": "application/octet-stream",
      "X-Evidence-Metadata": encodeURIComponent(
        JSON.stringify({
          requestId: randomUUID(),
          originalName: "fuente-ficticia.pdf",
        }),
      ),
    },
    body: bytes,
  });
  assert.equal(upload.status, 201);
  reviewEvidenceId = (await upload.json()).id;
  const v = await ok(path(q) + "/response", { session: stakeholder });
  await ok(path(q) + "/response/evidence/attach", {
    session: stakeholder,
    method: "POST",
    body: {
      requestId: randomUUID(),
      expectedVersion: v.lockVersion,
      evidenceId: reviewEvidenceId,
    },
  });
  const sent = await submit(
      q,
      "Respuesta ficticia <img src=x onerror=alert(1)>",
    ),
    rev = sent.revisions[0];
  await command(q, "validate", {
    ...decision([rev.id]),
    decisionText:
      "Decisión <script>alert(1)</script> [abrir](javascript:alert(1))",
    validationComment: "PRIVATE_ANALYST_COMMENT",
  });
  await save(q, "PRIVATE_DRAFT_SECRET");
  const full = await exported();
  assert.equal(full.status, 201);
  assert.equal(full.data.kind, "project-export");
  assert.ok(full.data.responseRevisions.some((r) => r.id === rev.id));
  assert.ok(
    full.data.evidence.some((e) => e.id === reviewEvidenceId && e.sha256),
  );
  assert.ok(
    full.data.revisionEvidence.some((e) => e.responseRevisionId === rev.id),
  );
  for (const secret of [
    "passwordHash",
    "storageKey",
    "csrfSecret",
    "tokenHash",
    "PRIVATE_DRAFT_SECRET",
    "ResponseDraft",
  ])
    assert.equal(full.text.includes(secret), false, secret);
  const markdown = await exported("MARKDOWN");
  assert.equal(markdown.status, 201);
  assert.ok(markdown.text.includes("Decisión validada vigente"));
  assert.ok(markdown.text.includes("&lt;script&gt;"));
  assert.equal(markdown.text.includes("<script>"), false);
  assert.equal(markdown.text.includes("[abrir](javascript:"), false);
  assert.ok(markdown.text.includes(reviewEvidenceId));
  const csv = await exported("CSV");
  assert.equal(csv.status, 201);
  assert.ok(csv.text.includes("validationId"));
  assert.ok(csv.text.includes(q.externalId));
  const limited = await exported("JSON", viewer, "validated-decisions");
  assert.equal(limited.status, 201);
  assert.equal(limited.data.kind, "validated-decisions-export");
  assert.equal(limited.text.includes("PRIVATE_ANALYST_COMMENT"), false);
  assert.equal(limited.text.includes("PRIVATE_DRAFT_SECRET"), false);
  assert.equal("auditEvents" in limited.data, false);
  assert.equal((await exported("JSON", viewer)).status, 403);
  assert.equal((await exported("JSON", stakeholder)).status, 403);
  assert.equal((await exported("JSON", other)).status, 403);
  const noMembership = await emptyProject("SCOPE-PRIVATE");
  assert.equal(
    (await exported("JSON", viewer, "validated-decisions", noMembership))
      .status,
    404,
  );
  await submit(q, "Respuesta posterior");
  const after = await exported("JSON", viewer, "validated-decisions");
  assert.equal(
    after.data.decisions.some((d) => d.question.id === q.id),
    false,
  );
  const mdAfter = await exported("MARKDOWN");
  assert.ok(mdAfter.text.includes("Sin decisión validada vigente."));
});
test("Audit metadata filtered/paginated/read-only; ImportBatch immutable at database runtime", async () => {
  const events = await ok(
    `/projects/${project.id}/history?action=EXPORT_CREATED&pageSize=2`,
  );
  assert.ok(events.total > 2);
  assert.equal(events.items.length, 2);
  assert.ok(events.items.every((e) => e.exportType && e.scope));
  assert.equal(JSON.stringify(events).includes("PRIVATE_DRAFT_SECRET"), false);
  assert.equal(
    (
      await req(`/projects/${project.id}/history`, {
        method: "POST",
        body: { action: "FAKE" },
      })
    ).status,
    404,
  );
  assert.equal(
    (await req(`/projects/${project.id}/history`, { session: viewer })).status,
    403,
  );
  const batch = await db.importBatch.findFirst();
  await assert.rejects(() =>
    db.importBatch.update({
      where: { id: batch.id },
      data: { formatVersion: "2.0" },
    }),
  );
  await assert.rejects(() =>
    db.auditEvent.updateMany({
      where: { projectId: project.id },
      data: { action: "FAKE" },
    }),
  );
});

test("decisions register: excerpts of what is in force, history kept apart, no leaks and read-only roles", async () => {
  const register = (session = analyst, id = project.id) =>
    req(`/projects/${id}/decisions`, { session });
  const entry = (list, q) => list.entries.find((e) => e.questionId === q.id);
  // The SHORT_TEXT question had a decision that a later submission invalidated:
  // it is an earlier decision, not one in force.
  const closed = of("SHORT_TEXT");
  const before = (await register()).data;
  assert.equal(entry(before, closed)?.state, "REOPENED");
  assert.ok(entry(before, closed).endedAt && entry(before, closed).endedReason);
  assert.equal(entry(before, closed).previous, 0);
  // A long decision is returned as an excerpt: the document stays in the review.
  const q = of("YES_NO");
  const long =
    "Se adopta el procedimiento único. ".repeat(40) + "FINAL-COMPLETO";
  const first = await submit(q, true);
  await command(q, "validate", {
    ...decision([first.revisions[0].id]),
    decisionText: long,
    scope: "Alcance " + "amplio ".repeat(60),
    exceptions: "Salvo urgencias",
  });
  let list = (await register()).data;
  let current = entry(list, q);
  assert.equal(current.state, "CURRENT");
  assert.equal(current.truncated, true);
  assert.ok(current.excerpt.length <= 241 && current.excerpt.endsWith("…"));
  assert.ok(!JSON.stringify(list).includes("FINAL-COMPLETO"));
  assert.ok(current.scope.length <= 121);
  assert.equal(current.hasExceptions, true);
  assert.equal(current.previous, 0);
  assert.equal(current.endedAt, null);
  assert.equal(current.decidedBy, "Analista demo");
  // Reopen and decide again: the new one is in force, the old one is history.
  await command(q, "reopen", { reason: "Cambió el alcance" });
  const reopened = entry((await register()).data, q);
  assert.equal(reopened.state, "REOPENED");
  assert.equal(reopened.endedReason, "Cambió el alcance");
  assert.equal(reopened.previous, 0);
  const second = await submit(q, false);
  await command(q, "validate", {
    ...decision([second.revisions[0].id]),
    decisionText: "Segunda decisión vigente",
  });
  current = entry((await register()).data, q);
  assert.equal(current.state, "CURRENT");
  assert.equal(current.excerpt, "Segunda decisión vigente");
  assert.equal(current.previous, 1);
  assert.equal(current.hasExceptions, false);
  // A question closed as "no aplica" is neither in force nor reopened.
  const n = of("NUMBER");
  const sent = await submit(n, 7);
  await command(n, "validate", decision([sent.revisions[0].id]));
  await command(n, "reopen", { reason: "Revisión" });
  await command(n, "not-applicable", { reason: "Ya no aplica", scope: "Todo" });
  assert.equal(entry((await register()).data, n), undefined);
  // Only this project's questions, only people who can already read decisions.
  list = (await register()).data;
  assert.ok(
    list.entries.every((e) => questions.some((x) => x.id === e.questionId)),
  );
  assert.equal((await register(admin)).status, 200);
  for (const session of [viewer, stakeholder, other])
    assert.equal((await register(session)).status, 403);
  const foreign = await ok("/projects", {
    session: admin,
    method: "POST",
    body: { externalId: "DECISIONS-FOREIGN", name: "Ajeno ficticio" },
  });
  assert.ok([403, 404].includes((await register(analyst, foreign.id)).status));
  assert.deepEqual((await register(admin, foreign.id)).data.entries, []);
  assert.equal(
    (await req(`/projects/${project.id}/decisions`, { session: null })).status,
    401,
  );
  assert.equal(
    (await req(`/projects/${project.id}/decisions`, { method: "POST" })).status,
    404,
  );
});
test("history names what an event is about without extra reads per event and groups invitation actors", async () => {
  const q = of("DATE");
  const link = await ok(`/projects/${project.id}/invitations`, {
    method: "POST",
    body: {
      requestId: randomUUID(),
      label: "Invitación de bitácora",
      questionIds: [q.id],
      areaId: member.areaId,
      identity: { name: "Persona ficticia" },
      nonNominal: false,
      allowEvidence: false,
    },
  });
  const entered = await fetch(origin + "/api/v1/invitations/access/exchange", {
    method: "POST",
    headers: { Origin: origin, "Content-Type": "application/json" },
    body: JSON.stringify({ token: new URL(link.url).hash.slice(1) }),
  });
  assert.equal(entered.status, 201);
  await submit(of("SHORT_TEXT"), "Respuesta para la bitácora");
  const log = await ok(`/projects/${project.id}/history?pageSize=50`);
  const by = (action) => log.items.filter((e) => e.action === action);
  // A submitted response names its question; so does a decision.
  const sentEvent = by("RESPONSE_SUBMITTED").find(
    (e) => e.subject?.id === of("SHORT_TEXT").id,
  );
  assert.equal(sentEvent.objectType, "Response");
  assert.equal(sentEvent.subject.kind, "QUESTION");
  assert.equal(sentEvent.subject.reference, of("SHORT_TEXT").externalId);
  assert.ok(sentEvent.subject.label.length > 0);
  assert.ok(
    by("RESPONSE_VALIDATED").every((e) => e.subject?.kind === "QUESTION"),
  );
  // The first draft of a response is recorded under its question's identifier.
  const drafts = (
    await ok(
      `/projects/${project.id}/history?action=RESPONSE_DRAFTED&pageSize=50`,
    )
  ).items;
  const firstDrafts = drafts.filter((e) =>
    questions.some((x) => x.id === e.objectId),
  );
  assert.ok(firstDrafts.length > 0);
  assert.ok(firstDrafts.every((e) => e.subject?.id === e.objectId));
  assert.ok(drafts.every((e) => e.subject?.kind === "QUESTION"));
  // An invitation is named by the label the analyst gave it.
  const created = by("INVITATION_CREATED")[0];
  assert.equal(created.subject.kind, "INVITATION");
  assert.equal(created.subject.label, "Invitación de bitácora");
  // What cannot be resolved stays unnamed instead of guessed.
  assert.ok(by("PROJECT_MEMBER_CHANGED").every((e) => e.subject === null));
  // Nothing beyond reference and title/label is added to the event.
  assert.deepEqual(Object.keys(sentEvent.subject).sort(), [
    "id",
    "kind",
    "label",
    "reference",
  ]);
  // Actors: accounts are options, invitations are a count and a kind filter.
  assert.ok(log.invitationActors >= 1);
  assert.ok(log.actors.length > 0);
  const invited = await db.user.findMany({
    where: {
      organizationId: analyst.user.organizationId,
      invitationOnly: true,
    },
    select: { id: true },
  });
  assert.ok(log.actors.every((a) => !invited.some((i) => i.id === a.id)));
  const kind = await ok(`/projects/${project.id}/history?actorKind=INVITATION`);
  assert.ok(kind.total >= 1);
  assert.ok(kind.items.every((e) => invited.some((i) => i.id === e.actorId)));
  const accounts = await ok(
    `/projects/${project.id}/history?actorKind=ACCOUNT`,
  );
  assert.ok(
    accounts.items.every((e) => !invited.some((i) => i.id === e.actorId)),
  );
  assert.equal(accounts.total + kind.total, log.total);
  // One selected invitation actor is still offered so the filter shows it.
  const one = kind.items[0].actorId;
  const picked = await ok(`/projects/${project.id}/history?actorId=${one}`);
  assert.ok(picked.actors.some((a) => a.id === one));
  assert.equal(
    (await req(`/projects/${project.id}/history`, { session: viewer })).status,
    403,
  );
});

test("Areas exact-code/name; analyst imports with existing area; CSRF/scope and CSV formula stored unchanged", async () => {
  const p = await emptyProject("ANALYST-IMPORT"),
    file = template(p.externalId, "EXACT-AREA");
  file.questions[0].title = "  =SUM(1,2)";
  await ok("/areas", { session: admin, method: "POST", body: file.areas[0] });
  const wrong = structuredClone(file);
  wrong.areas[0].name = "Nombre incompatible";
  assert.ok(
    (await importFile(p, wrong, undefined, analyst)).data.errors.some(
      (e) => e.path === "/areas/0/name",
    ),
  );
  const preview = (await importFile(p, file, undefined, analyst)).data;
  assert.deepEqual(preview.errors, []);
  assert.equal(preview.counts.areas, 0);
  const result = await importFile(
    p,
    file,
    confirmation(preview, { createMissingAreas: false }),
    analyst,
  );
  assert.equal(result.status, 201, JSON.stringify(result.data));
  const csv = await exported("CSV", analyst, "full", p);
  assert.equal(csv.status, 201);
  assert.ok(csv.text.includes('"\'  =SUM(1,2)"'));
  const q = await db.questionRevision.findFirst({
    where: { projectId: p.id, title: file.questions[0].title },
  });
  assert.ok(q);
  const noScope = await importFile(p, file, undefined, viewer);
  assert.equal(noScope.status, 404);
  const forbidden = await importFile(project, file, undefined, stakeholder);
  assert.equal(forbidden.status, 403);
  const unauth = await fetch(
    origin + `/api/v1/projects/${p.id}/imports/preview`,
    {
      method: "POST",
      headers: {
        Origin: origin,
        Cookie: admin.cookie,
        "Content-Type": "application/octet-stream",
      },
      body: JSON.stringify(file),
    },
  );
  assert.equal(unauth.status, 403);
});

for (const kind of ["minimal", "full"]) {
  test(`public ${kind} example: exact bytes preview then atomic DRAFT structure`, async () => {
    const bytes = await readFile(
      new URL(
        `../../examples/questionnaire-template.${kind}.json`,
        import.meta.url,
      ),
      "utf8",
    );
    const file = JSON.parse(bytes),
      p = await emptyProject(file.project.externalId);
    const previous = await db.auditEvent.count({ where: { projectId: p.id } });
    const preview = await importFile(p, bytes);
    assert.equal(preview.status, 201);
    assert.deepEqual(preview.data.errors, []);
    assert.equal(preview.data.canConfirm, true);
    assert.equal(preview.data.counts.questions, file.questions.length);
    assert.equal(preview.data.counts.sections, file.sections.length);
    assert.equal(await db.section.count({ where: { projectId: p.id } }), 0);
    assert.equal(
      await db.auditEvent.count({ where: { projectId: p.id } }),
      previous,
    );
    const command = confirmation(preview.data);
    const result = await importFile(p, bytes, command);
    assert.equal(result.status, 201, JSON.stringify(result.data));
    const questionnaire = await ok(`/projects/${p.id}/questionnaire`, {
      session: admin,
    });
    assert.equal(questionnaire.questions.length, file.questions.length);
    assert.ok(
      questionnaire.questions.every(
        (q) => q.publication === "DRAFT" && q.status === "NOT_REVIEWED",
      ),
    );
    assert.deepEqual(
      new Set(questionnaire.questions.map((q) => q.externalId)),
      new Set(file.questions.map((q) => q.externalId)),
    );
    const revisions = await db.questionRevision.findMany({
      where: { projectId: p.id },
    });
    assert.deepEqual(
      new Set(revisions.map((r) => r.type)),
      new Set(file.questions.map((q) => q.type)),
    );
    assert.equal(
      await db.questionCondition.count({ where: { projectId: p.id } }),
      file.conditions.length,
    );
    assert.equal(
      await db.questionTraceability.count({ where: { projectId: p.id } }),
      file.questions.reduce((n, q) => n + q.references.length, 0),
    );
    assert.equal(await db.response.count({ where: { projectId: p.id } }), 0);
    assert.equal(
      await db.questionAssignment.count({ where: { projectId: p.id } }),
      0,
    );
    if (kind === "full") {
      const parent = questionnaire.questions.find(
        (q) => q.externalId === "REQ-006",
      );
      const followup = questionnaire.questions.find(
        (q) => q.externalId === "REQ-007",
      );
      assert.equal(followup.groupParentId, parent.id);
      assert.equal(followup.condition, null);
      assert.deepEqual(
        revisions.find((r) => r.type === "MATRIX").config,
        file.questions.find((q) => q.type === "MATRIX").config,
      );
    }
    const repeat = await importFile(p, bytes, command);
    assert.deepEqual(repeat.data, result.data);
    assert.equal(await db.importBatch.count({ where: { projectId: p.id } }), 1);
  });
}
