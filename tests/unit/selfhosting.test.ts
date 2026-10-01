import { afterEach, describe, expect, it } from "vitest";
import { publicBranding } from "../../app/backend/src/common/config";
import {
  objectKey,
  s3Configuration,
} from "../../app/backend/src/responses/s3-storage";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  createStorage,
  LocalStorage,
  sha256,
  verifiedBytes,
} from "../../app/backend/src/responses/storage";
const original = { ...process.env };
afterEach(() => {
  process.env = { ...original };
});
describe("Self-hosting boundaries", () => {
  it("public config exposes only approved branding, never credentials", () => {
    process.env.S3_SECRET_KEY = "private-value-not-for-public-output";
    process.env.APP_NAME = "Neutral workspace";
    const b = publicBranding();
    expect(b.appName).toBe("Neutral workspace");
    expect(Object.keys(b).sort()).toEqual(
      [
        "accent",
        "appName",
        "favicon",
        "locale",
        "logo",
        "organizationName",
        "shortName",
        "timezone",
      ].sort(),
    );
    expect(JSON.stringify(b)).not.toContain("private-value");
  });
  it("rejects remote branding, path traversal and unreadable accent", () => {
    for (const logo of [
      "https://tracker.example/image.png",
      "/branding/../config",
      "//external.example/x.png",
    ]) {
      process.env.APP_LOGO = logo;
      expect(() => publicBranding()).toThrow();
    }
    process.env.APP_LOGO = "";
    process.env.APP_ACCENT = "#ffffff";
    expect(() => publicBranding()).toThrow(/contrast/);
  });
  it("validates timezone and locale; accepts local assets", () => {
    process.env.APP_LOGO = "/branding/logo.png";
    process.env.DEFAULT_TIMEZONE = "Europe/Madrid";
    expect(publicBranding().timezone).toBe("Europe/Madrid");
    process.env.DEFAULT_TIMEZONE = "not-a-zone";
    expect(() => publicBranding()).toThrow();
  });
  it("object keys never use user filenames or traversal", () => {
    for (const key of [
      "../outside",
      "a/b",
      "%2e%2e",
      "https://example.test/file",
      "file.pdf",
      "00000000-0000-0000-0000-000000000000/extra",
    ])
      expect(() => objectKey(key)).toThrow();
    expect(objectKey("00000000-0000-0000-0000-000000000000")).toBe(
      "evidence/v1/00000000-0000-0000-0000-000000000000",
    );
  });
  it("rejects missing S3 secrets and insecure remote endpoints", () => {
    delete process.env.S3_SECRET_KEY;
    expect(() => s3Configuration()).toThrow();
    Object.assign(process.env, {
      S3_ENDPOINT: "http://public.example.test",
      S3_BUCKET: "private-evidence",
      S3_ACCESS_KEY: "fixture-access",
      S3_SECRET_KEY: "fixture-only-not-real-credential-123",
    });
    expect(() => s3Configuration()).toThrow(/HTTPS/);
    process.env.S3_ENDPOINT = "https://objects.example.test";
    expect(s3Configuration().bucket).toBe("private-evidence");
  });
  it("invalid endpoint errors never echo configuration values", () => {
    Object.assign(process.env, {
      S3_ENDPOINT: "not-a-url-with-private-content",
      S3_BUCKET: "private-evidence",
      S3_ACCESS_KEY: "fixture-access",
      S3_SECRET_KEY: "fixture-only-not-real-credential-123",
    });
    expect(() => s3Configuration()).toThrow(
      "Invalid S3 endpoint (value omitted)",
    );
    try {
      s3Configuration();
    } catch (error) {
      expect(String(error)).not.toContain("private-content");
    }
  });
  it("S3 default preserves existing LOCAL evidence and verifies its integrity", async () => {
    const directory = await mkdtemp(join(tmpdir(), "legacy-storage-test-"));
    Object.assign(process.env, {
      EVIDENCE_ROOT: directory,
      STORAGE_PROVIDER: "S3",
      S3_ENDPOINT: "http://minio:9000",
      S3_BUCKET: "private-evidence",
      S3_ACCESS_KEY: "fixture-access",
      S3_SECRET_KEY: "fixture-only-not-real-credential-123",
    });
    try {
      const bytes = Buffer.from("fictional legacy evidence");
      const storageKey = await new LocalStorage().put(bytes);
      const provider = createStorage();
      const evidence = {
        storageKey,
        backend: "LOCAL",
        byteSize: BigInt(bytes.length),
        sha256: sha256(bytes),
      };
      expect(provider.backend).toBe("S3");
      expect(await verifiedBytes(provider, evidence)).toEqual(bytes);
      await expect(
        verifiedBytes(provider, { ...evidence, sha256: "0".repeat(64) }),
      ).rejects.toThrow(/integridad/);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
