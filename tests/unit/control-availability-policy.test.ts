import { readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import ts from "typescript";
import { expect, it } from "vitest";

const root = resolve("app/frontend/src");
const sharedControls = new Set([
  "Button",
  "Input",
  "Select",
  "Textarea",
  "Checkbox",
  "Radio",
  "EvidenceFile",
]);

function violations(text: string, file: string) {
  const source = ts.createSourceFile(
    file,
    text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const problems: string[] = [];
  function attributes(node: ts.JsxOpeningElement | ts.JsxSelfClosingElement) {
    return new Map(
      node.attributes.properties
        .filter(ts.isJsxAttribute)
        .map((a) => [a.name.getText(source), a]),
    );
  }
  function active(attribute?: ts.JsxAttribute) {
    return (
      !!attribute &&
      !/^(?:\{(?:false|undefined)\}|"false")$/.test(
        attribute.initializer?.getText(source) ?? "",
      )
    );
  }
  function visit(node: ts.Node) {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const name = node.tagName.getText(source);
      const attrs = attributes(node);
      const fail = (reason: string) => {
        const line =
          source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
        problems.push(`${file}:${line} ${name}: ${reason}`);
      };
      // The primitive implementation is covered by interaction tests: it renders
      // native disabled fields only after validating and associating their reason.
      const primitive = file === "ui/index.tsx" && /^[a-z]/.test(name);
      if (!primitive && active(attrs.get("disabled"))) {
        let explanation = attrs.has("aria-describedby");
        if (name === "option") {
          let parent = node.parent;
          while (parent) {
            if (
              ts.isJsxElement(parent) &&
              /^(Select|select)$/.test(
                parent.openingElement.tagName.getText(source),
              )
            ) {
              const select = attributes(parent.openingElement);
              explanation ||=
                select.has("hint") || select.has("aria-describedby");
              break;
            }
            parent = parent.parent;
          }
        }
        if (
          !attrs.has("aria-busy") &&
          (sharedControls.has(name) || !explanation)
        ) {
          fail(
            "disabled necesita aria-busy; una restricción necesita un motivo asociado",
          );
        }
      }
      if (!primitive && active(attrs.get("aria-disabled"))) {
        fail("usa el control compartido con unavailable y su motivo visible");
      }
      if (
        !primitive &&
        active(attrs.get("readOnly")) &&
        !attrs.has("readOnlyReason")
      ) {
        fail("el valor copiable necesita readOnlyReason");
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  return problems;
}

function files(folder: string): string[] {
  return readdirSync(folder, { withFileTypes: true }).flatMap((entry) => {
    const path = join(folder, entry.name);
    return entry.isDirectory()
      ? files(path)
      : /\.tsx$/.test(entry.name) && !/\.(test|spec)\./.test(entry.name)
        ? [path]
        : [];
  });
}

it("detecta controles bloqueados sin explicación, incluidos los nativos y las opciones", () => {
  expect(
    violations(
      `<><Button disabled /><button disabled /><Input readOnly /><fieldset disabled /><select><option disabled>Una opción</option></select><Button aria-disabled /></>`,
      "pages/Example.tsx",
    ),
  ).toHaveLength(6);
  expect(
    violations(
      `<><Button disabled={busy} aria-busy={busy} /><Button unavailable={{reason: "Elige un tema."}} /><Input readOnly readOnlyReason="Copia este enlace." /><fieldset disabled={locked} aria-describedby="reason" /><Select hint="La opción ya elegida no se puede repetir."><option disabled>Elegida</option></Select></>`,
      "pages/Example.tsx",
    ),
  ).toEqual([]);
});

it("todas las pantallas declaran espera o motivo; las pruebas de interacción comprueban su asociación y bloqueo", () => {
  const production = files(root);
  expect(production.length).toBeGreaterThan(50);
  expect(
    production.flatMap((path) =>
      violations(readFileSync(path, "utf8"), relative(root, path)),
    ),
  ).toEqual([]);
});
