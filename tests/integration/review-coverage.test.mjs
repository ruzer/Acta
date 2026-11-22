import "reflect-metadata";
import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { config } from "dotenv";
import pg from "pg";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { AccessService } from "../../app/backend/dist/administration/access.service.js";
import { AdministrationService } from "../../app/backend/dist/administration/administration.service.js";
import { ResponsesService } from "../../app/backend/dist/responses/responses.service.js";
import { LocalStorage } from "../../app/backend/dist/responses/storage.js";
import { QuestionnaireService } from "../../app/backend/dist/questionnaire/questionnaire.service.js";
import { InvitationsService } from "../../app/backend/dist/invitations/invitations.service.js";
import { InvitationAuthService } from "../../app/backend/dist/auth/invitation-auth.service.js";
import { ReviewService } from "../../app/backend/dist/review/review.service.js";
import {
  coverage,
  questionCoverage,
} from "../../app/backend/dist/review/review-state.js";
import { loadAssignedResponseGraph } from "../../app/backend/dist/responses/response-graph.js";

config({ quiet: true });
const name = "acta_coverage_" + randomBytes(6).toString("hex");
const ownerUrl = new URL(process.env.MIGRATION_DATABASE_URL);
const runtimeUrl = new URL(process.env.DATABASE_URL);
const adminDb = new pg.Client({ connectionString: ownerUrl.href });
let db,
  access,
  responses,
  questionnaire,
  invitations,
  review,
  project,
  participant,
  analyst,
  admin,
  member,
  area,
  questions,
  root;
const queries = [];
const context = (actor) => ({ actor, requestId: randomUUID() });
const of = (type) =>
  questions.find(
    (q) =>
      q.QuestionRevision_questionRecord[0].type === type &&
      q.publication === "PUBLISHED",
  );
const latestQuestion = (q) =>
  db.question.findUniqueOrThrow({ where: { id: q.id } });

// Oráculo anterior al agrupamiento: usa los grafos completos reales, sin mocks.
async function originalCoverage(tx, p) {
  const assignments = await tx.questionAssignment.findMany({
    where: {
      projectId: p,
      active: true,
      member: { active: true, role: "STAKEHOLDER", user: { active: true } },
    },
    include: { member: { include: { user: true, area: true } } },
  });
  const graphs = new Map();
  for (const a of assignments)
    if (!graphs.has(a.member.userId))
      graphs.set(
        a.member.userId,
        await loadAssignedResponseGraph(tx, a.member.user, p, a.member.id),
      );
  return { assignments, graphs };
}

async function compare(label) {
  return db.$transaction(
    async (tx) => {
      const ids = await tx.question.findMany({
        where: { projectId: project.id },
        select: { id: true },
      });
      let start = queries.length;
      const original = await originalCoverage(tx, project.id);
      const originalQueries = queries.length - start;
      start = queries.length;
      const candidate = await coverage(tx, access, project.id);
      const candidateQueries = queries.length - start;
      const values = new Map();
      for (const { id } of ids) {
        const expected = questionCoverage(original, id);
        const actual = questionCoverage(candidate, id);
        assert.deepEqual(actual, expected, `${label}: ${id}`);
        values.set(id, actual);
      }
      assert.deepEqual(candidate.assignments, original.assignments, label);
      return { values, candidate, originalQueries, candidateQueries };
    },
    { isolationLevel: "RepeatableRead", timeout: 15000 },
  );
}

async function save(
  q,
  answer,
  consultationRequested = false,
  actor = participant,
) {
  const v = await responses.get(actor, project.id, q.id);
  const result = await responses.save(context(actor), project.id, q.id, {
    answer,
    consultationRequested,
    comment: "MARCADOR_PRIVADO_BORRADOR",
    example: "EJEMPLO_PRIVADO_BORRADOR",
    expectedVersion: v.lockVersion,
    requestId: randomUUID(),
  });
  await compare("guardar borrador");
  return result;
}
async function submit(q, answer, actor = participant) {
  const saved = await save(q, answer, false, actor);
  const result = await responses.submit(context(actor), project.id, q.id, {
    expectedVersion: saved.lockVersion,
    requestId: randomUUID(),
  });
  await compare("enviar respuesta");
  return result.revisions[0];
}
async function assign(q, target, active, required = false) {
  await questionnaire.assign(context(analyst), project.id, q.id, {
    projectMemberId: target.id,
    active,
    required,
    expectedVersion: (await latestQuestion(q)).lockVersion,
  });
  return compare("cambiar asignación");
}
async function command(method, q, body, actor = analyst) {
  const result = await review[method](context(actor), project.id, q.id, {
    requestId: randomUUID(),
    expectedVersion: (await latestQuestion(q)).lockVersion,
    ...body,
  });
  await compare(method);
  return result;
}
const decision = (ids) => ({
  decisionText: "Decisión ficticia",
  scope: "Prueba de cobertura",
  exceptions: "",
  validationComment: "Fuentes verificadas",
  responseRevisionIds: ids,
  clarificationMessageIds: [],
  conflictResolutionIds: [],
});

before(
  async () => {
    await adminDb.connect();
    await adminDb.query(`CREATE DATABASE "${name}"`);
    ownerUrl.pathname = runtimeUrl.pathname = "/" + name;
    const migrate = spawnSync(
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
    assert.equal(migrate.status, 0, migrate.stdout + migrate.stderr);
    root = await mkdtemp(join(tmpdir(), "acta-coverage-"));
    Object.assign(process.env, {
      DATABASE_URL: runtimeUrl.href,
      APP_ORIGIN: "http://localhost:4333",
      COOKIE_SECURE: "false",
      NODE_ENV: "test",
      ORGANIZATION_CODE: "DEFAULT",
      DEMO_SEED: "true",
      DEMO_PASSWORD: "Test-" + randomBytes(24).toString("base64url"),
      STORAGE_PROVIDER: "LOCAL",
      EVIDENCE_ROOT: root,
    });
    const seed = spawnSync("node", ["app/backend/dist/seed.js"], {
      encoding: "utf8",
      env: process.env,
    });
    assert.equal(seed.status, 0, seed.stdout + seed.stderr);
    db = new PrismaClient({
      adapter: new PrismaPg({ connectionString: runtimeUrl.href }),
      log: [{ emit: "event", level: "query" }],
    });
    db.$on("query", (event) => queries.push(event.query));
    access = new AccessService(db);
    responses = new ResponsesService(db, access, new LocalStorage());
    questionnaire = new QuestionnaireService(
      db,
      access,
      new AdministrationService(db, access, responses),
      responses,
    );
    invitations = new InvitationsService(db, access);
    review = new ReviewService(db, access);
    participant = await db.user.findFirstOrThrow({
      where: { username: "stakeholder" },
    });
    analyst = await db.user.findFirstOrThrow({
      where: { username: "analyst" },
    });
    admin = await db.user.findFirstOrThrow({ where: { username: "admin" } });
    project = await db.project.findFirstOrThrow({
      where: { externalId: "DEMO-PRINCIPAL" },
    });
    member = await db.projectMember.findFirstOrThrow({
      where: { projectId: project.id, userId: participant.id },
    });
    area = await db.area.findUniqueOrThrow({ where: { id: member.areaId } });
    questions = await db.question.findMany({
      where: { projectId: project.id },
      include: {
        QuestionRevision_questionRecord: {
          orderBy: { number: "desc" },
          take: 1,
        },
      },
    });
  },
  { timeout: 120000 },
);
after(async () => {
  await db?.$disconnect();
  await adminDb.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
  await adminDb.end();
  if (root) await rm(root, { recursive: true, force: true });
});

test("cobertura agrupada equivale al grafo completo y conserva consulta sin cargar borradores privados", async () => {
  const q = of("SHORT_TEXT");
  const initial = await compare("sin respuestas");
  assert.equal(initial.values.get(q.id).missing, 1);
  assert.equal(initial.values.get(q.id).consult, false);
  await save(q, "RESPUESTA_PRIVADA_BORRADOR", true);
  const consulted = await compare("consulta solicitada");
  assert.equal(consulted.values.get(q.id).consult, true);
  assert.equal((await latestQuestion(q)).status, "PENDING");
  const graph = consulted.candidate.graphs.get(participant.id);
  assert.deepEqual(graph.response(q.id).ResponseDraft_response, {
    consultationRequested: true,
  });
  assert.doesNotMatch(JSON.stringify(graph.responses), /PRIVAD[OA]_BORRADOR/);
  await save(q, "RESPUESTA_PRIVADA_BORRADOR", false);
  assert.equal((await latestQuestion(q)).status, "NOT_REVIEWED");
});

test("condiciones usan el último envío y descartan revisiones con contexto obsoleto", async () => {
  const parent = of("SINGLE_CHOICE"),
    child = of("LONG_TEXT");
  assert.equal(
    (await compare("sin padre")).values.get(child.id).participants[0]
      .applicability,
    "UNDETERMINED",
  );
  await submit(parent, "DEPENDE");
  const childRevision = await submit(child, "Respuesta condicional ficticia");
  await command("validate", child, decision([childRevision.id]));
  await save(parent, "NUNCA", true);
  assert.equal((await latestQuestion(child)).status, "VALIDATED");
  await submit(parent, "NUNCA");
  const disabled = (await compare("padre no cumple")).values.get(child.id);
  assert.equal(disabled.participants[0].applicability, "DISABLED");
  assert.equal(disabled.currentIds.size, 0);
  assert.ok(
    (await db.validation.findFirstOrThrow({ where: { questionId: child.id } }))
      .invalidatedAt,
  );
  await submit(parent, "DEPENDE");
  const obsolete = (await compare("contexto de hija anterior")).values.get(
    child.id,
  );
  assert.equal(obsolete.participants[0].applicability, "ENABLED");
  assert.equal(obsolete.currentIds.size, 0);
  assert.equal(obsolete.missing, 1);
  await submit(child, "Respuesta con contexto vigente");
});

test("varias personas, asignaciones, cuentas y miembros inactivos conservan cobertura exacta", async () => {
  const q = of("YES_NO");
  const other = await db.user.create({
    data: {
      organizationId: admin.organizationId,
      username: "coverage-other",
      displayName: "Otra persona ficticia",
      mustChangePassword: false,
    },
  });
  const otherMember = await db.projectMember.create({
    data: {
      projectId: project.id,
      userId: other.id,
      role: "STAKEHOLDER",
      areaId: area.id,
    },
  });
  const parent = of("SINGLE_CHOICE"),
    child = of("LONG_TEXT");
  await assign(parent, otherMember, true);
  await assign(child, otherMember, true);
  await submit(parent, "NUNCA", other);
  const conditional = (
    await compare("condición independiente por persona")
  ).values.get(child.id);
  assert.equal(
    conditional.participants.find((p) => p.person.id === participant.id)
      .applicability,
    "ENABLED",
  );
  assert.equal(
    conditional.participants.find((p) => p.person.id === other.id)
      .applicability,
    "DISABLED",
  );
  await assign(q, otherMember, true, true);
  assert.equal((await compare("dos requeridos")).values.get(q.id).missing, 2);
  const a = await submit(q, true),
    b = await submit(q, false, other);
  await command("conflict", q, {
    reason: "Versiones distintas",
    responseRevisionIds: [a.id, b.id],
  });
  const conflict = await db.conflict.findFirstOrThrow({
    where: { questionId: q.id, status: "OPEN" },
  });
  await command("resolve", q, {
    conflictId: conflict.id,
    expectedConflictVersion: conflict.lockVersion,
    resolutionText: "Resolución ficticia",
    responseRevisionIds: [a.id, b.id],
  });
  await command("validate", q, decision([a.id, b.id]));
  await assign(q, otherMember, false);
  assert.equal(
    (await compare("asignación retirada")).values.get(q.id).currentIds.size,
    1,
  );
  await assign(q, otherMember, true);
  await db.user.update({ where: { id: other.id }, data: { active: false } });
  assert.equal(
    (await compare("cuenta inactiva")).values.get(q.id).participants.length,
    1,
  );
  await db.user.update({ where: { id: other.id }, data: { active: true } });
  await db.projectMember.update({
    where: { id: otherMember.id },
    data: { active: false },
  });
  assert.equal(
    (await compare("miembro inactivo")).values.get(q.id).participants.length,
    1,
  );
  await db.projectMember.update({
    where: { id: otherMember.id },
    data: { active: true },
  });
  assert.equal(
    (await compare("miembro reactivado")).values.get(q.id).participants.length,
    2,
  );
});

test("aclaraciones, no aplica y preguntas archivadas mantienen la proyección completa", async () => {
  const q = of("SHORT_TEXT");
  const revision = await submit(q, "Respuesta pública ficticia");
  const requested = await command("request", q, {
    responseRevisionId: revision.id,
    body: "Aclara el alcance",
  });
  let thread = await db.clarificationThread.findUniqueOrThrow({
    where: { id: requested.threadId },
  });
  await command(
    "reply",
    q,
    {
      threadId: thread.id,
      expectedThreadVersion: thread.lockVersion,
      body: "Alcance ficticio",
    },
    participant,
  );
  thread = await db.clarificationThread.findUniqueOrThrow({
    where: { id: thread.id },
  });
  await command("close", q, {
    threadId: thread.id,
    expectedThreadVersion: thread.lockVersion,
    reason: "Aclarado",
  });
  await command("validate", q, decision([revision.id]));
  const date = of("DATE");
  await command("notApplicable", date, {
    reason: "Fuera del caso",
    scope: "Prueba",
  });
  await command("reopen", date, { reason: "Se incorpora al caso" });
  await questionnaire.archive(
    context(analyst),
    project.id,
    date.id,
    (await latestQuestion(date)).lockVersion,
  );
  const archived = (await compare("pregunta archivada")).values.get(date.id);
  assert.equal(archived.participants[0].applicability, "DISABLED");
  assert.equal(archived.missing, 0);
  assert.equal(archived.currentIds.size, 0);
});

test("invitaciones selladas mantienen envíos y consultas tras vencer o revocarse", async () => {
  const q = of("SHORT_TEXT");
  const link = await invitations.create(context(analyst), project.id, {
    requestId: randomUUID(),
    label: "Invitación ficticia",
    questionIds: [q.id],
    areaId: area.id,
    identity: { name: "Persona invitada ficticia" },
    nonNominal: false,
    allowEvidence: false,
  });
  const invitation = await db.responseInvitation.findUniqueOrThrow({
    where: { id: link.invitation.id },
  });
  assert.equal(invitation.scopeSealed, true);
  const { actor } = await new InvitationAuthService(db).exchange(
    new URL(link.url).hash.slice(1),
    randomUUID(),
  );
  const revision = await submit(q, "Envío invitado ficticio", actor);
  await save(q, "BORRADOR_PRIVADO_INVITADO", true, actor);
  const before = (await compare("invitación vigente")).values.get(q.id);
  assert.ok(before.currentIds.has(revision.id));
  assert.equal(before.consult, true);
  const graph = (await compare("alcance sellado")).candidate.graphs.get(
    actor.id,
  );
  assert.deepEqual(
    graph.questions.map((v) => v.id),
    [q.id],
  );
  await db.responseInvitation.update({
    where: { id: invitation.id },
    data: { expiresAt: new Date(Date.now() + 20) },
  });
  await new Promise((resolve) => setTimeout(resolve, 40));
  assert.deepEqual(
    (await compare("invitación vencida")).values.get(q.id),
    before,
  );
  await invitations.revoke(
    context(analyst),
    project.id,
    invitation.id,
    invitation.lockVersion,
  );
  assert.deepEqual(
    (await compare("invitación revocada")).values.get(q.id),
    before,
  );
});

test("la revisión enviada de una versión anterior no cuenta como vigente", async () => {
  const revisionIds = [randomUUID(), randomUUID()];
  const q = await db.$transaction(async (tx) => {
    const created = await tx.question.create({
      data: {
        projectId: project.id,
        sectionId: questions[0].sectionId,
        externalId: "COVERAGE-VERSION",
        responsibleAreaId: area.id,
        priority: "P1",
        order: 100,
        currentRevisionNumber: 2,
      },
    });
    await tx.questionRevision.createMany({
      data: revisionIds.map((id, i) => ({
        id,
        projectId: project.id,
        questionId: created.id,
        number: i + 1,
        title: "Versión de prueba",
        question: "Pregunta de prueba",
        type: "SHORT_TEXT",
        required: true,
        snapshot: {},
        createdById: analyst.id,
      })),
    });
    await tx.questionAssignment.create({
      data: {
        projectId: project.id,
        questionId: created.id,
        projectMemberId: member.id,
      },
    });
    await tx.question.update({
      where: { id: created.id },
      data: {
        publication: "PUBLISHED",
        publishedRevisionNumber: 2,
      },
    });
    const response = await tx.response.create({
      data: {
        projectId: project.id,
        questionId: created.id,
        respondentId: participant.id,
      },
    });
    await tx.responseRevision.create({
      data: {
        projectId: project.id,
        responseId: response.id,
        questionRevisionId: revisionIds[0],
        number: 1,
        answer: "Versión anterior",
        areaId: area.id,
        respondentSnapshot: {},
        areaSnapshot: {},
        conditionContext: {},
      },
    });
    return created;
  });
  const obsolete = (await compare("versión de pregunta obsoleta")).values.get(
    q.id,
  );
  assert.equal(obsolete.currentIds.size, 0);
  assert.equal(obsolete.missing, 1);
  const current = await submit(q, "Versión vigente");
  assert.deepEqual(
    (await compare("última versión de pregunta")).values.get(q.id).currentIds,
    new Set([current.id]),
  );
});

test("ambos cargadores rechazan una invitación sin alcance sellado", async () => {
  await assert.rejects(
    db.$transaction(async (tx) => {
      const actor = await tx.user.create({
        data: {
          organizationId: admin.organizationId,
          username: "coverage-unsealed",
          displayName: "Invitación incompleta ficticia",
          invitationOnly: true,
          mustChangePassword: false,
        },
      });
      const invitation = await tx.responseInvitation.create({
        data: {
          organizationId: admin.organizationId,
          projectId: project.id,
          respondentId: actor.id,
          createdById: analyst.id,
          requestId: randomUUID(),
          label: "Alcance sin sellar",
          recipientName: "Persona ficticia",
          areaId: area.id,
          tokenHash: randomBytes(32).toString("hex"),
          expiresAt: new Date(Date.now() + 60000),
        },
      });
      const q = of("SHORT_TEXT");
      await tx.invitationQuestion.create({
        data: {
          projectId: project.id,
          invitationId: invitation.id,
          questionId: q.id,
        },
      });
      const m = await tx.projectMember.create({
        data: {
          projectId: project.id,
          userId: actor.id,
          role: "STAKEHOLDER",
          areaId: area.id,
        },
      });
      await tx.questionAssignment.create({
        data: {
          projectId: project.id,
          projectMemberId: m.id,
          questionId: q.id,
        },
      });
      await assert.rejects(
        originalCoverage(tx, project.id),
        /Missing invitation scope/,
      );
      await assert.rejects(
        coverage(tx, access, project.id),
        /Missing invitation scope/,
      );
      throw new Error("ROLLBACK_UNSEALED_FIXTURE");
    }),
    /ROLLBACK_UNSEALED_FIXTURE/,
  );
});

test("el número de consultas de cobertura no crece por participante", async (t) => {
  const small = await compare("antes de agregar participantes");
  const q = of("NUMBER");
  const users = Array.from({ length: 48 }, (_, i) => ({
    id: randomUUID(),
    organizationId: admin.organizationId,
    username: `coverage-batch-${i}`,
    displayName: `Persona ficticia ${i}`,
  }));
  await db.user.createMany({ data: users });
  const members = users.map((u) => ({
    id: randomUUID(),
    projectId: project.id,
    userId: u.id,
    role: "STAKEHOLDER",
    areaId: area.id,
  }));
  await db.projectMember.createMany({ data: members });
  await db.questionAssignment.createMany({
    data: members.map((m) => ({
      projectId: project.id,
      projectMemberId: m.id,
      questionId: q.id,
      active: true,
      required: false,
    })),
  });
  const large = await compare("51 participantes");
  assert.equal(large.values.get(q.id).participants.length, 49);
  assert.ok(large.originalQueries > small.originalQueries);
  assert.equal(large.candidateQueries, small.candidateQueries);
  assert.ok(large.candidateQueries < large.originalQueries);
  t.diagnostic(
    JSON.stringify({
      originalBefore: small.originalQueries,
      groupedBefore: small.candidateQueries,
      originalAfter: large.originalQueries,
      groupedAfter: large.candidateQueries,
    }),
  );
});
