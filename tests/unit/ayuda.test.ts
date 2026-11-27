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

it("los motivos del editor y la forma de continuar coinciden en ayuda y guías", () => {
  for (const path of [
    "app/frontend/src/pages/Help.tsx",
    "docs/ayuda/SOLUCION-DE-PROBLEMAS.md",
    "docs/QUESTIONNAIRE-EDITOR-INTEGRATION.md",
    "README.md",
  ]) {
    const content = compact(read(path));
    for (const text of [
      "Editar tema",
      "búsqueda",
      "área activa",
      "pregunta archivada",
      "Cambiar de tema",
    ])
      expect(content, `${path}: ${text}`).toContain(text);
  }
  for (const message of [
    "Su nombre y descripción están protegidos porque el tema tiene preguntas publicadas o archivadas.",
    "Con una búsqueda activa se muestran todos los grupos desplegados. Limpia la búsqueda para contraerlos.",
    "Para crear preguntas hace falta al menos un área activa. Pide a la administración de la institución que la active en Administración.",
  ])
    expect(code).toContain(message);
});
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
function attributesReviewToAdministration(text: string) {
  const content = compact(
    text
      .normalize("NFD")
      .replace(/\p{M}/gu, "")
      .replace(/<[^<>]*>|\{\s*" "\s*\}|[*_`]/g, " "),
  );
  const subject =
    "\\badministracion(?: del proyecto)?(?: [yo] (?:el (?:perfil|equipo) )?analista(?: del proyecto)?)? (?:pueden? )?";
  const clarification =
    "(?:pedir|piden?|solicit(?:ar|an?)) (?:una |las? )?aclaracion(?:es)?(?: al participante\\b|(?=\\s*(?:[.!?;,:]|$)))";
  const decision =
    "(?:registr(?:ar|an?) (?:una |las? )?decision(?:es)?\\b|decid(?:ir|en?)(?: (?:sobre )?(?:las? |sus |una )?(?:respuestas?|aportacion(?:es)?|decision(?:es)?)\\b|(?=\\s*(?:[.!?;,:]|$))))";
  const review = `revis(?:ar|an?)(?: (?:las? |sus |una )?(?:respuestas?|aportacion(?:es)?)\\b| y ${decision}|(?=\\s*(?:[.!?;,:]|$)))`;
  // shortcut: reconoce sujeto y acción explícitos; ampliar los casos si cambia esa redacción.
  return new RegExp(
    `${subject}(?:${review}|${clarification}|${decision})`,
    "i",
  ).test(content);
}
it.each([
  "Administración revisa.",
  "Administración puede registrar decisiones.",
  "Administración del proyecto solicita aclaraciones.",
  "Administración puede revisar respuestas.",
  "Analista y Administración pueden decidir.",
  "<p><strong>Administración</strong> puede pedir aclaraciones.</p>",
  "Administración o Analista pueden pedir aclaraciones.",
  "Analista o Administración del proyecto pueden revisar respuestas.",
  "Analista y Administración del proyecto registran decisiones.",
  "Administración puede revisar y decidir.",
  "Administración y el equipo analista pueden registrar decisiones.",
  "Administración decide sobre la respuesta.",
  "Administración solicita una aclaración al participante.",
])("g: detecta la atribución incorrecta: %s", (text) => {
  expect(attributesReviewToAdministration(text)).toBe(true);
});
it.each([
  "Administración no revisa.",
  "Administración no puede registrar decisiones.",
  "Administración o Analista no pueden pedir aclaraciones.",
  "Administración no pide aclaraciones ni registra decisiones.",
  "Solo el perfil Analista puede pedir aclaraciones y registrar decisiones.",
  "Administración consulta las respuestas; solo el perfil Analista puede revisarlas.",
  "Analista y Administración del proyecto pueden consultar el informe. Solo el perfil Analista registra decisiones.",
  "Administración revisa el acceso al proyecto.",
  "Administración puede revisar el archivo antes de importarlo.",
  "Administración del proyecto debe revisar dónde corresponde cargarlo.",
  "Administración puede consultar decisiones.",
  "Administración prepara preguntas; Analista revisa respuestas.",
  "Administración decide la fecha límite del proyecto.",
  "Administración decide quién participa.",
  "Administración puede decidir si publica las preguntas.",
  "Administración solicita una aclaración a Sistemas sobre el servidor.",
  "Administración puede revisar y decidir la fecha límite del proyecto.",
])("g: acepta los permisos correctos: %s", (text) => {
  expect(attributesReviewToAdministration(text)).toBe(false);
});
it("g: las guías no atribuyen revisión a Administración del proyecto", () => {
  const paths = [
    ...docs().map(({ path }) => path),
    ...readdirSync("docs/pilot")
      .filter((name) => name.endsWith(".md"))
      .map((name) => join("docs/pilot", name)),
    "app/frontend/src/pages/Help.tsx",
  ];
  for (const path of paths)
    expect(attributesReviewToAdministration(read(path)), path).toBe(false);
});

it("el error de guardado en ayuda y guía explica la causa y conserva el texto sin afirmar que se guardó", () => {
  for (const path of [
    "app/frontend/src/pages/Help.tsx",
    "docs/pilot/GUIA-PARTICIPANTE.md",
    `${folder}/SOLUCION-DE-PROBLEMAS.md`,
  ]) {
    const content = compact(read(path));
    expect(content, path).toContain("No se pudo guardar:");
    expect(content, path).toContain("Tu texto sigue aquí");
    expect(content, path).not.toContain(
      "No se pudo guardar. Tu texto sigue aquí",
    );
  }
});

it("la ayuda explica que Deshacer retira Por consultar, conserva el borrador y dura ocho segundos", () => {
  for (const path of [
    "app/frontend/src/pages/Help.tsx",
    "docs/pilot/GUIA-PARTICIPANTE.md",
    `${folder}/PREGUNTAS-FRECUENTES.md`,
  ]) {
    const content = compact(read(path));
    expect(content, path).toContain("Necesito consultar esto");
    expect(content, path).toContain("Por consultar");
    expect(content, path).toContain("Deshacer");
    expect(content, path).toContain("ocho segundos");
    expect(content, path).toContain("borrador se conserva");
  }
});

it("la ayuda y la guía aclaran que No aplica queda fuera del avance", () => {
  for (const path of [
    "app/frontend/src/pages/Help.tsx",
    "docs/pilot/GUIA-PARTICIPANTE.md",
    `${folder}/PREGUNTAS-FRECUENTES.md`,
  ]) {
    const content = compact(read(path));
    expect(content, path).toContain("No aplica");
    expect(content, path).toMatch(/no cuenta|fuera del avance/);
  }
  const faq = read(`${folder}/PREGUNTAS-FRECUENTES.md`);
  expect(faq).toContain("Borradores sin enviar");
  expect(faq).toContain("Pendientes sin borrador");
  expect(faq).toContain("no se cuenta dos veces");
});

it("el cierre de la guía explica límites y contadores en una página con ocho pasos", () => {
  for (const path of [
    "app/frontend/src/pages/Help.tsx",
    "docs/pilot/GUIA-PARTICIPANTE.md",
  ]) {
    const text = compact(read(path));
    expect(text, path).toContain("límites y el contador");
  }
  const guide = read("docs/pilot/GUIA-PARTICIPANTE.md");
  expect(guide.trim().split(/\s+/).length).toBeLessThanOrEqual(350);
  expect([...guide.matchAll(/^\d+\. /gm)]).toHaveLength(8);
  const faq = read(`${folder}/PREGUNTAS-FRECUENTES.md`);
  expect(faq).toContain("Cambios sin guardar");
  expect(faq).toContain("Guardando…");
  expect(faq).toContain("Tienes cambios sin guardar");
});

it("la ayuda y la guía ubican el plazo disponible por proyecto en Hola y permiten responder después", () => {
  for (const path of [
    "app/frontend/src/pages/Help.tsx",
    "docs/pilot/GUIA-PARTICIPANTE.md",
    `${folder}/PREGUNTAS-FRECUENTES.md`,
  ]) {
    const text = compact(read(path));
    expect(text, path).toContain("Hola");
    expect(text, path).toContain("cada proyecto");
    expect(text, path).toContain("si está disponible");
    expect(text, path).toContain(
      "Puedes seguir respondiendo después del plazo",
    );
  }
});

it("la ayuda explica los controles no disponibles y conserva la copia de valores de solo lectura", () => {
  for (const file of [
    "app/frontend/src/pages/Help.tsx",
    "docs/ayuda/SOLUCION-DE-PROBLEMAS.md",
  ]) {
    const text = compact(read(file));
    expect(text).toContain("primera o última página");
    expect(text).toContain("operación en curso");
    expect(text).toContain("copiar");
  }
});

it("el aviso tras cambiar de tema explica cómo encontrar la pregunta", () => {
  for (const path of [
    "README.md",
    "docs/QUESTIONNAIRE-EDITOR-INTEGRATION.md",
    "docs/ayuda/SOLUCION-DE-PROBLEMAS.md",
    "app/frontend/src/pages/Help.tsx",
  ]) {
    expect(readFileSync(path, "utf8")).toContain("Ver");
  }
});

it("la ayuda describe apertura, acciones y recorrido del panel compartido", () => {
  for (const path of [
    "README.md",
    "docs/QUESTIONNAIRE-EDITOR-INTEGRATION.md",
    "docs/ayuda/SOLUCION-DE-PROBLEMAS.md",
    "app/frontend/src/pages/Help.tsx",
  ]) {
    const text = compact(read(path));
    for (const label of [
      "Escribir",
      "Organizar",
      "Cambiar de tema",
      "Más acciones",
      "Pregunta anterior",
      "Pregunta siguiente",
      "Primero aparecen la pregunta y sus opciones",
      "La acción principal y Más acciones permanecen al pie",
      "sin estrecharla",
      "Contenido",
      "Respuestas",
      "Escape",
    ])
      expect(text, path).toContain(label);
  }
});

it("la ayuda explica el aviso de traslado singular y plural", () => {
  for (const path of [
    "README.md",
    "docs/QUESTIONNAIRE-EDITOR-INTEGRATION.md",
    "docs/ayuda/SOLUCION-DE-PROBLEMAS.md",
    "app/frontend/src/pages/Help.tsx",
  ]) {
    const text = compact(read(path));
    expect(text, path).toContain("su único seguimiento");
    expect(text, path).toContain("muestra sus nombres");
  }
});
