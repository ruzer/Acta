// Destructive only to a NEW, explicitly opted-in disposable installation.
import "./runtime-env.mjs";
import assert from "node:assert/strict";
import { randomBytes, randomUUID, createHash } from "node:crypto";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { PDFDocument } from "pdf-lib";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { S3Client, CreateBucketCommand } from "@aws-sdk/client-s3";
import { s3Configuration } from "../app/backend/dist/responses/s3-storage.js";
if (process.env.SELFHOST_SMOKE_ALLOWED !== "true")
  throw Error("Explicit disposable-installation opt-in required");
const file = "/app/.private-evidence/selfhost-smoke.json";
const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});
const origin = process.env.APP_ORIGIN;
const base = "http://frontend:8080/api/v1";
const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
async function raw(path, session, method = "GET", body, headers = {}) {
  return fetch(base + path, {
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
      : {
          body: body instanceof Uint8Array ? body : JSON.stringify(body ?? {}),
        }),
  });
}
async function api(path, session, method = "GET", body) {
  const r = await raw(path, session, method, body);
  assert.ok(
    r.ok,
    `${method} ${path}: ${r.status} ${(await r.clone().json()).message || ""}`,
  );
  return r.json();
}
async function login(username, password) {
  const r = await raw("/auth/login", null, "POST", { username, password });
  assert.equal(r.status, 201);
  const data = await r.json();
  return {
    cookie: r.headers.get("set-cookie").split(";")[0],
    csrf: data.csrfToken,
  };
}
async function change(username, password) {
  let session = await login(username, password);
  const permanent = randomBytes(32).toString("base64url");
  await api("/auth/change-password", session, "POST", {
    currentPassword: password,
    newPassword: permanent,
  });
  session = await login(username, permanent);
  return { session, password: permanent };
}
try {
  assert.equal((await api("/health")).storage, "ok");
  const branding = await api("/configuration/public");
  assert.equal(branding.appName, process.env.APP_NAME);
  assert.ok(!("S3_SECRET_KEY" in branding));
  let state;
  if (process.argv.includes("--verify")) {
    state = JSON.parse(readFileSync(file, "utf8"));
  } else {
    assert.equal(
      await db.user.count(),
      0,
      "The smoke test requires an empty installation",
    );
    const temporary = randomBytes(32).toString("base64url");
    const input = {
      username: "installation_admin",
      displayName: "Installation test administrator",
      temporaryPassword: temporary,
    };
    const result = spawnSync(
      process.execPath,
      ["scripts/bootstrap-admin.mjs"],
      { input: JSON.stringify(input), encoding: "utf8", env: process.env },
    );
    assert.equal(result.status, 0, "Bootstrap failed");
    assert.ok(!result.stdout.includes(temporary));
    const repeat = spawnSync(
      process.execPath,
      ["scripts/bootstrap-admin.mjs"],
      { input: JSON.stringify(input), encoding: "utf8", env: process.env },
    );
    assert.notEqual(
      repeat.status,
      0,
      "Bootstrap must not reset an existing admin",
    );
    const { session: admin, password: adminPassword } = await change(
      input.username,
      temporary,
    );
    const area = await api("/areas", admin, "POST", {
      code: "TEST",
      name: "Fictional team",
    });
    const project = await api("/projects", admin, "POST", {
      externalId: "INSTALL-01",
      name: "Fictional installation check",
    });
    const section = await api(
      `/projects/${project.id}/sections`,
      admin,
      "POST",
      {
        externalId: "TOPIC-01",
        title: "Fictional topic",
        description: "",
        order: 0,
      },
    );
    const user = await api("/users", admin, "POST", {
      username: "installation_participant",
      displayName: "Fictional participant",
      temporaryPassword: temporary,
    });
    const { session: participant, password } = await change(
      user.username,
      temporary,
    );
    const member = await api(`/projects/${project.id}/members`, admin, "POST", {
      userId: user.id,
      role: "STAKEHOLDER",
      areaId: area.id,
      active: true,
    });
    let question = await api(
      `/projects/${project.id}/questions`,
      admin,
      "POST",
      {
        externalId: "QUESTION-01",
        sectionId: section.id,
        title: "Fictional process",
        question: "Is the fictional request recorded?",
        type: "YES_NO",
        priority: "P1",
        required: true,
        responsibleAreaId: area.id,
        order: 0,
      },
    );
    question = await api(
      `/projects/${project.id}/questions/${question.id}/assign`,
      admin,
      "POST",
      {
        expectedVersion: question.lockVersion,
        projectMemberId: member.id,
        active: true,
        required: true,
      },
    );
    await api(
      `/projects/${project.id}/questions/${question.id}/publish`,
      admin,
      "POST",
      { expectedVersion: question.lockVersion },
    );
    const path = `/projects/${project.id}/questions/${question.id}`;
    let response = await api(path + "/response/draft", participant, "PUT", {
      expectedVersion: 0,
      requestId: randomUUID(),
      answer: true,
      comment: "Fictional installation evidence",
      example: "",
      consultationRequested: false,
    });
    const pdf = await PDFDocument.create();
    pdf.addPage().drawText("FICTIONAL INSTALLATION CHECK");
    const bytes = await pdf.save();
    const uploaded = await raw(path + "/evidence", participant, "POST", bytes, {
      "Content-Type": "application/octet-stream",
      "X-Evidence-Metadata": encodeURIComponent(
        JSON.stringify({
          requestId: randomUUID(),
          originalName: "installation-check.pdf",
        }),
      ),
    });
    assert.equal(uploaded.status, 201);
    const evidence = await uploaded.json();
    response = await api(path + "/response", participant);
    response = await api(
      path + "/response/evidence/attach",
      participant,
      "POST",
      {
        expectedVersion: response.lockVersion,
        requestId: randomUUID(),
        evidenceId: evidence.id,
      },
    );
    response = await api(path + "/response/submit", participant, "POST", {
      expectedVersion: response.lockVersion,
      requestId: randomUUID(),
    });
    assert.equal(response.revisions.length, 1);
    const reviewer = await api("/users", admin, "POST", {
      username: "installation_analyst",
      displayName: "Fictional analyst",
      temporaryPassword: temporary,
    });
    await api(`/projects/${project.id}/members`, admin, "POST", {
      userId: reviewer.id,
      role: "ANALYST",
      areaId: null,
      active: true,
    });
    const { session: analyst, password: analystPassword } = await change(
      reviewer.username,
      temporary,
    );
    const review = await api(path + "/review", analyst);
    await api(path + "/review/validate", analyst, "POST", {
      requestId: randomUUID(),
      expectedVersion: review.lockVersion,
      decisionText: "Fictional installation decision",
      scope: "Installation persistence check",
      exceptions: "",
      validationComment: "Verified against submitted evidence",
      responseRevisionIds: [response.revisions[0].id],
      clarificationMessageIds: [],
      conflictResolutionIds: [],
    });
    const validated = await api(path + "/review", analyst);
    assert.equal(validated.status, "VALIDATED");
    assert.equal(
      (await db.evidence.findUnique({ where: { id: evidence.id } })).backend,
      "S3",
    );
    assert.equal(
      await db.auditEvent.count({
        where: { action: "INSTALLATION_BOOTSTRAPPED" },
      }),
      1,
    );
    const outsider = await api("/users", admin, "POST", {
      username: "installation_outsider",
      displayName: "Fictional unassigned user",
      temporaryPassword: temporary,
    });
    const { session: outsiderSession } = await change(
      outsider.username,
      temporary,
    );
    assert.ok(
      [403, 404].includes(
        (
          await raw(path + "/response/draft", outsiderSession, "PUT", {
            expectedVersion: 0,
            requestId: randomUUID(),
            answer: true,
            comment: "",
            example: "",
            consultationRequested: false,
          })
        ).status,
      ),
    );
    assert.ok(
      [403, 404].includes(
        (
          await raw(
            `/projects/${project.id}/evidence/${evidence.id}/download`,
            outsiderSession,
          )
        ).status,
      ),
    );
    const other = await api("/projects", admin, "POST", {
      externalId: "OTHER-01",
      name: "Other fictional project",
    });
    assert.ok(
      [403, 404].includes(
        (
          await raw(
            `/projects/${other.id}/evidence/${evidence.id}/download`,
            participant,
          )
        ).status,
      ),
    );
    state = {
      username: user.username,
      password,
      adminUsername: input.username,
      adminPassword,
      projectId: project.id,
      questionId: question.id,
      evidenceId: evidence.id,
      validationId: validated.validations[0].id,
      analystUsername: reviewer.username,
      analystPassword,
      sha256: digest(bytes),
    };
    writeFileSync(file, JSON.stringify(state), { mode: 0o600 });
  }
  const participant = await login(state.username, state.password);
  const response = await api(
    `/projects/${state.projectId}/questions/${state.questionId}/response`,
    participant,
  );
  assert.equal(response.revisions[0].answer, true);
  assert.equal(response.revisions[0].evidence[0].evidence.id, state.evidenceId);
  const path = `/projects/${state.projectId}/evidence/${state.evidenceId}/download`;
  const downloaded = await raw(path, participant);
  assert.equal(downloaded.status, 200);
  assert.equal(
    digest(new Uint8Array(await downloaded.arrayBuffer())),
    state.sha256,
  );
  assert.equal((await raw(path)).status, 401);
  await login(state.adminUsername, state.adminPassword);
  const analyst = await login(state.analystUsername, state.analystPassword);
  const review = await api(
    `/projects/${state.projectId}/questions/${state.questionId}/review`,
    analyst,
  );
  assert.equal(review.status, "VALIDATED");
  const validation = review.validations.find((v) => v.id === state.validationId);
  assert.ok(validation, "The original validated decision must persist");
  assert.equal(validation.invalidatedAt, null);
  assert.equal(validation.decisionText, "Fictional installation decision");
  assert.deepEqual(
    validation.sources.map((source) => source.responseRevisionId),
    [response.revisions[0].id],
  );
  const s3 = s3Configuration();
  const client = new S3Client(s3.options);
  await assert.rejects(
    () =>
      client.send(
        new CreateBucketCommand({ Bucket: "forbidden-" + randomUUID() }),
      ),
    (error) => error.$metadata?.httpStatusCode === 403,
  );
  assert.equal(
    (await fetch(`${s3.options.endpoint}/${s3.bucket}`)).status,
    403,
  );
  assert.equal(
    existsSync("/run/db-secrets/owner"),
    false,
    "Runtime API must not mount DB owner credentials",
  );
  console.log(
    JSON.stringify({
      result: "PASS",
      mode: process.argv.includes("--verify")
        ? "verify-persistence"
        : "clean-install",
      checks: [
        "health",
        "private-bucket",
        "scoped-s3-account",
        ...(process.argv.includes("--verify")
          ? ["persisted-response", "persisted-decision-and-source", "persisted-evidence-sha256"]
          : [
              "bootstrap-once",
              "project",
              "question",
              "response",
              "evidence-upload-download-sha256",
              "validated-decision-and-source",
              "unassigned-denied",
              "project-isolation",
            ]),
        "login",
        "anonymous-denied",
        "runtime-no-db-owner",
      ],
      projectId: state.projectId,
    }),
  );
} finally {
  await db.$disconnect();
}
