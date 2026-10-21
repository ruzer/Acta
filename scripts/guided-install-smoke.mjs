// Destructive only to a NEW, explicitly opted-in disposable installation.
// Exercises the guided first run through the real proxy: operator code, wizard calls,
// the created administrator, a logo, and (with --verify, after a restart) persistence.
import "./runtime-env.mjs";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { crc32, deflateSync } from "node:zlib";

if (process.env.SELFHOST_SMOKE_ALLOWED !== "true")
  throw Error("Explicit disposable-installation opt-in required");
const file = "/app/.private-evidence/guided-install-smoke.json";
const origin = process.env.APP_ORIGIN;
const base = "http://frontend:8080/api/v1";
const verifying = process.argv.includes("--verify");

async function call(path, { method = "GET", body, session, headers = {} } = {}) {
  const raw = body instanceof Uint8Array;
  const response = await fetch(base + path, {
    method,
    headers: {
      Origin: origin,
      "Content-Type": raw ? "application/octet-stream" : "application/json",
      ...(session ? { Cookie: session.cookie, "X-CSRF-Token": session.csrf } : {}),
      ...headers,
    },
    ...(method === "GET" ? {} : { body: raw ? body : JSON.stringify(body ?? {}) }),
  });
  const json = (response.headers.get("content-type") ?? "").includes("json")
    ? await response.json()
    : null;
  return { status: response.status, json, response };
}
async function login(username, password) {
  const r = await call("/auth/login", { method: "POST", body: { username, password } });
  assert.equal(r.status, 201, "sign-in failed");
  return { cookie: r.response.headers.get("set-cookie").split(";")[0], csrf: r.json.csrfToken };
}
function png(size) {
  const chunk = (type, data) => {
    const body = Buffer.concat([Buffer.from(type), data]);
    const out = Buffer.alloc(12 + data.length);
    out.writeUInt32BE(data.length, 0);
    body.copy(out, 4);
    out.writeUInt32BE(crc32(body), 8 + data.length);
    return out;
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header.set([8, 2, 0, 0, 0], 8);
  const row = Buffer.concat([Buffer.from([0]), Buffer.alloc(size * 3, 0x33)]);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(Buffer.concat(Array.from({ length: size }, () => row)))),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

if (verifying) {
  const state = JSON.parse(readFileSync(file, "utf8"));
  assert.deepEqual((await call("/setup/status")).json, { state: "COMPLETED" });
  const session = await login(state.username, state.password);
  const settings = (await call("/settings", { session })).json;
  assert.equal(settings.appName.value, "Acta Guiada");
  assert.equal(settings.logo.source, "saved");
  assert.equal((await call("/system", { session })).json.storage.status, "ok");
  const image = await fetch("http://frontend:8080" + settings.logo.url);
  assert.equal(image.status, 200);
  assert.equal(image.headers.get("content-type"), "image/png");
  const token = randomBytes(32).toString("base64url");
  assert.equal((await call("/setup/verify", { method: "POST", body: { token } })).status, 409);
  console.log("Guided installation persisted after restart.");
} else {
  assert.deepEqual((await call("/setup/status")).json, { state: "PENDING" });
  assert.equal((await call("/auth/context")).status, 503);
  const stranger = randomBytes(32).toString("base64url");
  assert.equal((await call("/setup/verify", { method: "POST", body: { token: stranger } })).status, 403);
  const issued = spawnSync(process.execPath, ["scripts/setup-token.mjs", "--url"], {
    encoding: "utf8",
    env: process.env,
  });
  assert.equal(issued.status, 0, issued.stderr);
  const token = new URL(issued.stdout.trim()).hash.replace("#setup=", "");
  const defaults = (await call("/setup/verify", { method: "POST", body: { token } })).json.defaults;
  assert.equal(defaults.organizationCode, process.env.ORGANIZATION_CODE);
  const checks = (await call("/setup/checks", { method: "POST", body: { token } })).json;
  assert.deepEqual([checks.database, checks.storage, checks.storageProvider], ["ok", "ok", "S3"]);
  const password = randomBytes(24).toString("base64url");
  const done = await call("/setup/complete", {
    method: "POST",
    body: {
      token,
      administrator: { username: "guided_admin", displayName: "Guided test administrator", password },
      organization: { name: "Fictional guided institution" },
      appearance: { appName: "Acta Guiada", shortName: "Guiada", accent: "#1b4b8c", timezone: "America/Mexico_City" },
    },
  });
  assert.equal(done.status, 201, JSON.stringify(done.json));
  assert.deepEqual((await call("/setup/status")).json, { state: "COMPLETED" });
  assert.equal((await call("/setup/verify", { method: "POST", body: { token } })).status, 409);
  const session = await login("guided_admin", password);
  const settings = (await call("/settings", { session })).json;
  assert.equal(settings.appName.source, "saved");
  const logo = await call("/settings/assets/logo", {
    method: "POST",
    session,
    body: png(64),
    headers: { "X-Expected-Version": String(settings.version) },
  });
  assert.equal(logo.status, 201, JSON.stringify(logo.json));
  const branding = (await call("/configuration/public")).json;
  assert.equal(branding.appName, "Acta Guiada");
  assert.equal(branding.organizationName, "Fictional guided institution");
  assert.ok(branding.logo.startsWith("/api/v1/configuration/assets/logo"));
  assert.ok(!JSON.stringify(branding).includes(password));
  writeFileSync(file, JSON.stringify({ username: "guided_admin", password }), { mode: 0o600 });
  console.log("Guided installation completed through the proxy.");
}
