import { afterEach, describe, expect, it } from "vitest";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  existsSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
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
