// Solo fixtures descartables: no opera sobre una instalación institucional.
import assert from "node:assert/strict";
import { execFile, execFileSync } from "node:child_process";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { lstatSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { outputPath, checkConfig } from "./backup-manifest.mjs";

export function argumentsForRehearsal(args) {
  const options = {};
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i];
    assert.ok(
      ["--phase", "--root", "--project", "--origin", "--state"].includes(key),
      "Argumento no admitido.",
    );
    assert.ok(
      args[i + 1] && !options[key.slice(2)],
      "Falta valor o argumento repetido.",
    );
    options[key.slice(2)] = args[i + 1];
  }
  assert.ok(
    ["prepare", "verify", "measure"].includes(options.phase),
    "Fase requerida: prepare, verify o measure.",
  );
  assert.match(
    options.project || "",
    /^acta-upgrade-[a-z0-9][a-z0-9-]{0,50}$/,
    "Use un proyecto exclusivo acta-upgrade-…",
  );
  const origin = new URL(options.origin || "invalid");
  assert.ok(
    origin.protocol === "http:" &&
      origin.hostname === "127.0.0.1" &&
      origin.port &&
      origin.pathname === "/" &&
      !origin.username &&
      !origin.password &&
      !origin.search &&
      !origin.hash,
    "Origen local requerido: http://127.0.0.1:PUERTO.",
  );
  assert.ok(options.root && options.state, "Faltan --root o --state.");
  return {
    ...options,
    root: resolve(options.root),
    state: resolve(options.state),
    origin: origin.origin,
  };
}

export const responseDeadlineMigration = "202611180001_response_due_at";
export function rehearsalBase(version) {
  assert.ok(
    ["0.10.0", "0.11.0", "0.12.0"].includes(version),
    "La base debe ser v0.10.0, v0.11.0 o v0.12.0 publicada.",
  );
  return { migrationCount: version === "0.12.0" ? 14 : 13,
    alreadyHasDeadline: version === "0.12.0" };
}
export function verifyRehearsalMigrations(before, after, baseVersion = "0.11.0") {
  const base = rehearsalBase(baseVersion);
  assert.equal(before.length, base.migrationCount, "Migraciones inesperadas en la base publicada.");
  assert.equal(new Set(before).size, before.length, "Migraciones duplicadas en la base.");
  assert.equal(before.includes(responseDeadlineMigration), base.alreadyHasDeadline,
    "La migración de fecha límite no corresponde a la base.");
  assert.deepEqual(
    [...after].sort(),
    (base.alreadyHasDeadline ? [...before] : [...before, responseDeadlineMigration]).sort(),
    base.alreadyHasDeadline ? "Desde v0.12.0 deben conservarse las 14 migraciones, sin nuevas."
      : "Solo se admite la migración aditiva de fecha límite (13 → 14).",
  );
}

// Auth cambia con cada acceso; no forma parte de la huella de contenido de negocio.
const volatileTables = new Set([
  "Session",
  "InvitationSession",
  "LoginAttempt",
  "InvitationRateBucket",
]);
export function compareSnapshots(before, after) {
  assert.deepEqual(
    Object.keys(after).sort(),
    Object.keys(before).sort(),
    "Cambió el conjunto de tablas.",
  );
  for (const [table, rows] of Object.entries(before)) {
    if (table === "AuditEvent") {
      assert.ok(
        rows.every((row) => after[table].includes(row)),
        "Se alteró la auditoría previa.",
      );
    } else
      assert.deepEqual(
        after[table],
        rows,
        `Cambió contenido persistido: ${table}`,
      );
  }
}

async function run(options) {
  assert.equal(
    process.env.ACTA_UPGRADE_REHEARSAL_ALLOWED,
    "true",
    "Falta autorización explícita del laboratorio descartable.",
  );
  assert.ok(
    !process.env.COMPOSE_FILE &&
      !process.env.COMPOSE_PROFILES &&
      !process.env.COMPOSE_ENV_FILES,
    "No use overrides de Compose desde el entorno.",
  );
  const parent = lstatSync(dirname(options.state));
  assert.ok(
    parent.isDirectory() && (parent.mode & 0o777) === 0o700,
    "El directorio privado debe tener modo 700.",
  );
  if (options.phase === "prepare") await outputPath(options.state);
  else {
    const file = lstatSync(options.state);
    assert.ok(
      file.isFile() && (file.mode & 0o777) === 0o600,
      "El estado privado debe ser un archivo regular con modo 600.",
    );
  }
  const compose = [
    "compose",
    "--project-directory",
    options.root,
    "--env-file",
    join(options.root, ".env"),
    "-p",
    options.project,
    "-f",
    join(options.root, "docker-compose.yml"),
  ];
  for (const name of readdirSync(options.root)
    .filter((n) => /^docker-compose\.override.*\.yml$/.test(n))
    .sort())
    compose.push("-f", join(options.root, name));
  const dc = (...args) =>
    execFileSync("docker", [...compose, ...args], {
      encoding: "utf8",
      maxBuffer: 32 * 1024 * 1024,
      stdio: ["pipe", "pipe", "pipe"],
    });
  const config = JSON.parse(dc("config", "--format", "json"));
  checkConfig(config, options.project);
  assert.equal(
    config.services.backend.environment.APP_ORIGIN,
    options.origin,
    "El origen no coincide con el proyecto.",
  );
  assert.equal(
    String(config.services.frontend.ports[0].published),
    new URL(options.origin).port,
  );
  assert.equal(config.services.frontend.ports[0].host_ip, "127.0.0.1");
  for (const suffix of [
    "pgdata",
    "objectdata",
    "evidence",
    "db-secrets",
    "api-secrets",
    "object-secrets",
    "provision-secrets",
  ]) {
    const owner = execFileSync(
      "docker",
      [
        "volume",
        "inspect",
        "-f",
        '{{index .Labels "com.docker.compose.project"}}',
        `${options.project}_${suffix}`,
      ],
      { encoding: "utf8" },
    ).trim();
    assert.equal(owner, options.project, "Volumen ajeno al laboratorio.");
  }
  const raw = (path, session, method = "GET", body, headers = {}) =>
    fetch(options.origin + "/api/v1" + path, {
      method,
      headers: {
        Origin: options.origin,
        "Content-Type": "application/json",
        ...(session
          ? { Cookie: session.cookie, "X-CSRF-Token": session.csrf }
          : {}),
        ...headers,
      },
      ...(body === undefined
        ? {}
        : { body: body instanceof Uint8Array ? body : JSON.stringify(body) }),
      signal: AbortSignal.timeout(30000),
    });
  const api = async (path, session, method, body) => {
    const response = await raw(path, session, method, body);
    assert.ok(
      response.ok,
      `API del ensayo: ${method || "GET"} ${path}, HTTP ${response.status}`,
    );
    return response.json();
  };
  const login = async (username, password) => {
    const response = await raw("/auth/login", null, "POST", {
      username,
      password,
    });
    assert.equal(response.status, 201, "No se pudo iniciar sesión.");
    const headers = response.headers.getSetCookie();
    const cookie = headers.find(
      (h) =>
        /^(acta|fgeo)_session=.+/.test(h) && !h.startsWith("fgeo_session=;"),
    );
    assert.ok(cookie, "No se emitió una cookie de cuenta.");
    return {
      cookie: cookie.split(";")[0],
      csrf: (await response.json()).csrfToken,
      headers,
    };
  };
  const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
  const sql = (query) =>
    dc(
      "exec",
      "-T",
      "postgres",
      "psql",
      "-X",
      "-U",
      "requirements_owner",
      "-d",
      "requirements",
      "-v",
      "ON_ERROR_STOP=1",
      "-Atc",
      query,
    ).trim();
  const migrationNames = () =>
    sql(
      'SELECT migration_name FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL ORDER BY migration_name',
    ).split("\n");
  const snapshot = () => {
    const hasDeadline =
      sql(
        "SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='Project' AND column_name='responseDueAt'",
      ) === "1";
    if (hasDeadline && state?.baseVersion !== "0.12.0")
      assert.equal(
        sql('SELECT count(*) FROM "Project" WHERE "responseDueAt" IS NOT NULL'),
        "0",
        "La nueva columna debe ser nula en todo el fixture previo.",
      );
    const tables = sql(
      "SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename",
    ).split("\n");
    const hashes = {};
    for (const table of tables.filter((t) => !volatileTables.has(t))) {
      assert.match(table, /^[A-Za-z_][A-Za-z0-9_]*$/);
      const value =
        table === "Project" && hasDeadline && state?.baseVersion !== "0.12.0"
          ? "(to_jsonb(t)-'responseDueAt')"
          : "to_jsonb(t)";
      const where =
        table === "_prisma_migrations" && state?.baseVersion !== "0.12.0"
          ? `WHERE migration_name <> '${responseDeadlineMigration}'`
          : "";
      const result = sql(
        `SELECT encode(sha256(convert_to(${value}::text,'UTF8')),'hex') FROM "${table}" t ${where} ORDER BY 1`,
      );
      hashes[table] = result ? result.split("\n") : [];
    }
    return hashes;
  };
  const { chromium } = await import("@playwright/test");
  const browser = await chromium.launch();
  const importCsv = async (project, area, session) => {
    const context = await browser.newContext();
    await context.addCookies([
      {
        name: session.cookie.split("=")[0],
        value: session.cookie.split("=")[1],
        url: options.origin,
        httpOnly: true,
        sameSite: "Lax",
      },
    ]);
    const page = await context.newPage();
    page.setDefaultTimeout(30000);
    await page.goto(`${options.origin}/projects/${project.id}/import`);
    const csv =
      "Tema;Código;Pregunta;Texto de ayuda;Tipo;Obligatoria;Área responsable\n" +
      Array.from(
        { length: 300 },
        (_, i) =>
          `Tema ${Math.floor(i / 25) + 1};ENS-${i + 1};¿Cómo se atiende el caso ficticio ${i + 1}?;;Texto corto;Sí;${area.name}`,
      ).join("\n");
    await page.getByLabel("Archivo CSV o JSON").setInputFiles({
      name: "ensayo.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(csv),
    });
    await page
      .getByRole("button", { name: "Revisar archivo", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Confirmar importación", exact: true })
      .click();
    await page
      .getByText("Importación completada: 300 preguntas y 12 temas.", {
        exact: true,
      })
      .waitFor();
    await context.close();
  };
  let state;
  try {
    if (options.phase === "prepare") {
      const baseVersion = JSON.parse(
        readFileSync(join(options.root, "package.json")),
      ).version;
      const base = rehearsalBase(baseVersion);
      const migrations = migrationNames();
      assert.equal(migrations.length, base.migrationCount);
      assert.equal(migrations.includes(responseDeadlineMigration), base.alreadyHasDeadline);
      assert.equal(
        sql('SELECT count(*) FROM "User"'),
        "0",
        "El laboratorio debe estar vacío.",
      );
      writeFileSync(options.state, JSON.stringify({ complete: false }), {
        flag: "wx",
        mode: 0o600,
      });
      for (const [script, args] of [
        ["selfhost-smoke.mjs", []],
        ["invitation-proxy-smoke.mjs", []],
        ["invitation-proxy-smoke.mjs", ["--verify"]],
      ]) {
        dc(
          "exec",
          "-T",
          "-e",
          "SELFHOST_SMOKE_ALLOWED=true",
          "backend",
          "node",
          `scripts/${script}`,
          ...args,
        );
        console.log(`${script} ${args.join(" ")}: PASS`);
      }
      const fixture = JSON.parse(
        dc(
          "exec",
          "-T",
          "backend",
          "cat",
          "/app/.private-evidence/selfhost-smoke.json",
        ),
      );
      const session = await login(fixture.adminUsername, fixture.adminPassword);
      assert.match(
        session.cookie,
        baseVersion === "0.10.0" ? /^fgeo_session=/ : /^acta_session=/,
        "La base debe emitir su cookie real, sin reemplazarla.",
      );
      const project = await api("/projects", session, "POST", {
        externalId: "UPGRADE-CSV",
        name: "Ensayo ficticio de actualización",
        description:
          "300 preguntas ficticias; no usar como contenido institucional.",
      });
      const area = await api("/areas", session, "POST", {
        code: "UPGRADE",
        name: "Equipo ficticio del ensayo",
      });
      const text =
        "Usuario\tNombre\tProyecto\tRol\tÁrea\n" +
        Array.from(
          { length: 5 },
          (_, i) =>
            `ensayo_${i + 1}\tPersona ficticia ${i + 1}\tUPGRADE-CSV\tParticipante\tUPGRADE`,
        ).join("\n");
      const preview = await api("/users/bulk/preview", session, "POST", {
        text,
      });
      assert.equal(preview.canConfirm, true);
      const users = await api("/users/bulk/confirm", session, "POST", {
        text,
        requestId: randomUUID(),
        previewHash: preview.previewHash,
      });
      assert.equal(users.delivery, "NEW");
      const accounts = [];
      for (const item of users.credentials) {
        const initial = await login(item.username, item.temporaryPassword);
        assert.equal(
          (await api("/auth/me", initial)).user.mustChangePassword,
          true,
        );
        const password = randomBytes(24).toString("base64url");
        await api("/auth/change-password", initial, "POST", {
          currentPassword: item.temporaryPassword,
          newPassword: password,
        });
        accounts.push({
          username: item.username,
          password,
          session: await login(item.username, password),
        });
      }
      await importCsv(project, area, session);
      const graph = await api(`/projects/${project.id}/questionnaire`, session);
      assert.equal(graph.questions.length, 300);
      assert.equal(graph.sections.length, 12);
      const members = await api(`/projects/${project.id}/members`, session);
      for (const [index, account] of accounts.entries()) {
        let question = graph.questions[index];
        const path = `/projects/${project.id}/questions/${question.id}`;
        question = await api(path + "/assign", session, "POST", {
          expectedVersion: question.lockVersion,
          projectMemberId: members.find((m) => m.username === account.username)
            .id,
          required: true,
          active: true,
        });
        await api(path + "/publish", session, "POST", {
          expectedVersion: question.lockVersion,
        });
        let response = await api(
          path + "/response/draft",
          account.session,
          "PUT",
          {
            expectedVersion: 0,
            requestId: randomUUID(),
            answer: `Respuesta ficticia ${index + 1}`,
            comment: "",
            example: "",
            consultationRequested: false,
          },
        );
        response = await api(
          path + "/response/submit",
          account.session,
          "POST",
          { expectedVersion: response.lockVersion, requestId: randomUUID() },
        );
        assert.equal(response.revisions.length, 1);
        account.questionId = question.id;
      }
      state = {
        complete: true,
        baseVersion,
        migrations: migrationNames(),
        fixture,
        session,
        accounts,
        projectId: project.id,
        preparedAt: new Date().toISOString(),
      };
    } else {
      state = JSON.parse(readFileSync(options.state, "utf8"));
      assert.equal(
        state.complete,
        true,
        "El estado de origen está incompleto.",
      );
      if (options.phase === "verify")
        verifyRehearsalMigrations(state.migrations, migrationNames(), state.baseVersion);
      compareSnapshots(state.snapshot, snapshot());
    }
    if (options.phase === "measure") {
      // Carga acotada sobre el fixture; nunca repetir sobre una instalación de trabajo.
      const execute = promisify(execFile);
      const services = ["backend", "frontend", "postgres", "object-storage"];
      const ids = services.map((service) => dc("ps", "-q", service).trim());
      assert.ok(ids.every((id) => /^[a-f0-9]{64}$/.test(id)));
      const samples = { idle: [], load: [] };
      const sample = async (phase) => {
        const { stdout } = await execute("docker", [
          "stats",
          "--no-stream",
          "--format",
          "{{json .}}",
          ...ids,
        ]);
        samples[phase].push(
          stdout
            .trim()
            .split("\n")
            .map((row) => JSON.parse(row)),
        );
      };
      for (let i = 0; i < 5; i++) await sample("idle");
      const started = Date.now();
      let rounds = 0;
      let loading = true;
      const sampling = (async () => {
        while (loading) await sample("load");
      })();
      const session = await login(
        state.fixture.adminUsername,
        state.fixture.adminPassword,
      );
      const account = state.accounts[0];
      const sharp = (await import("sharp")).default;
      const bytes = await sharp(randomBytes(1100 * 1100 * 3), {
        raw: { width: 1100, height: 1100, channels: 3 },
      })
        .png()
        .toBuffer();
      assert.ok(bytes.length > 3 * 1024 * 1024);
      let uploaded;
      let csvMs;
      try {
        await Promise.all([
          ...state.accounts.map(async (user) => {
            const path = `/projects/${state.projectId}/questions/${user.questionId}`;
            for (let i = 0; i < 30; i++) {
              await api(`/projects/${state.projectId}/my-work`, user.session);
              let response = await api(path + "/response", user.session);
              response = await api(
                path + "/response/draft",
                user.session,
                "PUT",
                {
                  expectedVersion: response.lockVersion,
                  requestId: randomUUID(),
                  answer: `Medición ficticia ${i}`,
                  comment: "",
                  example: "",
                  consultationRequested: false,
                },
              );
              await api(path + "/response/submit", user.session, "POST", {
                expectedVersion: response.lockVersion,
                requestId: randomUUID(),
              });
              rounds++;
            }
          }),
          (async () => {
            const project = await api("/projects", session, "POST", {
              externalId: "RESOURCE-CSV",
              name: "Carga ficticia CSV",
              description: "Solo medición",
            });
            const areas = await api("/areas", session);
            const area = areas.find((item) => item.code === "UPGRADE");
            assert.ok(area);
            const start = Date.now();
            await importCsv(project, area, session);
            csvMs = Date.now() - start;
          })(),
          (async () => {
            const response = await raw(
              `/projects/${state.projectId}/questions/${account.questionId}/evidence`,
              account.session,
              "POST",
              bytes,
              {
                "Content-Type": "application/octet-stream",
                "X-Evidence-Metadata": encodeURIComponent(
                  JSON.stringify({
                    requestId: randomUUID(),
                    originalName: "ruido-ficticio.png",
                  }),
                ),
              },
            );
            assert.equal(
              response.status,
              201,
              "No se pudo subir la evidencia de carga.",
            );
            uploaded = await response.json();
          })(),
        ]);
      } finally {
        loading = false;
        await sampling;
      }
      // Adjuntar al terminar evita competir con la propia edición del mismo usuario.
      const path = `/projects/${state.projectId}/questions/${account.questionId}`;
      let response = await api(path + "/response", account.session);
      response = await api(path + "/response/draft", account.session, "PUT", {
        expectedVersion: response.lockVersion,
        requestId: randomUUID(),
        answer: "Evidencia de carga",
        comment: "",
        example: "",
        consultationRequested: false,
      });
      response = await api(
        path + "/response/evidence/attach",
        account.session,
        "POST",
        {
          expectedVersion: response.lockVersion,
          requestId: randomUUID(),
          evidenceId: uploaded.id,
        },
      );
      await api(path + "/response/submit", account.session, "POST", {
        expectedVersion: response.lockVersion,
        requestId: randomUUID(),
      });
      const downloaded = await raw(
        `/projects/${state.projectId}/evidence/${uploaded.id}/download`,
        account.session,
      );
      assert.equal(downloaded.status, 200);
      assert.equal(
        digest(Buffer.from(await downloaded.arrayBuffer())),
        uploaded.sha256,
      );
      console.log(
        JSON.stringify({
          result: "PASS",
          concurrentUsers: 5,
          rounds,
          requestsInUserLoops: rounds * 4,
          csvQuestions: 300,
          csvMs,
          uploadBytes: bytes.length,
          storedBytes: uploaded.byteSize,
          evidenceHashVerified: true,
          elapsedMs: Date.now() - started,
          samples,
          databaseBytes: Number(
            sql("SELECT pg_database_size(current_database())"),
          ),
        }),
      );
      return;
    }
    assert.ok(
      (await api("/auth/me", state.session)).user.isOrganizationAdmin,
      "La sesión anterior debe seguir activa.",
    );
    const graph = await api(
      `/projects/${state.projectId}/questionnaire`,
      state.session,
    );
    assert.equal(graph.questions.length, 300);
    assert.equal(graph.sections.length, 12);
    assert.equal(
      graph.questions.filter((q) => q.publication === "PUBLISHED").length,
      5,
    );
    const bytes = await raw(
      `/projects/${state.fixture.projectId}/evidence/${state.fixture.evidenceId}/download`,
      state.session,
    );
    assert.equal(bytes.status, 200);
    assert.equal(
      digest(Buffer.from(await bytes.arrayBuffer())),
      state.fixture.sha256,
    );
    const context = await browser.newContext();
    await context.addCookies([
      {
        name: state.session.cookie.split("=")[0],
        value: state.session.cookie.split("=")[1],
        url: options.origin,
        httpOnly: true,
        sameSite: "Lax",
      },
    ]);
    const page = await context.newPage();
    await page.goto(
      `${options.origin}/projects/${state.fixture.projectId}/report`,
    );
    await page
      .getByRole("heading", { name: "Informe de decisiones", exact: true })
      .waitFor();
    await page
      .getByText("Fictional installation decision", { exact: true })
      .waitFor();
    assert.ok((await page.pdf({ format: "A4" })).length > 1000);
    await context.close();
    if (options.phase === "verify") {
      for (const script of ["selfhost-smoke.mjs", "invitation-proxy-smoke.mjs"])
        dc(
          "exec",
          "-T",
          "-e",
          "SELFHOST_SMOKE_ALLOWED=true",
          "backend",
          "node",
          `scripts/${script}`,
          "--verify",
        );
      const fresh = await login(
        state.fixture.adminUsername,
        state.fixture.adminPassword,
      );
      assert.match(
        fresh.cookie,
        /^acta_session=/,
        "El nuevo acceso no usa la cookie neutral.",
      );
      assert.ok(
        fresh.headers.some(
          (h) =>
            /^fgeo_session=;/.test(h) && /Expires=Thu, 01 Jan 1970/.test(h),
        ),
      );
      const logout = await raw("/auth/logout", fresh, "POST", {});
      assert.ok(logout.ok);
      for (const name of ["acta_session", "fgeo_session"])
        assert.ok(
          logout.headers
            .getSetCookie()
            .some(
              (h) =>
                h.startsWith(name + "=;") && /Expires=Thu, 01 Jan 1970/.test(h),
            ),
        );
      assert.equal((await raw("/auth/me", fresh)).status, 401);
      assert.equal((await raw("/auth/me", state.session)).status, 200);
      compareSnapshots(state.snapshot, snapshot());
    } else {
      state.snapshot = snapshot();
      writeFileSync(options.state, JSON.stringify(state), { mode: 0o600 });
    }
    console.log(
      JSON.stringify({
        result: "PASS",
        phase: options.phase,
        csvQuestions: 300,
        csvTopics: 12,
        bulkUsers: 5,
        published: 5,
        draft: 295,
        persistedTables: Object.keys(state.snapshot).length,
        evidenceSha256: state.fixture.sha256,
        previousSession: "valid",
        report: "HTML y PDF comprobados",
        ...(options.phase === "verify"
          ? {
              newCookie: "acta_session",
              logout: "ambas retiradas",
              restoredInvitation: "verificada",
            }
          : {}),
      }),
    );
  } finally {
    await browser.close();
  }
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  try {
    await run(argumentsForRehearsal(process.argv.slice(2)));
  } catch (error) {
    // No volcar objetos de fetch/child_process: pueden contener cookies o configuración.
    console.error(
      error instanceof assert.AssertionError
        ? error.message
        : `Ensayo detenido (${error.code || error.name}). Consulte el paso ejecutado; no continúe con datos parciales.`,
    );
    process.exitCode = 1;
  }
}
