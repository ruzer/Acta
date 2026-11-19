// Solo datos ficticios nuevos en un laboratorio local autorizado explícitamente.
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { pathToFileURL } from "node:url";

export function loadConfiguration(env) {
  assert.equal(
    env.ACTA_DRAFT_LOAD_ALLOWED,
    "true",
    "Falta autorización del laboratorio descartable.",
  );
  const origin = new URL(env.APP_ORIGIN);
  assert.ok(
    origin.protocol === "http:" &&
      ["127.0.0.1", "localhost"].includes(origin.hostname) &&
      origin.port &&
      origin.pathname === "/" &&
      !origin.username &&
      !origin.password &&
      !origin.search &&
      !origin.hash,
    "Se requiere un origen local con puerto propio.",
  );
  assert.ok(
    env.ACTA_LOAD_ADMIN_PASSWORD,
    "Falta ACTA_LOAD_ADMIN_PASSWORD, desde un archivo privado.",
  );
  const mode = env.ACTA_DRAFT_LOAD_MODE ?? "simultaneous";
  assert.ok(
    ["simultaneous", "paced"].includes(mode),
    "Modo de medición no admitido.",
  );
  return {
    origin: origin.origin,
    password: env.ACTA_LOAD_ADMIN_PASSWORD,
    mode,
  };
}
export async function scheduleDraftWrites(write, mode) {
  assert.ok(
    ["simultaneous", "paced"].includes(mode),
    "Modo de medición no admitido.",
  );
  const results = [],
    pending = Array.from({ length: 50 }, () => Promise.resolve());
  const count = mode === "paced" ? 100 : 50;
  const start = performance.now();
  for (let n = 0; n < count; n++) {
    if (mode === "paced" && n > 0)
      await new Promise((resolve) =>
        setTimeout(resolve, Math.max(0, start + n * 600 - performance.now())),
      );
    const person = n % 50,
      round = Math.floor(n / 50);
    // Una cuenta termina su primer guardado antes del segundo, incluso si el servidor tarda.
    const result = pending[person].then(() => write(person, round));
    pending[person] = result;
    results.push(result);
  }
  return Promise.all(results);
}
export function summarizeDraftWrites(results) {
  assert.ok(
    results.length &&
      results.every(
        (r) => Number.isFinite(r.ms) && r.ms >= 0 && Number.isInteger(r.status),
      ),
    "Medición incompleta.",
  );
  const sorted = results.map((r) => r.ms).sort((a, b) => a - b);
  return {
    requests: results.length,
    successful: results.filter((r) => r.status >= 200 && r.status < 300).length,
    http: Object.fromEntries(
      [...new Set(results.map((r) => r.status))].map((s) => [
        s,
        results.filter((r) => r.status === s).length,
      ]),
    ),
    minMs: sorted[0],
    medianMs:
      (sorted[Math.floor((sorted.length - 1) / 2)] +
        sorted[Math.floor(sorted.length / 2)]) /
      2,
    p95Ms: sorted[Math.ceil(sorted.length * 0.95) - 1],
    maxMs: sorted.at(-1),
  };
}
async function run(options) {
  const base = options.origin + "/api/v1";
  async function raw(path, session, method = "GET", body, headers = {}) {
    return fetch(base + path, {
      method,
      signal: AbortSignal.timeout(120000),
      headers: {
        Origin: options.origin,
        "Content-Type": "application/json",
        ...(session
          ? { Cookie: session.cookie, "X-CSRF-Token": session.csrf }
          : {}),
        ...headers,
      },
      ...(method === "GET"
        ? {}
        : {
            body: typeof body === "string" ? body : JSON.stringify(body ?? {}),
          }),
    });
  }
  async function api(path, session, method = "GET", body, headers) {
    const response = await raw(path, session, method, body, headers);
    assert.ok(response.ok, `${method} ${path}: ${response.status}`);
    return response.json();
  }
  async function login(username, password) {
    const response = await raw("/auth/login", null, "POST", {
      username,
      password,
    });
    assert.equal(
      response.status,
      201,
      "No se pudo iniciar la sesión de laboratorio.",
    );
    const data = await response.json();
    return {
      cookie: response.headers.get("set-cookie").split(";")[0],
      csrf: data.csrfToken,
    };
  }
  const admin = await login("admin", options.password);
  const suffix = randomUUID().slice(0, 8),
    code = `LOAD-${suffix}`;
  const project = await api("/projects", admin, "POST", {
    externalId: code,
    name: "Medición ficticia de guardados",
  });
  const area = await api("/areas", admin, "POST", {
    code,
    name: "Equipo ficticio de medición",
  });
  const text =
    "Usuario\tNombre\tProyecto\tRol\tÁrea\n" +
    Array.from(
      { length: 50 },
      (_, i) =>
        `load_${suffix}_${i}\tPersona ficticia ${i + 1}\t${code}\tParticipante\t${code}`,
    ).join("\n");
  const preview = await api("/users/bulk/preview", admin, "POST", { text });
  assert.equal(preview.canConfirm, true);
  const users = await api("/users/bulk/confirm", admin, "POST", {
    text,
    requestId: randomUUID(),
    previewHash: preview.previewHash,
  });
  assert.equal(users.delivery, "NEW");
  assert.equal(users.credentials.length, 50);
  const sessions = [];
  for (const user of users.credentials) {
    const initial = await login(user.username, user.temporaryPassword),
      password = randomBytes(24).toString("base64url");
    await api("/auth/change-password", initial, "POST", {
      currentPassword: user.temporaryPassword,
      newPassword: password,
    });
    sessions.push(await login(user.username, password));
  }
  const template = JSON.stringify({
    formatVersion: "1.0",
    kind: "questionnaire-template",
    project: { externalId: code, name: project.name },
    areas: [{ code, name: area.name }],
    sections: [{ externalId: "TEMA", title: "Medición ficticia", order: 0 }],
    questions: Array.from({ length: 300 }, (_, i) => ({
      externalId: `LOAD-${i}`,
      sectionExternalId: "TEMA",
      title: `Actividad ${i + 1}`,
      question: `Describe la actividad ficticia ${i + 1}.`,
      type: "LONG_TEXT",
      required: true,
      priority: "P2",
      responsibleAreaCode: code,
      order: i,
      options: [],
      references: [],
    })),
    conditions: [],
    traceabilityReferences: [],
  });
  const imported = await api(
    `/projects/${project.id}/imports/preview`,
    admin,
    "POST",
    template,
    { "Content-Type": "application/octet-stream" },
  );
  assert.deepEqual(imported.errors, []);
  await api(
    `/projects/${project.id}/imports/confirm`,
    admin,
    "POST",
    template,
    {
      "Content-Type": "application/octet-stream",
      "X-Import-Command": encodeURIComponent(
        JSON.stringify({
          payloadHash: imported.payloadHash,
          expectedProjectVersion: imported.expectedProjectVersion,
          requestId: randomUUID(),
          createMissingAreas: false,
        }),
      ),
    },
  );
  const questionnaire = () =>
    api(`/projects/${project.id}/questionnaire`, admin);
  const members = (await api(`/projects/${project.id}/members`, admin)).filter(
    (m) => m.role === "STAKEHOLDER",
  );
  assert.equal(members.length, 50);
  async function bulk(kind, extra = {}) {
    const graph = await questionnaire();
    const input = {
      requestId: randomUUID(),
      questions: graph.questions.map((q) => ({
        id: q.id,
        expectedVersion: q.lockVersion,
      })),
      ...extra,
    };
    const reviewed = await api(
      `/projects/${project.id}/questions/bulk/${kind}/preview`,
      admin,
      "POST",
      input,
    );
    assert.equal(reviewed.canConfirm, true);
    return api(
      `/projects/${project.id}/questions/bulk/${kind}/confirm`,
      admin,
      "POST",
      { ...input, previewHash: reviewed.previewHash },
    );
  }
  for (let i = 0; i < 50; i += 20)
    await bulk("participants", {
      participants: members
        .slice(i, i + 20)
        .map((m) => ({ projectMemberId: m.id, required: true })),
    });
  await bulk("publish");
  const graph = await questionnaire();
  assert.equal(graph.questions.length, 300);
  assert.equal(
    graph.questions.filter((q) => q.publication === "PUBLISHED").length,
    300,
  );
  console.log(
    JSON.stringify({
      stage: "fixture",
      questions: 300,
      participants: 50,
      assignments: 15000,
      projectId: project.id,
    }),
  );
  const body = (
    answer,
    expectedVersion = 0,
    consultationRequested = false,
  ) => ({
    answer,
    expectedVersion,
    consultationRequested,
    comment: "",
    example: "",
    requestId: randomUUID(),
  });
  const start = performance.now();
  const versions = Array(50).fill(0);
  const results = await scheduleDraftWrites(async (i, round) => {
    const t = performance.now();
    try {
      const r = await raw(
        `/projects/${project.id}/questions/${graph.questions[i].id}/response/draft`,
        sessions[i],
        "PUT",
        body(`Borrador ficticio ${i + 1}, ronda ${round + 1}`, versions[i]),
      );
      if (r.ok) versions[i] = (await r.json()).lockVersion;
      else await r.arrayBuffer();
      return { status: r.status, ms: performance.now() - t };
    } catch {
      return { status: 0, ms: performance.now() - t };
    }
  }, options.mode);
  console.log(
    JSON.stringify({
      stage: options.mode === "paced" ? "paced-drafts" : "concurrent-drafts",
      rounds: options.mode === "paced" ? 2 : 1,
      intervalMs: options.mode === "paced" ? 600 : 0,
      questions: 300,
      participants: 50,
      elapsedMs: performance.now() - start,
      ...summarizeDraftWrites(results),
    }),
  );
  // Una solicitud de consulta en el borrador sí cambia la proyección del mismo conjunto de datos.
  const q = graph.questions[299],
    responsePath = `/projects/${project.id}/questions/${q.id}/response`;
  const before = await questionnaire();
  const response = await api(responsePath, sessions[0]);
  await api(
    responsePath + "/draft",
    sessions[0],
    "PUT",
    body("Necesito consultar un dato ficticio", response.lockVersion, true),
  );
  const after = await questionnaire();
  const changes = before.questions
    .filter(
      (q) => after.questions.find((a) => a.id === q.id).status !== q.status,
    )
    .map((q) => ({
      before: q.status,
      after: after.questions.find((a) => a.id === q.id).status,
    }));
  assert.equal(
    changes.length,
    1,
    "La prueba debe demostrar el efecto real de consulta en un borrador.",
  );
  assert.equal(changes[0].after, "PENDING");
  console.log(
    JSON.stringify({
      stage: "projection",
      changed: changes,
      decision:
        "Se conserva recomputeReview: los borradores pueden cambiar estados.",
    }),
  );
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  await run(loadConfiguration(process.env));
