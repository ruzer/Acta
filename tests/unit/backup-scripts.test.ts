import { afterEach, describe, expect, it } from "vitest";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  existsSync,
  readFileSync,
  copyFileSync,
  chmodSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
const directories: string[] = [];
afterEach(() => {
  for (const dir of directories.splice(0))
    rmSync(dir, { recursive: true, force: true });
});
function fixture() {
  const dir = mkdtempSync(join(tmpdir(), "acta-backup-unit-"));
  directories.push(dir);
  const bin = join(dir, "bin");
  mkdirSync(bin);
  const calls = join(dir, "docker-calls");
  writeFileSync(
    join(bin, "docker"),
    '#!/bin/sh\nprintf "docker called\\n" >> "$DOCKER_CALLS"\nexit 1\n',
    { mode: 0o700 },
  );
  return {
    dir,
    calls,
    env: {
      ...process.env,
      COMPOSE_PROJECT_NAME: "",
      PATH: `${bin}:${process.env.PATH}`,
      DOCKER_CALLS: calls,
    },
  };
}
describe("backup preflight without Docker", () => {
  it.each([
    [[], /Proyecto/],
    [["--project", "fixture"], /Falta --out/],
    [["--project"], /Falta valor/],
    [["--unknown"], /Uso:/],
    [["--project", "../another", "--out", "unused"], /Proyecto/],
    [["--project", "-other", "--out", "unused"], /Proyecto/],
  ])("rejects malformed arguments %j", (args, expected) => {
    const f = fixture();
    const r = spawnSync("sh", ["scripts/backup.sh", ...(args as string[])], {
      env: f.env,
      encoding: "utf8",
    });
    expect(r.status).not.toBe(0);
    expect(r.stderr).toMatch(expected as RegExp);
    expect(existsSync(f.calls)).toBe(false);
  });
  it.each([
    "existing",
    "missing-parent",
    "repository",
    "nested-git",
    "incomplete",
  ])("rejects unsafe output: %s", (kind) => {
    const f = fixture();
    let out = join(f.dir, "copy");
    if (kind === "existing") mkdirSync(out);
    if (kind === "missing-parent") out = join(f.dir, "missing", "copy");
    if (kind === "repository") out = resolve("backup-forbidden");
    if (kind === "nested-git") {
      writeFileSync(join(f.dir, ".git"), "gitdir: fixture");
    }
    if (kind === "incomplete") mkdirSync(out + ".INCOMPLETE");
    const r = spawnSync(
      "sh",
      ["scripts/backup.sh", "--project", "fixture", "--out", out],
      { env: f.env, encoding: "utf8" },
    );
    expect(r.status).not.toBe(0);
    expect(r.stderr).toMatch(/ERROR:/);
    expect(existsSync(f.calls)).toBe(false);
  });
});

it.each(["migrate", "secrets-init", "storage-init"])(
  "backup refuses an active %s before stopping writers",
  (transient) => {
    const f = fixture();
    const deployment = join(f.dir, "deployment");
    mkdirSync(join(deployment, "scripts"), { recursive: true });
    mkdirSync(join(deployment, "app/backend"), { recursive: true });
    for (const name of ["backup.sh", "backup-common.sh", "backup-manifest.mjs"])
      expect(
        spawnSync("cp", [
          resolve("scripts", name),
          join(deployment, "scripts", name),
        ]).status,
      ).toBe(0);
    writeFileSync(join(deployment, ".env"), "# Fictional configuration\n");
    writeFileSync(
      join(deployment, "app/backend/Dockerfile"),
      "FROM node:fixture AS runtime\n",
    );
    const volumeNames = [
      "pgdata",
      "objectdata",
      "evidence",
      "db-secrets",
      "api-secrets",
      "object-secrets",
      "provision-secrets",
    ];
    const config = {
      volumes: Object.fromEntries(
        volumeNames.map((v) => [v, { name: `fixture_${v}` }]),
      ),
      services: {
        postgres: {
          environment: {
            POSTGRES_USER: "requirements_owner",
            POSTGRES_DB: "requirements",
          },
          volumes: [
            { type: "volume", source: "pgdata", target: "/var/lib/postgresql" },
          ],
        },
        backend: {
          environment: {
            STORAGE_PROVIDER: "S3",
            S3_ENDPOINT: "http://object-storage:9000",
          },
          volumes: [
            {
              type: "volume",
              source: "evidence",
              target: "/app/.private-evidence",
            },
          ],
        },
        "object-storage": {
          build: { dockerfile: "docker/versity/Dockerfile" },
          volumes: [{ type: "volume", source: "objectdata", target: "/data" }],
        },
      },
    };
    const configFile = join(f.dir, "config.json");
    writeFileSync(configFile, JSON.stringify(config));
    writeFileSync(
      join(f.dir, "bin/docker"),
      `#!/bin/sh
printf '%s\n' "$*" >> "$DOCKER_CALLS"
case "$*" in
  *'config --format json') cat "$FAKE_CONFIG";;
  'volume inspect'*) printf 'fixture\\n';;
  *'ps --status running --services') printf 'postgres\\nobject-storage\\n${transient}\\n';;
  *) exit 90;;
esac
`,
      { mode: 0o700 },
    );
    const out = join(f.dir, "new-copy");
    const r = spawnSync(
      "sh",
      [
        join(deployment, "scripts/backup.sh"),
        "--project",
        "fixture",
        "--out",
        out,
      ],
      { env: { ...f.env, FAKE_CONFIG: configFile }, encoding: "utf8" },
    );
    expect(r.status).not.toBe(0);
    expect(r.stderr).toMatch(/termine.*migraciones/);
    expect(existsSync(out)).toBe(false);
  },
);

function backupFixture() {
  const f = fixture();
  const backup = join(f.dir, "backup");
  mkdirSync(backup, { mode: 0o700 });
  const source = join(f.dir, "tar-source");
  mkdirSync(source);
  writeFileSync(join(source, "example.txt"), "Fictional backup data");
  writeFileSync(
    join(backup, "database.dump"),
    "PGDMP-fake-fixture-not-a-real-database",
  );
  writeFileSync(join(backup, ".env"), "# Fictional configuration only\n");
  const suffixes = [
    "objectdata",
    "evidence",
    "db-secrets",
    "api-secrets",
    "object-secrets",
    "provision-secrets",
  ];
  for (const suffix of suffixes) {
    const r = spawnSync("tar", [
      "-cf",
      join(backup, `${suffix}.tar`),
      "-C",
      source,
      ".",
    ]);
    expect(r.status).toBe(0);
  }
  const files = ["database.dump", ".env", ...suffixes.map((s) => `${s}.tar`)];
  const manifest = {
    formatVersion: 1,
    commit: null,
    postgresVersion: "18.6",
    actaVersion: "0.8.0",
    images: [{ ID: "fixture" }],
    controlCounts: {
      migrations: 0,
      projects: 0,
      sections: 0,
      questions: 0,
      responseRevisions: 0,
      validations: 0,
      evidence: 0,
      brandingAssets: 0,
    },
    files: files.map((path) => {
      const bytes = readFileSync(join(backup, path));
      return {
        path,
        size: bytes.length,
        sha256: createHash("sha256").update(bytes).digest("hex"),
      };
    }),
  };
  writeFileSync(join(backup, "manifest.json"), JSON.stringify(manifest));
  const deployment = join(f.dir, "deployment");
  mkdirSync(join(deployment, "scripts"), { recursive: true });
  mkdirSync(join(deployment, "app/backend"), { recursive: true });
  for (const name of [
    "restore.sh",
    "verify-backup.sh",
    "backup-common.sh",
    "backup-manifest.mjs",
  ]) {
    copyFileSync(resolve("scripts", name), join(deployment, "scripts", name));
    chmodSync(join(deployment, "scripts", name), 0o700);
  }
  copyFileSync(
    resolve("app/backend/Dockerfile"),
    join(deployment, "app/backend/Dockerfile"),
  );
  writeFileSync(join(deployment, ".env"), "# Fixture only\n");
  writeFileSync(
    join(deployment, "package.json"),
    JSON.stringify({ version: manifest.actaVersion }),
  );
  mkdirSync(join(deployment, "app/backend/prisma/migrations"), {
    recursive: true,
  });
  return { ...f, backup, deployment, manifest };
}
describe("verify backup without Docker", () => {
  it("accepts a complete synthetic inventory without modifying it", () => {
    const f = backupFixture();
    const before = readFileSync(join(f.backup, "manifest.json"));
    const r = spawnSync("sh", ["scripts/verify-backup.sh", f.backup], {
      env: f.env,
      encoding: "utf8",
    });
    expect(r.status, r.stderr).toBe(0);
    expect(r.stdout).toContain("8 archivos");
    expect(existsSync(f.calls)).toBe(false);
    expect(readFileSync(join(f.backup, "manifest.json"))).toEqual(before);
  });
  it.each([
    "altered",
    "missing",
    "no-manifest",
    "incomplete-marker",
    "incomplete-directory",
    "extra",
    "bad-signature",
    "bad-tar",
    "traversal",
    "duplicate",
    "bad-counts",
  ])("rejects %s before Docker", (kind) => {
    const f = backupFixture();
    let backup = f.backup;
    if (kind === "altered")
      writeFileSync(join(backup, "objectdata.tar"), "altered");
    if (kind === "missing") rmSync(join(backup, "evidence.tar"));
    if (kind === "no-manifest") rmSync(join(backup, "manifest.json"));
    if (kind === "incomplete-marker")
      writeFileSync(join(backup, "INCOMPLETE"), "unfinished");
    if (kind === "incomplete-directory") {
      backup = join(f.dir, "copy.INCOMPLETE");
      mkdirSync(backup, { mode: 0o700 });
    }
    if (kind === "extra") writeFileSync(join(backup, "unknown"), "extra");
    if (kind === "bad-signature" || kind === "bad-tar") {
      const path = kind === "bad-signature" ? "database.dump" : "evidence.tar";
      const bytes = Buffer.from("not the expected format");
      writeFileSync(join(backup, path), bytes);
      Object.assign(
        f.manifest.files.find((v) => v.path === path)!,
        {
          size: bytes.length,
          sha256: createHash("sha256").update(bytes).digest("hex"),
        },
      );
      writeFileSync(join(backup, "manifest.json"), JSON.stringify(f.manifest));
    }
    if (kind === "traversal") {
      f.manifest.files[0].path = "../database.dump";
      writeFileSync(join(backup, "manifest.json"), JSON.stringify(f.manifest));
    }
    if (kind === "duplicate") {
      f.manifest.files.push(f.manifest.files[0]);
      writeFileSync(join(backup, "manifest.json"), JSON.stringify(f.manifest));
    }
    if (kind === "bad-counts") {
      f.manifest.controlCounts.projects = -1;
      writeFileSync(join(backup, "manifest.json"), JSON.stringify(f.manifest));
    }
    const r = spawnSync("sh", ["scripts/verify-backup.sh", backup], {
      env: f.env,
      encoding: "utf8",
    });
    expect(r.status).not.toBe(0);
    expect(r.stderr).toMatch(/ERROR:/);
    expect(existsSync(f.calls)).toBe(false);
  });
});
describe("restore guards", () => {
  it.each([
    [],
    ["--project"],
    ["--project", "demo"],
    ["--project", "bad/name", "--backup", "unused"],
  ])("rejects arguments %j without Docker", (...args) => {
    const f = fixture();
    const r = spawnSync("sh", ["scripts/restore.sh", ...args], {
      env: f.env,
      encoding: "utf8",
    });
    expect(r.status).not.toBe(0);
    expect(existsSync(f.calls)).toBe(false);
  });
  it("does not invoke Docker for a corrupted backup", () => {
    const f = backupFixture();
    writeFileSync(join(f.backup, ".env"), "changed");
    const r = spawnSync(
      "sh",
      ["scripts/restore.sh", "--project", "fixture", "--backup", f.backup],
      { env: f.env, encoding: "utf8" },
    );
    expect(r.status).not.toBe(0);
    expect(existsSync(f.calls)).toBe(false);
  });
  it.each(["volume", "container"])(
    "refuses existing destination %s without mutations",
    (kind) => {
      const f = backupFixture();
      writeFileSync(
        join(f.dir, "bin/docker"),
        `#!/bin/sh
printf '%s\n' "$*" >> "$DOCKER_CALLS"
case "$1 $2" in
  'ps -aq') ${kind === "container" ? "printf 'existing-container\\n'" : ":"};;
  'volume ls') printf 'fixture_pgdata\\n';;
  *) exit 90;;
esac
`,
        { mode: 0o700 },
      );
      const r = spawnSync(
        "sh",
        [
          join(f.deployment, "scripts/restore.sh"),
          "--project",
          "fixture",
          "--backup",
          f.backup,
        ],
        { env: f.env, encoding: "utf8" },
      );
      expect(r.status).not.toBe(0);
      expect(r.stderr).toMatch(/ya tiene contenedores|Existe un volumen/);
      const calls = readFileSync(f.calls, "utf8");
      expect(calls).not.toMatch(/create|run|up|stop|rm/);
    },
  );
});

describe("restore compatibility and counts", () => {
  it("rejects a PostgreSQL major change before any Docker invocation", () => {
    const f = backupFixture();
    const r = spawnSync(
      "node",
      [
        "scripts/backup-manifest.mjs",
        "postgres-compatibility",
        f.backup,
        "postgres (PostgreSQL) 19.1",
      ],
      { env: f.env, encoding: "utf8" },
    );
    expect(r.status).not.toBe(0);
    expect(r.stderr).toMatch(/Cambio mayor/);
    expect(existsSync(f.calls)).toBe(false);
  });
  it.each(["version", "commit"])(
    "warns without blocking a %s difference",
    (kind) => {
      const f = backupFixture();
      if (kind === "version") f.manifest.actaVersion = "0.1.0";
      else Object.assign(f.manifest, { commit: "old-commit" });
      writeFileSync(
        join(f.backup, "manifest.json"),
        JSON.stringify(f.manifest),
      );
      const r = compatibility(f);
      expect(r.status, r.stderr).toBe(0);
      expect(r.stderr).toContain("AVISO: versión de Acta o commit distintos");
    },
  );
  it("does not compare image IDs when the code and migrations match", () => {
    const f = backupFixture();
    f.manifest.images[0].ID = "rebuilt-image";
    writeFileSync(join(f.backup, "manifest.json"), JSON.stringify(f.manifest));
    const r = compatibility(f);
    expect(r.status, r.stderr).toBe(0);
    expect(r.stderr).toBe("");
  });
  it("rejects a newer backup before restore invokes Docker", () => {
    const f = backupFixture();
    f.manifest.controlCounts.migrations = 1;
    writeFileSync(join(f.backup, "manifest.json"), JSON.stringify(f.manifest));
    const r = restore(f);
    expect(r.status).not.toBe(0);
    expect(r.stderr).toContain("la copia es más nueva que el código");
    expect(existsSync(f.calls)).toBe(false);
  });
  it("warns about pending migrations, counting only directories containing migration.sql", () => {
    const f = backupFixture();
    const migrations = join(f.deployment, "app/backend/prisma/migrations");
    mkdirSync(join(migrations, "first"));
    writeFileSync(join(migrations, "first/migration.sql"), "-- fixture");
    mkdirSync(join(migrations, "not-a-migration"));
    writeFileSync(join(migrations, "migration_lock.toml"), "");
    const r = compatibility(f);
    expect(r.status, r.stderr).toBe(0);
    expect(r.stderr).toContain("este código aplicará 1 migraciones al iniciar");
    expect(existsSync(f.calls)).toBe(false);
  });
  it("only warns if the migrations directory cannot be read", () => {
    const f = backupFixture();
    rmSync(join(f.deployment, "app/backend/prisma/migrations"), {
      recursive: true,
    });
    f.manifest.controlCounts.migrations = 1;
    writeFileSync(join(f.backup, "manifest.json"), JSON.stringify(f.manifest));
    const r = compatibility(f);
    expect(r.status, r.stderr).toBe(0);
    expect(r.stderr).toContain("no se pudo leer el directorio de migraciones");
  });
  it("compares all eight control counts", () => {
    const f = backupFixture();
    const run = (counts: object) =>
      spawnSync(
        "node",
        [
          "scripts/backup-manifest.mjs",
          "counts",
          f.backup,
          JSON.stringify(counts),
        ],
        { env: f.env, encoding: "utf8" },
      );
    expect(run(f.manifest.controlCounts).status).toBe(0);
    for (const key of Object.keys(f.manifest.controlCounts))
      expect(run({ ...f.manifest.controlCounts, [key]: 1 }).status).not.toBe(0);
    expect(existsSync(f.calls)).toBe(false);
  });
});

function compatibility(f: ReturnType<typeof backupFixture>) {
  return spawnSync(
    "node",
    ["scripts/backup-manifest.mjs", "compatibility", f.backup, f.deployment],
    { env: f.env, encoding: "utf8" },
  );
}
function restore(f: ReturnType<typeof backupFixture>) {
  return spawnSync(
    "sh",
    [
      join(f.deployment, "scripts/restore.sh"),
      "--project",
      "fixture",
      "--backup",
      f.backup,
    ],
    { env: f.env, encoding: "utf8" },
  );
}
it.each(["permissions", "incomplete"])(
  "gives a specific message for %s",
  (kind) => {
    const f = backupFixture();
    if (kind === "permissions") chmodSync(f.backup, 0o755);
    else writeFileSync(join(f.backup, "INCOMPLETE"), "unfinished");
    const r = restore(f);
    expect(r.status).not.toBe(0);
    if (kind === "permissions") {
      expect(r.stderr).toContain(
        "El directorio de la copia debe tener modo 700",
      );
      expect(r.stderr).toContain("chmod 700 tras confirmar");
      expect(r.stderr).not.toContain("INCOMPLETE");
    } else expect(r.stderr).toContain("Backup INCOMPLETE");
    expect(existsSync(f.calls)).toBe(false);
  },
);
it.each([".env", "docker-compose.override.yml"])(
  "warns before Docker when %s differs or is missing",
  (name) => {
    const f = backupFixture();
    const content = Buffer.from("# private fixture values must not be printed");
    writeFileSync(join(f.backup, name), content);
    f.manifest.files = f.manifest.files.filter((v) => v.path !== name);
    f.manifest.files.push({
      path: name,
      size: content.length,
      sha256: createHash("sha256").update(content).digest("hex"),
    });
    writeFileSync(join(f.backup, "manifest.json"), JSON.stringify(f.manifest));
    for (const state of ["different", "missing", "same"]) {
      if (state === "missing") rmSync(join(f.deployment, name));
      else
        writeFileSync(
          join(f.deployment, name),
          state === "same" ? content : "# another fixture",
        );
      const r = restore(f);
      if (state === "same") expect(r.stderr).not.toContain(`AVISO: ${name}`);
      else
        expect(r.stderr).toContain(
          `AVISO: ${name} difiere de la copia o falta`,
        );
      expect(r.stderr).not.toContain(content.toString());
    }
  },
);
it("warns for an override only present at the destination", () => {
  const f = backupFixture();
  writeFileSync(
    join(f.deployment, "docker-compose.override-new.yml"),
    "# fixture",
  );
  expect(restore(f).stderr).toContain("AVISO: docker-compose.override-new.yml");
});
it("names missing images with build and pull instructions, without downloading", () => {
  const f = backupFixture();
  // Reuse the project's real Compose shape without contacting a Docker daemon.
  const config = {
    volumes: Object.fromEntries(
      [
        "pgdata",
        "objectdata",
        "evidence",
        "db-secrets",
        "api-secrets",
        "object-secrets",
        "provision-secrets",
      ].map((v) => [v, { name: `fixture_${v}` }]),
    ),
    services: {
      postgres: {
        image: "postgres:18.6-bookworm",
        environment: {
          POSTGRES_USER: "requirements_owner",
          POSTGRES_DB: "requirements",
        },
        volumes: [
          { type: "volume", source: "pgdata", target: "/var/lib/postgresql" },
        ],
      },
      backend: {
        environment: {
          STORAGE_PROVIDER: "S3",
          S3_ENDPOINT: "http://object-storage:9000",
        },
        volumes: [
          {
            type: "volume",
            source: "evidence",
            target: "/app/.private-evidence",
          },
        ],
      },
      "object-storage": {
        build: { dockerfile: "docker/versity/Dockerfile" },
        volumes: [{ type: "volume", source: "objectdata", target: "/data" }],
      },
    },
  };
  writeFileSync(join(f.dir, "config.json"), JSON.stringify(config));
  writeFileSync(
    join(f.dir, "bin/docker"),
    `#!/bin/sh
printf '%s\n' "$*" >> "$DOCKER_CALLS"
case "$*" in
  'ps -aq'*|'volume ls'*) :;;
  *'config --format json') cat "${join(f.dir, "config.json")}";;
  *'config --images') printf 'postgres:18.6-bookworm\n';;
  'image inspect'*) printf 'No such image\n' >&2; exit 1;;
  *) exit 90;;
esac
`,
    { mode: 0o700 },
  );
  const r = restore(f);
  expect(r.status).not.toBe(0);
  expect(r.stderr).toContain("Falta la imagen local postgres:18.6-bookworm");
  expect(r.stderr).toContain("docker compose -p fixture build");
  expect(r.stderr).toContain(
    "docker compose -p fixture pull --ignore-buildable",
  );
  expect(r.stderr).not.toContain("No such image");
  expect(readFileSync(f.calls, "utf8")).not.toMatch(
    /(?:^|\s)(?:create|run|up|stop|pull|build)(?:\s|$)/m,
  );
});
