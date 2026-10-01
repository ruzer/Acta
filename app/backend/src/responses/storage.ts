import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import {
  mkdir,
  open,
  readFile,
  rename,
  unlink,
  readdir,
  stat,
  access,
} from "node:fs/promises";
import { join, resolve } from "node:path";
import { S3Storage } from "./s3-storage.js";
import { createHash, randomUUID } from "node:crypto";
export const STORAGE = Symbol("STORAGE");
export interface StorageProvider {
  readonly backend: "LOCAL" | "MINIO" | "S3";
  health?(): Promise<void>;
  resolve?(backend: string): StorageProvider;
  put(bytes: Uint8Array): Promise<string>;
  read(key: string): Promise<Buffer>;
  remove(key: string): Promise<void>;
  candidates(before: Date): Promise<string[]>;
}
export function sha256(bytes: Uint8Array | string) {
  return createHash("sha256").update(bytes).digest("hex");
}
@Injectable()
export class LocalStorage implements StorageProvider {
  readonly backend = "LOCAL" as const;
  private readonly root = resolve(
    process.env.EVIDENCE_ROOT || "./.private-evidence",
  );
  private path(key: string) {
    if (!/^[0-9a-f-]{36}(\.tmp)?$/.test(key))
      throw new Error("InvalidStorageKey");
    return join(this.root, key);
  }
  async health() {
    await mkdir(this.root, { recursive: true, mode: 0o700 });
    await access(this.root, 6);
  }
  async put(bytes: Uint8Array) {
    await mkdir(this.root, { recursive: true, mode: 0o700 });
    const key = randomUUID();
    const f = await open(this.path(key + ".tmp"), "wx", 0o600);
    try {
      await f.writeFile(bytes);
      await f.sync();
    } finally {
      await f.close();
    }
    await rename(this.path(key + ".tmp"), this.path(key));
    const dir = await open(this.root, "r");
    try {
      await dir.sync();
    } finally {
      await dir.close();
    }
    return key;
  }
  async read(key: string) {
    return readFile(this.path(key));
  }
  async remove(key: string) {
    await unlink(this.path(key)).catch((e: NodeJS.ErrnoException) => {
      if (e.code !== "ENOENT") throw e;
    });
  }
  async candidates(before: Date) {
    await mkdir(this.root, { recursive: true, mode: 0o700 });
    const result: string[] = [];
    for (const key of await readdir(this.root))
      if (
        /^[0-9a-f-]{36}(\.tmp)?$/.test(key) &&
        (await stat(this.path(key))).mtime < before
      )
        result.push(key);
    return result;
  }
}
export async function verifiedBytes(
  storage: StorageProvider,
  e: { storageKey: string; sha256: string; byteSize: bigint; backend: string },
) {
  try {
    storage = storage.resolve?.(e.backend) ?? storage;
    if (
      e.backend !== storage.backend &&
      !(e.backend === "MINIO" && storage.backend === "S3")
    )
      throw new Error("StorageBackendMismatch");
    const bytes = await storage.read(e.storageKey);
    if (BigInt(bytes.length) !== e.byteSize || sha256(bytes) !== e.sha256)
      throw new Error("EvidenceIntegrity");
    return bytes;
  } catch {
    throw new ServiceUnavailableException(
      "La evidencia no está disponible o no pasó la comprobación de integridad. Inténtalo más tarde.",
    );
  }
}

// Select the write provider; keep existing LOCAL evidence readable during transition.
export function createStorage(): StorageProvider {
  const provider = process.env.STORAGE_PROVIDER || "LOCAL";
  if (!["LOCAL", "S3"].includes(provider))
    throw new Error("Invalid STORAGE_PROVIDER");
  if (provider === "LOCAL") return new LocalStorage();
  const primary = new S3Storage();
  const legacy = new LocalStorage();
  return {
    backend: primary.backend,
    put: (bytes) => primary.put(bytes),
    read: (key) => primary.read(key),
    remove: (key) => primary.remove(key),
    candidates: (before) => primary.candidates(before),
    health: () => primary.health(),
    resolve: (backend) => {
      if (backend === "LOCAL") return legacy;
      if (backend === "S3" || backend === "MINIO") return primary;
      throw new Error("UnknownStorageBackend");
    },
  };
}
