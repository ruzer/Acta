import { randomBytes } from "node:crypto";
import {
  mkdirSync,
  existsSync,
  readFileSync,
  writeFileSync,
  chmodSync,
  chownSync,
} from "node:fs";
const dirs = [
  "/secrets/db",
  "/secrets/api",
  "/secrets/object",
  "/secrets/provision",
];
for (const dir of dirs) {
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  chmodSync(dir, 0o700);
  chownSync(dir, 1000, 1000);
}
const state = "/secrets/db/state.json";
let values;
if (existsSync(state)) values = JSON.parse(readFileSync(state, "utf8"));
else {
  const secret = (key, length = 32) => {
    const value = process.env[key] || randomBytes(length).toString("base64url");
    if (
      value.length < 20 ||
      /REPLACE|changeme|minioadmin/i.test(value) ||
      /[\r\n\0]/.test(value)
    )
      throw Error(`Invalid ${key}; value omitted`);
    return value;
  };
  values = {
    POSTGRES_PASSWORD: secret("POSTGRES_PASSWORD"),
    APP_DB_PASSWORD: secret("APP_DB_PASSWORD"),
    MINIO_ROOT_USER: secret("MINIO_ROOT_USER", 18),
    MINIO_ROOT_PASSWORD: secret("MINIO_ROOT_PASSWORD"),
    S3_ACCESS_KEY: secret("S3_ACCESS_KEY", 18),
    S3_SECRET_KEY: secret("S3_SECRET_KEY"),
  };
}
// Existing installations must rotate credentials explicitly, never overwrite on restart.
for (const key of Object.keys(values))
  if (process.env[key] && process.env[key] !== values[key])
    throw Error(
      `Credential change for ${key} requires the documented rotation procedure; value omitted`,
    );
function save(path, data) {
  writeFileSync(path, data, { mode: 0o600 });
  chmodSync(path, 0o600);
  chownSync(path, 1000, 1000);
}
save(state, JSON.stringify(values));
save("/secrets/db/owner", values.POSTGRES_PASSWORD);
save("/secrets/db/app", values.APP_DB_PASSWORD);
save("/secrets/object/root-user", values.MINIO_ROOT_USER);
save("/secrets/object/root-password", values.MINIO_ROOT_PASSWORD);
save("/secrets/provision/root-user", values.MINIO_ROOT_USER);
save("/secrets/provision/root-password", values.MINIO_ROOT_PASSWORD);
save("/secrets/provision/access", values.S3_ACCESS_KEY);
save("/secrets/provision/secret", values.S3_SECRET_KEY);
save(
  "/secrets/api/runtime.json",
  JSON.stringify({
    DATABASE_URL: `postgresql://requirements_app:${encodeURIComponent(values.APP_DB_PASSWORD)}@postgres:5432/requirements`,
    S3_ACCESS_KEY: values.S3_ACCESS_KEY,
    S3_SECRET_KEY: values.S3_SECRET_KEY,
  }),
);
console.log("Installation credentials ready. Values are never printed.");
