import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import { config } from "dotenv";
import pg from "pg";
config({ quiet: true });
const name = "requirements_test_" + randomBytes(6).toString("hex");
const ownerUrl = new URL(process.env.MIGRATION_DATABASE_URL);
const appUrl = new URL(process.env.DATABASE_URL);
const adminDb = new pg.Client({ connectionString: ownerUrl.href });
let app, db, createApp;
const port = 4328;
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
function editable(q) {
  const {
    id: _id,
    publication: _publication,
    status: _status,
    lockVersion: _lockVersion,
    revisionNumber: _revisionNumber,
    assignments: _assignments,
    ...d
  } = q;
  return { ...d, expectedVersion: q.lockVersion };
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
test("PostgreSQL real: migración desde base vacía, seed idempotente y ocho tipos", async () => {
  assert.equal(await db.question.count(), 9);
  assert.equal(
    new Set((await db.questionRevision.findMany()).map((q) => q.type)).size,
    8,
  );
  const seeded = spawnSync("node", ["app/backend/dist/seed.js"], {
    encoding: "utf8",
    env: process.env,
  });
  assert.equal(seeded.status, 0, seeded.stderr);
  assert.equal(await db.question.count(), 9);
});
test("cookies HttpOnly/SameSite, sesión sin token plano y CSRF/origin obligatorios", async () => {
  assert.match(admin.header, /HttpOnly/);
  assert.match(admin.header, /SameSite=Lax/i);
  assert.ok((await db.session.findFirst()).tokenHash.length === 64);
  assert.equal(
    (
      await request("/projects", {
        session: admin,
        method: "POST",
        body: {},
        headers: { "X-CSRF-Token": "" },
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await request("/projects", {
        session: admin,
        method: "POST",
        body: {},
        headers: { Origin: "https://evil.invalid" },
      })
    ).status,
    403,
  );
});
test("aislamiento entre organizaciones, membresía y roles", async () => {
  assert.equal(
    (
      await request(`/projects/${project.id}/participant`, {
        session: otherOrg,
      })
    ).status,
    401,
  );
  for (const s of [outsider])
    assert.equal(
      (await request(`/projects/${project.id}/participant`, { session: s }))
        .status,
      404,
    );
  assert.equal(
    (
      await request(`/projects/${foreignProject.id}/questionnaire`, {
        session: admin,
      })
    ).status,
    404,
  );
  for (const s of [viewer, stakeholder])
    assert.equal(
      (
        await request(`/projects/${project.id}/questions`, {
          session: s,
          method: "POST",
          body: input("NO-ROLE"),
        })
      ).status,
      403,
    );
  assert.equal((await request("/users", { session: analyst })).status, 403);
});
test("aislamiento por proyecto en IDs de sección, pregunta, asignación y referencias", async () => {
  const q = await question("ISOLATED");
  assert.equal(
    (
      await request(`/projects/${second.id}/questions/${q.id}/publish`, {
        session: admin,
        method: "POST",
        body: { expectedVersion: q.lockVersion },
      })
    ).status,
    404,
  );
  assert.equal(
    (
      await request(`/projects/${second.id}/questions`, {
        session: admin,
        method: "POST",
        body: input("CROSS-SECTION"),
      })
    ).status,
    404,
  );
  assert.equal(
    (
      await request(`/projects/${project.id}/questions/${q.id}/assign`, {
        session: admin,
        method: "POST",
        body: {
          projectMemberId: foreignMember.id,
          required: true,
          active: true,
          expectedVersion: q.lockVersion,
        },
      })
    ).status,
    400,
  );
  const ref = await ok(`/projects/${second.id}/references`, {
    type: "OTHER",
    externalId: "EXTERNAL-REF",
    label: "Otra referencia",
    description: "",
    url: null,
    priority: null,
  });
  assert.equal(
    (
      await request(`/projects/${project.id}/questions`, {
        session: admin,
        method: "POST",
        body: input("CROSS-REF", {
          references: [{ referenceId: ref.id, scopeNote: "" }],
        }),
      })
    ).status,
    400,
  );
});
test("externalId conserva FORM-14 y FORM-014 como valores distintos en datos de prueba", async () => {
  const a = await question("FORM-14"),
    b = await question("FORM-014");
  assert.notEqual(a.id, b.id);
  assert.equal(a.externalId, "FORM-14");
  assert.equal(b.externalId, "FORM-014");
});
test("editar borrador de pregunta crea historia; publicación congela significado en API y DB", async () => {
  let q = await question("IMMUTABLE");
  q = await ok(
    `/projects/${project.id}/questions/${q.id}/draft`,
    { ...editable(q), title: "Título revisado" },
    analyst,
    "PUT",
  );
  assert.equal(q.revisionNumber, 2);
  q = await ok(`/projects/${project.id}/questions/${q.id}/publish`, {
    expectedVersion: q.lockVersion,
  });
  assert.equal(
    (
      await request(`/projects/${project.id}/questions/${q.id}/draft`, {
        session: admin,
        method: "PUT",
        body: { ...editable(q), title: "Cambio prohibido" },
      })
    ).status,
    409,
  );
  await assert.rejects(
    db.questionRevision.updateMany({
      where: { questionId: q.id },
      data: { title: "Cambio SQL" },
    }),
  );
  await assert.rejects(
    db.question.update({ where: { id: q.id }, data: { publication: "DRAFT" } }),
  );
  assert.equal(
    (
      await db.questionRevision.findFirst({
        where: { questionId: q.id, number: 2 },
      })
    ).title,
    "Título revisado",
  );
});
test("concurrencia rechaza edición obsoleta sin perder contenido", async () => {
  const q = await question("CONCURRENT");
  const results = await Promise.all(
    ["Uno", "Dos"].map((title) =>
      request(`/projects/${project.id}/questions/${q.id}/draft`, {
        session: admin,
        method: "PUT",
        body: { ...editable(q), title },
      }),
    ),
  );
  assert.deepEqual(results.map((r) => r.status).sort(), [200, 409]);
  assert.equal(
    await db.questionRevision.count({ where: { questionId: q.id } }),
    2,
  );
});
test("rechaza ciclos de condición y no deja revisión parcial", async () => {
  const a = await question("CYCLE-A");
  const b = await question("CYCLE-B", {
    condition: { parentQuestionId: a.id, operator: "EQUALS", value: true },
  });
  const r = await request(`/projects/${project.id}/questions/${a.id}/draft`, {
    session: admin,
    method: "PUT",
    body: {
      ...editable(a),
      condition: { parentQuestionId: b.id, operator: "EQUALS", value: true },
    },
  });
  assert.equal(r.status, 400);
  assert.equal(
    await db.questionRevision.count({ where: { questionId: a.id } }),
    1,
  );
  await assert.rejects(
    db.questionCondition.create({
      data: {
        projectId: project.id,
        parentQuestionId: b.id,
        childQuestionId: a.id,
        operator: "EQUALS",
        value: true,
      },
    }),
  );
});
test("trazabilidad no valida referencias y mass assignment es rechazado", async () => {
  const ref = await ok(`/projects/${project.id}/references`, {
    type: "REQUIREMENT",
    externalId: "REQ-TEST-1",
    label: "Pendiente",
    url: null,
    priority: "P0",
    description: "",
  });
  const q = await question("LINKED", {
    references: [{ referenceId: ref.id, scopeNote: "Por confirmar" }],
  });
  assert.equal(q.status, "NOT_REVIEWED");
  assert.equal(await db.validation.count(), 0);
  assert.equal(
    Object.hasOwn(
      await db.traceabilityReference.findUnique({ where: { id: ref.id } }),
      "status",
    ),
    false,
  );
  assert.equal(
    (
      await request(`/projects/${project.id}/questions`, {
        session: admin,
        method: "POST",
        body: { ...input("MASS"), status: "VALIDATED" },
      })
    ).status,
    400,
  );
});
test("stakeholder solo recibe asignadas publicadas y DTO no expone IDs técnicos", async () => {
  let q = await question("PRIVATE-DRAFT");
  let view = await ok(
    `/projects/${project.id}/participant`,
    undefined,
    stakeholder,
    "GET",
  );
  assert.equal(view.sections.length, 0);
  q = await ok(`/projects/${project.id}/questions/${q.id}/assign`, {
    projectMemberId: member.id,
    active: true,
    required: true,
    expectedVersion: q.lockVersion,
  });
  view = await ok(
    `/projects/${project.id}/participant`,
    undefined,
    stakeholder,
    "GET",
  );
  assert.equal(view.sections.length, 0);
  await ok(`/projects/${project.id}/questions/${q.id}/publish`, {
    expectedVersion: q.lockVersion,
  });
  view = await ok(
    `/projects/${project.id}/participant`,
    undefined,
    stakeholder,
    "GET",
  );
  assert.equal(view.sections[0].questions.length, 1);
  assert.doesNotMatch(
    JSON.stringify(view),
    /PRIVATE-DRAFT|referenceId|revisionNumber|NOT_REVIEWED|[0-9a-f]{8}-[0-9a-f]{4}-/,
  );
});
test("contraseña temporal limita acceso y cambiarla revoca sesiones anteriores", async () => {
  const user = await ok("/users", {
    username: "temporary",
    displayName: "Cuenta temporal ficticia",
    temporaryPassword: password,
    isOrganizationAdmin: false,
  });
  const s = await login("temporary");
  assert.equal((await request("/projects", { session: s })).status, 403);
  assert.equal((await request("/auth/me", { session: s })).status, 200);
  await ok(
    "/auth/change-password",
    { currentPassword: password, newPassword: password + "-changed" },
    s,
  );
  assert.equal((await request("/auth/me", { session: s })).status, 401);
  const fresh = await login("temporary", password + "-changed");
  assert.equal(fresh.user.mustChangePassword, false);
  assert.equal(
    (await db.user.findUnique({ where: { id: user.id } })).mustChangePassword,
    false,
  );
});
test("desactivar usuario revoca sesión y evita login; logout revocable", async () => {
  const user = await ok("/users", {
    username: "deactivated",
    displayName: "Cuenta a desactivar",
    temporaryPassword: password,
    isOrganizationAdmin: false,
  });
  const s = await login("deactivated");
  await ok(`/users/${user.id}/set-active`, { active: false });
  assert.equal((await request("/auth/me", { session: s })).status, 401);
  assert.equal(
    (
      await request("/auth/login", {
        method: "POST",
        body: { username: "deactivated", password },
      })
    ).status,
    401,
  );
  const v = await login("viewer");
  await ok("/auth/logout", {}, v);
  assert.equal((await request("/auth/me", { session: v })).status, 401);
});
test("archivado conserva revisión y auditoría es inmutable y sin secretos", async () => {
  let q = await question("ARCHIVE");
  q = await ok(`/projects/${project.id}/questions/${q.id}/archive`, {
    expectedVersion: q.lockVersion,
  });
  assert.equal(q.publication, "ARCHIVED");
  assert.equal(
    await db.questionRevision.count({ where: { questionId: q.id } }),
    1,
  );
  const logs = await db.auditEvent.findMany();
  assert.ok(logs.some((x) => x.action === "QUESTION_PUBLISHED"));
  assert.doesNotMatch(JSON.stringify(logs), new RegExp(password));
  await assert.rejects(db.auditEvent.deleteMany());
});
test("scope SQL impide referencias entre organizaciones y el runtime no modifica esquema", async () => {
  await assert.rejects(
    db.projectMember.create({
      data: {
        projectId: foreignProject.id,
        userId: admin.user.id,
        role: "ADMIN",
      },
    }),
  );
  await assert.rejects(
    db.$executeRawUnsafe("CREATE TABLE forbidden_test (id integer)"),
  );
});
test("Separación de capacidades: editar cuestionarios no crea respuestas ni decisiones; rutas GET no declaradas rechazadas", async () => {
  for (const path of [
    "responses",
    "evidence",
    "validations",
    "imports",
    "exports",
  ])
    assert.equal(
      (await request(`/projects/${project.id}/${path}`, { session: admin }))
        .status,
      404,
    );
  for (const model of [
    "response",
    "responseDraft",
    "responseRevision",
    "evidence",
    "validation",
    "clarificationThread",
  ])
    assert.equal(await db[model].count(), 0);
});
test("login institucional: contrato público sin códigos y credenciales sin contexto del navegador", async () => {
  const context = await request("/auth/context");
  assert.equal(context.status, 200);
  assert.deepEqual(context.data, {
    mode: "single-organization",
    institutionName: "Example organization",
  });
  const session = await login("stakeholder");
  assert.equal(
    (await request("/auth/me", { session })).data.organization.id,
    org.id,
  );
});
test("login rechaza selección de institución por payload, incluso un campo oculto", async () => {
  for (const field of ["organization", "organizationId", "organizationCode"]) {
    const result = await request("/auth/login", {
      method: "POST",
      body: { username: "admin", password, [field]: "OTHER-DEMO" },
    });
    assert.equal(result.status, 400);
    assert.equal(result.cookie, null);
  }
});
test("mismo username de otra institución no autentica contra la institución configurada ni permite enumerar cuentas", async () => {
  const other = await db.organization.findUniqueOrThrow({
    where: { code: "OTHER-DEMO" },
  });
  const { hashPassword } =
    await import("../../app/backend/dist/auth/auth.service.js");
  const foreignPassword = password + "-other-institution";
  await db.user.create({
    data: {
      organizationId: other.id,
      username: "stakeholder",
      displayName: "Cuenta ficticia homónima",
      passwordHash: await hashPassword(foreignPassword),
      mustChangePassword: false,
    },
  });
  const messages = [];
  for (const [username, pass] of [
    ["stakeholder", foreignPassword],
    ["unknown-person", password],
    ["stakeholder", "incorrect"],
  ]) {
    const result = await request("/auth/login", {
      method: "POST",
      body: { username, password: pass },
    });
    assert.equal(result.status, 401);
    assert.equal(result.cookie, null);
    messages.push(result.data.message);
  }
  assert.equal(new Set(messages).size, 1);
  await login("stakeholder");
});
test("institución configurada inexistente falla sin fallback ni exposición de códigos", async () => {
  process.env.ORGANIZATION_CODE = "DOES-NOT-EXIST";
  try {
    const seed = spawnSync("node", ["app/backend/dist/seed.js"], {
      encoding: "utf8",
      env: process.env,
    });
    assert.notEqual(seed.status, 0);
    assert.equal(
      await db.organization.count({ where: { code: "DOES-NOT-EXIST" } }),
      0,
    );
    const result = await request("/auth/login", {
      method: "POST",
      body: { username: "stakeholder", password },
    });
    assert.equal(result.status, 401);
    assert.equal(
      result.data.message,
      "No fue posible iniciar sesión con esos datos.",
    );
    assert.equal(result.cookie, null);
    const context = await request("/auth/context");
    assert.equal(context.status, 503);
    assert.ok(!JSON.stringify(context.data).includes("DOES-NOT-EXIST"));
    assert.equal(
      (await request("/auth/me", { session: stakeholder })).status,
      401,
    );
  } finally {
    process.env.ORGANIZATION_CODE = "DEFAULT";
  }
});
test("contexto institucional y login sobreviven a reinicio real de API", async () => {
  const before = await login("stakeholder");
  await app.close();
  app = await createApp();
  const after = await login("stakeholder");
  assert.equal(after.user.id, before.user.id);
  assert.equal((await request("/auth/me", { session: before })).status, 200);
  assert.equal(
    (await request("/auth/context")).data.institutionName,
    "Example organization",
  );
});
test("transición FGEO-DEMO a FGEO conserva identidad y rechaza fusión ambigua", async () => {
  const { readFile } = await import("node:fs/promises");
  const migration = await readFile(
    "app/backend/prisma/migrations/202609280006_single_organization_login/migration.sql",
    "utf8",
  );
  const owner = new pg.Client({ connectionString: ownerUrl.href });
  await owner.connect();
  try {
    await owner.query("BEGIN");
    await owner.query(
      `UPDATE "Organization" SET code='FGEO-DEMO' WHERE id=$1`,
      [org.id],
    );
    await owner.query(migration);
    const preserved = await owner.query(
      `SELECT id,code FROM "Organization" WHERE id=$1`,
      [org.id],
    );
    assert.deepEqual(preserved.rows, [{ id: org.id, code: "FGEO" }]);
    assert.equal(
      (
        await owner.query(`SELECT "organizationId" FROM "User" WHERE id=$1`, [
          stakeholder.user.id,
        ])
      ).rows[0].organizationId,
      org.id,
    );
    await owner.query("ROLLBACK");
    await owner.query("BEGIN");
    await owner.query(
      `UPDATE "Organization" SET code='FGEO-DEMO' WHERE id=$1`,
      [org.id],
    );
    await owner.query(
      `INSERT INTO "Organization" (id,code,name,"createdAt","updatedAt") VALUES (gen_random_uuid(),'FGEO','Colisión ficticia',now(),now())`,
    );
    await assert.rejects(
      owner.query(migration),
      /Institution context conflict/,
    );
  } finally {
    await owner.query("ROLLBACK");
    await owner.end();
  }
});
test("login limita intentos persistentes sin distinguir cuentas existentes", async () => {
  await db.loginAttempt.deleteMany();
  for (let i = 0; i < 10; i++) {
    const r = await request("/auth/login", {
      method: "POST",
      body: { username: "missing", password: "bad" },
    });
    assert.equal(r.status, 401);
  }
  assert.equal(
    (
      await request("/auth/login", {
        method: "POST",
        body: { username: "missing", password: "bad" },
      })
    ).status,
    429,
  );
});

test("retirar asignación de usuario desactivado permite cerrar su membresía", async () => {
  const u = await ok("/users", {
    username: "assignmentoff",
    displayName: "Participante ficticio inactivo",
    temporaryPassword: password,
    isOrganizationAdmin: false,
  });
  const m = await ok(`/projects/${project.id}/members`, {
    userId: u.id,
    role: "STAKEHOLDER",
    areaId: area.id,
    active: true,
  });
  let q = await question("DEACTIVATE-ASSIGNMENT");
  q = await ok(`/projects/${project.id}/questions/${q.id}/assign`, {
    projectMemberId: m.id,
    active: true,
    required: true,
    expectedVersion: q.lockVersion,
  });
  await ok(`/users/${u.id}/set-active`, { active: false });
  q = await ok(`/projects/${project.id}/questions/${q.id}/assign`, {
    projectMemberId: m.id,
    active: false,
    required: true,
    expectedVersion: q.lockVersion,
  });
  assert.equal(q.assignments[0].active, false);
  const closed = await ok(`/projects/${project.id}/members`, {
    userId: u.id,
    role: "STAKEHOLDER",
    areaId: area.id,
    active: false,
  });
  assert.equal(closed.active, false);
});

test("fallo de auditoría revierte pregunta y revisión en la misma transacción", async () => {
  const owner = new pg.Client({ connectionString: ownerUrl.href });
  await owner.connect();
  const count = await db.question.count();
  try {
    await owner.query('REVOKE INSERT ON "AuditEvent" FROM requirements_app');
    const r = await request(`/projects/${project.id}/questions`, {
      session: admin,
      method: "POST",
      body: input("ROLLBACK-AUDIT"),
    });
    assert.equal(r.status, 500);
    assert.equal(await db.question.count(), count);
    assert.equal(
      await db.question.count({ where: { externalId: "ROLLBACK-AUDIT" } }),
      0,
    );
  } finally {
    await owner.query('GRANT INSERT ON "AuditEvent" TO requirements_app');
    await owner.end();
  }
});

test("JSON inválido y cuerpo excesivo devuelven errores seguros y específicos", async () => {
  const malformed = await request("/projects", {
    session: admin,
    method: "POST",
    body: "{notjson",
  });
  assert.equal(malformed.status, 400);
  const large = await request("/projects", {
    session: admin,
    method: "POST",
    body: JSON.stringify({ name: "x".repeat(300000) }),
  });
  assert.equal(large.status, 413);
  assert.equal(large.data.code, "PAYLOAD_TOO_LARGE");
});

// Editor extension: real PostgreSQL, all commands pass through HTTP/CSRF/authorization.
async function editorFixture() {
  const p = await ok("/projects", {
    externalId: "EDITOR-" + randomBytes(8).toString("hex"),
    name: "Editor transaccional ficticio",
    description: "",
  });
  for (const [session, role] of [
    [analyst, "ANALYST"],
    [stakeholder, "STAKEHOLDER"],
    [viewer, "VIEWER"],
  ])
    await ok(`/projects/${p.id}/members`, {
      userId: session.user.id,
      role,
      areaId: area.id,
      active: true,
    });
  const sections = [];
  for (let i = 0; i < 3; i++)
    sections.push(
      await ok(`/projects/${p.id}/sections`, {
        externalId: "TOPIC-" + i,
        title: "Tema " + i,
        description: "Descripción original",
        order: i,
      }),
    );
  const questions = [];
  for (let i = 0; i < 4; i++)
    questions.push(
      await ok(
        `/projects/${p.id}/questions`,
        input("FORM-" + (i === 0 ? "14" : i === 1 ? "014" : i), {
          sectionId: sections[i === 3 ? 1 : 0].id,
          order: i,
        }),
      ),
    );
  return { p, sections, questions };
}
async function editorSnapshot(p) {
  return ok(`/projects/${p.id}/questionnaire`, undefined, admin, "GET");
}
function sectionOrder(d) {
  return {
    expectedVersion: d.structureVersion,
    expected: d.sections.map(({ id, order }) => ({ id, order })),
    orderedIds: d.sections.map((s) => s.id).reverse(),
  };
}
function questionOrderCommand(d, sectionIds) {
  return {
    expectedVersion: d.structureVersion,
    sections: sectionIds.map((sectionId) => {
      const qs = d.questions
        .filter((q) => q.sectionId === sectionId)
        .sort((a, b) => a.order - b.order);
      return {
        sectionId,
        expected: qs.map(({ id, order, lockVersion }) => ({
          id,
          order,
          lockVersion,
        })),
        orderedIds: qs
          .filter((q) => q.publication !== "ARCHIVED")
          .map((q) => q.id)
          .reverse(),
      };
    }),
  };
}
async function assertRejected(
  path,
  body,
  status,
  session = admin,
  method = "POST",
) {
  const organization = process.env.ORGANIZATION_CODE;
  if (session === otherOrg) process.env.ORGANIZATION_CODE = "OTHER-DEMO";
  try {
    const r = await request(path, { session, method, body });
    assert.equal(r.status, status, JSON.stringify(r.data));
    return r;
  } finally {
    process.env.ORGANIZATION_CODE = organization;
  }
}
test("editor: editar nombre/descripción preserva identidad y audita; detecta edición concurrente", async () => {
  const { p, sections } = await editorFixture(),
    s = sections[0],
    before = await editorSnapshot(p);
  const body = {
    title: "Nombre actualizado",
    description: "Nueva descripción",
    expectedVersion: before.structureVersion,
  };
  const result = await ok(
    `/projects/${p.id}/sections/${s.id}/draft`,
    body,
    analyst,
    "PUT",
  );
  assert.equal(result.title, body.title);
  assert.equal(result.description, body.description);
  assert.equal(result.externalId, s.externalId);
  assert.equal(result.order, s.order);
  await assertRejected(
    `/projects/${p.id}/sections/${s.id}/draft`,
    body,
    409,
    analyst,
    "PUT",
  );
  const event = await db.auditEvent.findFirst({
    where: { projectId: p.id, action: "SECTION_UPDATED" },
  });
  assert.equal(event.actorId, analyst.user.id);
  assert.equal(event.objectId, s.id);
});
test("editor: tema rechaza campos inválidos, mass assignment, IDs ajenos y permisos", async () => {
  const { p, sections } = await editorFixture(),
    s = sections[0],
    d = await editorSnapshot(p),
    body = {
      title: "Editado",
      description: "",
      expectedVersion: d.structureVersion,
    };
  const path = `/projects/${p.id}/sections/${s.id}/draft`;
  for (const patch of [
    { title: "" },
    { title: "x".repeat(201) },
    { externalId: "OTHER" },
    { order: 44 },
    { projectId: second.id },
    { publication: "DRAFT" },
  ])
    await assertRejected(path, { ...body, ...patch }, 400, admin, "PUT");
  await assertRejected(
    `/projects/${p.id}/sections/00000000-0000-4000-8000-000000000001/draft`,
    body,
    404,
    admin,
    "PUT",
  );
  await assertRejected(
    `/projects/${second.id}/sections/${s.id}/draft`,
    body,
    404,
    admin,
    "PUT",
  );
  for (const session of [stakeholder, viewer])
    await assertRejected(path, body, 403, session, "PUT");
  for (const session of [otherOrg, outsider])
    await assertRejected(path, body, 404, session, "PUT");
  assert.equal((await editorSnapshot(p)).sections[0].title, s.title);
});
test("editor: tema con pregunta publicada o archivada protege contenido, vacío/borrador editable", async () => {
  const { p, sections, questions } = await editorFixture();
  let q = await ok(`/projects/${p.id}/questions/${questions[0].id}/publish`, {
    expectedVersion: 0,
  });
  const path = `/projects/${p.id}/sections/${sections[0].id}/draft`,
    body = {
      title: "No permitido",
      description: "",
      expectedVersion: (await editorSnapshot(p)).structureVersion,
    };
  await assertRejected(path, body, 409, admin, "PUT");
  await ok(`/projects/${p.id}/questions/${q.id}/archive`, {
    expectedVersion: q.lockVersion,
  });
  await assertRejected(path, body, 409, admin, "PUT");
  await ok(
    `/projects/${p.id}/sections/${sections[2].id}/draft`,
    body,
    admin,
    "PUT",
  );
});
test("editor: reorder de temas permuta IDs, preserva externalId y registra auditoría", async () => {
  const { p } = await editorFixture(),
    before = await editorSnapshot(p),
    command = sectionOrder(before);
  const result = await ok(
    `/projects/${p.id}/sections/reorder`,
    command,
    analyst,
  );
  const after = await editorSnapshot(p);
  assert.deepEqual(
    after.sections.map((s) => s.id),
    command.orderedIds,
  );
  assert.equal(result.structureVersion, before.structureVersion + 1);
  for (const s of before.sections)
    assert.equal(
      after.sections.find((x) => x.id === s.id).externalId,
      s.externalId,
    );
  assert.equal(
    await db.auditEvent.count({
      where: { projectId: p.id, action: "SECTIONS_REORDERED" },
    }),
    1,
  );
});
test("editor: reorder rechaza duplicados, omisiones, IDs inexistentes/ajenos y acceso", async () => {
  const { p, sections } = await editorFixture(),
    d = await editorSnapshot(p),
    body = sectionOrder(d),
    path = `/projects/${p.id}/sections/reorder`;
  await assertRejected(
    path,
    { ...body, orderedIds: [sections[0].id, sections[0].id, sections[2].id] },
    400,
  );
  await assertRejected(path, { ...body, orderedIds: [] }, 400);
  const foreign = await db.section.create({
    data: {
      projectId: foreignProject.id,
      externalId: randomBytes(8).toString("hex"),
      title: "Tema externo",
      description: "",
      order: 100,
    },
  });
  for (const id of [
    section.id,
    foreign.id,
    "00000000-0000-4000-8000-000000000001",
  ])
    await assertRejected(
      path,
      { ...body, orderedIds: [id, ...body.orderedIds.slice(1)] },
      404,
    );
  for (const session of [stakeholder, viewer])
    await assertRejected(path, body, 403, session);
  for (const session of [otherOrg, outsider])
    await assertRejected(path, body, 404, session);
  assert.deepEqual((await editorSnapshot(p)).sections, d.sections);
});
test("editor: reorder preguntas, incluidas publicadas, conserva revisiones/IDs/condiciones/seguimientos", async () => {
  const { p, sections, questions } = await editorFixture();
  await ok(
    `/projects/${p.id}/questions/${questions[1].id}/draft`,
    {
      ...editable(questions[1]),
      groupParentId: questions[0].id,
      condition: {
        parentQuestionId: questions[0].id,
        operator: "EQUALS",
        value: true,
      },
    },
    admin,
    "PUT",
  );
  await ok(`/projects/${p.id}/questions/${questions[0].id}/publish`, {
    expectedVersion: 0,
  });
  const before = await editorSnapshot(p),
    revisions = await db.questionRevision.findMany({
      where: { projectId: p.id },
      orderBy: { id: "asc" },
    }),
    body = questionOrderCommand(before, [sections[0].id]);
  await ok(`/projects/${p.id}/questions/reorder`, body, analyst);
  const after = await editorSnapshot(p);
  assert.deepEqual(
    after.questions
      .filter((q) => q.sectionId === sections[0].id)
      .map((q) => q.id),
    body.sections[0].orderedIds,
  );
  for (const q of before.questions) {
    const next = after.questions.find((x) => x.id === q.id);
    assert.equal(next.externalId, q.externalId);
    assert.equal(next.groupParentId, q.groupParentId);
    assert.deepEqual(next.condition, q.condition);
    assert.equal(next.revisionNumber, q.revisionNumber);
  }
  assert.deepEqual(
    await db.questionRevision.findMany({
      where: { projectId: p.id },
      orderBy: { id: "asc" },
    }),
    revisions,
  );
});
test("editor: move DRAFT une cambio de tema y ambos órdenes sin crear revisión", async () => {
  const { p, sections, questions } = await editorFixture(),
    before = await editorSnapshot(p),
    body = questionOrderCommand(before, [sections[0].id, sections[1].id]);
  const id = questions[2].id;
  body.sections[0].orderedIds = body.sections[0].orderedIds.filter(
    (x) => x !== id,
  );
  body.sections[1].orderedIds.push(id);
  await ok(`/projects/${p.id}/questions/reorder`, body);
  const after = await editorSnapshot(p);
  for (const scope of body.sections)
    assert.deepEqual(
      after.questions
        .filter((q) => q.sectionId === scope.sectionId)
        .map((q) => q.id),
      scope.orderedIds,
    );
  const moved = after.questions.find((q) => q.id === id);
  assert.equal(moved.revisionNumber, 1);
  assert.equal(moved.externalId, questions[2].externalId);
  assert.equal(
    await db.auditEvent.count({
      where: { projectId: p.id, action: "QUESTION_MOVED" },
    }),
    1,
  );
});
test("editor: move conserva condiciones entre temas; prohíbe separar grupo o trasladar publicada", async () => {
  const { p, sections, questions } = await editorFixture();
  await ok(
    `/projects/${p.id}/questions/${questions[2].id}/draft`,
    {
      ...editable(questions[2]),
      condition: {
        parentQuestionId: questions[0].id,
        operator: "EQUALS",
        value: true,
      },
    },
    admin,
    "PUT",
  );
  async function move(id) {
    const d = await editorSnapshot(p),
      body = questionOrderCommand(d, [sections[0].id, sections[1].id]);
    body.sections[0].orderedIds = body.sections[0].orderedIds.filter(
      (x) => x !== id,
    );
    body.sections[1].orderedIds.push(id);
    return request(`/projects/${p.id}/questions/reorder`, {
      session: admin,
      method: "POST",
      body,
    });
  }
  assert.equal((await move(questions[2].id)).status, 201);
  assert.equal(
    (await editorSnapshot(p)).questions.find((q) => q.id === questions[2].id)
      .condition.parentQuestionId,
    questions[0].id,
  );
  await ok(
    `/projects/${p.id}/questions/${questions[1].id}/draft`,
    {
      ...editable(
        (await editorSnapshot(p)).questions.find(
          (q) => q.id === questions[1].id,
        ),
      ),
      groupParentId: questions[0].id,
    },
    admin,
    "PUT",
  );
  assert.equal((await move(questions[1].id)).status, 409);
  assert.equal((await move(questions[0].id)).status, 409);
  await ok(`/projects/${p.id}/questions/${questions[0].id}/publish`, {
    expectedVersion: (await editorSnapshot(p)).questions.find(
      (q) => q.id === questions[0].id,
    ).lockVersion,
  });
  assert.equal((await move(questions[0].id)).status, 409);
});
test("editor: archivada conserva orden exacto y no entra en la lista final activa", async () => {
  const { p, sections, questions } = await editorFixture();
  await ok(`/projects/${p.id}/questions/${questions[1].id}/archive`, {
    expectedVersion: 0,
  });
  const before = await editorSnapshot(p),
    body = questionOrderCommand(before, [sections[0].id]);
  await ok(`/projects/${p.id}/questions/reorder`, body);
  const archived = (await editorSnapshot(p)).questions.find(
    (q) => q.id === questions[1].id,
  );
  assert.equal(archived.order, questions[1].order);
  assert.equal(archived.lockVersion, 1);
  const invalid = questionOrderCommand(await editorSnapshot(p), [
    sections[0].id,
  ]);
  invalid.sections[0].orderedIds.push(archived.id);
  await assertRejected(`/projects/${p.id}/questions/reorder`, invalid, 400);
});
test("editor: reorder preguntas valida lista completa, scope, duplicados y roles", async () => {
  const { p, sections, questions } = await editorFixture(),
    d = await editorSnapshot(p),
    body = questionOrderCommand(d, [sections[0].id]),
    path = `/projects/${p.id}/questions/reorder`;
  for (const session of [stakeholder, viewer])
    await assertRejected(path, body, 403, session);
  for (const session of [otherOrg, outsider])
    await assertRejected(path, body, 404, session);
  for (const ids of [[questions[0].id, questions[0].id], []]) {
    const b = structuredClone(body);
    b.sections[0].orderedIds = ids;
    await assertRejected(path, b, 400);
  }
  const outside = await question(
    "OUTSIDE-EDITOR-" + randomBytes(4).toString("hex"),
  );
  for (const id of [outside.id, "00000000-0000-4000-8000-000000000001"]) {
    const b = structuredClone(body);
    b.sections[0].orderedIds[0] = id;
    await assertRejected(path, b, 404);
  }
  const other = structuredClone(body);
  other.sections[0].sectionId = section.id;
  await assertRejected(path, other, 404);
  const stale = structuredClone(body);
  stale.sections[0].expected[0].lockVersion++;
  await assertRejected(path, stale, 409);
  assert.deepEqual((await editorSnapshot(p)).questions, d.questions);
});
for (const kind of ["sections", "questions"])
  test(`editor: dos reorder concurrentes de ${kind}: un éxito y un conflicto sin lost update`, async () => {
    const { p, sections } = await editorFixture(),
      before = await editorSnapshot(p),
      body =
        kind === "sections"
          ? sectionOrder(before)
          : questionOrderCommand(before, [sections[0].id]);
    const results = await Promise.all(
      [admin, analyst].map((session) =>
        request(`/projects/${p.id}/${kind}/reorder`, {
          session,
          method: "POST",
          body,
        }),
      ),
    );
    assert.deepEqual(results.map((r) => r.status).sort(), [201, 409]);
    const after = await editorSnapshot(p);
    assert.equal(after.structureVersion, before.structureVersion + 1);
    if (kind === "sections")
      assert.deepEqual(
        after.sections.map((s) => s.id),
        body.orderedIds,
      );
    else
      assert.deepEqual(
        after.questions
          .filter((q) => q.sectionId === sections[0].id)
          .map((q) => q.id),
        body.sections[0].orderedIds,
      );
  });
for (const kind of ["Section", "Question"])
  test(`editor: fallo después de posiciones temporales en ${kind} revierte datos, versión y auditoría`, async () => {
    const { p, sections } = await editorFixture(),
      before = await editorSnapshot(p),
      events = await db.auditEvent.count({ where: { projectId: p.id } });
    const owner = new pg.Client({ connectionString: ownerUrl.href });
    await owner.connect();
    await owner.query(
      `CREATE FUNCTION editor_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW."projectId"='${p.id}'::uuid AND NEW."order"=0 THEN RAISE EXCEPTION 'injected rollback'; END IF; RETURN NEW; END $$; CREATE TRIGGER editor_failure BEFORE UPDATE ON "${kind}" FOR EACH ROW EXECUTE FUNCTION editor_failure()`,
    );
    try {
      const body =
        kind === "Section"
          ? sectionOrder(before)
          : questionOrderCommand(before, [sections[0].id]);
      await assertRejected(
        `/projects/${p.id}/${kind === "Section" ? "sections" : "questions"}/reorder`,
        body,
        500,
      );
      assert.deepEqual(await editorSnapshot(p), before);
      assert.equal(
        await db.auditEvent.count({ where: { projectId: p.id } }),
        events,
      );
    } finally {
      await owner.query(
        `DROP TRIGGER editor_failure ON "${kind}"; DROP FUNCTION editor_failure()`,
      );
      await owner.end();
    }
  });
test("editor: snapshot detecta alta/metadata por endpoints anteriores sin sobrescribir", async () => {
  const { p, sections, questions } = await editorFixture();
  const before = await editorSnapshot(p);
  await ok(`/projects/${p.id}/questions/${questions[0].id}/metadata`, {
    priority: "P2",
    responsibleAreaId: area.id,
    order: questions[0].order,
    expectedVersion: 0,
  });
  await assertRejected(
    `/projects/${p.id}/questions/reorder`,
    questionOrderCommand(before, [sections[0].id]),
    409,
  );
  await ok(`/projects/${p.id}/sections`, {
    externalId: "NEW",
    title: "Nuevo tema",
    description: "",
    order: 10,
  });
  await assertRejected(
    `/projects/${p.id}/sections/reorder`,
    sectionOrder(before),
    409,
  );
});
test("editor: IDs de pregunta de otra organización rechazados dentro del proyecto autorizado", async () => {
  const { p, sections } = await editorFixture();
  const organization = process.env.ORGANIZATION_CODE;
  process.env.ORGANIZATION_CODE = "OTHER-DEMO";
  let foreign;
  try {
    const fa = await ok(
      "/areas",
      { code: "EDITOR-FOREIGN", name: "Área externa ficticia" },
      otherOrg,
    );
    const fs = await ok(
      `/projects/${foreignProject.id}/sections`,
      {
        externalId: "EDITOR-FOREIGN",
        title: "Tema externo",
        description: "",
        order: 101,
      },
      otherOrg,
    );
    foreign = await ok(
      `/projects/${foreignProject.id}/questions`,
      input("FOREIGN-Q", {
        sectionId: fs.id,
        responsibleAreaId: fa.id,
        order: 0,
      }),
      otherOrg,
    );
  } finally {
    process.env.ORGANIZATION_CODE = organization;
  }
  const before = await editorSnapshot(p),
    body = questionOrderCommand(before, [sections[0].id]);
  body.sections[0].orderedIds[0] = foreign.id;
  await assertRejected(`/projects/${p.id}/questions/reorder`, body, 404);
  assert.deepEqual(await editorSnapshot(p), before);
});
test("editor: rollback de traslado restaura origen y destino completos", async () => {
  const { p, sections, questions } = await editorFixture(),
    before = await editorSnapshot(p),
    body = questionOrderCommand(before, [sections[0].id, sections[1].id]);
  const id = questions[2].id;
  body.sections[0].orderedIds = body.sections[0].orderedIds.filter(
    (x) => x !== id,
  );
  body.sections[1].orderedIds.push(id);
  const owner = new pg.Client({ connectionString: ownerUrl.href });
  await owner.connect();
  await owner.query(
    `CREATE FUNCTION editor_move_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW."projectId"='${p.id}'::uuid AND NEW.action='QUESTION_MOVED' THEN RAISE EXCEPTION 'injected failure after move'; END IF; RETURN NEW; END $$; CREATE TRIGGER editor_move_failure BEFORE INSERT ON "AuditEvent" FOR EACH ROW EXECUTE FUNCTION editor_move_failure()`,
  );
  try {
    await assertRejected(`/projects/${p.id}/questions/reorder`, body, 500);
    assert.deepEqual(await editorSnapshot(p), before);
    assert.equal(
      await db.auditEvent.count({
        where: { projectId: p.id, action: "QUESTION_MOVED" },
      }),
      0,
    );
  } finally {
    await owner.query(
      'DROP TRIGGER editor_move_failure ON "AuditEvent"; DROP FUNCTION editor_move_failure()',
    );
    await owner.end();
  }
});
