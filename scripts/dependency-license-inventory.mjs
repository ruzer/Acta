// Metadatos declarados, no una autorización legal ni evidencia de binarios instalados.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, posix, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const attribution = new Set([
  "MIT",
  "ISC",
  "BSD-2-Clause",
  "BSD-3-Clause",
  "Apache-2.0",
  "MPL-2.0",
  "CC-BY-4.0",
  "BlueOak-1.0.0",
  "(MIT AND Zlib)",
  "MIT and ISC",
]);
const compatible = new Set(["0BSD", "Unlicense", "CC0-1.0", "MIT-0"]);
const columns = [
  "package",
  "version",
  "declaredLicense",
  "lockfilePath",
  "devFlag",
  "optionalFlag",
  "classification",
  "redistribution",
  "evidence",
  "source",
  "integrity",
];
const csvCell = (value) =>
  /[",\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;

export function dependencyInventory(lock) {
  const rows = Object.entries(lock.packages)
    .filter(([path, pkg]) => path.includes("node_modules/") && !pkg.link)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([path, pkg]) => {
      const license = pkg.license || "NO DECLARADA";
      const classification = attribution.has(license)
        ? "ATTRIBUTION REQUIRED"
        : compatible.has(license)
          ? "COMPATIBLE"
          : "REVIEW REQUIRED";
      return {
        package: pkg.name || path.split("node_modules/").at(-1),
        version: pkg.version,
        declaredLicense: license,
        lockfilePath: path,
        devFlag: pkg.dev ? "True" : "False",
        optionalFlag: pkg.optional ? "True" : "False",
        classification,
        redistribution:
          classification === "REVIEW REQUIRED"
            ? "Revisar términos exactos y obligaciones de redistribución; conservar avisos y fuentes aplicables."
            : "Conservar licencia y avisos completos; aplicar las obligaciones descritas en THIRD-PARTY-NOTICES.md.",
        evidence:
          "Metadatos de package-lock.json; no verifica textos de licencia ni binarios instalados.",
        source: pkg.resolved || "",
        integrity: pkg.integrity || "",
      };
    });
  const direct = new Map();
  for (const [workspace, pkg] of Object.entries(lock.packages)) {
    if (workspace.includes("node_modules")) continue;
    for (const name of Object.keys({
      ...pkg.dependencies,
      ...pkg.devDependencies,
    })) {
      let dir = workspace;
      let dependency;
      while (!dependency) {
        dependency = lock.packages[posix.join(dir, "node_modules", name)];
        if (dependency || !dir || dir === ".") break;
        dir = posix.dirname(dir);
      }
      if (!dependency) throw Error(`Dependencia sin resolver: ${name}`);
      if (dependency.link) continue;
      direct.set(`${name}@${dependency.version}`, [
        name,
        dependency.version,
        dependency.license || "NO DECLARADA",
      ]);
    }
  }
  return {
    rows,
    csv:
      [
        columns.join(","),
        ...rows.map((row) => columns.map((key) => csvCell(row[key])).join(",")),
      ].join("\n") + "\n",
    table:
      "| Paquete | Versión | Licencia declarada |\n| --- | --- | --- |\n" +
      [...direct.entries()]
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([, cells]) => `| ${cells.join(" | ")} |`)
        .join("\n"),
  };
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const inventory = dependencyInventory(
    JSON.parse(readFileSync(join(root, "package-lock.json"), "utf8")),
  );
  const noticesPath = join(root, "docs/THIRD-PARTY-NOTICES.md");
  let notices = readFileSync(noticesPath, "utf8");
  const fonts = notices.indexOf("\n## Fonts\n");
  if (fonts < 0 || !/^- \*\*npm\*\*: .+$/m.test(notices))
    throw Error("No se encontraron las secciones del inventario.");
  const counts = Object.entries(
    Object.groupBy(inventory.rows, (row) => row.classification),
  )
    .map(([name, entries]) => `${entries.length} \`${name}\``)
    .join(", ");
  notices =
    "# Third-party notices\n\nInventario reproducible de dependencias npm declaradas en `package-lock.json`. Regenerar con `node scripts/dependency-license-inventory.mjs` desde la raíz. Acta conserva AGPL-3.0-only; este inventario no autoriza a relicenciar terceros ni sustituye sus textos y avisos originales.\n\n" +
    inventory.table +
    "\n" +
    notices.slice(fonts);
  notices = notices.replace(
    /^- \*\*npm\*\*: .+$/m,
    `- **npm**: [${inventory.rows.length} entradas del lockfile](DEPENDENCY-LICENSES.csv): ${counts}. Incluye paquetes opcionales de otras plataformas. Versión, licencia declarada, origen e integridad proceden del lockfile; no se afirma haber inspeccionado cada licencia instalada. Las clasificaciones conservan los criterios de la tabla inferior; una licencia desconocida queda como \`REVIEW REQUIRED\`. No constituye una autorización legal de redistribución.`,
  );
  writeFileSync(join(root, "docs/DEPENDENCY-LICENSES.csv"), inventory.csv);
  writeFileSync(noticesPath, notices);
  console.log(`Inventario: ${inventory.rows.length} entradas; ${counts}.`);
}
