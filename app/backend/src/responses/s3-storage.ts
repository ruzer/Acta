import { randomUUID } from "node:crypto";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
  HeadBucketCommand,
} from "@aws-sdk/client-s3";
import type { StorageProvider } from "./storage.js";
import { evidenceLimits } from "./file-validation.js";
export function objectKey(key: string) {
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(key)
  )
    throw new Error("InvalidStorageKey");
  return `evidence/v1/${key}`;
}
export function s3Configuration() {
  const endpoint = process.env.S3_ENDPOINT;
  const bucket = process.env.S3_BUCKET;
  const accessKeyId = process.env.S3_ACCESS_KEY;
  const secretAccessKey = process.env.S3_SECRET_KEY;
  if (
    !endpoint ||
    !bucket ||
    !accessKeyId ||
    !secretAccessKey ||
    secretAccessKey.length < 20 ||
    /REPLACE|changeme|minioadmin/i.test(secretAccessKey)
  )
    throw new Error(
      "Invalid S3 configuration; check required variables (values omitted)",
    );
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    // URL constructor errors can include the supplied endpoint (and credentials).
    throw new Error("Invalid S3 endpoint (value omitted)");
  }
  if (
    !["https:", "http:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    !/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(bucket)
  )
    throw new Error("Invalid S3 endpoint or bucket");
  if (
    url.protocol === "http:" &&
    !["minio", "object-storage", "localhost", "127.0.0.1", "[::1]"].includes(
      url.hostname,
    )
  )
    throw new Error("Remote S3 endpoints require HTTPS");
  if (![undefined, "true", "false"].includes(process.env.S3_FORCE_PATH_STYLE))
    throw new Error("Invalid S3_FORCE_PATH_STYLE");
  return {
    bucket,
    options: {
      endpoint,
      region: process.env.S3_REGION || "us-east-1",
      forcePathStyle: process.env.S3_FORCE_PATH_STYLE !== "false",
      credentials: { accessKeyId, secretAccessKey },
      maxAttempts: 3,
      requestHandler: { connectionTimeout: 5000, requestTimeout: 30000 },
    },
  };
}
export class S3Storage implements StorageProvider {
  readonly backend = "S3" as const;
  private readonly config = s3Configuration();
  private readonly client = new S3Client(this.config.options);
  async health() {
    await this.client.send(
      new HeadBucketCommand({ Bucket: this.config.bucket }),
    );
  }
  async put(bytes: Uint8Array) {
    if (bytes.length > evidenceLimits().fileBytes)
      throw new Error("EvidenceTooLarge");
    const key = randomUUID();
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.config.bucket,
        Key: objectKey(key),
        Body: bytes,
        ContentType: "application/octet-stream",
        IfNoneMatch: "*",
      }),
    );
    return key;
  }
  async read(key: string) {
    const response = await this.client.send(
      new GetObjectCommand({ Bucket: this.config.bucket, Key: objectKey(key) }),
    );
    const max = evidenceLimits().fileBytes;
    const body = response.Body;
    if (!body) throw new Error("MissingEvidence");
    const stream = body as AsyncIterable<Uint8Array> & { destroy?: () => void };
    if ((response.ContentLength ?? 0) > max) {
      stream.destroy?.();
      throw new Error("EvidenceTooLarge");
    }
    const chunks: Buffer[] = [];
    let size = 0;
    try {
      for await (const chunk of stream) {
        size += chunk.length;
        if (size > max) throw new Error("EvidenceTooLarge");
        chunks.push(Buffer.from(chunk));
      }
    } finally {
      stream.destroy?.();
    }
    return Buffer.concat(chunks, size);
  }
  async remove(key: string) {
    await this.client.send(
      new DeleteObjectCommand({
        Bucket: this.config.bucket,
        Key: objectKey(key),
      }),
    );
  }
  async candidates(before: Date) {
    const keys: string[] = [];
    let token: string | undefined;
    do {
      const page = await this.client.send(
        new ListObjectsV2Command({
          Bucket: this.config.bucket,
          Prefix: "evidence/v1/",
          ContinuationToken: token,
          MaxKeys: 1000,
        }),
      );
      for (const item of page.Contents ?? []) {
        const key = item.Key?.slice("evidence/v1/".length);
        if (
          key &&
          item.LastModified &&
          item.LastModified < before &&
          /^[0-9a-f-]{36}$/.test(key)
        ) {
          objectKey(key);
          keys.push(key);
        }
      }
      token = page.IsTruncated ? page.NextContinuationToken : undefined;
    } while (token);
    return keys;
  }
}
