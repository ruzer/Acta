import { expect, it } from "vitest";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

const root = process.cwd();
const folder = "docs/ayuda";
const names = [
  "README.md",
  "GLOSARIO.md",
  "SOLUCION-DE-PROBLEMAS.md",
  "PREGUNTAS-FRECUENTES.md",
];
const read = (path: string) => readFileSync(path, "utf8");
const compact = (s: string) => s.replace(/\s+/g, " ").trim();
function sources(path: string): string[] {
  return readdirSync(path, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? sources(join(path, entry.name))
      : /\.tsx?$/.test(entry.name) && !/\.test\.|^Help\.tsx$/.test(entry.name)
        ? [compact(read(join(path, entry.name)))]
        : [],
  );
}
const code = ["app/frontend/src", "app/backend/src", "packages/contracts/src"]
  .flatMap(sources)
  .join("\n");
const docs = () =>
  names.map((name) => ({
    path: join(folder, name),
    text: read(join(folder, name)),
  }));
const links = (text: string) =>
  [...text.matchAll(/\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)].map(
    (m) => m[1],
  );
function anchors(text: string) {
  const seen = new Map<string, number>();
  return [...text.matchAll(/^#{1,6}\s+(.+?)\s*#*$/gm)].map((m) => {
    const base = m[1]
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\p{M}_\-\s]/gu, "")
      .replace(/\s/g, "-");
    const n = seen.get(base) ?? 0;
    seen.set(base, n + 1);
    return n ? `${base}-${n}` : base;
  });
}
function checkLink(path: string, link: string) {
  const prefix = "https://github.com/ruzer/Acta/blob/main/";
  if (/^[a-z]+:/i.test(link) && !link.startsWith(prefix)) return;
  const [file, anchor] = decodeURIComponent(link).split("#");
  const target = link.startsWith(prefix)
    ? resolve(root, file.slice(prefix.length))
    : resolve(dirname(path), file || path.split("/").at(-1)!);
  expect(existsSync(target), `${path}: archivo inexistente ${link}`).toBe(true);
  if (anchor)
    expect(
      anchors(read(target)),
      `${path}: ancla inexistente ${link}`,
    ).toContain(anchor);
}
it("a: las etiquetas de pantalla y botón en negritas existen en el producto, sin usar la ayuda como fuente", () => {
  let count = 0;
  for (const { path, text } of docs())
    for (const match of text.matchAll(/\*\*([^*]+)\*\*/g)) {
      count++;
      expect(
        code.includes(compact(match[1])),
        `${path}: etiqueta ${match[1]}`,
      ).toBe(true);
    }
  expect(count).toBeGreaterThan(0);
});
it("b: los 15 a 25 mensajes citados de problemas existen literalmente en el producto", () => {
  const text = read(`${folder}/SOLUCION-DE-PROBLEMAS.md`);
  const messages = [...text.matchAll(/«([^»]+)»/g)];
  expect(messages.length).toBeGreaterThanOrEqual(15);
  expect(messages.length).toBeLessThanOrEqual(25);
  for (const [, message] of messages)
    expect(code.includes(compact(message)), message).toBe(true);
});
it("c: todos los enlaces locales y anclas de ayuda y del mapa para IA resuelven", () => {
  for (const { path, text } of [
    ...docs(),
    { path: "llms.txt", text: read("llms.txt") },
  ]) {
    const found = links(text);
    expect(found.length, path).toBeGreaterThan(0);
    for (const link of found) checkLink(path, link);
  }
});
it("d: el FAQ enlaza términos existentes, los índices incluyen los cuatro documentos y la ayuda pesa menos de 60 kB", () => {
  const glossary = read(`${folder}/GLOSARIO.md`);
  const terms = [...glossary.matchAll(/^### /gm)].length;
  expect(terms).toBeGreaterThanOrEqual(20);
  expect(terms).toBeLessThanOrEqual(30);
  const faq = read(`${folder}/PREGUNTAS-FRECUENTES.md`);
  const linkedTerms = links(faq).filter((link) =>
    link.startsWith("GLOSARIO.md#"),
  );
  expect(linkedTerms.length).toBeGreaterThan(0);
  for (const link of linkedTerms)
    checkLink(`${folder}/PREGUNTAS-FRECUENTES.md`, link);
  const index = links(read(`${folder}/README.md`));
  const map = links(read("llms.txt"));
  expect(readdirSync(folder).sort()).toEqual([...names].sort());
  for (const name of names) {
    expect(index).toContain(name);
    expect(map).toContain(
      `https://github.com/ruzer/Acta/blob/main/${folder}/${name}`,
    );
  }
  expect(
    docs().reduce((sum, { text }) => sum + Buffer.byteLength(text), 0),
  ).toBeLessThan(60000);
});
it("e: la ayuda no reintroduce vocabulario retirado", () => {
  for (const { path, text } of docs())
    expect(text, path).not.toMatch(/membresía|Importar estructura/iu);
});
it("f: las entradas son autocontenidas, el FAQ declara audiencia y enlaza sin copiar pasos", () => {
  for (const file of ["PREGUNTAS-FRECUENTES.md", "SOLUCION-DE-PROBLEMAS.md"]) {
    const entries = read(`${folder}/${file}`).split(/^### /m).slice(1);
    expect(entries.length).toBeGreaterThan(0);
    for (const entry of entries) {
      const body = entry
        .split("\n")
        .slice(1)
        .join("\n")
        .replace(/^Aplica a:.*$/m, "")
        .trim();
      expect(body).not.toMatch(/^(?:Lo anterior|Como se dijo|Ver arriba)/i);
      if (file.startsWith("PREGUNTAS")) {
        expect(entry).toMatch(/^Aplica a: .+/m);
        expect(entry).toMatch(/^Más información: \[/m);
        expect(entry).not.toMatch(/^\d+\. /m);
      }
    }
    if (file.startsWith("PREGUNTAS")) {
      expect(entries.length).toBeGreaterThanOrEqual(20);
      expect(entries.length).toBeLessThanOrEqual(30);
    }
  }
});
