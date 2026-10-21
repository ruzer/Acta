// Requires the disposable installation created by selfhost-smoke.mjs.
import "./runtime-env.mjs";
import assert from "node:assert/strict";
import { randomUUID, createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { PDFDocument } from "pdf-lib";
assert.equal(
  process.env.SELFHOST_SMOKE_ALLOWED,
  "true",
  "Disposable installation opt-in required",
);
const account = JSON.parse(
  readFileSync("/app/.private-evidence/selfhost-smoke.json", "utf8"),
);
const file = "/app/.private-evidence/invitation-proxy-smoke.json";
const base = "http://frontend:8080/api/v1";
const origin = process.env.APP_ORIGIN;
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
      ...(session?.id ? { "X-Invitation-Id": session.id } : {}),
      ...headers,
    },
    ...(method === "GET"
      ? {}
      : {
          body: body instanceof Uint8Array ? body : JSON.stringify(body ?? {}),
        }),
  });
}
async function api(path, session, method, body) {
  const result = await raw(path, session, method, body);
  assert.ok(result.ok, `Invitation proxy request failed: ${result.status}`);
  assert.equal(result.headers.get("cache-control"), "no-store");
  return result.json();
}
async function open(url) {
  const result = await raw("/invitations/access/exchange", null, "POST", {
    token: new URL(url).hash.slice(1),
  });
  assert.equal(result.status, 201);
  const cookie = result.headers.get("set-cookie");
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /SameSite=Strict/);
  assert.match(cookie, /Path=\/api\/v1\/invitations\/access/);
  const view = await result.json();
  return {
    cookie: cookie.split(";")[0],
    csrf: view.csrfToken,
    id: view.invitationId,
  };
}
let state;
if (process.argv.includes("--verify")) {
  state = JSON.parse(readFileSync(file, "utf8"));
} else {
  assert.ok(!existsSync(file), "Do not overwrite an existing smoke fixture");
  const logged = await raw("/auth/login", null, "POST", {
    username: account.adminUsername,
    password: account.adminPassword,
  });
  assert.equal(logged.status, 201);
  const admin = {
    cookie: logged.headers.get("set-cookie").split(";")[0],
    csrf: (await logged.json()).csrfToken,
  };
  const graph = await api(
    `/projects/${account.projectId}/questionnaire`,
    admin,
  );
  const member = (
    await api(`/projects/${account.projectId}/members`, admin)
  ).find((m) => m.username === account.username);
  let q = await api(`/projects/${account.projectId}/questions`, admin, "POST", {
    externalId: "INVITATION-SMOKE",
    sectionId: graph.sections[0].id,
    title: "Fictional external contribution",
    question: "What would you improve in this fictional example?",
    type: "SHORT_TEXT",
    priority: "P2",
    required: true,
    responsibleAreaId: member.areaId,
    order: graph.questions.length,
  });
  q = await api(
    `/projects/${account.projectId}/questions/${q.id}/assign`,
    admin,
    "POST",
    {
      expectedVersion: q.lockVersion,
      projectMemberId: member.id,
      active: true,
      required: true,
    },
  );
  await api(
    `/projects/${account.projectId}/questions/${q.id}/publish`,
    admin,
    "POST",
    { expectedVersion: q.lockVersion },
  );
  const link = await api(
    `/projects/${account.projectId}/invitations`,
    admin,
    "POST",
    {
      requestId: randomUUID(),
      label: "Fictional proxy check",
      questionIds: [q.id],
      areaId: member.areaId,
      identity: { name: "Example External Respondent" },
      nonNominal: false,
      allowEvidence: true,
    },
  );
  const session = await open(link.url);
  const path = `/invitations/access/questions/${q.id}`;
  await api(path + "/draft", session, "PUT", {
    requestId: randomUUID(),
    expectedVersion: 0,
    answer: "Persistent external contribution",
    comment: "",
    example: "",
    consultationRequested: false,
  });
  const pdf = await PDFDocument.create();
  pdf.addPage().drawText("FICTIONAL INVITATION PROXY CHECK");
  const bytes = await pdf.save();
  const uploaded = await raw(path + "/evidence", session, "POST", bytes, {
    "Content-Type": "application/octet-stream",
    "X-Evidence-Metadata": encodeURIComponent(
      JSON.stringify({
        requestId: randomUUID(),
        originalName: "external-example.pdf",
      }),
    ),
  });
  assert.equal(uploaded.status, 201);
  const evidence = await uploaded.json();
  await api(path + "/evidence/attach", session, "POST", {
    requestId: randomUUID(),
    expectedVersion: 1,
    evidenceId: evidence.id,
  });
  state = {
    url: link.url,
    session,
    questionId: q.id,
    evidenceId: evidence.id,
    sha256: digest(bytes),
  };
  writeFileSync(file, JSON.stringify(state), { mode: 0o600 });
}
const path = `/invitations/access/questions/${state.questionId}`;
let response = await api(path, state.session);
assert.equal(
  (response.draft || response.revisions[0]).answer,
  "Persistent external contribution",
);
const renewedSession = await open(state.url);
assert.deepEqual(await api(path, renewedSession), response);
assert.equal((await raw("/users", state.session)).status, 401);
assert.equal(
  (
    await raw(
      `/invitations/access/questions/${account.questionId}`,
      state.session,
    )
  ).status,
  404,
);
const downloadPath = `/invitations/access/evidence/${state.evidenceId}/download`;
const download = await raw(downloadPath, state.session);
assert.equal(download.status, 200);
assert.equal(download.headers.get("x-content-type-options"), "nosniff");
assert.equal(download.headers.get("cache-control"), "no-store");
assert.equal(
  digest(new Uint8Array(await download.arrayBuffer())),
  state.sha256,
);
assert.equal((await raw(downloadPath)).status, 401);
const wrongOrigin = await raw(
  path + "/submit",
  state.session,
  "POST",
  { requestId: randomUUID(), expectedVersion: response.lockVersion },
  { Origin: "https://untrusted.example.test" },
);
assert.equal(wrongOrigin.status, 403);
if (process.argv.includes("--verify") && response.draft) {
  response = await api(path + "/submit", state.session, "POST", {
    requestId: randomUUID(),
    expectedVersion: response.lockVersion,
  });
  assert.equal(response.revisions.length, 1);
  assert.equal(response.revisions[0].evidence[0].evidence.sha256, state.sha256);
}
console.log(
  JSON.stringify({
    gate: "invitation-proxy",
    restart: process.argv.includes("--verify"),
    session: "preserved",
    draft: "preserved",
    evidence: "sha256-verified",
    privateRoutes: "denied",
    foreignQuestion: "denied",
    foreignOrigin: "denied",
  }),
);
