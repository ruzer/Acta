import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import {
  mkdtemp,
  rm,
  readdir,
  utimes,
  readFile,
  unlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { config } from "dotenv";
import pg from "pg";
import { PDFDocument } from "pdf-lib";
import sharp from "sharp";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
const s3Test = process.env.STORAGE_TEST_S3 === "true";
if (s3Test)
  assert.equal(
    process.env.SELFHOST_STORAGE_TEST_ALLOWED,
    "true",
    "Dedicated disposable bucket opt-in required",
  );
process.env.STORAGE_PROVIDER = s3Test ? "S3" : "LOCAL";
let objectClient, objectBucket;
async function replaceStoredBytes(key, bytes) {
  if (s3Test) {
    await objectClient.send(
      new PutObjectCommand({
        Bucket: objectBucket,
        Key: `evidence/v1/${key}`,
        Body: bytes,
      }),
    );
  } else await writeFile(join(root, key), bytes);
}
import { crc32 } from "node:zlib";
config({ quiet: true });
const name = "requirements_2c_" + randomBytes(6).toString("hex"),
  origin = "http://localhost:4329",
  base = origin + "/api/v1",
  password = "Test-" + randomBytes(24).toString("base64url");
const ownerUrl = new URL(process.env.MIGRATION_DATABASE_URL),
  runtimeUrl = new URL(process.env.DATABASE_URL);
const adminDb = new pg.Client({ connectionString: ownerUrl.href });
let app,
  db,
  owner,
  createApp,
  storage,
  service,
  root,
  project,
  otherProject,
  questions,
  stakeholder,
  admin,
  analyst,
  viewer,
  other,
  foreignOrganizationSession,
  member,
  pdf;
const blank = {
  answer: null,
  comment: "",
  example: "",
  consultationRequested: false,
};
async function req(
  path,
  { session = stakeholder, method = "GET", body, binary, metadata } = {},
) {
  const r = await fetch(base + path, {
    method,
    headers: {
      Origin: origin,
      "Content-Type": binary ? "application/octet-stream" : "application/json",
      ...(session
        ? { Cookie: session.cookie, "X-CSRF-Token": session.csrf }
        : {}),
      ...(metadata
        ? {
            "X-Evidence-Metadata": encodeURIComponent(JSON.stringify(metadata)),
          }
        : {}),
    },
    ...(method === "GET" ? {} : { body: binary ?? JSON.stringify(body ?? {}) }),
  });
  const data = r.headers.get("content-type")?.includes("application/json")
    ? await r.json()
    : Buffer.from(await r.arrayBuffer());
  return { status: r.status, data, headers: r.headers };
}
async function ok(path, options) {
  const r = await req(path, options);
  assert.ok(
    r.status === 200 || r.status === 201,
    `${path}: ${r.status} ${r.data.message}`,
  );
  return r.data;
}
async function login(username) {
  const r = await req("/auth/login", {
    session: null,
    method: "POST",
    body: { username, password },
  });
  assert.equal(r.status, 201, JSON.stringify(r.data));
  return {
    cookie: r.headers.get("set-cookie").split(";")[0],
    csrf: r.data.csrfToken,
    user: r.data.user,
  };
}
const path = (q) => `/projects/${project.id}/questions/${q.id}`;
async function view(q, session = stakeholder) {
  return ok(path(q) + "/response", { session });
}
async function save(q, content, extra = {}) {
  const v = await view(q);
  return ok(path(q) + "/response/draft", {
    method: "PUT",
    body: {
      ...blank,
      ...content,
      expectedVersion: v.lockVersion,
      requestId: randomUUID(),
      ...extra,
    },
  });
}
async function submit(q) {
  const v = await view(q);
  return ok(path(q) + "/response/submit", {
    method: "POST",
    body: { expectedVersion: v.lockVersion, requestId: randomUUID() },
  });
}
const of = (type) => questions.find((q) => q.type === type);
async function stage(
  q,
  bytes = pdf,
  name = "evidencia.pdf",
  requestId = randomUUID(),
) {
  return req(path(q) + "/evidence", {
    method: "POST",
    binary: bytes,
    metadata: { originalName: name, requestId },
  });
}
async function attach(q, evidence) {
  const v = await view(q);
  return ok(path(q) + "/response/evidence/attach", {
    method: "POST",
    body: {
      expectedVersion: v.lockVersion,
      requestId: randomUUID(),
      evidenceId: evidence.id,
    },
  });
}
async function start() {
  app = await createApp();
  const { STORAGE } =
    await import("../../app/backend/dist/responses/storage.js");
  const { ResponsesService } =
    await import("../../app/backend/dist/responses/responses.service.js");
  storage = app.get(STORAGE);
  service = app.get(ResponsesService);
}
before(
  async () => {
    root = await mkdtemp(join(tmpdir(), "requirements-2c-"));
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
      PORT: "4329",
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
    ({ createApp } = await import("../../app/backend/dist/main.js"));
    await start();
    if (s3Test) {
      assert.equal(
        storage.backend,
        "S3",
        "S3 gate must never fall back to LOCAL",
      );
      const { s3Configuration } =
        await import("../../app/backend/dist/responses/s3-storage.js");
      const configuration = s3Configuration();
      objectBucket = configuration.bucket;
      objectClient = new S3Client(configuration.options);
      await storage.health();
    }
    admin = await login("admin");
    analyst = await login("analyst");
    stakeholder = await login("stakeholder");
    viewer = await login("viewer");
    const projects = await ok("/projects", { session: admin });
    project = projects.find((p) => p.externalId === "DEMO-PRINCIPAL");
    otherProject = projects.find((p) => p.externalId === "DEMO-SECUNDARIO");
    questions = (
      await ok(`/projects/${project.id}/questionnaire`, { session: analyst })
    ).questions;
    member = await db.projectMember.findFirst({
      where: { projectId: project.id, userId: stakeholder.user.id },
    });
    const u = await ok("/users", {
      session: admin,
      method: "POST",
      body: {
        username: "otherparticipant",
        displayName: "Otro participante ficticio",
        temporaryPassword: password,
      },
    });
    await db.user.update({
      where: { id: u.id },
      data: { mustChangePassword: false },
    });
    other = await login("otherparticipant");
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
      const updated = await ok(path(q) + "/assign", {
        session: analyst,
        method: "POST",
        body: {
          projectMemberId: m.id,
          active: true,
          required: false,
          expectedVersion: q.lockVersion,
        },
      });
      q.lockVersion = updated.lockVersion;
    }
    const document = await PDFDocument.create();
    document.addPage().drawText("Evidencia ficticia - prueba 2C");
    pdf = Buffer.from(await document.save());
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
test("Participante: guardar intacta persiste sin envío; Continuar respeta categoría y orden documental", async () => {
  const personal = () => ok(`/projects/${project.id}/my-work`);
  const initial = await personal();
  const ids = initial.sections
    .flatMap((s) => s.questions)
    .filter((q) => q.applicability === "ENABLED")
    .slice(0, 3)
    .map((q) => q.id);
  const [first, second, third] = ids.map((id) =>
    questions.find((q) => q.id === id),
  );
  const blankDraft = await save(second, {});
  assert.equal(blankDraft.draft.answer, null);
  assert.equal(blankDraft.revisions.length, 0);
  await ok("/auth/logout", { method: "POST" });
  await app.close();
  await start();
  stakeholder = await login("stakeholder");
  assert.deepEqual((await view(second)).draft, blankDraft.draft);
  assert.equal((await personal()).continueQuestionId, second.id);
  await save(first, { consultationRequested: true });
  await save(third, {});
  const work = await personal();
  assert.equal(
    work.continueQuestionId,
    second.id,
    "documentary first draft wins, not newest save or consultation",
  );
  const item = work.sections
    .flatMap((s) => s.questions)
    .find((q) => q.id === first.id);
  assert.equal(item.state, "CONSULTATION");
  assert.equal(item.hasSubmission, false);
  assert.ok(item.question);
});
test("T01 guarda, logout, reinicia API y recupera exactamente el último borrador confirmado", async () => {
  const q = of("SHORT_TEXT");
  const saved = await save(q, {
    answer: "Procedimiento ficticio persistente",
    comment: "Comentario recuperable",
  });
  assert.equal(saved.revisions.length, 0);
  await ok("/auth/logout", { method: "POST" });
  await app.close();
  await start();
  stakeholder = await login("stakeholder");
  const recovered = await view(q);
  assert.deepEqual(recovered.draft, saved.draft);
  assert.equal(recovered.lockVersion, saved.lockVersion);
});
test("T02 dos guardados, envío, nuevo borrador y reenvío producen exactamente dos versiones inmutables", async () => {
  const q = of("YES_NO");
  await save(q, { answer: true });
  await save(q, { answer: false });
  let v = await view(q);
  assert.equal(v.revisions.length, 0);
  v = await submit(q);
  assert.equal(v.draft, null);
  assert.equal(v.revisions.length, 1);
  const first = v.revisions[0];
  v = await save(q, { answer: true });
  assert.equal(v.draft.basedOnRevisionId, first.id);
  assert.equal(v.revisions[0].answer, false);
  v = await submit(q);
  assert.equal(v.revisions.length, 2);
  assert.equal(v.revisions[0].number, 2);
  await assert.rejects(
    db.responseRevision.update({
      where: { id: first.id },
      data: { answer: true },
    }),
  );
  await assert.rejects(
    owner.query('UPDATE "ResponseRevision" SET comment=$1 WHERE id=$2', [
      "alterar",
      first.id,
    ]),
  );
  assert.equal((await view(q)).revisions[1].answer, false);
});
test("T09 dos escrituras simultáneas: una gana, otra 409, versión monotónica evita ABA después de envío", async () => {
  const q = of("SHORT_TEXT"),
    v = await view(q),
    url = path(q) + "/response/draft";
  const results = await Promise.all(
    ["pestaña uno", "pestaña dos"].map((answer) =>
      req(url, {
        method: "PUT",
        body: {
          ...blank,
          answer,
          expectedVersion: v.lockVersion,
          requestId: randomUUID(),
        },
      }),
    ),
  );
  assert.deepEqual(results.map((r) => r.status).sort(), [200, 409]);
  assert.match(
    results.find((r) => r.status === 409).data.message,
    /otra sesión o pestaña/,
  );
  const winner = results.find((r) => r.status === 200).data;
  assert.equal((await view(q)).draft.answer, winner.draft.answer);
  await submit(q);
  await save(q, { answer: "nueva aportación" });
  assert.equal(
    (
      await req(url, {
        method: "PUT",
        body: {
          ...blank,
          answer: "vieja",
          expectedVersion: winner.lockVersion,
          requestId: randomUUID(),
        },
      })
    ).status,
    409,
  );
});
test("T10 reintentos de guardar/enviar con requestId no duplican y payload distinto es rechazado", async () => {
  const q = of("DATE"),
    v = await view(q);
  const payload = {
    ...blank,
    answer: "2026-09-28",
    expectedVersion: v.lockVersion,
    requestId: randomUUID(),
  };
  const first = await ok(path(q) + "/response/draft", {
    method: "PUT",
    body: payload,
  });
  assert.deepEqual(
    await ok(path(q) + "/response/draft", { method: "PUT", body: payload }),
    first,
  );
  assert.equal(
    (
      await req(path(q) + "/response/draft", {
        method: "PUT",
        body: { ...payload, answer: "2026-09-29" },
      })
    ).status,
    409,
  );
  const command = {
    expectedVersion: first.lockVersion,
    requestId: randomUUID(),
  };
  const sent = await ok(path(q) + "/response/submit", {
    method: "POST",
    body: command,
  });
  assert.deepEqual(
    await ok(path(q) + "/response/submit", { method: "POST", body: command }),
    sent,
  );
  assert.equal((await view(q)).revisions.length, 1);
});
test("T19 ocho tipos: incompleto válido permitido, tipos/opciones/fechas/matrices falsos rechazados", async () => {
  const invalid = {
    YES_NO: "true",
    SINGLE_CHOICE: "AJENA",
    MULTIPLE_CHOICE: ["AJENA"],
    SHORT_TEXT: 123,
    LONG_TEXT: true,
    DATE: "2026-02-30",
    NUMBER: "20",
    MATRIX: { DESCONOCIDA: "SOLICITANTE" },
  };
  for (const [type, answer] of Object.entries(invalid)) {
    const q = of(type),
      v = await view(q);
    const r = await req(path(q) + "/response/draft", {
      method: "PUT",
      body: {
        ...blank,
        answer,
        expectedVersion: v.lockVersion,
        requestId: randomUUID(),
      },
    });
    assert.equal(r.status, 422, type);
    assert.equal((await view(q)).lockVersion, v.lockVersion);
  }
  const matrix = of("MATRIX");
  let v = await save(matrix, { answer: { RECIBIR: "SOLICITANTE" } });
  assert.equal(
    (
      await req(path(matrix) + "/response/submit", {
        method: "POST",
        body: { expectedVersion: v.lockVersion, requestId: randomUUID() },
      })
    ).status,
    422,
  );
  await save(matrix, {
    answer: { RECIBIR: "SOLICITANTE", REVISAR: "REVISORA" },
  });
  assert.equal((await submit(matrix)).revisions.length, 1);
  const number = of("NUMBER");
  v = await save(number, { answer: null });
  assert.equal(
    (
      await req(path(number) + "/response/submit", {
        method: "POST",
        body: { expectedVersion: v.lockVersion, requestId: randomUUID() },
      })
    ).status,
    422,
  );
  await save(number, { answer: 0 });
  await submit(number);
});
test("Consulta persistente es privada y no crea aclaración ni no aplicabilidad", async () => {
  const q = of("SHORT_TEXT");
  const v = await save(q, {
    answer: "por confirmar",
    consultationRequested: true,
    comment: "Consultar manual ficticio",
  });
  assert.equal(v.draft.consultationRequested, true);
  const work = await ok(`/projects/${project.id}/my-work`);
  assert.equal(
    work.sections.flatMap((s) => s.questions).find((x) => x.id === q.id).state,
    "CONSULTATION",
  );
  assert.equal(await db.clarificationThread.count(), 0);
  assert.notEqual(
    (await db.question.findUnique({ where: { id: q.id } })).status,
    "NOT_APPLICABLE",
  );
});
test("T06/T18 roles, otro participante, otra organización y proyecto no acceden a borradores", async () => {
  const q = of("SHORT_TEXT");
  for (const session of [admin, analyst, viewer])
    assert.equal((await req(path(q) + "/response", { session })).status, 403);
  assert.equal((await view(q, other)).draft, null);
  assert.equal(
    (await req(`/projects/${otherProject.id}/questions/${q.id}/response`))
      .status,
    404,
  );
  const foreignOrg = await db.organization.create({
    data: { code: "TEST-ISOLATED", name: "Organización ficticia aislada" },
  });
  const foreignUser = await db.user.create({
    data: {
      organizationId: foreignOrg.id,
      username: "isolated",
      displayName: "Aislado",
      passwordHash: (
        await db.user.findUnique({ where: { id: stakeholder.user.id } })
      ).passwordHash,
      mustChangePassword: false,
    },
  });
  process.env.ORGANIZATION_CODE = foreignOrg.code;
  const logged = await req("/auth/login", {
    session: null,
    method: "POST",
    body: {
      username: foreignUser.username,
      password,
    },
  });
  process.env.ORGANIZATION_CODE = "DEFAULT";
  assert.equal(logged.status, 201);
  const session = {
    cookie: logged.headers.get("set-cookie").split(";")[0],
    csrf: logged.data.csrfToken,
  };
  foreignOrganizationSession = session;
  assert.equal((await req(path(q) + "/response", { session })).status, 401);
  for (const session of [admin, analyst, viewer])
    assert.equal(
      (
        await req(path(q) + "/response/draft", {
          session,
          method: "PUT",
          body: {
            ...blank,
            answer: "no",
            requestId: randomUUID(),
            expectedVersion: 0,
          },
        })
      ).status,
      403,
    );
});
test("Condición usa envío del padre, conserva hijo e invalida vigencia sin borrar su historia", async () => {
  const parent = of("SINGLE_CHOICE"),
    child = of("LONG_TEXT");
  assert.equal((await view(child)).question.applicability, "UNDETERMINED");
  await save(parent, { answer: "DEPENDE" });
  assert.equal((await view(child)).question.applicability, "UNDETERMINED");
  await submit(parent);
  assert.equal((await view(child)).question.applicability, "ENABLED");
  await save(child, { answer: "Criterio ficticio conservado" });
  await submit(child);
  await save(child, { answer: "Otro borrador conservado" });
  await save(parent, { answer: "NUNCA" });
  await submit(parent);
  const off = await view(child);
  assert.equal(off.question.applicability, "DISABLED");
  assert.equal(off.draft.answer, "Otro borrador conservado");
  assert.equal(off.revisions[0].current, false);
  assert.equal(
    (
      await req(path(child) + "/response/submit", {
        method: "POST",
        body: { requestId: randomUUID(), expectedVersion: off.lockVersion },
      })
    ).status,
    409,
  );
  await save(parent, { answer: "DEPENDE" });
  await submit(parent);
  assert.equal((await view(child)).revisions[0].current, false);
  await save(child, { answer: "Otro borrador conservado" });
  assert.equal((await submit(child)).revisions[0].current, true);
});
let historicalEvidence, historicalRevision;
test("Evidencia: staging idempotente, attach idempotente, envío conserva bytes sin duplicarlos", async () => {
  const q = of("SHORT_TEXT");
  await save(q, { answer: "Con evidencia" });
  const rid = randomUUID();
  const staged = await stage(q, pdf, "ficticio.pdf", rid);
  assert.equal(staged.status, 201, staged.data.message);
  assert.deepEqual(
    (await stage(q, pdf, "ficticio.pdf", rid)).data,
    staged.data,
  );
  assert.equal(await db.evidence.count({ where: { id: staged.data.id } }), 1);
  assert.equal((await stage(q, pdf, "otro.pdf", rid)).status, 409);
  let v = await view(q);
  const command = {
    expectedVersion: v.lockVersion,
    requestId: randomUUID(),
    evidenceId: staged.data.id,
  };
  v = await ok(path(q) + "/response/evidence/attach", {
    method: "POST",
    body: command,
  });
  assert.deepEqual(
    await ok(path(q) + "/response/evidence/attach", {
      method: "POST",
      body: command,
    }),
    v,
  );
  assert.equal(v.draft.evidence.length, 1);
  for (const session of [admin, analyst, viewer, other])
    assert.equal(
      (
        await req(
          `/projects/${project.id}/evidence/${staged.data.id}/download`,
          { session },
        )
      ).status,
      404,
    );
  v = await submit(q);
  historicalRevision = v.revisions[0];
  historicalEvidence = staged.data;
  assert.equal(
    historicalRevision.evidence[0].evidence.id,
    historicalEvidence.id,
  );
  const download = await req(
    `/projects/${project.id}/evidence/${historicalEvidence.id}/download`,
  );
  assert.deepEqual(download.data, pdf);
  assert.match(download.headers.get("content-disposition"), /^attachment/);
  assert.equal(download.headers.get("x-content-type-options"), "nosniff");
  assert.equal(download.headers.get("content-type"), "application/pdf");
  for (const session of [admin, analyst])
    assert.equal(
      (
        await req(
          `/projects/${project.id}/evidence/${historicalEvidence.id}/download`,
          { session },
        )
      ).status,
      200,
    );
  v = await save(q, { answer: "Nueva aportación sin adjunto" });
  assert.equal(v.draft.evidence.length, 1);
  v = await ok(path(q) + "/response/evidence/remove", {
    method: "POST",
    body: {
      requestId: randomUUID(),
      expectedVersion: v.lockVersion,
      evidenceId: historicalEvidence.id,
    },
  });
  assert.equal(v.draft.evidence.length, 0);
  assert.equal(v.revisions[0].evidence.length, 1);
  assert.deepEqual(
    (
      await req(
        `/projects/${project.id}/evidence/${historicalEvidence.id}/download`,
      )
    ).data,
    pdf,
  );
  await assert.rejects(
    owner.query(
      'DELETE FROM "RevisionEvidence" WHERE "responseRevisionId"=$1',
      [historicalRevision.id],
    ),
  );
});
test("T15 tamaño, extensión falsa, traversal, SVG, PDF activo/cifrado/dañado rechazados", async () => {
  const q = of("SHORT_TEXT");
  for (const name of [
    "../archivo.pdf",
    "ruta\\archivo.pdf",
    "script.html",
    "imagen.svg",
    "legacy.doc",
    "macro.docm",
    "%2e%2e.pdf",
  ])
    assert.equal((await stage(q, pdf, name)).status, 422, name);
  assert.equal(
    (await stage(q, Buffer.from("<html>invalido</html>"), "falso.pdf")).status,
    422,
  );
  assert.equal(
    (await stage(q, Buffer.alloc(20 * 1024 * 1024 + 1), "grande.pdf")).status,
    413,
  );
  const doc = await PDFDocument.create();
  doc.addPage();
  doc.addJavaScript("code", 'app.alert("ficticio")');
  assert.equal(
    (await stage(q, Buffer.from(await doc.save()), "activo.pdf")).status,
    422,
  );
  assert.equal(
    (
      await stage(
        q,
        Buffer.from("%PDF-1.7\n/Encrypt 1 0 R\n%%EOF"),
        "cifrado.pdf",
      )
    ).status,
    422,
  );
});
function zip(entries) {
  const locals = [],
    central = [];
  let offset = 0;
  for (const [name, text] of Object.entries(entries)) {
    const n = Buffer.from(name),
      b = Buffer.from(text),
      crc = crc32(b),
      h = Buffer.alloc(30);
    h.writeUInt32LE(0x04034b50);
    h.writeUInt16LE(20, 4);
    h.writeUInt32LE(crc, 14);
    h.writeUInt32LE(b.length, 18);
    h.writeUInt32LE(b.length, 22);
    h.writeUInt16LE(n.length, 26);
    locals.push(h, n, b);
    const c = Buffer.alloc(46);
    c.writeUInt32LE(0x02014b50);
    c.writeUInt16LE(20, 4);
    c.writeUInt16LE(20, 6);
    c.writeUInt32LE(crc, 16);
    c.writeUInt32LE(b.length, 20);
    c.writeUInt32LE(b.length, 24);
    c.writeUInt16LE(n.length, 28);
    c.writeUInt32LE(offset, 42);
    central.push(c, n);
    offset += h.length + n.length + b.length;
  }
  const c = Buffer.concat(central),
    end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50);
  end.writeUInt16LE(Object.keys(entries).length, 8);
  end.writeUInt16LE(Object.keys(entries).length, 10);
  end.writeUInt32LE(c.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, c, end]);
}
test("Allowlist real: PNG/JPEG decodificados y paquetes DOCX/XLSX estructurales; macros/ZIP corrupto rechazados", async () => {
  const q = of("SHORT_TEXT");
  for (const ext of ["png", "jpeg"]) {
    const image = await sharp({
      create: { width: 10, height: 10, channels: 3, background: "white" },
    })
      .toFormat(ext)
      .toBuffer();
    assert.equal((await stage(q, image, "imagen." + ext)).status, 201);
    assert.equal(
      (await stage(q, image.subarray(0, 30), "truncado." + ext)).status,
      422,
    );
  }
  for (const ext of ["docx", "xlsx"]) {
    const main = ext === "docx" ? "word/document.xml" : "xl/workbook.xml",
      type =
        ext === "docx"
          ? "wordprocessingml.document.main+xml"
          : "spreadsheetml.sheet.main+xml";
    const entries = {
      "[Content_Types].xml": `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/${main}" ContentType="application/vnd.openxmlformats-officedocument.${type}"/>${ext === "xlsx" ? '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' : ""}</Types>`,
      "_rels/.rels": `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="${main}"/></Relationships>`,
      [main]:
        ext === "docx"
          ? '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p/></w:body></w:document>'
          : '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Ficticio" sheetId="1" r:id="rId1"/></sheets></workbook>',
      ...(ext === "xlsx"
        ? {
            "xl/_rels/workbook.xml.rels":
              '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>',
            "xl/worksheets/sheet1.xml":
              '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData/></worksheet>',
          }
        : {}),
    };
    assert.equal(
      (
        await stage(
          q,
          zip({
            ...entries,
            [main]: ext === "docx" ? "<document/>" : "<workbook/>",
          }),
          "falso." + ext,
        )
      ).status,
      422,
    );
    if (ext === "xlsx") {
      const missingSheet = { ...entries };
      delete missingSheet["xl/worksheets/sheet1.xml"];
      assert.equal(
        (await stage(q, zip(missingSheet), "incompleto.xlsx")).status,
        422,
      );
    }
    assert.equal(
      (await stage(q, zip(entries), "documento." + ext)).status,
      201,
    );
    assert.equal(
      (
        await stage(
          q,
          zip({ ...entries, "word/vbaProject.bin": "bad" }),
          "macro." + ext,
        )
      ).status,
      422,
    );
  }
});
test("T16 auditoría falla: borrador y envío se revierten; stage deja solo huérfano reconciliable", async () => {
  const q = of("NUMBER"),
    before = await view(q);
  await owner.query(
    `CREATE FUNCTION test_audit_fail() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action IN ('RESPONSE_DRAFTED','RESPONSE_SUBMITTED','EVIDENCE_STAGED') THEN RAISE EXCEPTION 'test injection'; END IF; RETURN NEW; END $$; CREATE TRIGGER test_audit_fail BEFORE INSERT ON "AuditEvent" FOR EACH ROW EXECUTE FUNCTION test_audit_fail()`,
  );
  try {
    assert.equal(
      (
        await req(path(q) + "/response/draft", {
          method: "PUT",
          body: {
            ...blank,
            answer: 5,
            requestId: randomUUID(),
            expectedVersion: before.lockVersion,
          },
        })
      ).status,
      500,
    );
    assert.deepEqual(await view(q), before);
    const count = await db.evidence.count();
    assert.equal((await stage(q)).status, 500);
    assert.equal(await db.evidence.count(), count);
  } finally {
    await owner.query(
      'DROP TRIGGER test_audit_fail ON "AuditEvent"; DROP FUNCTION test_audit_fail()',
    );
  }
  await save(q, { answer: 6 });
  const draft = await view(q);
  await owner.query(
    `CREATE FUNCTION test_submit_fail() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='RESPONSE_SUBMITTED' THEN RAISE EXCEPTION 'test injection'; END IF; RETURN NEW; END $$; CREATE TRIGGER test_submit_fail BEFORE INSERT ON "AuditEvent" FOR EACH ROW EXECUTE FUNCTION test_submit_fail()`,
  );
  try {
    assert.equal(
      (
        await req(path(q) + "/response/submit", {
          method: "POST",
          body: { requestId: randomUUID(), expectedVersion: draft.lockVersion },
        })
      ).status,
      500,
    );
    assert.deepEqual(await view(q), draft);
  } finally {
    await owner.query(
      'DROP TRIGGER test_submit_fail ON "AuditEvent"; DROP FUNCTION test_submit_fail()',
    );
  }
  if (!s3Test) {
    for (const key of await readdir(root))
      await utimes(join(root, key), new Date(0), new Date(0));
  }
  // S3 LastModified is server-controlled. Advance the reconciliation clock,
  // on this gate's dedicated empty bucket only; attached/history objects survive.
  const reconciled = await service.reconcile(
    s3Test ? new Date(Date.now() + 25 * 60 * 60 * 1000) : new Date(),
  );
  assert.ok(reconciled.removed >= 1);
  assert.deepEqual(
    (
      await req(
        `/projects/${project.id}/evidence/${historicalEvidence.id}/download`,
      )
    ).data,
    pdf,
  );
});
test("T16 almacenamiento y BD fallan sin enviar revisiones incompletas; integridad comprobada al descargar", async () => {
  const q = of("NUMBER");
  const realPut = storage.put.bind(storage);
  storage.put = async () => {
    throw new Error("injected storage failure");
  };
  const count = await db.evidence.count();
  try {
    assert.equal((await stage(q)).status, 500);
    assert.equal(await db.evidence.count(), count);
  } finally {
    storage.put = realPut;
  }
  const uploaded = await stage(q);
  assert.equal(uploaded.status, 201);
  await attach(q, uploaded.data);
  const row = await db.evidence.findUnique({ where: { id: uploaded.data.id } }),
    bytes = s3Test
      ? await storage.read(row.storageKey)
      : await readFile(join(root, row.storageKey));
  if (s3Test) await storage.remove(row.storageKey);
  else await unlink(join(root, row.storageKey));
  const v = await view(q);
  assert.equal(
    (
      await req(path(q) + "/response/submit", {
        method: "POST",
        body: { requestId: randomUUID(), expectedVersion: v.lockVersion },
      })
    ).status,
    503,
  );
  assert.deepEqual(await view(q), v);
  await replaceStoredBytes(row.storageKey, Buffer.from("corrupt"));
  assert.equal(
    (await req(`/projects/${project.id}/evidence/${row.id}/download`)).status,
    503,
  );
  await replaceStoredBytes(row.storageKey, bytes);
  await submit(q);
});
test("Caducidad de staging auditada, límites de adjuntos y conservación de historial", async () => {
  const q = of("YES_NO");
  const uploaded = await stage(q);
  assert.equal(uploaded.status, 201);
  const old = process.env.EVIDENCE_MAX_ATTACHMENTS;
  process.env.EVIDENCE_MAX_ATTACHMENTS = "1";
  try {
    assert.equal((await stage(q)).status, 422);
  } finally {
    if (old) process.env.EVIDENCE_MAX_ATTACHMENTS = old;
    else delete process.env.EVIDENCE_MAX_ATTACHMENTS;
  }
  const result = await service.reconcile(
    new Date(Date.now() + 25 * 60 * 60 * 1000),
  );
  assert.ok(result.expired >= 1);
  const expired = await db.evidence.findUnique({
    where: { id: uploaded.data.id },
  });
  assert.equal(expired.status, "REJECTED");
  assert.ok(
    await db.auditEvent.findFirst({
      where: { objectId: expired.id, action: "EVIDENCE_STAGE_EXPIRED" },
    }),
  );
  assert.equal(
    (await req(`/projects/${project.id}/evidence/${expired.id}/download`))
      .status,
    404,
  );
  assert.deepEqual(
    (
      await req(
        `/projects/${project.id}/evidence/${historicalEvidence.id}/download`,
      )
    ).data,
    pdf,
  );
});
test("Evidencia exige CSRF y no permite reescribir identidad ni añadir archivos a una revisión histórica", async () => {
  const q = of("YES_NO");
  const raw = await fetch(base + path(q) + "/evidence", {
    method: "POST",
    headers: {
      Origin: origin,
      "Content-Type": "application/octet-stream",
      Cookie: stakeholder.cookie,
      "X-Evidence-Metadata": encodeURIComponent(
        JSON.stringify({ requestId: randomUUID(), originalName: "test.pdf" }),
      ),
    },
    body: pdf,
  });
  assert.equal(raw.status, 403);
  const e = await db.evidence.findUnique({
    where: { id: historicalEvidence.id },
  });
  await assert.rejects(
    db.evidence.update({
      where: { id: e.id },
      data: { storageKey: randomUUID() },
    }),
  );
  await assert.rejects(
    db.response.update({
      where: { id: e.responseId },
      data: { respondentId: other.user.id },
    }),
  );
  const uploaded = await stage(of("SHORT_TEXT"));
  assert.equal(uploaded.status, 201);
  await attach(of("SHORT_TEXT"), uploaded.data);
  await assert.rejects(
    db.revisionEvidence.create({
      data: {
        projectId: project.id,
        responseRevisionId: historicalRevision.id,
        evidenceId: uploaded.data.id,
      },
    }),
  );
  assert.equal(await db.validation.count(), 0);
  assert.equal(await db.clarificationThread.count(), 0);
});
test("Descarga deniega proyecto ajeno, otra persona, viewer, asignación retirada y sesión revocada", async () => {
  const url = `/projects/${project.id}/evidence/${historicalEvidence.id}/download`;
  for (const session of [other, viewer])
    assert.equal((await req(url, { session })).status, 404);
  // Deployment tenant check rejects a foreign session before domain lookup.
  assert.equal(
    (await req(url, { session: foreignOrganizationSession })).status,
    401,
  );
  process.env.ORGANIZATION_CODE = "TEST-ISOLATED";
  try {
    // With a valid session in its own tenant, the foreign evidence stays hidden.
    assert.equal(
      (await req("/auth/me", { session: foreignOrganizationSession })).status,
      200,
    );
    assert.equal(
      (await req(url, { session: foreignOrganizationSession })).status,
      404,
    );
  } finally {
    process.env.ORGANIZATION_CODE = "DEFAULT";
  }
  assert.equal(
    (
      await req(
        `/projects/${otherProject.id}/evidence/${historicalEvidence.id}/download`,
      )
    ).status,
    404,
  );
  const q = of("SHORT_TEXT"),
    current = (
      await ok(`/projects/${project.id}/questionnaire`, { session: analyst })
    ).questions.find((x) => x.id === q.id);
  await ok(path(q) + "/assign", {
    session: analyst,
    method: "POST",
    body: {
      projectMemberId: member.id,
      active: false,
      required: true,
      expectedVersion: current.lockVersion,
    },
  });
  assert.equal((await req(url)).status, 404);
  assert.equal(
    (
      await req(path(q) + "/response/submit", {
        method: "POST",
        body: { requestId: randomUUID(), expectedVersion: 0 },
      })
    ).status,
    404,
  );
  const stillAssigned = `/projects/${project.id}/questions/${of("NUMBER").id}/response`;
  await ok("/auth/logout", { method: "POST" });
  assert.equal((await req(url)).status, 401);
  stakeholder = await login("stakeholder");
  await ok(`/users/${stakeholder.user.id}/set-active`, {
    session: admin,
    method: "POST",
    body: { active: false },
  });
  assert.equal((await req(stillAssigned)).status, 401);
});
