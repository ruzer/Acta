import { describe, expect, it } from "vitest";
import { evaluateAudit } from "../../scripts/audit-gate.mjs";

const now = new Date("2026-11-17T18:00:00Z");
const accepted = "GHSA-fc5q-39xc-vjpf";
const via = (id = accepted, severity = "high") => ({
  url: `https://github.com/advisories/${id}`,
  severity,
});
const report = (advisory = via()) =>
  JSON.stringify({
    vulnerabilities: {
      picomatch: { severity: advisory.severity, via: [advisory] },
      tool: { severity: advisory.severity, via: ["picomatch", advisory] },
    },
  });

describe("gate completo de dependencias con excepción acotada", () => {
  it("rechaza un resumen que indique avisos ausentes del detalle", () => {
    expect(() =>
      evaluateAudit(
        JSON.stringify({
          vulnerabilities: {},
          metadata: { vulnerabilities: { total: 1, high: 1 } },
        }),
        now,
      ),
    ).toThrow("Recuentos");
  });
  it("acepta solo el aviso autorizado y lo deduplica con sus transitivas", () => {
    expect(evaluateAudit(report(), now)).toMatchObject({
      advisoryCount: 1,
      blocked: [],
      ignored: [{ id: accepted, hasta: "2027-01-15" }],
    });
  });
  it.each(["high", "critical"])(
    "bloquea un nuevo aviso %s aunque también exista el aceptado",
    (severity) => {
      const data = JSON.parse(report());
      data.vulnerabilities.other = {
        severity,
        via: [via("GHSA-abcd-efgh-ijkl", severity)],
      };
      expect(evaluateAudit(JSON.stringify(data), now).blocked).toEqual([
        { id: "GHSA-abcd-efgh-ijkl", severity },
      ]);
    },
  );
  it("la excepción caduca al terminar el día UTC indicado, aunque desaparezca el aviso", () => {
    expect(() =>
      evaluateAudit(report(), new Date("2027-01-15T23:59:59.999Z")),
    ).not.toThrow();
    for (const json of [report(), '{"vulnerabilities":{}}'])
      expect(() =>
        evaluateAudit(json, new Date("2027-01-16T00:00:00Z")),
      ).toThrow("excepción caducada, vuelve a evaluar");
  });
  it("acepta un informe válido sin vulnerabilidades", () => {
    expect(evaluateAudit('{"vulnerabilities":{}}', now)).toEqual({
      advisoryCount: 0,
      ignored: [],
      blocked: [],
    });
  });
  it.each([
    "",
    "no es JSON",
    "null",
    "{}",
    '{"error":{"code":"ENETUNREACH"},"vulnerabilities":{}}',
  ])("rechaza JSON inválido, incompleto o con error: %s", (json) => {
    expect(() => evaluateAudit(json, now)).toThrow();
  });
  it("no acepta una URL distinta que incluya el identificador autorizado", () => {
    expect(
      evaluateAudit(
        report({ ...via(), url: `https://example.invalid/${accepted}` }),
        now,
      ).blocked,
    ).toHaveLength(1);
  });
  it.each([
    { high: { severity: "high", via: [] } },
    { high: { severity: "high", via: ["missing"] } },
    { high: { severity: "high", via: ["high"] } },
    { high: { severity: "unknown", via: [via()] } },
  ])("no ignora avisos incompletos o cadenas sin origen", (vulnerabilities) => {
    expect(() =>
      evaluateAudit(JSON.stringify({ vulnerabilities }), now),
    ).toThrow();
  });
  it("conserva la política de severidad para avisos moderados sin aceptarlos como excepción", () => {
    expect(
      evaluateAudit(report(via("GHSA-abcd-efgh-ijkl", "moderate")), now),
    ).toEqual({ advisoryCount: 1, ignored: [], blocked: [] });
  });
});
