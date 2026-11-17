import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dependencyInventory } from "../../scripts/dependency-license-inventory.mjs";

describe("inventario de licencias npm", () => {
  it("resuelve dependencias directas anidadas y no licencia los workspaces", () => {
    const inventory = dependencyInventory({
      packages: {
        "": { devDependencies: { tool: "1" } },
        "app/frontend": { dependencies: { tool: "2", local: "1" } },
        "node_modules/tool": { version: "1", license: "MIT", dev: true },
        "app/frontend/node_modules/tool": { version: "2", license: "ISC" },
        "node_modules/local": { link: true, resolved: "packages/local" },
      },
    });
    expect(inventory.rows).toHaveLength(2);
    expect(inventory.table).toContain("| tool | 1 | MIT |");
    expect(inventory.table).toContain("| tool | 2 | ISC |");
    expect(inventory.table).not.toContain("local");
  });
  it("mantiene revisión requerida para licencias ausentes o no clasificadas y escapa CSV", () => {
    const inventory = dependencyInventory({
      packages: {
        "node_modules/unknown": { version: "1" },
        "node_modules/native": {
          version: "1",
          license: "LGPL-3.0-or-later",
          optional: true,
        },
        "node_modules/other": {
          version: "1",
          license: 'Términos, "especiales"',
        },
      },
    });
    expect(
      inventory.rows.every(
        (row: { classification: string }) =>
          row.classification === "REVIEW REQUIRED",
      ),
    ).toBe(true);
    expect(inventory.csv).toContain('"Términos, ""especiales"""');
    expect(inventory.csv).toContain("NO DECLARADA");
  });
  it("el inventario versionado coincide con el lockfile y conserva react-hook-form", () => {
    const inventory = dependencyInventory(
      JSON.parse(readFileSync("package-lock.json", "utf8")),
    );
    expect(inventory.csv).toBe(
      readFileSync("docs/DEPENDENCY-LICENSES.csv", "utf8"),
    );
    expect(inventory.table).toContain("| react-hook-form |");
    expect(inventory.table).not.toContain("@hookform/resolvers");
    expect(readFileSync("docs/THIRD-PARTY-NOTICES.md", "utf8")).toContain(
      inventory.table,
    );
  });
});
