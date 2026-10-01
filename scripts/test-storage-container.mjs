// Run only on a dedicated disposable Compose installation, never a live bucket.
import "./runtime-env.mjs";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
assert.equal(
  process.env.SELFHOST_STORAGE_TEST_ALLOWED,
  "true",
  "Explicit disposable-storage opt-in required",
);
const password = readFileSync("/run/db-secrets/owner", "utf8");
const env = {
  ...process.env,
  MIGRATION_DATABASE_URL: `postgresql://requirements_owner:${encodeURIComponent(password)}@postgres:5432/requirements`,
  STORAGE_TEST_S3: "true",
  STORAGE_PROVIDER: "S3",
};
// Same API/authorization/MIME/rollback suite as LOCAL, no skips or weaker assertions.
const result = spawnSync(
  process.execPath,
  [
    "--test",
    "--test-concurrency=1",
    "tests/integration/responses.test.mjs",
    "tests/selfhosting/s3.test.mjs",
  ],
  { env, stdio: "inherit" },
);
process.exit(result.status ?? 1);
