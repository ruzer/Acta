// @vitest-environment node
import { afterEach, describe, it, expect, vi } from "vitest";
import {
  loadConfiguration,
  summarizeDraftWrites,
  scheduleDraftWrites,
} from "../../scripts/draft-load.mjs";
afterEach(() => vi.useRealTimers());

it("espacia cien guardados en dos rondas sin solapar peticiones de la misma persona", async () => {
  vi.useFakeTimers();
  const times: { person: number; round: number; time: number }[] = [];
  const active = new Set<number>();
  const start = performance.now();
  const result = scheduleDraftWrites(async (person: number, round: number) => {
    expect(active.has(person)).toBe(false);
    active.add(person);
    times.push({ person, round, time: performance.now() - start });
    if (person === 0 && round === 0)
      await new Promise((resolve) => setTimeout(resolve, 40000));
    active.delete(person);
    return { status: 200, ms: 1 };
  }, "paced");
  await vi.runAllTimersAsync();
  expect(await result).toHaveLength(100);
  for (let person = 0; person < 50; person++) {
    expect(times.find((t) => t.person === person && t.round === 0)!.time).toBe(
      person * 600,
    );
    expect(times.find((t) => t.person === person && t.round === 1)!.time).toBe(
      person === 0 ? 40000 : (50 + person) * 600,
    );
  }
});
it("el modo anterior sigue lanzando cincuenta guardados sin espaciamiento ni segunda ronda", async () => {
  const write = vi.fn(async () => ({ status: 200, ms: 1 }));
  expect(await scheduleDraftWrites(write, "simultaneous")).toHaveLength(50);
  expect(write.mock.calls).toEqual(
    Array.from({ length: 50 }, (_, i) => [i, 0]),
  );
});

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
  it("conserva el ensayo simultáneo y permite solo el ritmo espaciado explícito", () => {
    expect(loadConfiguration(env).mode).toBe("simultaneous");
    expect(
      loadConfiguration({ ...env, ACTA_DRAFT_LOAD_MODE: "paced" }).mode,
    ).toBe("paced");
    expect(() =>
      loadConfiguration({ ...env, ACTA_DRAFT_LOAD_MODE: "unknown" }),
    ).toThrow("Modo");
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
