// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  loadConfiguration,
  summarizeDraftWrites,
} from "../../scripts/draft-load.mjs";

describe("medición de borradores solo en un laboratorio local", () => {
  const env = {
    ACTA_DRAFT_LOAD_ALLOWED: "true",
    APP_ORIGIN: "http://127.0.0.1:4492",
    ACTA_LOAD_ADMIN_PASSWORD: "solo-prueba-ficticia",
  };
  it("exige autorización, dirección local completa y credenciales privadas", () => {
    expect(loadConfiguration(env).origin).toBe(env.APP_ORIGIN);
    expect(() =>
      loadConfiguration({ ...env, ACTA_DRAFT_LOAD_ALLOWED: "false" }),
    ).toThrow();
    expect(() =>
      loadConfiguration({ ...env, ACTA_LOAD_ADMIN_PASSWORD: "" }),
    ).toThrow();
    for (const origin of [
      "https://example.org",
      "http://127.0.0.1",
      "http://localhost:4492/ruta",
      "http://usuario@localhost:4492",
      "http://localhost:4492?x=1",
    ])
      expect(() => loadConfiguration({ ...env, APP_ORIGIN: origin })).toThrow();
  });
  it("informa fallos y percentiles sin presentarlos como guardados correctos", () => {
    expect(
      summarizeDraftWrites([
        { status: 200, ms: 10 },
        { status: 201, ms: 20 },
        { status: 500, ms: 100 },
        { status: 0, ms: 120 },
      ]),
    ).toEqual({
      requests: 4,
      successful: 2,
      http: { 200: 1, 201: 1, 500: 1, 0: 1 },
      minMs: 10,
      medianMs: 60,
      p95Ms: 120,
      maxMs: 120,
    });
    expect(() => summarizeDraftWrites([])).toThrow();
    expect(() => summarizeDraftWrites([{ status: 200, ms: NaN }])).toThrow();
  });
});
