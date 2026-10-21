import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { cp, mkdir, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import pg from "pg";
import { config } from "dotenv";
config({ quiet: true });

// Exercise the official migration on a populated v0.3 schema, not a fresh DB.
// Fixture inserts run only in the randomly named disposable database below.
test(
  "invitation upgrade preserves existing account sessions, answers and evidence history",
  { timeout: 120000 },
  async () => {
    const name = "acta_invitation_upgrade_" + randomBytes(6).toString("hex");
    const ownerUrl = new URL(process.env.MIGRATION_DATABASE_URL);
    const runtimeUrl = new URL(process.env.DATABASE_URL);
    const admin = new pg.Client({ connectionString: ownerUrl.href });
    const root = await mkdtemp(join(tmpdir(), "acta-invitation-upgrade-"));
    let owner, db;
    await admin.connect();
    try {
      await admin.query(`CREATE DATABASE "${name}"`);
      ownerUrl.pathname = runtimeUrl.pathname = "/" + name;
      owner = new pg.Client({ connectionString: ownerUrl.href });
      await owner.connect();
      const migrations = resolve("app/backend/prisma/migrations");
      const previous = join(root, "migrations");
      await mkdir(previous);
      const added = "202610060001_response_invitations";
      for (const entry of await readdir(migrations)) {
        if (entry !== added)
          await cp(join(migrations, entry), join(previous, entry), {
            recursive: true,
          });
      }
      const oldConfig = join(root, "prisma.config.mjs");
      await writeFile(
        oldConfig,
        `export default ${JSON.stringify({
          schema: resolve("app/backend/prisma/schema.prisma"),
          migrations: { path: previous },
          datasource: { url: ownerUrl.href },
        })}`,
        { mode: 0o600 },
      );
      const deploy = (path) => {
        const result = spawnSync(
          process.execPath,
          [
            "node_modules/prisma/build/index.js",
            "migrate",
            "deploy",
            "--config",
            path,
          ],
          {
            encoding: "utf8",
            env: { ...process.env, DATABASE_URL: ownerUrl.href },
          },
        );
        assert.equal(
          result.status,
          0,
          (result.stdout + result.stderr).replaceAll(
            ownerUrl.href,
            "[test database]",
          ),
        );
      };
      deploy(oldConfig);
      assert.equal(
        (
          await owner.query(
            'SELECT count(*)::int AS n FROM "_prisma_migrations" WHERE migration_name=$1',
            [added],
          )
        ).rows[0].n,
        0,
      );
      const now = new Date();
      const ids = Object.fromEntries(
        [
          "org",
          "user",
          "session",
          "area",
          "project",
          "member",
          "section",
          "question",
          "questionRevision",
          "assignment",
          "response",
          "draft",
          "revision",
          "evidence",
          "draftEvidence",
          "revisionEvidence",
          "audit",
        ].map((key) => [key, randomUUID()]),
      );
      const sessionToken = randomBytes(32).toString("base64url");
      const hash = (value) => createHash("sha256").update(value).digest("hex");
      const sessionHash = hash(sessionToken);
      const insert = async (table, data) => {
        const keys = Object.keys(data);
        await owner.query(
          `INSERT INTO "${table}" (${keys.map((key) => `"${key}"`).join(",")}) VALUES (${keys.map((_, i) => `$${i + 1}`).join(",")})`,
          Object.values(data),
        );
      };
      await owner.query("BEGIN");
      await insert("Organization", {
        id: ids.org,
        code: "DEFAULT",
        name: "Example Organization",
        updatedAt: now,
      });
      await insert("User", {
        id: ids.user,
        organizationId: ids.org,
        username: "example.participant",
        displayName: "Example Participant",
        mustChangePassword: false,
        updatedAt: now,
      });
      await insert("Session", {
        id: ids.session,
        userId: ids.user,
        tokenHash: sessionHash,
        csrfSecretHash: hash(randomBytes(32)),
        expiresAt: new Date(Date.now() + 3600000),
      });
      await insert("Area", {
        id: ids.area,
        organizationId: ids.org,
        code: "EXAMPLE",
        name: "Example Area",
        updatedAt: now,
      });
      await insert("Project", {
        id: ids.project,
        organizationId: ids.org,
        externalId: "EXAMPLE",
        name: "Example Project",
        updatedAt: now,
      });
      await insert("ProjectMember", {
        id: ids.member,
        projectId: ids.project,
        userId: ids.user,
        role: "STAKEHOLDER",
        areaId: ids.area,
        updatedAt: now,
      });
      await insert("Section", {
        id: ids.section,
        projectId: ids.project,
        externalId: "TOPIC",
        title: "Example topic",
        order: 0,
        updatedAt: now,
      });
      await insert("Question", {
        id: ids.question,
        projectId: ids.project,
        sectionId: ids.section,
        externalId: "QUESTION",
        responsibleAreaId: ids.area,
        priority: "P2",
        order: 0,
        updatedAt: now,
      });
      await insert("QuestionRevision", {
        id: ids.questionRevision,
        projectId: ids.project,
        questionId: ids.question,
        number: 1,
        title: "Example question",
        question: "What would you improve?",
        type: "SHORT_TEXT",
        required: true,
        snapshot: {},
        createdById: ids.user,
      });
      await owner.query(
        'UPDATE "Question" SET publication=\'PUBLISHED\', "publishedRevisionNumber"=1 WHERE id=$1',
        [ids.question],
      );
      await insert("QuestionAssignment", {
        id: ids.assignment,
        projectId: ids.project,
        questionId: ids.question,
        projectMemberId: ids.member,
        updatedAt: now,
      });
      await insert("Response", {
        id: ids.response,
        projectId: ids.project,
        questionId: ids.question,
        respondentId: ids.user,
        lockVersion: 2,
        updatedAt: now,
      });
      await insert("ResponseRevision", {
        id: ids.revision,
        projectId: ids.project,
        responseId: ids.response,
        questionRevisionId: ids.questionRevision,
        number: 1,
        answer: JSON.stringify("Submitted example"),
        areaId: ids.area,
        respondentSnapshot: { displayName: "Example Participant" },
        areaSnapshot: { name: "Example Area" },
        conditionContext: {},
      });
      await insert("ResponseDraft", {
        id: ids.draft,
        projectId: ids.project,
        responseId: ids.response,
        basedOnRevisionId: ids.revision,
        questionRevisionId: ids.questionRevision,
        answer: JSON.stringify("Correction in progress"),
        areaId: ids.area,
        conditionContext: {},
        lockVersion: 1,
        updatedAt: now,
      });
      await insert("Evidence", {
        id: ids.evidence,
        projectId: ids.project,
        responseId: ids.response,
        uploadedById: ids.user,
        originalName: "example.txt",
        detectedMimeType: "text/plain",
        byteSize: 7,
        sha256: hash("example"),
        backend: "S3",
        storageKey: `evidence/${ids.evidence}`,
        status: "READY",
      });
      await insert("DraftEvidence", {
        id: ids.draftEvidence,
        projectId: ids.project,
        responseDraftId: ids.draft,
        evidenceId: ids.evidence,
      });
      await insert("RevisionEvidence", {
        id: ids.revisionEvidence,
        projectId: ids.project,
        responseRevisionId: ids.revision,
        evidenceId: ids.evidence,
      });
      await insert("AuditEvent", {
        id: ids.audit,
        organizationId: ids.org,
        projectId: ids.project,
        actorId: ids.user,
        actorSnapshot: { displayName: "Example Participant" },
        action: "RESPONSE_SUBMITTED",
        objectType: "Response",
        objectId: ids.response,
        requestId: randomUUID(),
        after: { revisionId: ids.revision },
      });
      await owner.query("COMMIT");
      const tables = [
        "Organization",
        "User",
        "Session",
        "Area",
        "Project",
        "ProjectMember",
        "Section",
        "Question",
        "QuestionRevision",
        "QuestionAssignment",
        "Response",
        "ResponseDraft",
        "ResponseRevision",
        "Evidence",
        "DraftEvidence",
        "RevisionEvidence",
        "AuditEvent",
      ];
      const before = new Map();
      for (const table of tables)
        before.set(
          table,
          (
            await owner.query(
              `SELECT to_jsonb(t) AS row FROM "${table}" t ORDER BY id`,
            )
          ).rows,
        );
      deploy("app/backend/prisma.config.ts");
      for (const table of tables) {
        const remove =
          table === "User"
            ? " - 'invitationOnly'"
            : table === "Project"
              ? " - 'allowNonNominalInvitations'"
              : "";
        assert.deepEqual(
          (
            await owner.query(
              `SELECT to_jsonb(t)${remove} AS row FROM "${table}" t ORDER BY id`,
            )
          ).rows,
          before.get(table),
          `${table} preserves all pre-existing values`,
        );
      }
      assert.equal(
        (await owner.query('SELECT "invitationOnly" FROM "User"')).rows[0]
          .invitationOnly,
        false,
      );
      assert.equal(
        (
          await owner.query(
            'SELECT "allowNonNominalInvitations" FROM "Project"',
          )
        ).rows[0].allowNonNominalInvitations,
        false,
      );
      for (const table of [
        "ResponseInvitation",
        "InvitationQuestion",
        "InvitationSession",
        "InvitationRateBucket",
      ])
        assert.equal(
          (await owner.query(`SELECT count(*)::int AS n FROM "${table}"`))
            .rows[0].n,
          0,
        );
      const { PrismaClient } = await import("@prisma/client");
      const { PrismaPg } = await import("@prisma/adapter-pg");
      db = new PrismaClient({
        adapter: new PrismaPg({ connectionString: runtimeUrl.href }),
      });
      const { AuthService } =
        await import("../../app/backend/dist/auth/auth.service.js");
      Object.assign(process.env, {
        ORGANIZATION_CODE: "DEFAULT",
        APP_ORIGIN: "http://localhost:4359",
        COOKIE_SECURE: "false",
        NODE_ENV: "test",
      });
      const authenticated = await new AuthService(db).authenticate(
        sessionToken,
      );
      assert.equal(
        authenticated.session.user.id,
        ids.user,
        "existing account session remains usable with the new application",
      );
      const restored = await db.response.findUniqueOrThrow({
        where: {
          questionId_respondentId: {
            questionId: ids.question,
            respondentId: ids.user,
          },
        },
        include: {
          ResponseDraft_response: true,
          ResponseRevision_response: true,
          Evidence_response: true,
        },
      });
      assert.equal(
        restored.ResponseDraft_response.answer,
        "Correction in progress",
      );
      assert.equal(
        restored.ResponseRevision_response[0].answer,
        "Submitted example",
      );
      assert.equal(restored.Evidence_response[0].sha256, hash("example"));
      // Re-running deployment must not alter data or repeat migrations.
      deploy("app/backend/prisma.config.ts");
      assert.equal(
        (
          await owner.query(
            'SELECT count(*)::int AS n FROM "_prisma_migrations" WHERE migration_name=$1 AND finished_at IS NOT NULL',
            [added],
          )
        ).rows[0].n,
        1,
      );
    } finally {
      await db?.$disconnect();
      await owner?.end();
      await admin.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
      await admin.end();
      await rm(root, { recursive: true, force: true });
    }
  },
);
