import { existsSync, readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { spawn } from "node:child_process";
// Never interpret an existing provider's data directory as a new empty store.
const marker = "/data/.requirements-versity-v1";
if (!existsSync(marker)) {
  const { readdirSync } = await import("node:fs");
  if (readdirSync("/data").length)
    throw Error(
      "Existing object storage requires an explicit verified migration; no data changed.",
    );
  writeFileSync(marker, "versitygw-posix-sidecar-v1\n", { mode: 0o600 });
}
for (const dir of ["objects", "metadata", "iam"])
  mkdirSync(`/data/${dir}`, { recursive: true, mode: 0o700 });
const child = spawn(
  "/usr/local/bin/versitygw",
  [
    "--port",
    ":9000",
    "--health",
    "/_health",
    "--iam-dir",
    "/data/iam",
    "posix",
    "--sidecar",
    "/data/metadata",
    "--dir-perms",
    "0700",
    "--file-perms",
    "0600",
    "/data/objects",
  ],
  {
    env: {
      ...process.env,
      ROOT_ACCESS_KEY: readFileSync("/run/object-secrets/root-user", "utf8"),
      ROOT_SECRET_KEY: readFileSync(
        "/run/object-secrets/root-password",
        "utf8",
      ),
    },
    stdio: "inherit",
  },
);
for (const signal of ["SIGTERM", "SIGINT"])
  process.on(signal, () => child.kill(signal));
child.on("error", () => {
  console.error("Object storage failed to start");
  process.exit(1);
});
child.on("exit", (code) => process.exit(code ?? 1));
