import { describe, expect, it } from "vitest";
import {
  argumentsForRehearsal,
  compareSnapshots,
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
