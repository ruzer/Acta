import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const exceptions = {
  "GHSA-fc5q-39xc-vjpf": {
    hasta: "2027-01-15",
    motivo:
      "Solo herramientas de desarrollo, sin uso en ejecución y sin versión corregida; npm audit --omit=dev = 0. La imagen del backend incluye el paquete en disco, sin usarlo.",
  },
};
const severities = ["info", "low", "moderate", "high", "critical"];
const object = (value) =>
  value && typeof value === "object" && !Array.isArray(value);

export function evaluateAudit(json, now = new Date()) {
  assert.ok(
    now instanceof Date && Number.isFinite(now.getTime()),
    "Fecha de auditoría inválida.",
  );
  for (const [id, exception] of Object.entries(exceptions)) {
    assert.ok(
      now.toISOString().slice(0, 10) <= exception.hasta,
      `${id}: excepción caducada, vuelve a evaluar. Retira o justifica de nuevo la excepción.`,
    );
  }
  const report = JSON.parse(json);
  assert.ok(
    object(report) && !report.error && object(report.vulnerabilities),
    "Salida de npm audit incompleta o con error.",
  );
  const advisories = new Map();
  const entries = report.vulnerabilities;
  if (report.metadata?.vulnerabilities) {
    const counts = report.metadata.vulnerabilities;
    assert.equal(
      counts.total,
      Object.keys(entries).length,
      "Recuentos de npm audit inconsistentes.",
    );
    for (const severity of severities)
      assert.equal(
        counts[severity],
        Object.values(entries).filter((entry) => entry?.severity === severity)
          .length,
        "Severidades de npm audit inconsistentes.",
      );
  }
  for (const entry of Object.values(entries)) {
    assert.ok(
      object(entry) &&
        severities.includes(entry.severity) &&
        Array.isArray(entry.via) &&
        entry.via.length > 0,
      "Entrada de vulnerabilidad inválida.",
    );
    for (const via of entry.via) {
      if (typeof via === "string") {
        assert.ok(
          Object.hasOwn(entries, via),
          "Referencia de vulnerabilidad sin resolver.",
        );
        continue;
      }
      assert.ok(
        object(via) &&
          typeof via.url === "string" &&
          via.url.length > 0 &&
          severities.includes(via.severity),
        "Aviso de vulnerabilidad inválido.",
      );
      const id =
        /^https:\/\/github\.com\/advisories\/(GHSA-[a-z0-9-]+)$/.exec(
          via.url,
        )?.[1] ?? via.url;
      const previous = advisories.get(id);
      if (
        !previous ||
        severities.indexOf(via.severity) > severities.indexOf(previous.severity)
      )
        advisories.set(id, { id, severity: via.severity });
    }
  }
  // Una cadena o ciclo sin aviso original nunca puede convertir un high en PASS.
  const resolves = (name, seen = new Set()) => {
    if (seen.has(name)) return false;
    return entries[name].via.some(
      (via) =>
        typeof via !== "string" || resolves(via, new Set([...seen, name])),
    );
  };
  for (const name of Object.keys(entries))
    assert.ok(resolves(name), "Cadena de vulnerabilidad sin aviso original.");

  const ignored = [];
  const blocked = [];
  for (const advisory of advisories.values()) {
    if (Object.hasOwn(exceptions, advisory.id))
      ignored.push({ ...advisory, ...exceptions[advisory.id] });
    else if (["high", "critical"].includes(advisory.severity))
      blocked.push(advisory);
  }
  return { ignored, blocked, advisoryCount: advisories.size };
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  try {
    const result = spawnSync("npm", ["audit", "--json"], {
      encoding: "utf8",
      maxBuffer: 16 * 1024 * 1024,
      timeout: 180000,
    });
    assert.ok(
      !result.error && [0, 1].includes(result.status),
      "npm audit no terminó correctamente; no se acepta el resultado.",
    );
    const audit = evaluateAudit(result.stdout);
    assert.ok(
      result.status === 0 || audit.advisoryCount > 0,
      "npm audit falló sin aportar avisos verificables.",
    );
    for (const item of audit.ignored)
      console.log(
        `ACEPTADO hasta ${item.hasta} (inclusive, UTC): ${item.id}. ${item.motivo}`,
      );
    for (const item of audit.blocked)
      console.error(`BLOQUEADO: ${item.id}, severidad ${item.severity}.`);
    console.log(
      `${audit.blocked.length ? "FAIL" : "PASS"}: ${audit.advisoryCount} avisos distintos; ${audit.ignored.length} aceptados explícitamente; ${audit.blocked.length} altos/críticos sin aceptar.`,
    );
    process.exitCode = audit.blocked.length ? 1 : 0;
  } catch (error) {
    console.error(
      `FAIL: ${error instanceof SyntaxError ? "JSON de npm audit inválido." : error.message}`,
    );
    process.exitCode = 1;
  }
}
