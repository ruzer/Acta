import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { config } from "dotenv";
import pg from "pg";
import { PDFDocument } from "pdf-lib";
let reviewEvidenceId;
config({ quiet: true });
const name = "requirements_2d_" + randomBytes(6).toString("hex"),
  origin = "http://localhost:4330",
  password = "Test-" + randomBytes(24).toString("base64url");
const ownerUrl = new URL(process.env.MIGRATION_DATABASE_URL),
  runtimeUrl = new URL(process.env.DATABASE_URL),
  adminDb = new pg.Client({ connectionString: ownerUrl.href });
let app,
  db,
  owner,
  root,
  project,
  otherProject,
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
    root = await mkdtemp(join(tmpdir(), "requirements-2d-"));
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
      PORT: "4330",
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
    otherProject = projects.find((p) => p.externalId === "DEMO-SECUNDARIO");
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

test("A: múltiples rondas, privacidad, cierre y fuentes exactas sin alterar SUBMITTED", async () => {
  const q = of("SHORT_TEXT");
  await save(q, "Respuesta original");
  const pdf = await PDFDocument.create();
  pdf.addPage().drawText("Fuente ficticia 2D");
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
          originalName: "fuente-2d.pdf",
        }),
      ),
    },
    body: bytes,
  });
  assert.equal(upload.status, 201);
  reviewEvidenceId = (await upload.json()).id;
  const saved = await ok(path(q) + "/response", { session: stakeholder });
  await ok(path(q) + "/response/evidence/attach", {
    session: stakeholder,
    method: "POST",
    body: {
      requestId: randomUUID(),
      expectedVersion: saved.lockVersion,
      evidenceId: reviewEvidenceId,
    },
  });
  const sent = await submit(q, "Respuesta original"),
    rev = sent.revisions[0];
  const started = await command(q, "clarifications/request", {
    responseRevisionId: rev.id,
    body: "¿Puedes precisar el alcance?",
  });
  let d = await detail(q),
    t = d.threads[0];
  assert.equal(d.status, "CLARIFICATION_REQUIRED");
  assert.equal(started.threadId, t.id);
  assert.equal((await cmd(q, "validate", decision([rev.id]))).status, 409);
  assert.equal(
    (
      await cmd(
        q,
        "clarifications/reply",
        { threadId: t.id, expectedThreadVersion: t.lockVersion, body: "Ajeno" },
        other,
      )
    ).status,
    404,
  );
  await command(
    q,
    "clarifications/reply",
    {
      threadId: t.id,
      expectedThreadVersion: t.lockVersion,
      body: "Primera explicación",
    },
    stakeholder,
  );
  t = (await detail(q)).threads[0];
  await command(q, "clarifications/request", {
    threadId: t.id,
    expectedThreadVersion: t.lockVersion,
    responseRevisionId: rev.id,
    body: "¿Y la excepción?",
  });
  t = (await detail(q)).threads[0];
  await command(
    q,
    "clarifications/reply",
    {
      threadId: t.id,
      expectedThreadVersion: t.lockVersion,
      body: "Segunda explicación",
    },
    stakeholder,
  );
  t = (await detail(q)).threads[0];
  await command(q, "clarifications/close", {
    threadId: t.id,
    expectedThreadVersion: t.lockVersion,
    reason: "Alcance aclarado",
  });
  d = await detail(q);
  assert.equal(d.threads[0].messages.length, 4);
  assert.deepEqual(
    (await ok(path(q) + "/response", { session: stakeholder })).revisions[0],
    rev,
  );
  const messageId = d.threads[0].messages[3].id;
  await command(q, "validate", {
    ...decision([rev.id]),
    clarificationMessageIds: [messageId],
  });
  d = await detail(q);
  assert.equal(d.status, "VALIDATED");
  assert.deepEqual(
    d.validations[0].sources.map((s) => s.responseRevisionId),
    [rev.id],
  );
  assert.deepEqual(
    d.validations[0].messages.map((s) => s.clarificationMessageId),
    [messageId],
  );
  const visible = await ok(path(q) + "/review", { session: viewer });
  assert.equal(visible.submissions.length, 1);
  assert.equal(visible.threads[0].messages.length, 1);
  assert.equal(visible.validations[0].validationComment, "");
  assert.equal(visible.participants.length, 0);
  const download = await fetch(
    origin +
      `/api/v1/projects/${project.id}/evidence/${reviewEvidenceId}/download`,
    { headers: { Cookie: viewer.cookie } },
  );
  assert.equal(download.status, 200);
  assert.deepEqual(Buffer.from(await download.arrayBuffer()), bytes);
  const v = d.validations[0];
  await assert.rejects(
    owner.query('UPDATE "Validation" SET "decisionText"=$1 WHERE id=$2', [
      "alteración",
      v.id,
    ]),
  );
  await assert.rejects(
    db.validationSource.create({
      data: {
        projectId: project.id,
        validationId: v.id,
        responseRevisionId: rev.id,
      },
    }),
  );
  await assert.rejects(
    owner.query('DELETE FROM "ClarificationMessage" WHERE id=$1', [messageId]),
  );
});
test("B: Draft mantiene validación; nuevo envío invalida y conserva fuentes e historial", async () => {
  const q = of("SHORT_TEXT");
  const before = await detail(q);
  await save(q, "Borrador privado");
  let d = await detail(q);
  assert.equal(d.status, "VALIDATED");
  assert.equal(d.validations[0].invalidatedAt, null);
  assert.ok(!JSON.stringify(d).includes("Borrador privado"));
  await submit(q, "Segunda respuesta");
  d = await detail(q);
  assert.equal(d.status, "ANSWERED");
  assert.ok(d.validations[0].invalidatedAt);
  const hidden = await fetch(
    origin +
      `/api/v1/projects/${project.id}/evidence/${reviewEvidenceId}/download`,
    { headers: { Cookie: viewer.cookie } },
  );
  assert.equal(hidden.status, 404);
  assert.deepEqual(d.validations[0].sources, before.validations[0].sources);
  assert.equal(
    (await req(path(q) + "/review", { session: viewer })).status,
    404,
  );
  assert.ok(
    await db.auditEvent.findFirst({
      where: {
        action: "VALIDATION_INVALIDATED",
        objectId: d.validations[0].id,
      },
    }),
  );
  assert.equal(
    (await cmd(q, "validate", decision([before.submissions[0].id]))).status,
    409,
  );
});
test("C: conflicto exige autores distintos, compara, resuelve sin validar y decisión usa resolución", async () => {
  const q = of("YES_NO");
  const a = (await submit(q, true)).revisions[0],
    b = (await submit(q, false, other)).revisions[0];
  await submit(q, false);
  let d = await detail(q);
  const own = d.submissions.filter(
    (r) => r.respondent.id === stakeholder.user.id,
  );
  assert.equal(
    (
      await cmd(q, "conflicts", {
        reason: "Dos versiones propias",
        responseRevisionIds: own.map((s) => s.id),
      })
    ).status,
    409,
  );
  const latest = own.find((s) => s.current);
  await command(q, "conflicts", {
    reason: "Interpretaciones diferentes",
    responseRevisionIds: [a.id, b.id],
  });
  d = await detail(q);
  assert.equal(d.status, "CONFLICT");
  assert.equal(d.conflicts[0].participants.length, 2);
  assert.equal(
    (await cmd(q, "validate", decision([latest.id, b.id]))).status,
    409,
  );
  const c = d.conflicts[0];
  await command(q, "conflicts/resolve", {
    conflictId: c.id,
    expectedConflictVersion: c.lockVersion,
    resolutionText: "Se integran las dos aportaciones actuales",
    responseRevisionIds: [latest.id, b.id],
  });
  d = await detail(q);
  assert.equal(d.status, "ANSWERED");
  assert.equal(d.validations.length, 0);
  const res = d.conflicts[0].resolution;
  await command(q, "validate", {
    ...decision([latest.id, b.id]),
    conflictResolutionIds: [res.id],
  });
  d = await detail(q);
  assert.equal(d.status, "VALIDATED");
  assert.equal(d.validations[0].resolutions[0].conflictResolutionId, res.id);
  await assert.rejects(
    owner.query(
      'UPDATE "ConflictResolution" SET "resolutionText"=$1 WHERE id=$2',
      ["rewrite", res.id],
    ),
  );
});
test("D: No aplica requiere motivo y alcance, bloquea contribución y reapertura conserva historia", async () => {
  const q = of("DATE");
  assert.equal(
    (await cmd(q, "not-applicable", { reason: " ", scope: "Prueba" })).status,
    400,
  );
  await command(q, "not-applicable", {
    reason: "Fuera del proceso",
    scope: "Caso ficticio",
  });
  let d = await detail(q);
  assert.equal(d.status, "NOT_APPLICABLE");
  const v = await ok(path(q) + "/response", { session: stakeholder });
  assert.equal(
    (
      await req(path(q) + "/response/draft", {
        session: stakeholder,
        method: "PUT",
        body: {
          answer: "2026-09-28",
          comment: "",
          example: "",
          consultationRequested: false,
          requestId: randomUUID(),
          expectedVersion: v.lockVersion,
        },
      })
    ).status,
    409,
  );
  await command(q, "reopen", { reason: "Proceso incorporado" });
  d = await detail(q);
  assert.equal(d.status, "PENDING");
  assert.ok(d.dispositions[0].revokedAt);
  assert.equal(d.dispositions[0].reason, "Fuera del proceso");
});
test("Seguridad: ADMIN/VIEWER no heredan revisión, proyectos aislados y permisos retirados", async () => {
  const q = of("SHORT_TEXT"),
    ids = (await detail(q)).submissions
      .filter((s) => s.current)
      .map((s) => s.id);
  for (const session of [admin, viewer, stakeholder])
    assert.equal(
      (await cmd(q, "validate", decision(ids), session)).status,
      403,
    );
  assert.equal(
    (await req(`/projects/${otherProject.id}/questions/${q.id}/review`)).status,
    404,
  );
  assert.equal(
    (await req(path(q) + "/review", { session: stakeholder })).status,
    403,
  );
  const inbox = await ok("/review?pageSize=1");
  assert.equal(inbox.items.length, 1);
  assert.ok(inbox.total > 1);
  assert.equal((await req("/review?pageSize=101")).status, 400);
  assert.equal((await ok("/review?status=CONFLICT")).items.length, 0);
  assert.equal((await ok("/review", { session: viewer })).items.length, 0);
});
test("Concurrencia, idempotencia y rollback de auditoría", async () => {
  const q = of("NUMBER"),
    d = await detail(q),
    body = {
      requestId: randomUUID(),
      expectedVersion: d.lockVersion,
      reason: "Falta confirmar plazo",
    };
  const results = await Promise.all([
    req(path(q) + "/review/pending", { method: "POST", body }),
    req(path(q) + "/review/partial", {
      method: "POST",
      body: { ...body, requestId: randomUUID() },
    }),
  ]);
  assert.deepEqual(results.map((r) => r.status).sort(), [201, 409]);
  const win = results[0].status === 201 ? "pending" : "partial";
  if (win === "pending") {
    const again = await req(path(q) + "/review/pending", {
      method: "POST",
      body,
    });
    assert.deepEqual(again.data, results[0].data);
    assert.equal(
      (
        await req(path(q) + "/review/pending", {
          method: "POST",
          body: { ...body, reason: "Otro" },
        })
      ).status,
      409,
    );
  }
  await command(q, "pending", { reason: "Falta confirmar plazo visible" });
  const before = await detail(q);
  assert.equal(before.pendingReviewReason, "Falta confirmar plazo visible");
  await owner.query(
    `CREATE FUNCTION review_audit_fail() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='QUESTION_NOT_APPLICABLE' THEN RAISE EXCEPTION 'injection'; END IF; RETURN NEW; END $$; CREATE TRIGGER review_audit_fail BEFORE INSERT ON "AuditEvent" FOR EACH ROW EXECUTE FUNCTION review_audit_fail()`,
  );
  try {
    assert.equal(
      (
        await cmd(q, "not-applicable", {
          reason: "Prueba rollback",
          scope: "Prueba",
        })
      ).status,
      500,
    );
    assert.deepEqual(await detail(q), before);
  } finally {
    await owner.query(
      'DROP TRIGGER review_audit_fail ON "AuditEvent"; DROP FUNCTION review_audit_fail()',
    );
  }
});
test("Cobertura requerida no puede omitirse y PARTIAL necesita explicar cómo se resolvió", async () => {
  const q = of("MULTIPLE_CHOICE");
  const rev = (await submit(q, ["CORREO"], other)).revisions[0];
  assert.equal((await detail(q)).status, "PARTIAL");
  assert.equal((await cmd(q, "validate", decision([rev.id]))).status, 409);
  const original = (await submit(q, ["CORREO"])).revisions[0];
  await command(q, "partial", { reason: "Falta precisión" });
  assert.equal((await cmd(q, "validate", decision([original.id]))).status, 409);
  await command(q, "validate", {
    ...decision([original.id]),
    coverageExplanation: "Precisión contrastada con el procedimiento",
  });
  assert.equal((await detail(q)).status, "VALIDATED");
});
test("Cambio de cobertura requiere incluir la nueva fuente obligatoria y no permite ampliar historia", async () => {
  const q = of("MULTIPLE_CHOICE"),
    d = await detail(q),
    v = d.validations[0],
    otherSource = d.submissions.find((s) => s.respondent.id === other.user.id);
  await owner.query("BEGIN");
  try {
    await owner.query(
      'UPDATE "Validation" SET "invalidatedAt"=now(),"invalidatedById"=$1,"invalidationReason"=$2 WHERE id=$3',
      [analyst.user.id, "Prueba", v.id],
    );
    await assert.rejects(
      owner.query(
        'INSERT INTO "ValidationSource" (id,"projectId","validationId","responseRevisionId") VALUES ($1,$2,$3,$4)',
        [randomUUID(), project.id, v.id, otherSource.id],
      ),
    );
  } finally {
    await owner.query("ROLLBACK");
  }
  const m = await db.projectMember.findFirst({
    where: { projectId: project.id, userId: other.user.id },
  });
  await ok(path(q) + "/assign", {
    method: "POST",
    body: {
      projectMemberId: m.id,
      required: true,
      active: true,
      expectedVersion: d.lockVersion,
    },
  });
  const after = await detail(q);
  assert.equal(after.status, "ANSWERED");
  assert.ok(after.validations[0].invalidatedAt);
  assert.equal(after.validations[0].sources.length, 1);
  assert.equal(
    (await cmd(q, "validate", decision([of("YES_NO").id]))).status,
    404,
  );
  const inbox = await ok(
    `/review?projectId=${project.id}&sectionId=${d.question.sectionId}&priority=${d.priority}&participantId=${other.user.id}`,
  );
  assert.ok(inbox.items.some((i) => i.questionId === q.id));
});
test("T12: cambio condicional invalida decisión hija y conserva todas sus fuentes", async () => {
  const parent = of("SINGLE_CHOICE"),
    child = of("LONG_TEXT");
  await submit(parent, "DEPENDE");
  const rev = (await submit(child, "Explicación del caso")).revisions[0];
  await command(child, "validate", decision([rev.id]));
  await save(parent, "NUNCA");
  assert.equal((await detail(child)).status, "VALIDATED");
  await submit(parent, "NUNCA");
  const d = await detail(child);
  assert.notEqual(d.status, "VALIDATED");
  assert.notEqual(d.status, "NOT_APPLICABLE");
  assert.ok(d.validations[0].invalidatedAt);
  assert.equal(d.validations[0].sources[0].responseRevisionId, rev.id);
  await submit(parent, "DEPENDE");
  assert.equal((await detail(child)).submissions[0].current, false);
});
test("T22: validaciones concurrentes y envío contra validación nunca dejan una fuente obsoleta vigente", async () => {
  const q = of("SHORT_TEXT");
  let d = await detail(q);
  const rev = d.submissions.find((s) => s.current);
  const make = () => ({
    requestId: randomUUID(),
    expectedVersion: d.lockVersion,
    ...decision([rev.id]),
  });
  const results = await Promise.all([
    req(path(q) + "/review/validate", { method: "POST", body: make() }),
    req(path(q) + "/review/validate", { method: "POST", body: make() }),
  ]);
  assert.deepEqual(results.map((r) => r.status).sort(), [201, 409]);
  await command(q, "reopen", { reason: "Probar nuevo envío simultáneo" });
  await save(q, "Nuevo envío concurrente");
  d = await detail(q);
  const response = await ok(path(q) + "/response", { session: stakeholder });
  const race = await Promise.all([
    req(path(q) + "/review/validate", { method: "POST", body: make() }),
    req(path(q) + "/response/submit", {
      session: stakeholder,
      method: "POST",
      body: { requestId: randomUUID(), expectedVersion: response.lockVersion },
    }),
  ]);
  assert.equal(race[1].status, 201);
  assert.ok([201, 409].includes(race[0].status));
  const final = await detail(q);
  assert.equal(final.status, "ANSWERED");
  assert.ok(final.validations.every((v) => v.invalidatedAt !== null));
});
test("No autocertificación después de cambiar rol; fuente indirecta tampoco elude control", async () => {
  const q = of("SHORT_TEXT"),
    d = await detail(q),
    rev = d.submissions.find(
      (r) => r.current && r.respondent.id === stakeholder.user.id,
    );
  const started = await command(q, "clarifications/request", {
    responseRevisionId: rev.id,
    body: "Confirma el procedimiento",
  });
  let t = (await detail(q)).threads.find((t) => t.id === started.threadId);
  await command(
    q,
    "clarifications/reply",
    {
      threadId: t.id,
      expectedThreadVersion: t.lockVersion,
      body: "Confirmado",
    },
    stakeholder,
  );
  t = (await detail(q)).threads.find((t) => t.id === started.threadId);
  await command(q, "clarifications/close", {
    threadId: started.threadId,
    expectedThreadVersion: t.lockVersion,
    reason: "Confirmado",
  });
  await db.questionAssignment.updateMany({
    where: { projectMemberId: member.id },
    data: { active: false },
  });
  await db.projectMember.update({
    where: { id: member.id },
    data: { role: "ANALYST" },
  });
  assert.equal(
    (await cmd(q, "validate", decision([rev.id]), stakeholder)).status,
    403,
  );
  const ownThread = (await detail(q)).threads.find(
    (t) => t.id === started.threadId,
  );
  const otherRev = (await submit(q, "Aportación ajena", other)).revisions[0];
  assert.equal(
    (
      await cmd(
        q,
        "validate",
        {
          ...decision([otherRev.id]),
          clarificationMessageIds: [ownThread.messages[1].id],
        },
        stakeholder,
      )
    ).status,
    403,
  );
});
