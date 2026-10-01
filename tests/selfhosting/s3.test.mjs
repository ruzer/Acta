import { test, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import {
  S3Storage,
  s3Configuration,
  objectKey,
} from "../../app/backend/dist/responses/s3-storage.js";
import {
  verifiedBytes,
  sha256,
} from "../../app/backend/dist/responses/storage.js";
assert.equal(
  process.env.SELFHOST_STORAGE_TEST_ALLOWED,
  "true",
  "Dedicated disposable bucket required",
);
const storage = new S3Storage();
const config = s3Configuration();
const client = new S3Client(config.options);
const keys = [];
after(async () => {
  for (const key of keys) await storage.remove(key);
  client.destroy();
});
test("S3 real: private object, exact bytes/hash, no anonymous access", async () => {
  const bytes = Buffer.from("Fictional storage integration fixture");
  const key = await storage.put(bytes);
  keys.push(key);
  assert.deepEqual(
    await verifiedBytes(storage, {
      backend: "S3",
      storageKey: key,
      byteSize: BigInt(bytes.length),
      sha256: sha256(bytes),
    }),
    bytes,
  );
  await assert.rejects(
    () =>
      verifiedBytes(storage, {
        backend: "S3",
        storageKey: key,
        byteSize: BigInt(bytes.length),
        sha256: "0".repeat(64),
      }),
    /integridad/,
  );
  assert.equal(
    (
      await fetch(
        `${config.options.endpoint}/${config.bucket}/${objectKey(key)}`,
      )
    ).status,
    403,
  );
  await assert.rejects(
    () =>
      client.send(
        new GetObjectCommand({
          Bucket: config.bucket,
          Key: "outside-prefix/private",
        }),
      ),
    (e) => e.$metadata?.httpStatusCode === 403,
  );
});
test("S3 real: missing object and oversized stored object are rejected", async () => {
  await assert.rejects(
    () => storage.read(randomUUID()),
    (e) => e.$metadata?.httpStatusCode === 404,
  );
  const bytes = Buffer.alloc(
    Number(process.env.EVIDENCE_MAX_BYTES || 20971520) + 1,
  );
  await assert.rejects(() => storage.put(bytes), /EvidenceTooLarge/);
  const key = randomUUID();
  keys.push(key);
  await client.send(
    new PutObjectCommand({
      Bucket: config.bucket,
      Key: objectKey(key),
      Body: bytes,
    }),
  );
  await assert.rejects(() => storage.read(key), /EvidenceTooLarge/);
});
test("S3 unavailable: health/write/read fail instead of pretending persistence", async () => {
  const previous = process.env.S3_ENDPOINT;
  process.env.S3_ENDPOINT = "http://127.0.0.1:1";
  let unavailable;
  try {
    unavailable = new S3Storage();
  } finally {
    process.env.S3_ENDPOINT = previous;
  }
  await assert.rejects(() => unavailable.health());
  await assert.rejects(() => unavailable.put(Buffer.from("not persisted")));
  await assert.rejects(() => unavailable.read(randomUUID()));
});

test("S3 conditional creation never overwrites an existing object", async () => {
  const key = randomUUID();
  keys.push(key);
  const put = (text) =>
    client.send(
      new PutObjectCommand({
        Bucket: config.bucket,
        Key: objectKey(key),
        Body: Buffer.from(text),
        IfNoneMatch: "*",
      }),
    );
  const results = await Promise.allSettled([put("first"), put("second")]);
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  const failure = results.find((r) => r.status === "rejected");
  assert.equal(failure.reason.$metadata.httpStatusCode, 412);
  const stored = await storage.read(key);
  assert.equal(
    stored.toString(),
    results[0].status === "fulfilled" ? "first" : "second",
  );
});
