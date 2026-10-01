// @vitest-environment node
import { describe, it, expect } from "vitest";
import { mkdtemp, rm, utimes } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import {
  saveDraftInput,
  ResponseContent,
  ResponseQuestionView,
} from "@requirements/contracts";
import { validateAnswer } from "../../app/backend/src/responses/answer-rules";
import {
  LocalStorage,
  StorageProvider,
  verifiedBytes,
  sha256,
} from "../../app/backend/src/responses/storage";
const empty: ResponseContent = {
  answer: null,
  comment: "",
  example: "",
  consultationRequested: false,
};
const q = (
  type: ResponseQuestionView["type"],
  required = true,
  config: Record<string, unknown> | null = null,
) => ({
  type,
  required,
  config,
  options: [
    { value: "A", label: "Primera", order: 1 },
    { value: "B", label: "Segunda", order: 2 },
  ],
});
describe("Contrato y reglas de respuesta", () => {
  it("consulta se guarda incompleta y un envío explícito válido puede consumirla", () => {
    expect(() =>
      validateAnswer(
        q("YES_NO"),
        { ...empty, consultationRequested: true },
        false,
      ),
    ).not.toThrow();
    expect(() =>
      validateAnswer(
        q("YES_NO"),
        { ...empty, answer: true, consultationRequested: true },
        true,
      ),
    ).not.toThrow();
  });
  it("matriz requiere propiedades propias, sin dar por respondidas claves heredadas", () => {
    expect(() =>
      validateAnswer(
        q("MATRIX", true, {
          rows: [{ key: "constructor", label: "Fila" }],
          columns: [{ key: "A", label: "A" }],
        }),
        { ...empty, answer: {} },
        true,
      ),
    ).toThrow();
  });
  it("Zod impide imponer autor, versión enviada, estado y organización", () => {
    for (const field of ["respondentId", "organizationId", "status", "number"])
      expect(() =>
        saveDraftInput.parse({
          ...empty,
          expectedVersion: 0,
          requestId: randomUUID(),
          [field]: "injection",
        }),
      ).toThrow();
  });
  it("opcional sin valor exige comentario al enviar; guardar no lo exige", () => {
    expect(() =>
      validateAnswer(q("SHORT_TEXT", false), empty, false),
    ).not.toThrow();
    expect(() => validateAnswer(q("SHORT_TEXT", false), empty, true)).toThrow();
    expect(() =>
      validateAnswer(
        q("SHORT_TEXT", false),
        { ...empty, comment: "No hay procedimiento ficticio" },
        true,
      ),
    ).not.toThrow();
    expect(() =>
      validateAnswer(q("SHORT_TEXT", false), { ...empty, answer: "  " }, true),
    ).toThrow();
  });
  it("boolean false y número cero son respuestas completas", () => {
    expect(() =>
      validateAnswer(q("YES_NO"), { ...empty, answer: false }, true),
    ).not.toThrow();
    expect(() =>
      validateAnswer(
        q("NUMBER", true, { min: 0 }),
        { ...empty, answer: 0 },
        true,
      ),
    ).not.toThrow();
  });
  it("borrador permite selección parcial pero limita máximos y duplicados", () => {
    const question = q("MULTIPLE_CHOICE", true, {
      minSelections: 2,
      maxSelections: 2,
    });
    expect(() =>
      validateAnswer(question, { ...empty, answer: ["A"] }, false),
    ).not.toThrow();
    expect(() =>
      validateAnswer(question, { ...empty, answer: ["A"] }, true),
    ).toThrow();
    expect(() =>
      validateAnswer(question, { ...empty, answer: ["A", "A"] }, false),
    ).toThrow();
  });
  it("fechas imposibles y fuera de rango no se convierten", () => {
    for (const answer of ["2026-02-29", "2026-13-01", "2025-01-01", 172])
      expect(() =>
        validateAnswer(
          q("DATE", true, { min: "2026-01-01" }),
          { ...empty, answer },
          false,
        ),
      ).toThrow();
    expect(() =>
      validateAnswer(q("DATE"), { ...empty, answer: "2024-02-29" }, true),
    ).not.toThrow();
  });
  it("números: precisión, rango e integer se aplican sin coerción", () => {
    for (const answer of [
      "1",
      NaN,
      Infinity,
      1.1234567,
      Number.MAX_SAFE_INTEGER + 1,
    ])
      expect(() =>
        validateAnswer(q("NUMBER"), { ...empty, answer }, false),
      ).toThrow();
    expect(() =>
      validateAnswer(q("NUMBER"), { ...empty, answer: 1.123456 }, true),
    ).not.toThrow();
    expect(() =>
      validateAnswer(
        q("NUMBER", true, { integer: true }),
        { ...empty, answer: 1.2 },
        false,
      ),
    ).toThrow();
  });
});
class ObjectStoreAdapter implements StorageProvider {
  readonly backend = "MINIO" as const;
  readonly objects = new Map<string, Buffer>();
  async put(bytes: Uint8Array) {
    const key = randomUUID();
    this.objects.set(key, Buffer.from(bytes));
    return key;
  }
  async read(key: string) {
    const b = this.objects.get(key);
    if (!b) throw new Error("missing");
    return Buffer.from(b);
  }
  async remove(key: string) {
    this.objects.delete(key);
  }
  async candidates() {
    return [...this.objects.keys()];
  }
}
for (const adapter of ["LOCAL", "OBJECT"] as const)
  it(`StorageProvider sustituible: ${adapter}, claves opacas, bytes, hash y eliminación idempotente`, async () => {
    const root = await mkdtemp(join(tmpdir(), "requirements-storage-contract-"));
    process.env.EVIDENCE_ROOT = root;
    try {
      const storage: StorageProvider =
          adapter === "LOCAL" ? new LocalStorage() : new ObjectStoreAdapter(),
        bytes = Buffer.from("contenido ficticio");
      const key = await storage.put(bytes);
      expect(key).toMatch(/^[a-f0-9-]{36}$/);
      const e = {
        storageKey: key,
        byteSize: BigInt(bytes.length),
        sha256: sha256(bytes),
        backend: storage.backend,
      };
      expect(await verifiedBytes(storage, e)).toEqual(bytes);
      await expect(
        verifiedBytes(storage, { ...e, sha256: "0".repeat(64) }),
      ).rejects.toThrow();
      if (adapter === "LOCAL") {
        await utimes(join(root, key), new Date(0), new Date(0));
        expect(await storage.candidates(new Date())).toContain(key);
        await expect(storage.read("../secret")).rejects.toThrow();
      }
      await storage.remove(key);
      await storage.remove(key);
      await expect(verifiedBytes(storage, e)).rejects.toThrow();
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
