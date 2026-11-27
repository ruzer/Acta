import { describe, expect, it } from "vitest";
import {
  argumentsForRehearsal,
  rehearsalBase,
  compareSnapshots,
  verifyRehearsalMigrations,
  responseDeadlineMigration,
} from "../../scripts/upgrade-rehearsal.mjs";

const args = [
  "--phase",
  "prepare",
  "--root",
  "/tmp/source",
  "--project",
  "acta-upgrade-example",
  "--origin",
  "http://127.0.0.1:4491",
  "--state",
  "/tmp/private/state.json",
];
describe("precondiciones del ensayo, sin Docker", () => {
  it("acepta únicamente un laboratorio local explícito", () => {
    expect(argumentsForRehearsal(args)).toMatchObject({
      phase: "prepare",
      project: "acta-upgrade-example",
      origin: "http://127.0.0.1:4491",
    });
  });
  it("permite medir solo con las mismas precondiciones de laboratorio", () => {
    expect(
      argumentsForRehearsal(
        args.map((value) => (value === "prepare" ? "measure" : value)),
      ).phase,
    ).toBe("measure");
  });
  it.each([
    ["--project", "production"],
    ["--project", "acta-upgrade-x;echo"],
    ["--origin", "https://example.org"],
    ["--origin", "http://user:pass@127.0.0.1:4491"],
    ["--phase", "destroy"],
  ])("rechaza %s=%s antes de operar", (key, value) => {
    const input = [...args];
    input[input.indexOf(key) + 1] = value;
    expect(() => argumentsForRehearsal(input)).toThrow();
  });
  it("rechaza argumentos ausentes, desconocidos o repetidos", () => {
    for (const input of [
      [],
      ["--phase"],
      [...args, "--unknown", "x"],
      [...args, "--phase", "verify"],
    ])
      expect(() => argumentsForRehearsal(input)).toThrow();
  });
});
describe("integridad del contenido persistido", () => {
  const before = {
    Question: ["hash-original"],
    AuditEvent: ["audit-original"],
  };
  it("admite auditoría adicional sin alterar eventos anteriores", () => {
    expect(() =>
      compareSnapshots(before, {
        ...before,
        AuditEvent: ["audit-original", "audit-new"],
      }),
    ).not.toThrow();
  });
  it.each([
    { Question: [], AuditEvent: ["audit-original"] },
    { Question: ["hash-alterado"], AuditEvent: ["audit-original"] },
    {
      Question: ["hash-original", "hash-inesperado"],
      AuditEvent: ["audit-original"],
    },
    { Question: ["hash-original"], AuditEvent: [] },
    { Question: ["hash-original"] },
  ])("detecta pérdida, alteración o adición inesperada", (after) => {
    expect(() => compareSnapshots(before, after)).toThrow();
  });
});

it("admite solo la migración de fecha límite y conserva las trece previas", () => {
  const original = Array.from({ length: 13 }, (_, i) => `migration-${i}`);
  expect(() =>
    verifyRehearsalMigrations(original, [
      ...original,
      responseDeadlineMigration,
    ]),
  ).not.toThrow();
  for (const after of [
    original,
    [...original, "unexpected"],
    [...original.slice(1), responseDeadlineMigration],
    [...original, responseDeadlineMigration, "extra"],
  ])
    expect(() => verifyRehearsalMigrations(original, after)).toThrow();
});


describe("actualización sin migraciones desde v0.12.0", () => {
  const original = [...Array.from({ length: 13 }, (_, i) => `migration-${i}`), responseDeadlineMigration];
  it("conserva exactamente las catorce migraciones", () => {
    expect(rehearsalBase("0.12.0")).toEqual({migrationCount: 14, alreadyHasDeadline: true});
    expect(() => verifyRehearsalMigrations(original, [...original].reverse(), "0.12.0")).not.toThrow();
  });
  it.each([
    original.slice(1), [...original, "extra"],
    [...original.slice(0, -1), "replacement"],
    [...original.slice(0, -1), original[0]],
  ])("rechaza pérdida, adición, sustitución o duplicado", (after) => {
    expect(() => verifyRehearsalMigrations(original, after, "0.12.0")).toThrow();
  });
  it("rechaza una base con trece migraciones o sin la de fecha límite", () => {
    expect(() => verifyRehearsalMigrations(original.slice(0, -1), original, "0.12.0")).toThrow();
    expect(() => verifyRehearsalMigrations([...original.slice(0, -1), "other"], original, "0.12.0")).toThrow();
  });
  it.each(["0.10.0", "0.11.0"])("conserva la ruta histórica de %s", (version) => {
    expect(() => verifyRehearsalMigrations(original.slice(0, -1), original, version)).not.toThrow();
  });
  it.each(["0.12.1", "0.13.0", "unknown"])("rechaza bases no autorizadas: %s", (version) => {
    expect(() => rehearsalBase(version)).toThrow();
  });
});
